import type { SupabaseClient } from '@supabase/supabase-js'
import { ClaudeProvider, DEFAULT_CLAUDE_MODEL } from './claude'
import { OpenAIProvider, DEFAULT_OPENAI_MODEL } from './openai'
import {
  OpencodeProvider,
  DEFAULT_OPENCODE_BASE_URL,
  DEFAULT_OPENCODE_MODEL,
} from './opencode'
import type { Provider, ProviderConfig, ProviderId } from './types'

export * from './types'
export { ClaudeProvider, DEFAULT_CLAUDE_MODEL, DEFAULT_CLAUDE_SUMMARY_MODEL } from './claude'
export { OpenAIProvider, DEFAULT_OPENAI_MODEL, DEFAULT_OPENAI_SUMMARY_MODEL } from './openai'
export {
  OpencodeProvider,
  DEFAULT_OPENCODE_BASE_URL,
  DEFAULT_OPENCODE_MODEL,
} from './opencode'

export const PROVIDER_IDS: readonly ProviderId[] = ['claude', 'openai', 'opencode'] as const

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  claude: 'Claude API',
  openai: 'OpenAI API',
  opencode: 'OpenCode Go',
}

export const PROVIDER_DEFAULT_MODELS: Record<ProviderId, string> = {
  claude: DEFAULT_CLAUDE_MODEL,
  openai: DEFAULT_OPENAI_MODEL,
  opencode: DEFAULT_OPENCODE_MODEL,
}

export const PROVIDER_DEFAULT_BASE_URLS: Partial<Record<ProviderId, string>> = {
  opencode: DEFAULT_OPENCODE_BASE_URL,
}

export function makeProvider(id: ProviderId, cfg: ProviderConfig): Provider {
  switch (id) {
    case 'claude':
      return new ClaudeProvider(cfg)
    case 'openai':
      return new OpenAIProvider(cfg)
    case 'opencode':
      return new OpencodeProvider(cfg)
  }
}

export interface StoredCredential {
  apiKey: string
  baseUrl: string | null
  model: string | null
}

export async function loadCredential(
  supabase: SupabaseClient,
  userId: string,
  providerId: ProviderId,
): Promise<StoredCredential | null> {
  const { data, error } = await supabase
    .from('provider_credentials')
    .select('api_key, base_url, meta')
    .eq('user_id', userId)
    .eq('provider', providerId)
    .maybeSingle()

  if (error || !data) return null

  const meta = (data.meta ?? {}) as { model?: string }
  return {
    apiKey: data.api_key,
    baseUrl: data.base_url ?? null,
    model: meta.model ?? null,
  }
}

export async function getProviderForUser(
  supabase: SupabaseClient,
  userId: string,
  providerId: ProviderId,
): Promise<Provider | null> {
  const stored = await loadCredential(supabase, userId, providerId)
  if (!stored) return null
  return makeProvider(providerId, {
    apiKey: stored.apiKey,
    baseUrl: stored.baseUrl ?? undefined,
    model: stored.model ?? undefined,
  })
}
