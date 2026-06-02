'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCourse } from '@/lib/db/courses'
import {
  createSource,
  deleteSource,
} from '@/lib/db/sources'
import {
  ingestPdf,
  ingestText,
  inferKindFromMime,
  MAX_UPLOAD_BYTES,
} from '@/lib/ingest'

const COURSE_STORAGE_BUCKET = 'course-uploads'

const courseIdSchema = z.object({ courseId: z.string().uuid() })

const textSchema = z.object({
  courseId: z.string().uuid(),
  filename: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null)),
  text: z.string().min(1, 'Paste some text first').max(2_000_000),
})

const deleteSchema = z.object({
  courseId: z.string().uuid(),
  sourceId: z.string().uuid(),
})

async function requireUserAndCourse(courseId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const course = await getCourse(supabase, user!.id, courseId)
  if (!course) redirect('/')
  return { supabase, user: user!, course: course! }
}

function ingestRedirect(
  courseId: string,
  status: 'ok' | 'err',
  detail?: string,
) {
  const params = new URLSearchParams({ status })
  if (detail) params.set('detail', detail)
  redirect(`/courses/${courseId}/ingest?${params.toString()}`)
}

export async function ingestTextAction(formData: FormData) {
  const parsed = textSchema.safeParse({
    courseId: formData.get('courseId'),
    filename: formData.get('filename') ?? undefined,
    text: formData.get('text'),
  })
  if (!parsed.success) {
    const courseId = String(formData.get('courseId') ?? '')
    ingestRedirect(
      courseId,
      'err',
      parsed.error.issues[0]?.message ?? 'Invalid input',
    )
  }

  const { supabase, user } = await requireUserAndCourse(parsed.data!.courseId)
  const result = ingestText({
    text: parsed.data!.text,
    filename: parsed.data!.filename,
  })

  await createSource(supabase, {
    userId: user.id,
    courseId: parsed.data!.courseId,
    kind: result.kind,
    filename: result.filename,
    storagePath: null,
    rawText: result.rawText,
    tokenCount: result.tokenCount,
  })

  revalidatePath(`/courses/${parsed.data!.courseId}`)
  revalidatePath(`/courses/${parsed.data!.courseId}/ingest`)
  ingestRedirect(
    parsed.data!.courseId,
    'ok',
    `Added note (≈${result.tokenCount.toLocaleString()} tokens)`,
  )
}

export async function ingestFileAction(formData: FormData) {
  const courseIdRaw = String(formData.get('courseId') ?? '')
  if (!courseIdSchema.safeParse({ courseId: courseIdRaw }).success) {
    redirect('/')
  }
  const courseId = courseIdRaw

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    ingestRedirect(courseId, 'err', 'Pick a file first')
  }
  const uploaded = file as File

  if (uploaded.size > MAX_UPLOAD_BYTES) {
    ingestRedirect(
      courseId,
      'err',
      `File too large (${(uploaded.size / 1024 / 1024).toFixed(1)} MB > 25 MB)`,
    )
  }

  const kind = inferKindFromMime(uploaded.type)
  if (kind !== 'pdf' && kind !== 'text') {
    ingestRedirect(
      courseId,
      'err',
      `Unsupported file type: ${uploaded.type || 'unknown'}. PDF and text only for now.`,
    )
  }

  const { supabase, user } = await requireUserAndCourse(courseId)

  const buffer = await uploaded.arrayBuffer()

  // Path: <uid>/<course_id>/<timestamp>-<safe-name>
  const safeName = uploaded.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100)
  const storagePath = `${user.id}/${courseId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(COURSE_STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: uploaded.type || 'application/octet-stream',
      upsert: false,
    })
  if (uploadError) {
    ingestRedirect(courseId, 'err', `Upload failed: ${uploadError.message}`)
  }

  let rawText = ''
  let tokenCount = 0
  try {
    if (kind === 'pdf') {
      const result = await ingestPdf({
        buffer,
        filename: uploaded.name,
      })
      rawText = result.rawText
      tokenCount = result.tokenCount
    } else {
      // text/*
      const result = ingestText({
        text: new TextDecoder().decode(buffer),
        filename: uploaded.name,
      })
      rawText = result.rawText
      tokenCount = result.tokenCount
    }
  } catch (error: unknown) {
    // Roll back the stored file if parsing failed.
    await supabase.storage.from(COURSE_STORAGE_BUCKET).remove([storagePath])
    const message = error instanceof Error ? error.message : 'Parse error'
    ingestRedirect(courseId, 'err', `Could not parse file: ${message}`)
  }

  await createSource(supabase, {
    userId: user.id,
    courseId,
    kind: kind!,
    filename: uploaded.name,
    storagePath,
    rawText,
    tokenCount,
  })

  revalidatePath(`/courses/${courseId}`)
  revalidatePath(`/courses/${courseId}/ingest`)
  ingestRedirect(
    courseId,
    'ok',
    `Added ${uploaded.name} (≈${tokenCount.toLocaleString()} tokens)`,
  )
}

export async function deleteSourceAction(formData: FormData) {
  const parsed = deleteSchema.safeParse({
    courseId: formData.get('courseId'),
    sourceId: formData.get('sourceId'),
  })
  if (!parsed.success) redirect('/')

  const { supabase, user } = await requireUserAndCourse(parsed.data!.courseId)
  const { storagePath } = await deleteSource(
    supabase,
    user.id,
    parsed.data!.sourceId,
  )

  if (storagePath) {
    await supabase.storage.from(COURSE_STORAGE_BUCKET).remove([storagePath])
  }

  revalidatePath(`/courses/${parsed.data!.courseId}`)
  revalidatePath(`/courses/${parsed.data!.courseId}/ingest`)
  ingestRedirect(parsed.data!.courseId, 'ok', 'Removed')
}
