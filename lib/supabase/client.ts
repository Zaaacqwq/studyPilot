import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from './env'

export function createClient() {
  const env = getSupabaseEnv()
  if (!env) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see README).',
    )
  }
  return createBrowserClient(env.url, env.anonKey)
}
