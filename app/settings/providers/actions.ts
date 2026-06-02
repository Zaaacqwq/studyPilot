'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  makeProvider,
  PROVIDER_IDS,
  loadCredential,
} from '@/lib/providers'
import type { ProviderId } from '@/lib/db/types'

const providerSchema = z.enum(PROVIDER_IDS as unknown as [ProviderId, ...ProviderId[]])

const saveSchema = z.object({
  provider: providerSchema,
  apiKey: z.string().min(1, 'API key is required').max(2000),
  baseUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.string().url('Base URL must be a valid URL').optional()),
  model: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : undefined)),
})

const deleteSchema = z.object({ provider: providerSchema })
const testSchema = z.object({ provider: providerSchema })

const SETTINGS_PATH = '/settings/providers'

function statusRedirect(provider: ProviderId, status: 'ok' | 'err', detail?: string) {
  const params = new URLSearchParams()
  params.set('status', `${provider}:${status}`)
  if (detail) params.set('detail', detail)
  redirect(`${SETTINGS_PATH}?${params.toString()}`)
}

export async function saveAndTestCredential(formData: FormData) {
  const parsed = saveSchema.safeParse({
    provider: formData.get('provider'),
    apiKey: formData.get('apiKey'),
    baseUrl: formData.get('baseUrl') ?? undefined,
    model: formData.get('model') ?? undefined,
  })

  if (!parsed.success) {
    const fallback = (formData.get('provider') as ProviderId) || 'claude'
    statusRedirect(fallback, 'err', parsed.error.issues[0]?.message ?? 'Invalid input')
  }

  const { provider, apiKey, baseUrl, model } = parsed.data!

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error: upsertError } = await supabase
    .from('provider_credentials')
    .upsert(
      {
        user_id: user.id,
        provider,
        api_key: apiKey,
        base_url: baseUrl ?? null,
        meta: model ? { model } : {},
      },
      { onConflict: 'user_id,provider' },
    )

  if (upsertError) {
    statusRedirect(provider, 'err', `Save failed: ${upsertError.message}`)
  }

  // Test what we just saved.
  const instance = makeProvider(provider, { apiKey, baseUrl, model })
  const result = await instance.testConnection()
  revalidatePath(SETTINGS_PATH)
  statusRedirect(
    provider,
    result.ok ? 'ok' : 'err',
    result.detail,
  )
}

export async function testCredential(formData: FormData) {
  const parsed = testSchema.safeParse({ provider: formData.get('provider') })
  if (!parsed.success) {
    redirect(SETTINGS_PATH)
  }
  const provider = parsed.data!.provider

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const stored = await loadCredential(supabase, user.id, provider)
  if (!stored) {
    statusRedirect(provider, 'err', 'No credential saved yet')
  }

  const instance = makeProvider(provider, {
    apiKey: stored!.apiKey,
    baseUrl: stored!.baseUrl ?? undefined,
    model: stored!.model ?? undefined,
  })
  const result = await instance.testConnection()
  statusRedirect(provider, result.ok ? 'ok' : 'err', result.detail)
}

export async function deleteCredential(formData: FormData) {
  const parsed = deleteSchema.safeParse({ provider: formData.get('provider') })
  if (!parsed.success) redirect(SETTINGS_PATH)
  const provider = parsed.data!.provider

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('provider_credentials')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider)

  if (error) {
    statusRedirect(provider, 'err', `Delete failed: ${error.message}`)
  }

  revalidatePath(SETTINGS_PATH)
  statusRedirect(provider, 'ok', 'Credential removed')
}
