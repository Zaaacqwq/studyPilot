import {
  PROVIDER_DEFAULT_BASE_URLS,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_LABELS,
  type ProviderCapabilities,
} from '@/lib/providers'
import type { ProviderId } from '@/lib/db/types'
import {
  deleteCredential,
  saveAndTestCredential,
  testCredential,
} from './actions'

interface SavedCredential {
  apiKey: string
  baseUrl: string | null
  model: string | null
}

interface ProviderCardProps {
  providerId: ProviderId
  capabilities: ProviderCapabilities
  needsBaseUrl: boolean
  saved: SavedCredential | null
  status: 'ok' | 'err' | null
  detail: string | null
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

function CapabilityBadges({ caps }: { caps: ProviderCapabilities }) {
  const items: { label: string; on: boolean }[] = [
    { label: 'streaming', on: caps.streaming },
    { label: 'vision', on: caps.vision },
    { label: 'native pdf', on: caps.nativePdf },
    { label: 'structured', on: caps.structuredOutput },
    { label: 'caching', on: caps.promptCaching },
  ]
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {items.map(({ label, on }) => (
        <span
          key={label}
          className={
            on
              ? 'rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : 'rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-zinc-400 line-through dark:border-zinc-800 dark:bg-zinc-900'
          }
        >
          {label}
        </span>
      ))}
      <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        ctx {Math.round(caps.maxContextTokens / 1000)}k
      </span>
    </div>
  )
}

export function ProviderCard({
  providerId,
  capabilities,
  needsBaseUrl,
  saved,
  status,
  detail,
}: ProviderCardProps) {
  const label = PROVIDER_LABELS[providerId]
  const defaultModel = PROVIDER_DEFAULT_MODELS[providerId]
  const defaultBaseUrl = PROVIDER_DEFAULT_BASE_URLS[providerId]

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{label}</h2>
          <p className="text-xs text-zinc-500">
            Default model: <code>{defaultModel}</code>
          </p>
        </div>
        <CapabilityBadges caps={capabilities} />
      </div>

      {status && (
        <div
          className={
            status === 'ok'
              ? 'mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
              : 'mb-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100'
          }
        >
          <strong>{status === 'ok' ? 'OK' : 'Error'}:</strong>{' '}
          {detail ?? (status === 'ok' ? 'Connection successful.' : 'Failed.')}
        </div>
      )}

      {saved && (
        <div className="mb-4 grid grid-cols-1 gap-2 rounded-md bg-zinc-50 p-3 text-xs dark:bg-zinc-900 sm:grid-cols-3">
          <div>
            <div className="text-zinc-500">API key</div>
            <code className="text-zinc-700 dark:text-zinc-200">
              {maskKey(saved.apiKey)}
            </code>
          </div>
          <div>
            <div className="text-zinc-500">Base URL</div>
            <code className="break-all text-zinc-700 dark:text-zinc-200">
              {saved.baseUrl ?? '(default)'}
            </code>
          </div>
          <div>
            <div className="text-zinc-500">Model</div>
            <code className="text-zinc-700 dark:text-zinc-200">
              {saved.model ?? '(default)'}
            </code>
          </div>
        </div>
      )}

      {saved && (
        <div className="mb-4 flex gap-2">
          <form action={testCredential}>
            <input type="hidden" name="provider" value={providerId} />
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Test connection
            </button>
          </form>
          <form action={deleteCredential}>
            <input type="hidden" name="provider" value={providerId} />
            <button
              type="submit"
              className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
            >
              Delete
            </button>
          </form>
        </div>
      )}

      <details {...(saved ? {} : { open: true })} className="group">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          {saved ? 'Update credential' : 'Add credential'}
        </summary>

        <form action={saveAndTestCredential} className="mt-3 space-y-3">
          <input type="hidden" name="provider" value={providerId} />

          <label className="block space-y-1">
            <span className="text-xs font-medium">API key</span>
            <input
              type="password"
              name="apiKey"
              required
              autoComplete="off"
              placeholder={providerId === 'claude' ? 'sk-ant-…' : 'sk-…'}
              className="block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          {needsBaseUrl && (
            <label className="block space-y-1">
              <span className="text-xs font-medium">Base URL</span>
              <input
                type="url"
                name="baseUrl"
                placeholder={defaultBaseUrl ?? 'https://...'}
                defaultValue={saved?.baseUrl ?? ''}
                className="block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-medium">
              Model <span className="text-zinc-500">(optional)</span>
            </span>
            <input
              type="text"
              name="model"
              placeholder={defaultModel}
              defaultValue={saved?.model ?? ''}
              className="block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Save &amp; test
          </button>
        </form>
      </details>
    </section>
  )
}
