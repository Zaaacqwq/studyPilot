import { OpenAIProvider } from './openai'
import type {
  GenerateOutlineArgs,
  OutlineNodeDraft,
  ProviderConfig,
} from './types'
import {
  buildOutlineContext,
  normalizeOutlineTree,
  OutlineResponseSchema,
  SYSTEM_PROMPT,
} from '@/lib/outline/prompt'

// OpenCode Go hosted API — OpenAI-compatible.
// Docs: https://opencode.ai/docs/go
// Model IDs at the /chat/completions endpoint omit the `opencode-go/` prefix.
export const DEFAULT_OPENCODE_BASE_URL = 'https://opencode.ai/zen/go/v1'
export const DEFAULT_OPENCODE_MODEL = 'deepseek-v4-flash'

const JSON_INSTRUCTION = `Respond with ONLY a JSON object matching this exact shape (no markdown, no prose, no code fences):

{
  "nodes": [
    {
      "title": "string (concrete, ≤80 chars, lecture-faithful)",
      "summary": "string (3-8 sentences)",
      "children": [
        {
          "title": "string",
          "summary": "string",
          "children": [
            { "title": "string", "summary": "string", "children": [] }
          ]
        }
      ]
    }
  ]
}

Rules:
- "nodes" is the top-level array. For a typical lecture, emit 8-30 top-level items.
- "children" is ALWAYS an array. Use [] when there are no children.
- Depth up to 5 levels allowed where the source material is hierarchical.
- summary text uses normal punctuation but NO unescaped quotes or newlines. Escape with \\" and \\n if needed.
- Output MUST be valid JSON parseable in one pass — no markdown fences, no trailing prose.`

/**
 * OpenCode exposes an OpenAI-compatible HTTP API. Defaults point at OpenCode
 * Go (hosted subscription); users running `opencode serve` locally can override
 * the base URL to e.g. http://localhost:4096/v1. Capability flags are
 * conservative since the effective backend model varies.
 */
export class OpencodeProvider extends OpenAIProvider {
  constructor(cfg: ProviderConfig) {
    super(
      {
        ...cfg,
        baseUrl: cfg.baseUrl ?? DEFAULT_OPENCODE_BASE_URL,
      },
      {
        id: 'opencode',
        defaultModel: cfg.model ?? DEFAULT_OPENCODE_MODEL,
        capabilities: {
          streaming: true,
          vision: false,
          nativePdf: false,
          structuredOutput: false,
          promptCaching: false,
          maxContextTokens: 32_000,
        },
      },
    )
  }

  override async generateOutline(args: GenerateOutlineArgs): Promise<OutlineNodeDraft[]> {
    const context = buildOutlineContext(args.course, args.sources)
    const userPrompt = `${context}\n\n${JSON_INSTRUCTION}`

    const callOnce = async () => {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 16_384,
        // json_object is widely supported on OpenAI-compat backends.
        // We don't risk strict json_schema since the effective backend model varies.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      })
      const raw = response.choices[0]?.message?.content
      if (!raw) throw new Error('OpenCode returned an empty outline response')
      return raw
    }

    let raw = await callOnce()
    try {
      const parsed = OutlineResponseSchema.parse(safeParseJson(raw))
      return normalizeOutlineTree(parsed.nodes)
    } catch {
      // One retry — sometimes the first reply has stray prose around the JSON.
      raw = await callOnce()
      const parsed = OutlineResponseSchema.parse(safeParseJson(raw))
      return normalizeOutlineTree(parsed.nodes)
    }
  }
}

/**
 * Tolerant JSON extraction. Some OpenAI-compatible backends ignore the
 * response_format hint and wrap output in code fences or add a prefix.
 */
function safeParseJson(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // Try stripping markdown code fences.
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/i)
    if (fenceMatch) {
      return JSON.parse(fenceMatch[1])
    }
    // Try finding the first `{` and last `}`.
    const first = trimmed.indexOf('{')
    const last = trimmed.lastIndexOf('}')
    if (first >= 0 && last > first) {
      return JSON.parse(trimmed.slice(first, last + 1))
    }
    throw new Error('Could not parse JSON from OpenCode response')
  }
}
