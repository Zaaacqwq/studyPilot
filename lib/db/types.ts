export type ProviderId = 'claude' | 'openai' | 'opencode'
export type BranchStatus = 'open' | 'merged' | 'abandoned'
export type MessageRole = 'user' | 'assistant' | 'system'
export type SourceKind = 'text' | 'pdf' | 'image' | 'docx' | 'pptx'

export interface Course {
  id: string
  user_id: string
  title: string
  description: string | null
  default_provider: ProviderId
  created_at: string
  updated_at: string
}

export interface SourceDocument {
  id: string
  user_id: string
  course_id: string
  kind: SourceKind
  filename: string | null
  storage_path: string | null
  raw_text: string | null
  token_count: number | null
  created_at: string
}

export interface OutlineNode {
  id: string
  user_id: string
  course_id: string
  parent_id: string | null
  title: string
  summary_md: string | null
  position: number
  depth: number
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  user_id: string
  node_id: string
  title: string
  status: BranchStatus
  provider: ProviderId
  model: string | null
  summary_md: string | null
  created_at: string
  merged_at: string | null
}

export interface Message {
  id: string
  user_id: string
  branch_id: string
  role: MessageRole
  content: string
  token_usage: Record<string, unknown> | null
  created_at: string
}

export interface ProviderCredential {
  id: string
  user_id: string
  provider: ProviderId
  api_key: string
  base_url: string | null
  meta: Record<string, unknown>
  created_at: string
  updated_at: string
}
