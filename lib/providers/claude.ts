import Anthropic from '@anthropic-ai/sdk'
import type {
  ChatMessage,
  GenerateOutlineArgs,
  OutlineNodeDraft,
  Provider,
  ProviderCapabilities,
  ProviderConfig,
  StreamChatArgs,
  TestResult,
} from './types'
import {
  buildOutlineContext,
  normalizeOutlineTree,
  OUTLINE_USER_INSTRUCTION,
  OutlineResponseSchema,
  SYSTEM_PROMPT,
} from '@/lib/outline/prompt'
import {
  buildChatFocusBlock,
  buildChatSourceBlock,
  buildSummarizeUserMessage,
  SUMMARIZE_SYSTEM_PROMPT,
} from '@/lib/chat/prompt'
import type { SummarizeBranchArgs } from './types'

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6'
export const DEFAULT_CLAUDE_SUMMARY_MODEL = 'claude-haiku-4-5'

const OUTLINE_TOOL: Anthropic.Tool = {
  name: 'emit_outline',
  description:
    'Emit the final hierarchical study outline. Call this exactly once with the entire tree.',
  input_schema: {
    type: 'object',
    properties: {
      nodes: {
        type: 'array',
        minItems: 1,
        items: { $ref: '#/$defs/Node' },
      },
    },
    required: ['nodes'],
    additionalProperties: false,
    $defs: {
      Node: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 200 },
          summary: { type: 'string', maxLength: 2000 },
          children: {
            type: 'array',
            items: { $ref: '#/$defs/Node' },
            default: [],
          },
        },
        required: ['title', 'summary'],
        additionalProperties: false,
      },
    },
  } as unknown as Anthropic.Tool['input_schema'],
}

export class ClaudeProvider implements Provider {
  readonly id = 'claude' as const
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    vision: true,
    nativePdf: true,
    structuredOutput: true,
    promptCaching: true,
    maxContextTokens: 200_000,
  }

  private readonly client: Anthropic
  private readonly model: string

  constructor(cfg: ProviderConfig) {
    this.client = new Anthropic({ apiKey: cfg.apiKey })
    this.model = cfg.model ?? DEFAULT_CLAUDE_MODEL
  }

  async testConnection(): Promise<TestResult> {
    try {
      const res = await this.client.models.list({ limit: 1 })
      const found = res.data[0]?.id
      return { ok: true, detail: found ? `Reached API (saw ${found})` : 'Reached API' }
    } catch (error: unknown) {
      return { ok: false, detail: getErrorMessage(error) }
    }
  }

  async generateOutline(args: GenerateOutlineArgs): Promise<OutlineNodeDraft[]> {
    const context = buildOutlineContext(args.course, args.sources)

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16_384,
      system: SYSTEM_PROMPT,
      tools: [OUTLINE_TOOL],
      tool_choice: { type: 'tool', name: 'emit_outline' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: context,
              // Cache the heavy notes context for 5min so a follow-up chat
              // session pulls it from cache instead of re-billing.
              cache_control: { type: 'ephemeral' },
            },
            { type: 'text', text: OUTLINE_USER_INSTRUCTION },
          ],
        },
      ],
    })

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    )
    if (!toolUse) {
      throw new Error('Claude did not emit the outline tool call')
    }

    const parsed = OutlineResponseSchema.parse(toolUse.input)
    return normalizeOutlineTree(parsed.nodes)
  }

  async *streamChat(args: StreamChatArgs): AsyncIterable<string> {
    const focusBlock = buildChatFocusBlock({
      course: args.course,
      node: args.node,
      sources: args.sources,
    })
    const sourceBlock = buildChatSourceBlock(args.sources)

    const history: Anthropic.MessageParam[] = args.history
      .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } =>
        m.role === 'user' || m.role === 'assistant',
      )
      .map((m) => ({ role: m.role, content: m.content }))

    const stream = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      stream: true,
      // System split into two blocks so we can cache the heavy source notes.
      // Cache TTL is 5min — keeps cost low across consecutive chat turns.
      system: [
        { type: 'text', text: focusBlock },
        {
          type: 'text',
          text: sourceBlock,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: history,
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }

  async summarizeBranch(args: SummarizeBranchArgs): Promise<string> {
    const response = await this.client.messages.create({
      model: DEFAULT_CLAUDE_SUMMARY_MODEL,
      max_tokens: 1024,
      system: SUMMARIZE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildSummarizeUserMessage(args),
        },
      ],
    })
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
    if (!text) throw new Error('Claude returned an empty summary')
    return text
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    return `${error.status ?? ''} ${error.message}`.trim()
  }
  if (error instanceof Error) return error.message
  return 'Unknown error'
}
