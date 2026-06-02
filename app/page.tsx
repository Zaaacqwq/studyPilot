import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { AppHeader } from '@/components/AppHeader'
import { SetupRequired } from '@/components/SetupRequired'
import { loadCredential, PROVIDER_IDS, PROVIDER_LABELS } from '@/lib/providers'
import { listCourses } from '@/lib/db/courses'
import type { ProviderId } from '@/lib/db/types'
import { CreateCourseForm } from './CreateCourseForm'

interface HomePageProps {
  searchParams: Promise<{ error?: string }>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function HomePage({ searchParams }: HomePageProps) {
  if (!isSupabaseConfigured()) return <SetupRequired />

  const { error } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return (
      <>
        <AppHeader email={null} current="home" />
        <main className="mx-auto max-w-2xl px-4 py-12 text-sm text-zinc-500">
          Please sign in.
        </main>
      </>
    )
  }

  const [courses, ...credentialChecks] = await Promise.all([
    listCourses(supabase, user.id),
    ...PROVIDER_IDS.map(async (id) => ({
      id,
      ok: !!(await loadCredential(supabase, user.id, id)),
    })),
  ])

  const configuredProviders: ProviderId[] = credentialChecks
    .filter((c) => c.ok)
    .map((c) => c.id)

  const isEmpty = courses.length === 0

  return (
    <>
      <AppHeader email={user.email ?? null} current="home" />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-8">
        <section className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Courses</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Each course holds its own outline, notes, and branches.
            </p>
          </div>
          {!isEmpty && configuredProviders.length > 0 && (
            <Link
              href="#new-course"
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              + New course
            </Link>
          )}
        </section>

        {isEmpty ? (
          <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-base font-semibold">Create your first course</h2>
            <p className="mt-1 mb-4 text-sm text-zinc-500">
              Drop in notes next, and StudyPilot will draft an outline.
            </p>
            <CreateCourseForm
              configuredProviders={configuredProviders}
              error={error ?? null}
            />
          </section>
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2">
              {courses.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/courses/${c.id}`}
                    className="block h-full rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400 hover:shadow dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-semibold">
                        {c.title}
                      </h3>
                      <span className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                        {PROVIDER_LABELS[c.default_provider]}
                      </span>
                    </div>
                    {c.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                        {c.description}
                      </p>
                    )}
                    <p className="mt-3 text-[11px] text-zinc-400">
                      Updated {formatDate(c.updated_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            <section
              id="new-course"
              className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <details>
                <summary className="cursor-pointer text-sm font-semibold">
                  New course
                </summary>
                <div className="mt-3">
                  <CreateCourseForm
                    configuredProviders={configuredProviders}
                    error={error ?? null}
                  />
                </div>
              </details>
            </section>
          </>
        )}
      </main>
    </>
  )
}
