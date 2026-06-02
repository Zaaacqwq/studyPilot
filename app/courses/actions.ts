'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getProviderForUser, PROVIDER_IDS, PROVIDER_LABELS } from '@/lib/providers'
import {
  createCourse,
  deleteCourse,
  getCourse,
  updateCourse,
} from '@/lib/db/courses'
import { listSources } from '@/lib/db/sources'
import { replaceOutline } from '@/lib/db/outline'
import type { ProviderId, SourceDocument } from '@/lib/db/types'
import type { SourceDocPayload } from '@/lib/providers/types'

const providerSchema = z.enum(PROVIDER_IDS as unknown as [ProviderId, ...ProviderId[]])

const createSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : null)),
  defaultProvider: providerSchema,
})

const updateSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : null)),
  defaultProvider: providerSchema,
})

const deleteSchema = z.object({ courseId: z.string().uuid() })

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user: user! }
}

export async function createCourseAction(formData: FormData) {
  const parsed = createSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') ?? undefined,
    defaultProvider: formData.get('defaultProvider'),
  })

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid input'
    redirect(`/?error=${encodeURIComponent(msg)}`)
  }

  const { supabase, user } = await requireUser()
  const course = await createCourse(supabase, {
    userId: user.id,
    title: parsed.data!.title,
    description: parsed.data!.description,
    defaultProvider: parsed.data!.defaultProvider,
  })

  revalidatePath('/')
  redirect(`/courses/${course.id}`)
}

export async function updateCourseAction(formData: FormData) {
  const parsed = updateSchema.safeParse({
    courseId: formData.get('courseId'),
    title: formData.get('title'),
    description: formData.get('description') ?? undefined,
    defaultProvider: formData.get('defaultProvider'),
  })

  if (!parsed.success) {
    const id = String(formData.get('courseId') ?? '')
    const msg = parsed.error.issues[0]?.message ?? 'Invalid input'
    redirect(`/courses/${id}?error=${encodeURIComponent(msg)}`)
  }

  const { supabase, user } = await requireUser()
  await updateCourse(supabase, user.id, parsed.data!.courseId, {
    title: parsed.data!.title,
    description: parsed.data!.description,
    defaultProvider: parsed.data!.defaultProvider,
  })

  revalidatePath('/')
  revalidatePath(`/courses/${parsed.data!.courseId}`)
  redirect(`/courses/${parsed.data!.courseId}?saved=1`)
}

export async function deleteCourseAction(formData: FormData) {
  const parsed = deleteSchema.safeParse({ courseId: formData.get('courseId') })
  if (!parsed.success) redirect('/')

  const { supabase, user } = await requireUser()
  await deleteCourse(supabase, user.id, parsed.data!.courseId)

  revalidatePath('/')
  redirect('/')
}

const generateSchema = z.object({ courseId: z.string().uuid() })

function sourceToPayload(s: SourceDocument): SourceDocPayload {
  return {
    kind: s.kind,
    filename: s.filename ?? undefined,
    text: s.raw_text ?? undefined,
  }
}

function outlineStatusRedirect(
  courseId: string,
  status: 'ok' | 'err',
  detail?: string,
) {
  const params = new URLSearchParams({ status })
  if (detail) params.set('detail', detail)
  redirect(`/courses/${courseId}?${params.toString()}`)
}

export async function generateOutlineAction(formData: FormData) {
  const parsed = generateSchema.safeParse({
    courseId: formData.get('courseId'),
  })
  if (!parsed.success) redirect('/')

  const courseId = parsed.data!.courseId
  const { supabase, user } = await requireUser()

  const course = await getCourse(supabase, user.id, courseId)
  if (!course) outlineStatusRedirect(courseId, 'err', 'Course not found')

  const sources = await listSources(supabase, user.id, courseId)
  if (sources.length === 0) {
    outlineStatusRedirect(
      courseId,
      'err',
      'Add at least one note before generating an outline.',
    )
  }

  const provider = await getProviderForUser(
    supabase,
    user.id,
    course!.default_provider,
  )
  if (!provider) {
    outlineStatusRedirect(
      courseId,
      'err',
      `${PROVIDER_LABELS[course!.default_provider]} isn't configured. Open Settings → Providers.`,
    )
  }

  // Run the work inside try/catch — but DO NOT call redirect() inside the
  // try block. Next.js implements redirect() by throwing a NEXT_REDIRECT
  // error; catching it here would mis-classify a successful redirect as a
  // failure. Stage the outcome and redirect once after the catch.
  let outcome: { status: 'ok' | 'err'; detail: string }
  try {
    const tree = await provider!.generateOutline({
      course: {
        title: course!.title,
        description: course!.description ?? null,
      },
      sources: sources.map(sourceToPayload),
    })
    const inserted = await replaceOutline(supabase, user.id, courseId, tree)
    revalidatePath(`/courses/${courseId}`)
    outcome = {
      status: 'ok',
      detail: `Outline generated (${inserted} node${inserted === 1 ? '' : 's'}).`,
    }
  } catch (error: unknown) {
    outcome = {
      status: 'err',
      detail:
        error instanceof Error ? error.message : 'Outline generation failed',
    }
  }
  outlineStatusRedirect(courseId, outcome.status, outcome.detail)
}
