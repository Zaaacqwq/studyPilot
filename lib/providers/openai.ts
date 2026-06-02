import OpenAI from 'openai'
import type {
  GenerateOutlineArgs,
  OutlineNodeDraft,
  Provider,
  ProviderCapabilities,
  ProviderConfig,
  StreamChatArgs,
  SummarizeBranchArgs,
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
  buildChatSystemPrompt,
  buildSummarizeUserMessage,
  SUMMARIZE_SYSTEM_PROMPT,
} from '@/lib/chat/prompt'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

export const DEFAULT_OPENAI_MODEL = 'gpt-4o'
export const DEFAULT_OPENAI_SUMMARY_MODEL = 'gpt-4o-mini'

interface OpenAIProviderOptions {
  id?: 'openai' | 'opencode'
  defaultModel?: string
  capabilities?: Partial<ProviderCapabilities>
}

// OpenAI's strict json_schema does not allow recursive $refs.
// We hard-code 3 levels of depth, matching normalizeOutlineTree's cap.
function leafSchema() {
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      children: {
        type: 'array',
        items: { type: 'object' },
        maxItems: 0,
      },
    },
    required: ['title', 'summary', 'children'],
    additionalProperties: false,
  }
}

function nodeSchemaWith(childSchema: object) {
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      children: { type: 'array', items: childSchema },
    },
    required: ['title', 'summary', 'children'],
    additionalProperties: false,
  }
}

const OUTLINE_SCHEMA = {
  type: 'object',
  properties: {
    nodes: {
      type: 'array',
      items: nodeSchemaWith(nodeSchemaWith(leafSchema())),
    },
  },
  required: ['nodes'],
  additionalProperties: false,
} as const

export class OpenAIProvider implements Provider {
  readonly id: 'openai' | 'opencode'
  readonly capabilities: ProviderCapabilities

  protected readonly client: OpenAI
  protected readonly model: string

  constructor(cfg: ProviderConfig, opts: OpenAIProviderOptions = {}) {
    this.id = opts.id ?? 'openai'
    this.client = new OpenAI({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseUrl,
    })
    this.model = cfg.model ?? opts.defaultModel ?? DEFAULT_OPENAI_MODEL
    this.capabilities = {
      streaming: true,
      vision: true,
      nativePdf: false,
      structuredOutput: true,
      promptCaching: true,
      maxContextTokens: 128_000,
      ...opts.capabilities,
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      const res = await this.client.models.list()
      const first = res.data?.[0]?.id
      return { ok: true, detail: first ? `Reached API (saw ${first})` : 'Reached API' }
    } catch (error: unknown) {
      return { ok: false, detail: getErrorMessage(error) }
    }
  }

  async generateOutline(args: GenerateOutlineArgs): Promise<OutlineNodeDraft[]> {
    const context = buildOutlineContext(args.course, args.sources)

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 16_384,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${context}\n\n${OUTLINE_USER_INSTRUCTION}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'outline',
          strict: true,
          schema: OUTLINE_SCHEMA,
        },
      },
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new Error('OpenAI returned an empty outline response')

    const parsed = OutlineResponseSchema.parse(JSON.parse(raw))
    return normalizeOutlineTree(parsed.nodes)
  }

  async *streamChat(args: StreamChatArgs): AsyncIterable<string> {
    const system = buildChatSystemPrompt({
      course: args.course,
      node: args.node,
      sources: args.sources,
    })

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      ...args.history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
    ]

    const stream = await this.client.chat.completions.create({
      model: this.model,
      stream: true,
      max_tokens: 4096,
      messages,
    })

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content
      if (text) yield text
    }
  }

  async summarizeBranch(args: SummarizeBranchArgs): Promise<string> {
    // Use a smaller/cheaper model when the provider is OpenAI itself; for
    // OpenCode we keep the configured model since the user picked it.
    const summaryModel =
      this.id === 'openai' ? DEFAULT_OPENAI_SUMMARY_MODEL : this.model

    const response = await this.client.chat.completions.create({
      model: summaryModel,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SUMMARIZE_SYSTEM_PROMPT },
        { role: 'user', content: buildSummarizeUserMessage(args) },
      ],
    })
    const text = response.choices[0]?.message?.content?.trim()
    if (!text) throw new Error(`${this.id} returned an empty summary`)
    return text
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    return `${error.status ?? ''} ${error.message}`.trim()
  }
  if (error instanceof Error) return error.message
  return 'Unknown error'
}
