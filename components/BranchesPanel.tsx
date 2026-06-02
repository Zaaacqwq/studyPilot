import Link from 'next/link'
import { clsx } from 'clsx'
import { createBranchAction } from '@/app/courses/[id]/branches/actions'
import type { Branch } from '@/lib/db/types'

interface BranchesPanelProps {
  basePath: string
  courseId: string
  nodeId: string | null
  nodeTitle: string | null
  branches: Branch[]
  selectedBranchId: string | null
  providerConfigured: boolean
  providerLabel: string
}

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function BranchesPanel({
  basePath,
  courseId,
  nodeId,
  nodeTitle,
  branches,
  selectedBranchId,
  providerConfigured,
  providerLabel,
}: BranchesPanelProps) {
  const open = branches.filter((b) => b.status === 'open')
  const closed = branches.filter((b) => b.status !== 'open')

  return (
    <aside className="flex h-full flex-col rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="mb-3">
        <h3 className="text-sm font-semibold">Branches</h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {nodeTitle
            ? `Focused questions on "${nodeTitle}".`
            : 'Pick a node first to ask focused questions.'}
        </p>
      </header>

      {nodeId && (
        <section className="mb-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
          {providerConfigured ? (
            <form action={createBranchAction} className="space-y-2">
              <input type="hidden" name="courseId" value={courseId} />
              <input type="hidden" name="nodeId" value={nodeId} />
              <textarea
                name="question"
                required
                rows={3}
                maxLength={4000}
                placeholder="What do you want to ask about this node?"
                className="block w-full resize-none rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="submit"
                className="w-full rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Pull branch ({providerLabel})
              </button>
            </form>
          ) : (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {providerLabel} isn&apos;t configured.{' '}
              <Link href="/settings/providers" className="underline">
                Set it up
              </Link>{' '}
              to start branches on this course.
            </p>
          )}
        </section>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto">
        {open.length > 0 && (
          <BranchList
            label="Open"
            branches={open}
            basePath={basePath}
            nodeId={nodeId}
            selectedBranchId={selectedBranchId}
          />
        )}

        {closed.length > 0 && (
          <details>
            <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-zinc-500">
              Closed ({closed.length})
            </summary>
            <div className="mt-2">
              <BranchList
                label="Closed"
                branches={closed}
                basePath={basePath}
                nodeId={nodeId}
                selectedBranchId={selectedBranchId}
                muted
              />
            </div>
          </details>
        )}

        {nodeId && branches.length === 0 && (
          <p className="rounded-md border border-dashed border-zinc-300 p-3 text-center text-[11px] text-zinc-500 dark:border-zinc-700">
            No branches on this node yet.
          </p>
        )}
      </div>
    </aside>
  )
}

interface BranchListProps {
  label: string
  branches: Branch[]
  basePath: string
  nodeId: string | null
  selectedBranchId: string | null
  muted?: boolean
}

function BranchList({
  branches,
  basePath,
  nodeId,
  selectedBranchId,
  muted,
}: BranchListProps) {
  return (
    <ul className="space-y-1">
      {branches.map((b) => {
        const isSelected = selectedBranchId === b.id
        const href = nodeId
          ? `${basePath}?node=${nodeId}&branch=${b.id}`
          : `${basePath}?branch=${b.id}`
        return (
          <li key={b.id}>
            <Link
              href={href}
              className={clsx(
                'block rounded-md px-2 py-1.5 text-xs',
                isSelected
                  ? 'bg-zinc-200 dark:bg-zinc-800'
                  : muted
                  ? 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-900',
              )}
            >
              <div className="line-clamp-2 font-medium">{b.title}</div>
              <div className="mt-0.5 text-[10px] text-zinc-400">
                {b.status} · {relativeDate(b.created_at)}
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
