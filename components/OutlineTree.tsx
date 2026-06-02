'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import type { OutlineTreeNode } from '@/lib/db/outline'

interface OutlineTreeProps {
  nodes: OutlineTreeNode[]
  basePath: string
  selectedId: string | null
}

export function OutlineTree({ nodes, basePath, selectedId }: OutlineTreeProps) {
  const ancestorPath = useMemo(
    () => (selectedId ? findAncestors(nodes, selectedId) : new Set<string>()),
    [nodes, selectedId],
  )

  return (
    <ul className="space-y-0.5 text-sm">
      {nodes.map((n) => (
        <Item
          key={n.id}
          node={n}
          basePath={basePath}
          selectedId={selectedId}
          ancestorIds={ancestorPath}
        />
      ))}
    </ul>
  )
}

interface ItemProps {
  node: OutlineTreeNode
  basePath: string
  selectedId: string | null
  ancestorIds: Set<string>
}

function Item({ node, basePath, selectedId, ancestorIds }: ItemProps) {
  const hasKids = node.children.length > 0
  const isSelected = selectedId === node.id
  // Auto-expand: top-level, on the path to selection, or self is selected.
  const shouldAutoExpand =
    node.depth === 0 || ancestorIds.has(node.id) || isSelected
  const [open, setOpen] = useState(shouldAutoExpand)

  return (
    <li>
      <div
        className={clsx(
          'flex items-center gap-1 rounded px-1.5 py-1 text-sm',
          isSelected
            ? 'bg-zinc-200 dark:bg-zinc-800'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-900',
        )}
      >
        {hasKids ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Collapse' : 'Expand'}
            className="w-4 shrink-0 select-none text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4 shrink-0 select-none text-zinc-300 dark:text-zinc-700">
            ·
          </span>
        )}

        <Link
          href={`${basePath}?node=${node.id}`}
          scroll={false}
          className={clsx(
            'min-w-0 flex-1 truncate text-left',
            isSelected
              ? 'font-medium text-zinc-900 dark:text-zinc-50'
              : 'text-zinc-700 dark:text-zinc-300',
          )}
        >
          {node.title}
        </Link>
      </div>

      {hasKids && open && (
        <div className="ml-3 border-l border-zinc-200 pl-2 dark:border-zinc-800">
          <OutlineTree
            nodes={node.children}
            basePath={basePath}
            selectedId={selectedId}
          />
        </div>
      )}
    </li>
  )
}

function findAncestors(
  nodes: OutlineTreeNode[],
  targetId: string,
): Set<string> {
  const ancestors = new Set<string>()
  const walk = (
    current: OutlineTreeNode[],
    path: string[],
  ): boolean => {
    for (const node of current) {
      if (node.id === targetId) {
        path.forEach((id) => ancestors.add(id))
        return true
      }
      if (walk(node.children, [...path, node.id])) return true
    }
    return false
  }
  walk(nodes, [])
  return ancestors
}
