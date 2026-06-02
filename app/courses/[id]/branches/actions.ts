'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCourse } from '@/lib/db/courses'
import { createBranch, getBranch, setBranchStatus } from '@/lib/db/branches'
import { createMessage, listMessages } from '@/lib/db/messages'
import { getOutlineTree } from '@/lib/db/outline'
import { findNodeWithPath } from '@/lib/outline/tree-utils'
import {
  getProviderForUser,
  loadCredential,
  PROVIDER_LABELS,
} from '@/lib/providers'

const createSchema = z.object({
  courseId: z.string().uuid(),
  nodeId: z.string().uuid(),
  question: z
    .string()
    .trim()
    .min(1, 'Type a question first')
    .max(4000, 'Question is too long'),
})

const closeSchema = z.object({
  courseId: z.string().uuid(),
  branchId: z.string().uuid(),
})

function statusRedirect(
  courseId: string,
  nodeId: string,
  status: 'ok' | 'err',
  detail?: string,
  branchId?: string,
) {
  const params = new URLSearchParams({ node: nodeId, status })
  if (detail) params.set('detail', detail)
  if (branchId) params.set('branch', branchId)
  redirect(`/courses/${courseId}?${params.toString()}`)
}

function deriveTitle(question: string): string {
  const trimmed = question.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= 60) return trimmed
  return trimmed.slice(0, 57) + '…'
}

export async function createBranchAction(formData: FormData) {
  const parsed = createSchema.safeParse({
    courseId: formData.get('courseId'),
    nodeId: formData.get('nodeId'),
    question: formData.get('question'),
  })
  if (!parsed.success) {
    const courseId = String(formData.get('courseId') ?? '')
    const nodeId = String(formData.get('nodeId') ?? '')
    statusRedirect(
      courseId,
      nodeId,
      'err',
      parsed.error.issues[0]?.message ?? 'Invalid input',
    )
  }

  const { courseId, nodeId, question } = parsed.data!

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const course = await getCourse(supabase, user.id, courseId)
  if (!course) {
    statusRedirect(courseId, nodeId, 'err', 'Course not found')
  }

  // Verify node belongs to this course (cheap RLS-safe read).
  const { data: nodeRow, error: nodeErr } = await supabase
    .from('outline_nodes')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('id', nodeId)
    .maybeSingle()
  if (nodeErr || !nodeRow) {
    statusRedirect(courseId, nodeId, 'err', 'Node not found in this course')
  }

  const cred = await loadCredential(
    supabase,
    user.id,
    course!.default_provider,
  )
  if (!cred) {
    statusRedirect(
      courseId,
      nodeId,
      'err',
      `${PROVIDER_LABELS[course!.default_provider]} isn't configured. Open Settings → Providers.`,
    )
  }

  const branch = await createBranch(supabase, {
    userId: user.id,
    nodeId,
    title: deriveTitle(question),
    provider: course!.default_provider,
    model: cred!.model,
  })

  await createMessage(supabase, {
    userId: user.id,
    branchId: branch.id,
    role: 'user',
    content: question,
  })

  revalidatePath(`/courses/${courseId}`)
  statusRedirect(courseId, nodeId, 'ok', 'Branch opened', branch.id)
}

export async function abandonBranchAction(formData: FormData) {
  const parsed = closeSchema.safeParse({
    courseId: formData.get('courseId'),
    branchId: formData.get('branchId'),
  })
  if (!parsed.success) redirect('/')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const branch = await getBranch(supabase, user.id, parsed.data!.branchId)
  if (!branch) redirect(`/courses/${parsed.data!.courseId}`)

  await setBranchStatus(
    supabase,
    user.id,
    parsed.data!.branchId,
    'abandoned',
  )

  revalidatePath(`/courses/${parsed.data!.courseId}`)
  redirect(
    `/courses/${parsed.data!.courseId}?node=${branch.node_id}&status=ok&detail=${encodeURIComponent('Branch abandoned')}`,
  )
}

export async function mergeBranchAction(formData: FormData) {
  const parsed = closeSchema.safeParse({
    courseId: formData.get('courseId'),
    branchId: formData.get('branchId'),
  })
  if (!parsed.success) redirect('/')

  const { courseId, branchId } = parsed.data!

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const branch = await getBranch(supabase, user.id, branchId)
  if (!branch) redirect(`/courses/${courseId}`)

  function backToBranch(status: 'ok' | 'err', detail: string) {
    redirect(
      `/courses/${courseId}?node=${branch!.node_id}&branch=${branchId}&status=${status}&detail=${encodeURIComponent(detail)}`,
    )
  }

  if (branch.status !== 'open') {
    backToBranch('err', 'Branch is already closed')
  }

  const course = await getCourse(supabase, user.id, courseId)
  if (!course) backToBranch('err', 'Course not found')

  const provider = await getProviderForUser(supabase, user.id, branch.provider)
  if (!provider) {
    backToBranch(
      'err',
      `${PROVIDER_LABELS[branch.provider]} isn't configured. Open Settings → Providers.`,
    )
  }

  const [messages, outlineTree] = await Promise.all([
    listMessages(supabase, user.id, branchId),
    getOutlineTree(supabase, user.id, courseId),
  ])

  if (messages.length === 0) {
    backToBranch('err', 'Nothing to merge — no messages yet.')
  }

  const located = findNodeWithPath(outlineTree, branch.node_id)
  if (!located) backToBranch('err', 'Node no longer exists.')

  let summary = ''
  try {
    summary = await provider!.summarizeBranch({
      branchTitle: branch.title,
      node: {
        title: located!.node.title,
        summary: located!.node.summary_md ?? null,
        path: located!.path.map((p) => p.title),
      },
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })
  } catch (error: unknown) {
    const detail =
      error instanceof Error ? error.message : 'Summary generation failed'
    backToBranch('err', detail)
  }

  await setBranchStatus(supabase, user.id, branchId, 'merged', summary)

  revalidatePath(`/courses/${courseId}`)
  backToBranch('ok', 'Merged into outline.')
}
