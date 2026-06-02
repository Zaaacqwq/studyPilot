import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { AppHeader } from '@/components/AppHeader'
import { SetupRequired } from '@/components/SetupRequired'
import { getCourse } from '@/lib/db/courses'
import {
  loadCredential,
  PROVIDER_IDS,
  PROVIDER_LABELS,
} from '@/lib/providers'
import type { ProviderId } from '@/lib/db/types'
import { deleteCourseAction, updateCourseAction } from '../../actions'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}

export default async function CourseSettingsPage({
  params,
  searchParams,
}: PageProps) {
  if (!isSupabaseConfigured()) return <SetupRequired />

  const { id } = await params
  const { error, saved } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const course = await getCourse(supabase, user.id, id)
  if (!course) notFound()

  const credentialChecks = await Promise.all(
    PROVIDER_IDS.map(async (pid) => ({
      id: pid,
      ok: !!(await loadCredential(supabase, user.id, pid)),
    })),
  )
  const configuredProviders: ProviderId[] = credentialChecks
    .filter((c) => c.ok)
    .map((c) => c.id)
  const providerOptions: ProviderId[] = Array.from(
    new Set<ProviderId>([course.default_provider, ...configuredProviders]),
  )

  return (
    <>
      <AppHeader email={user.email ?? null} current="home" />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
        <div className="text-sm">
          <Link
            href={`/courses/${course.id}`}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Back to course
          </Link>
        </div>

        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Settings — {course.title}
          </h1>
          <p className="text-sm text-zinc-500">
            Tweak metadata, change the default provider, or delete the course.
          </p>
        </header>

        {saved && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            Saved.
          </div>
        )}

        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold">Course details</h2>
          <form action={updateCourseAction} className="space-y-3">
            <input type="hidden" name="courseId" value={course.id} />

            <label className="block space-y-1">
              <span className="text-xs font-medium">Title</span>
              <input
                type="text"
                name="title"
                required
                maxLength={200}
                defaultValue={course.title}
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
                defaultValue={course.description ?? ''}
                className="block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium">Default provider</span>
              <select
                name="defaultProvider"
                defaultValue={course.default_provider}
                className="block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {providerOptions.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                    {!configuredProviders.includes(p) && ' (not configured)'}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save changes
            </button>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </form>
        </section>

        <section className="rounded-lg border border-red-200 bg-red-50/40 p-5 dark:border-red-900 dark:bg-red-950/20">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-red-700 dark:text-red-300">
              Delete course
            </summary>
            <p className="mt-3 text-xs text-red-700 dark:text-red-300">
              This permanently deletes the course, all uploaded notes, the
              outline, and every branch. This cannot be undone.
            </p>
            <form action={deleteCourseAction} className="mt-3">
              <input type="hidden" name="courseId" value={course.id} />
              <button
                type="submit"
                className="rounded-md border border-red-400 bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Yes, delete &ldquo;{course.title}&rdquo;
              </button>
            </form>
          </details>
        </section>
      </main>
    </>
  )
}
