import Link from 'next/link'
import { createCourseAction } from './courses/actions'
import { PROVIDER_LABELS } from '@/lib/providers'
import type { ProviderId } from '@/lib/db/types'

interface CreateCourseFormProps {
  configuredProviders: ProviderId[]
  error?: string | null
}

export function CreateCourseForm({
  configuredProviders,
  error,
}: CreateCourseFormProps) {
  if (configuredProviders.length === 0) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        <p className="text-amber-900 dark:text-amber-100">
          You need at least one AI provider configured before creating a course.
        </p>
        <Link
          href="/settings/providers"
          className="mt-2 inline-block rounded-md border border-amber-400 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/40"
        >
          Go to provider settings
        </Link>
      </div>
    )
  }

  return (
    <form action={createCourseAction} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-xs font-medium">Title</span>
        <input
          type="text"
          name="title"
          required
          maxLength={200}
          placeholder="e.g. CS 246: Software Abstractions"
          className="block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium">
          Description <span className="text-zinc-500">(optional)</span>
        </span>
        <textarea
          name="description"
          maxLength={2000}
          rows={2}
          placeholder="Short note for your future self"
          className="block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium">Default provider</span>
        <select
          name="defaultProvider"
          defaultValue={configuredProviders[0]}
          className="block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        >
          {configuredProviders.map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Create course
      </button>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  )
}
