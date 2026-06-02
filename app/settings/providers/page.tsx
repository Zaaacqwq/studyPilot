import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { AppHeader } from '@/components/AppHeader'
import { SetupRequired } from '@/components/SetupRequired'
import {
  ClaudeProvider,
  OpenAIProvider,
  OpencodeProvider,
  PROVIDER_IDS,
  loadCredential,
} from '@/lib/providers'
import type { ProviderId } from '@/lib/db/types'
import { ProviderCard } from './ProviderCard'

interface PageProps {
  searchParams: Promise<{ status?: string; detail?: string }>
}

const PLACEHOLDER_KEY = 'placeholder'

const CAPABILITIES: Record<ProviderId, ReturnType<() => {
  capabilities: import('@/lib/providers').ProviderCapabilities
  needsBaseUrl: boolean
}>> = {
  claude: {
    capabilities: new ClaudeProvider({ apiKey: PLACEHOLDER_KEY }).capabilities,
    needsBaseUrl: false,
  },
  openai: {
    capabilities: new OpenAIProvider({ apiKey: PLACEHOLDER_KEY }).capabilities,
    needsBaseUrl: false,
  },
  opencode: {
    capabilities: new OpencodeProvider({ apiKey: PLACEHOLDER_KEY }).capabilities,
    needsBaseUrl: true,
  },
}

function parseStatus(raw: string | undefined): {
  provider: ProviderId | null
  status: 'ok' | 'err' | null
} {
  if (!raw) return { provider: null, status: null }
  const [provider, status] = raw.split(':') as [ProviderId, 'ok' | 'err']
  if (!PROVIDER_IDS.includes(provider)) return { provider: null, status: null }
  if (status !== 'ok' && status !== 'err') return { provider: null, status: null }
  return { provider, status }
}

export default async function ProvidersSettingsPage({ searchParams }: PageProps) {
  if (!isSupabaseConfigured()) return <SetupRequired />

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { status, detail } = await searchParams
  const { provider: statusProvider, status: statusValue } = parseStatus(status)

  const saved = await Promise.all(
    PROVIDER_IDS.map(async (id) => ({
      id,
      cred: await loadCredential(supabase, user.id, id),
    })),
  )

  return (
    <>
      <AppHeader email={user.email ?? null} current="settings" />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">AI Providers</h1>
          <p className="text-sm text-zinc-500">
            Each course can pick a default provider. You can also switch
            providers per branch. Keys are stored per-user under row-level
            security.
          </p>
        </div>

        <div className="grid gap-4">
          {saved.map(({ id, cred }) => (
            <ProviderCard
              key={id}
              providerId={id}
              capabilities={CAPABILITIES[id].capabilities}
              needsBaseUrl={CAPABILITIES[id].needsBaseUrl}
              saved={cred}
              status={statusProvider === id ? statusValue : null}
              detail={statusProvider === id ? detail ?? null : null}
            />
          ))}
        </div>
      </main>
    </>
  )
}
