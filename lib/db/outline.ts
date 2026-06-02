import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import type { OutlineNode } from './types'
import type { OutlineNodeDraft } from '@/lib/providers/types'

export interface OutlineTreeNode extends OutlineNode {
  children: OutlineTreeNode[]
}

interface FlatRow {
  id: string
  user_id: string
  course_id: string
  parent_id: string | null
  title: string
  summary_md: string
  position: number
  depth: number
}

function flatten(
  drafts: OutlineNodeDraft[],
  userId: string,
  courseId: string,
  parentId: string | null,
  depth: number,
): FlatRow[] {
  const rows: FlatRow[] = []
  drafts.forEach((draft, position) => {
    const id = randomUUID()
    rows.push({
      id,
      user_id: userId,
      course_id: courseId,
      parent_id: parentId,
      title: draft.title,
      summary_md: draft.summary,
      position,
      depth,
    })
    rows.push(
      ...flatten(draft.children ?? [], userId, courseId, id, depth + 1),
    )
  })
  return rows
}

/**
 * Atomically replace the entire outline for a course. Existing nodes (and any
 * cascading branches/messages) are deleted before the new tree is inserted.
 */
export async function replaceOutline(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  tree: OutlineNodeDraft[],
): Promise<number> {
  // CASCADE on outline_nodes.course_id removes children too.
  const { error: delError } = await supabase
    .from('outline_nodes')
    .delete()
    .eq('user_id', userId)
    .eq('course_id', courseId)
  if (delError) throw new Error(`replaceOutline (delete): ${delError.message}`)

  const rows = flatten(tree, userId, courseId, null, 0)
  if (rows.length === 0) return 0

  const { error: insError } = await supabase.from('outline_nodes').insert(rows)
  if (insError) throw new Error(`replaceOutline (insert): ${insError.message}`)
  return rows.length
}

export async function listOutlineNodes(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<OutlineNode[]> {
  const { data, error } = await supabase
    .from('outline_nodes')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .order('depth', { ascending: true })
    .order('position', { ascending: true })

  if (error) throw new Error(`listOutlineNodes: ${error.message}`)
  return (data ?? []) as OutlineNode[]
}

export async function getOutlineTree(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<OutlineTreeNode[]> {
  const flat = await listOutlineNodes(supabase, userId, courseId)
  return buildTree(flat)
}

function buildTree(flat: OutlineNode[]): OutlineTreeNode[] {
  const byId = new Map<string, OutlineTreeNode>()
  flat.forEach((n) => byId.set(n.id, { ...n, children: [] }))

  const roots: OutlineTreeNode[] = []
  flat.forEach((n) => {
    const node = byId.get(n.id)!
    if (n.parent_id) {
      const parent = byId.get(n.parent_id)
      if (parent) parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortKids = (nodes: OutlineTreeNode[]) => {
    nodes.sort((a, b) => a.position - b.position)
    nodes.forEach((n) => sortKids(n.children))
  }
  sortKids(roots)
  return roots
}
