import type {
  ChatMessage,
  CourseSummary,
  NodeContext,
  SourceDocPayload,
} from '@/lib/providers/types'

const PROMPT_BASE = `You are StudyPilot — a focused study companion. The student opened a branch to ask questions about ONE specific node of their course outline.

Rules:
- Stay anchored to the focus node. Don't drift across topics. If the question wanders, gently anchor back to the node.
- Ground every claim in the source notes when possible. If the notes don't cover something, say so and answer from general knowledge briefly.
- Be concrete: use the lecture's terminology, code samples, examples, formulas. When useful, quote short lines from the notes verbatim.
- Match the student's language (Mandarin / English / mixed) — mirror their phrasing.
- Concise > verbose. Aim for the answer the student needs, not a textbook re-derivation. Use code fences and bullet lists where they help readability.`

export interface BuildChatContextArgs {
  course: CourseSummary
  node: NodeContext
  sources: SourceDocPayload[]
  /** Optional cap on chars per source to keep prompts tractable. */
  maxCharsPerSource?: number
}

/**
 * Returns the focus-node block (rules + course/node context, no source notes).
 * Used by every provider as part of the system prompt.
 */
export function buildChatFocusBlock(args: BuildChatContextArgs): string {
  const { course, node } = args
  const lines: string[] = []
  lines.push(PROMPT_BASE)
  lines.push('')
  lines.push('=== FOCUS NODE ===')
  lines.push(`Course: ${course.title}`)
  if (course.description) lines.push(`Course note: ${course.description}`)
  if (node.path.length > 0) {
    lines.push(`Outline path: ${node.path.join(' › ')}`)
  }
  lines.push(`Focus node: ${node.title}`)
  if (node.summary) {
    lines.push(`Summary so far: ${node.summary}`)
  }
  lines.push('=== END FOCUS NODE ===')
  return lines.join('\n')
}

/**
 * Returns the source-notes block (just the raw text). Providers that support
 * prompt caching should mark this block with cache_control to amortize cost
 * across both outline generation and chat turns within the cache TTL.
 */
export function buildChatSourceBlock(
  sources: SourceDocPayload[],
  maxCharsPerSource = 120_000,
): string {
  if (sources.length === 0) return '(no source notes attached)'
  const lines: string[] = []
  lines.push('=== SOURCE NOTES ===')
  sources.forEach((s, i) => {
    const label = s.filename ? s.filename : `Note ${i + 1}`
    lines.push('')
    lines.push(`--- ${label} (${s.kind}) ---`)
    if (s.text && s.text.trim()) {
      const trimmed = s.text.trim()
      lines.push(
        trimmed.length > maxCharsPerSource
          ? `${trimmed.slice(0, maxCharsPerSource)}\n[…truncated ${trimmed.length - maxCharsPerSource} chars]`
          : trimmed,
      )
    } else {
      lines.push('(empty or non-text source)')
    }
  })
  lines.push('')
  lines.push('=== END SOURCE NOTES ===')
  return lines.join('\n')
}

/**
 * Convenience for providers that don't support split caching — concatenate
 * focus block + source block into a single system prompt string.
 */
export function buildChatSystemPrompt(args: BuildChatContextArgs): string {
  return `${buildChatFocusBlock(args)}\n\n${buildChatSourceBlock(
    args.sources,
    args.maxCharsPerSource,
  )}`
}

// ----- branch summarization -----

export const SUMMARIZE_SYSTEM_PROMPT = `You are StudyPilot, summarizing a Q&A conversation between a student and an AI tutor about a single course topic.

The student will read your output LATER to remember what they learned — without re-opening the full chat. So your job is to produce a compact, lecture-faithful study note.

Output rules:
- Markdown. 3–8 bullets, OR 1–3 short paragraphs, whichever fits the content better.
- Lead with the concrete answer / takeaway. No preamble like "In this conversation we discussed…".
- Use terminology and code/formula snippets from the conversation verbatim where helpful.
- Preserve any pitfalls, gotchas, examples, or quick rules of thumb the tutor called out.
- Drop dead ends and trivial banter.
- Match the language(s) the student used (Mandarin / English / mixed) — mirror their phrasing.
- Aim for ≤ 350 words.`

export interface BuildSummarizeUserMessageArgs {
  branchTitle: string
  node: NodeContext
  messages: ChatMessage[]
}

export function buildSummarizeUserMessage(
  args: BuildSummarizeUserMessageArgs,
): string {
  const { branchTitle, node, messages } = args
  const lines: string[] = []
  lines.push(`Topic: ${node.title}`)
  if (node.path.length > 1) {
    lines.push(`Outline path: ${node.path.join(' › ')}`)
  }
  lines.push(`Branch question: ${branchTitle}`)
  lines.push('')
  lines.push('=== TRANSCRIPT ===')
  messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .forEach((m, i) => {
      lines.push('')
      lines.push(`[${i + 1}] ${m.role.toUpperCase()}:`)
      lines.push(m.content.trim())
    })
  lines.push('')
  lines.push('=== END TRANSCRIPT ===')
  lines.push('')
  lines.push(
    'Produce the study note now, following the system rules. Output ONLY the markdown note — no preamble.',
  )
  return lines.join('\n')
}
