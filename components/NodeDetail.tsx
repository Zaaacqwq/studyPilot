import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import type { OutlineTreeNode } from '@/lib/db/outline'
import type { Branch } from '@/lib/db/types'

interface NodeDetailProps {
  basePath: string
  selected: { node: OutlineTreeNode; path: OutlineTreeNode[] } | null
  mergedBranches: Branch[]
}

export function NodeDetail({
  basePath,
  selected,
  mergedBranches,
}: NodeDetailProps) {
  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
        <p className="font-medium">Pick a topic to study.</p>
        <p className="mt-1 text-xs">
          Click any node on the left to read its summary.
        </p>
      </div>
    )
  }

  const { node, path } = selected
  const breadcrumb = path.slice(0, -1)
  const childCount = node.children.length

  return (
    <article className="flex h-full flex-col rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      {breadcrumb.length > 0 && (
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-[11px] text-zinc-500">
          {breadcrumb.map((n) => (
            <span key={n.id} className="flex items-center gap-1">
              <Link
                href={`${basePath}?node=${n.id}`}
                scroll={false}
                className="hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {n.title}
              </Link>
              <span>›</span>
            </span>
          ))}
        </nav>
      )}

      <header className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{node.title}</h2>
        <span className="shrink-0 text-[11px] text-zinc-400">
          depth {node.depth} · {childCount}{' '}
          {childCount === 1 ? 'child' : 'children'}
        </span>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto">
        <section className="prose prose-sm dark:prose-invert max-w-none text-sm text-zinc-700 dark:text-zinc-200">
          {node.summary_md ? (
            <ReactMarkdown>{node.summary_md}</ReactMarkdown>
          ) : (
            <p className="text-zinc-500">No summary saved for this node.</p>
          )}
        </section>

        {mergedBranches.length > 0 && (
          <section className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Learned from branches
              </h3>
              <span className="text-[10px] text-zinc-400">
                {mergedBranches.length} merged
              </span>
            </div>
            <ul className="space-y-3">
              {mergedBranches.map((b) => (
                <li
                  key={b.id}
                  className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  <Link
                    href={`${basePath}?node=${node.id}&branch=${b.id}`}
                    className="text-[13px] font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    {b.title}
                  </Link>
                  {b.summary_md && (
                    <div className="prose prose-sm dark:prose-invert mt-2 max-w-none text-xs text-zinc-700 dark:text-zinc-200">
                      <ReactMarkdown>{b.summary_md}</ReactMarkdown>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="mt-4 border-t border-zinc-200 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800">
        Pull a branch on the right to ask a focused question about this node.
      </footer>
    </article>
  )
}
