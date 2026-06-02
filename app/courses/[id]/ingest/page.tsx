import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { AppHeader } from '@/components/AppHeader'
import { SetupRequired } from '@/components/SetupRequired'
import { getCourse } from '@/lib/db/courses'
import { listSources, sumTokens } from '@/lib/db/sources'
import type { SourceDocument } from '@/lib/db/types'
import {
  ingestFileAction,
  ingestTextAction,
  deleteSourceAction,
} from './actions'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ status?: 'ok' | 'err'; detail?: string }>
}

const CONTEXT_WARNING_THRESHOLD = 150_000

function formatTokens(n: number): string {
  if (n < 1_000) return `${n}`
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function kindBadge(kind: SourceDocument['kind']) {
  const styles: Record<string, string> = {
    text: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
    pdf: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
    image: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
    docx: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200',
    pptx: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200',
  }
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles[kind] ?? styles.text}`}
    >
      {kind}
    </span>
  )
}

export default async function IngestPage({ params, searchParams }: PageProps) {
  if (!isSupabaseConfigured()) return <SetupRequired />

  const { id } = await params
  const { status, detail } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const course = await getCourse(supabase, user.id, id)
  if (!course) notFound()

  const [sources, totalTokens] = await Promise.all([
    listSources(supabase, user.id, id),
    sumTokens(supabase, user.id, id),
  ])

  return (
    <>
      <AppHeader email={user.email ?? null} current="home" />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
        <div className="text-sm">
          <Link
            href={`/courses/${id}`}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Back to course
          </Link>
        </div>

        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Notes for &ldquo;{course.title}&rdquo;
          </h1>
          <p className="text-sm text-zinc-500">
            Paste lecture notes or drop PDFs. We&apos;ll feed everything to your
            chosen AI provider when generating the outline.
          </p>
        </header>

        {status && (
          <div
            className={
              status === 'ok'
                ? 'rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                : 'rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100'
            }
          >
            <strong>{status === 'ok' ? 'OK' : 'Error'}:</strong>{' '}
            {detail ?? (status === 'ok' ? 'Done.' : 'Failed.')}
          </div>
        )}

        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">Paste text</h2>
          <form action={ingestTextAction} className="mt-3 space-y-3">
            <input type="hidden" name="courseId" value={course.id} />
            <label className="block space-y-1">
              <span className="text-xs font-medium">
                Title <span className="text-zinc-500">(optional)</span>
              </span>
              <input
                type="text"
                name="filename"
                maxLength={200}
                placeholder="e.g. Week 3 — Binary Trees"
                className="block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">Markdown or plain text</span>
              <textarea
                name="text"
                required
                rows={8}
                className="block w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Add as note
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">Upload file</h2>
          <p className="mt-1 text-xs text-zinc-500">
            PDF or plain text, up to 25&nbsp;MB.{' '}
            <span className="text-zinc-400">
              (docx / pptx / images arrive in Phase 3.5)
            </span>
          </p>
          <form action={ingestFileAction} className="mt-3 space-y-3">
            <input type="hidden" name="courseId" value={course.id} />
            <input
              type="file"
              name="file"
              accept=".pdf,application/pdf,text/plain,text/markdown,.md,.txt"
              required
              className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-zinc-800 dark:file:bg-zinc-50 dark:file:text-zinc-900 dark:hover:file:bg-zinc-200"
            />
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Upload &amp; parse
            </button>
          </form>
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">
              Sources ({sources.length})
            </h2>
            <span
              className={
                totalTokens > CONTEXT_WARNING_THRESHOLD
                  ? 'text-xs font-medium text-amber-600 dark:text-amber-300'
                  : 'text-xs text-zinc-500'
              }
            >
              ≈ {formatTokens(totalTokens)} tokens total
              {totalTokens > CONTEXT_WARNING_THRESHOLD &&
                ' — outline generation may be split into chunks'}
            </span>
          </div>

          {sources.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500 dark:border-zinc-700">
              No notes yet. Paste or upload above.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      {kindBadge(s.kind)}
                      <span className="truncate text-sm font-medium">
                        {s.filename ?? 'Pasted note'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      ≈ {formatTokens(s.token_count ?? 0)} tokens · added{' '}
                      {formatDate(s.created_at)}
                    </div>
                  </div>
                  <form action={deleteSourceAction}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="sourceId" value={s.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  )
}
