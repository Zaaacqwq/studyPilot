import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBranch } from '@/lib/db/branches'
import { getCourse } from '@/lib/db/courses'
import { listSources } from '@/lib/db/sources'
import { getOutlineTree } from '@/lib/db/outline'
import { createMessage, listMessages } from '@/lib/db/messages'
import { getProviderForUser } from '@/lib/providers'
import { findNodeWithPath } from '@/lib/outline/tree-utils'

// Streaming chat completion is long-running; default Node runtime is fine.
// Max 5 min on Vercel hobby; should be more than enough per turn.
export const maxDuration = 300

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: branchId } = await params

  let body: { content?: string } = {}
  try {
    body = (await request.json()) as { content?: string }
  } catch {
    /* allow empty body — used to resume an unanswered user turn */
  }
  const content =
    typeof body.content === 'string' && body.content.trim().length > 0
      ? body.content.trim()
      : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const branch = await getBranch(supabase, user.id, branchId)
  if (!branch) return new Response('Branch not found', { status: 404 })
  if (branch.status !== 'open') {
    return new Response('Branch is closed', { status: 400 })
  }

  // Resolve node, then its course.
  const { data: nodeRow, error: nodeErr } = await supabase
    .from('outline_nodes')
    .select('id, course_id, title, summary_md')
    .eq('user_id', user.id)
    .eq('id', branch.node_id)
    .maybeSingle()
  if (nodeErr || !nodeRow) {
    return new Response('Node not found', { status: 404 })
  }

  const course = await getCourse(supabase, user.id, nodeRow.course_id)
  if (!course) return new Response('Course not found', { status: 404 })

  const provider = await getProviderForUser(supabase, user.id, branch.provider)
  if (!provider) {
    return new Response('Provider not configured', { status: 400 })
  }

  // Save the new user message before loading history so the model sees it.
  if (content) {
    await createMessage(supabase, {
      userId: user.id,
      branchId,
      role: 'user',
      content,
    })
  }

  const [history, sources, outlineTree] = await Promise.all([
    listMessages(supabase, user.id, branchId),
    listSources(supabase, user.id, course.id),
    getOutlineTree(supabase, user.id, course.id),
  ])

  // History must end with a user turn — otherwise there's nothing to respond to.
  const lastMessage = history.at(-1)
  if (!lastMessage || lastMessage.role !== 'user') {
    return new Response('Nothing to respond to (last message is not a user turn)', {
      status: 400,
    })
  }

  // Build node path for breadcrumb hint.
  const located = findNodeWithPath(outlineTree, branch.node_id)
  const pathTitles = located
    ? located.path.map((n) => n.title)
    : [nodeRow.title]

  const args = {
    course: {
      title: course.title,
      description: course.description ?? null,
    },
    node: {
      title: nodeRow.title,
      summary: nodeRow.summary_md ?? null,
      path: pathTitles,
    },
    sources: sources.map((s) => ({
      kind: s.kind,
      filename: s.filename ?? undefined,
      text: s.raw_text ?? undefined,
    })),
    history: history.map((m) => ({ role: m.role, content: m.content })),
  }

  const encoder = new TextEncoder()
  let assistantText = ''

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of provider.streamChat(args)) {
          assistantText += chunk
          controller.enqueue(encoder.encode(chunk))
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error'
        const tail = `\n\n[stream error: ${message}]`
        assistantText += tail
        controller.enqueue(encoder.encode(tail))
      } finally {
        // Persist whatever was accumulated. Empty replies still record a row
        // (rare) so the conversation timeline doesn't have a dangling user msg.
        try {
          await createMessage(supabase, {
            userId: user.id,
            branchId,
            role: 'assistant',
            content: assistantText || '(empty response)',
          })
        } catch {
          /* swallow — we've already streamed the chunks */
        }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
