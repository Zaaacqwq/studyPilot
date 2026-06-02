import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { AppHeader } from '@/components/AppHeader'
import { SetupRequired } from '@/components/SetupRequired'
import { OutlineTree } from '@/components/OutlineTree'
import { NodeDetail } from '@/components/NodeDetail'
import { BranchesPanel } from '@/components/BranchesPanel'
import { getCourse } from '@/lib/db/courses'
import { listSources, sumTokens } from '@/lib/db/sources'
import { getOutlineTree } from '@/lib/db/outline'
import { findNodeWithPath, countNodes } from '@/lib/outline/tree-utils'
import { listBranchesForNode, getBranch } from '@/lib/db/branches'
import { listMessages } from '@/lib/db/messages'
import { loadCredential, PROVIDER_LABELS } from '@/lib/providers'
import { generateOutlineAction } from '../actions'
import { BranchChat } from '@/components/BranchChat'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    node?: string
    branch?: string
    status?: 'ok' | 'err'
    detail?: string
  }>
}

function formatTokens(n: number): string {
  if (n < 1_000) return `${n}`
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

export default async function CourseStudyPage({
  params,
  searchParams,
}: PageProps) {
  if (!isSupabaseConfigured()) return <SetupRequired />

  const { id } = await params
  const { node: nodeParam, branch: branchParam, status, detail } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const course = await getCourse(supabase, user.id, id)
  if (!course) notFound()

  const [sources, totalTokens, outline, providerConfigured] = await Promise.all([
    listSources(supabase, user.id, id),
    sumTokens(supabase, user.id, id),
    getOutlineTree(supabase, user.id, id),
    loadCredential(supabase, user.id, course.default_provider),
  ])

  const hasOutline = outline.length > 0
  const totalNodes = countNodes(outline)
  const selected = nodeParam ? findNodeWithPath(outline, nodeParam) : null
  const basePath = `/courses/${course.id}`

  // Load branches for the selected node (right column always reflects current node).
  const nodeBranches = selected
    ? await listBranchesForNode(supabase, user.id, selected.node.id)
    : []

  // If a branch is selected, load it + its messages for the chat panel.
  const activeBranch =
    branchParam && selected
      ? await getBranch(supabase, user.id, branchParam)
      : null
  const branchBelongsToNode =
    activeBranch && selected && activeBranch.node_id === selected.node.id
  const activeBranchMessages =
    activeBranch && branchBelongsToNode
      ? await listMessages(supabase, user.id, activeBranch.id)
      : []

  return (
    <>
      <AppHeader email={user.email ?? null} current="home" />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Link
              href="/"
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ← All courses
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {course.title}
              </h1>
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                {PROVIDER_LABELS[course.default_provider]}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              {sources.length} source{sources.length === 1 ? '' : 's'} ·{' '}
              {formatTokens(totalTokens)} tokens
              {hasOutline && ` · ${totalNodes} outline nodes`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`${basePath}/ingest`}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {sources.length === 0 ? 'Add notes' : 'Manage notes'}
            </Link>
            <Link
              href={`${basePath}/settings`}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Settings
            </Link>
            {sources.length > 0 && providerConfigured && (
              <form action={generateOutlineAction}>
                <input type="hidden" name="courseId" value={course.id} />
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {hasOutline ? 'Regenerate' : 'Generate outline'}
                </button>
              </form>
            )}
          </div>
        </div>

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

        {!hasOutline ? (
          <EmptyState
            sourcesCount={sources.length}
            totalTokens={totalTokens}
            providerConfigured={!!providerConfigured}
            providerLabel={PROVIDER_LABELS[course.default_provider]}
          />
        ) : (
          <section className="grid h-[calc(100vh-220px)] min-h-[480px] grid-cols-1 gap-3 lg:grid-cols-[280px_1fr_300px]">
            <div className="overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-2 px-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Outline
              </h2>
              <OutlineTree
                nodes={outline}
                basePath={basePath}
                selectedId={selected?.node.id ?? null}
              />
            </div>

            <div className="min-h-0 overflow-hidden">
              {activeBranch && branchBelongsToNode && selected ? (
                <BranchChat
                  branch={activeBranch}
                  initialMessages={activeBranchMessages}
                  courseId={course.id}
                  nodeBackHref={`${basePath}?node=${selected.node.id}`}
                />
              ) : (
                <NodeDetail
                  basePath={basePath}
                  selected={selected}
                  mergedBranches={nodeBranches.filter(
                    (b) => b.status === 'merged',
                  )}
                />
              )}
            </div>

            <div className="min-h-0 overflow-hidden">
              <BranchesPanel
                basePath={basePath}
                courseId={course.id}
                nodeId={selected?.node.id ?? null}
                nodeTitle={selected?.node.title ?? null}
                branches={nodeBranches}
                selectedBranchId={activeBranch?.id ?? null}
                providerConfigured={!!providerConfigured}
                providerLabel={PROVIDER_LABELS[course.default_provider]}
              />
            </div>
          </section>
        )}
      </main>
    </>
  )
}

interface EmptyStateProps {
  sourcesCount: number
  totalTokens: number
  providerConfigured: boolean
  providerLabel: string
}

function EmptyState({
  sourcesCount,
  totalTokens,
  providerConfigured,
  providerLabel,
}: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-dashed border-zinc-300 bg-white/60 p-12 text-center dark:border-zinc-700 dark:bg-zinc-950/60">
      <h2 className="text-base font-semibold">No outline yet</h2>
      {sourcesCount === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          Add lecture notes first — paste text or upload a PDF.
        </p>
      ) : !providerConfigured ? (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-300">
          The course&apos;s provider ({providerLabel}) isn&apos;t configured.
          Open <Link href="/settings/providers" className="underline">Settings → Providers</Link>.
        </p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">
          Ready when you are. <strong>{providerLabel}</strong> will see ≈{' '}
          {formatTokens(totalTokens)} tokens of context.
        </p>
      )}
    </section>
  )
}
