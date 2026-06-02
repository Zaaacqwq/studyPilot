export interface SupabaseEnv {
  url: string
  anonKey: string
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Supabase renamed "anon key" → "publishable key" in late 2024.
  // Accept both names so it works regardless of which the user copied.
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !anonKey) return null
  return { url, anonKey }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null
}
