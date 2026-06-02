import type { ProviderId } from '@/lib/db/types'

export type { ProviderId }

export interface ProviderCapabilities {
  streaming: boolean
  vision: boolean
  nativePdf: boolean
  structuredOutput: boolean
  promptCaching: boolean
  maxContextTokens: number
}

export interface ProviderConfig {
  apiKey: string
  baseUrl?: string
  model?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface OutlineNodeDraft {
  title: string
  summary: string
  children: OutlineNodeDraft[]
}

export interface SourceDocPayload {
  kind: 'text' | 'pdf' | 'image' | 'docx' | 'pptx'
  filename?: string
  text?: string
  pdfBase64?: string
  imageBase64?: string
  imageMediaType?: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
}

export interface NodeContext {
  title: string
  summary: string | null
  path: string[]
}

export interface StreamChatArgs {
  course: CourseSummary
  node: NodeContext
  sources: SourceDocPayload[]
  /** User/assistant turns only — no system role. Last item should be a user turn. */
  history: ChatMessage[]
}

export interface TestResult {
  ok: boolean
  detail?: string
}

export interface CourseSummary {
  title: string
  description: string | null
}

export interface GenerateOutlineArgs {
  course: CourseSummary
  sources: SourceDocPayload[]
}

export interface SummarizeBranchArgs {
  branchTitle: string
  node: NodeContext
  messages: ChatMessage[]
}

export interface Provider {
  readonly id: ProviderId
  readonly capabilities: ProviderCapabilities
  generateOutline(args: GenerateOutlineArgs): Promise<OutlineNodeDraft[]>
  streamChat(args: StreamChatArgs): AsyncIterable<string>
  summarizeBranch(args: SummarizeBranchArgs): Promise<string>
  testConnection(): Promise<TestResult>
}

export class NotImplementedError extends Error {
  constructor(method: string, provider: ProviderId) {
    super(`${method} not implemented yet for provider "${provider}"`)
    this.name = 'NotImplementedError'
  }
}
