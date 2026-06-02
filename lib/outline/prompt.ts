import { z } from 'zod'
import type {
  CourseSummary,
  OutlineNodeDraft,
  SourceDocPayload,
} from '@/lib/providers/types'

export type { CourseSummary }

export const SYSTEM_PROMPT = `You are StudyPilot, generating a hierarchical study outline from raw course notes.

GOAL
Your outline replaces a long, lost chat — a student will scan it later and click into any node to re-learn that exact concept. So it must be granular, ordered the way the source material is ordered, and rich enough that just reading the summary refreshes the idea.

STRUCTURE
- Mirror the source. If notes have page numbers, lecture numbers, or section labels, reflect them in titles (e.g. "Page 26: Implementing Synchronization Objects").
- Default to FINER granularity, not coarser. A 30-page lecture deserves roughly one top-level node per major topic block AND a child per page/sub-concept.
- Target 8–30 top-level sections for a typical lecture. 2–10 children where the notes warrant. Up to 5 levels of depth for hierarchical material.
- Do not drop content. Every named concept, algorithm, code example, pitfall, or definition in the notes must appear somewhere in the tree.

TITLES
- ≤ 80 chars. Concrete, lecture-faithful, using terminology FROM THE NOTES.
- Good: "Mutex Take 3: Spinlock-based", "Page 41: Why Take 2 still needs disable_interrupts", "Lost Wakeup in CV Take 2".
- Bad: "Introduction", "Background", "Overview" (unless the notes literally have an Overview section), "Concepts", "Discussion".

SUMMARIES
- 3–8 sentences. Self-contained — readable without re-opening the notes.
- Cover WHAT the section says: definitions, the key idea, the algorithm or code pattern, and any pitfalls/quotes the notes call out by name.
- Use the notes' own terminology and short inline code/formula references where helpful (e.g. \`test&set\`, \`P() / V()\`, "Mesa-style monitor", "atomicity of unlock+sleep").
- Don't editorialize about importance ("this is critical to understand"). Just say what it covers.

OUTPUT
Emit the structured outline. No preamble, no markdown wrapper.`.trim()

export const OUTLINE_USER_INSTRUCTION = `Generate the outline now, following the system rules above. Cover the entire body of source notes below.`

export interface BuildOutlineContextOptions {
  /**
   * Soft cap on chars per source. Avoids prompt blowups while we don't have
   * proper chunking yet. Defaults to ~120k chars (~30k tokens).
   */
  maxCharsPerSource?: number
}

/**
 * Builds the user-message context carrying course meta + all source notes.
 */
export function buildOutlineContext(
  course: CourseSummary,
  sources: SourceDocPayload[],
  options: BuildOutlineContextOptions = {},
): string {
  const maxChars = options.maxCharsPerSource ?? 120_000
  const lines: string[] = []
  lines.push(`Course title: ${course.title}`)
  if (course.description) {
    lines.push(`Course description: ${course.description}`)
  }
  lines.push('')
  lines.push('=== SOURCE NOTES ===')

  sources.forEach((s, i) => {
    const label = s.filename ? `${s.filename}` : `Note ${i + 1}`
    lines.push('')
    lines.push(`--- ${label} (${s.kind}) ---`)
    if (s.text && s.text.trim()) {
      const trimmed = s.text.trim()
      lines.push(
        trimmed.length > maxChars
          ? `${trimmed.slice(0, maxChars)}\n[…truncated ${trimmed.length - maxChars} chars]`
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
 * Recursive Zod schema for an outline tree node.
 *
 * Note: Some providers (OpenAI strict mode, in particular) reject recursive
 * $defs. For those we generate a flattened, depth-limited schema in the
 * provider implementation. Here we keep a permissive schema for parsing.
 */
export const OutlineNodeSchema: z.ZodType<OutlineNodeDraft> = z.lazy(() =>
  z.object({
    title: z.string().min(1).max(200),
    summary: z.string().min(1).max(4000),
    children: z.array(OutlineNodeSchema).optional().default([]),
  }),
)

export const OutlineResponseSchema = z.object({
  nodes: z.array(OutlineNodeSchema).min(1),
})

export type OutlineResponse = z.infer<typeof OutlineResponseSchema>

/**
 * Strip excess whitespace and clip depth. Idempotent.
 */
export function normalizeOutlineTree(
  nodes: OutlineNodeDraft[],
  maxDepth = 5,
  depth = 0,
): OutlineNodeDraft[] {
  return nodes.map((n) => ({
    title: n.title.trim().slice(0, 200),
    summary: n.summary.trim().slice(0, 4000),
    children:
      depth + 1 >= maxDepth
        ? []
        : normalizeOutlineTree(n.children ?? [], maxDepth, depth + 1),
  }))
}
