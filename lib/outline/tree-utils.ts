import type { OutlineTreeNode } from '@/lib/db/outline'

/**
 * Find a node by id along with the chain of ancestors (root → ... → self).
 * Returns null if the id is not present.
 */
export function findNodeWithPath(
  nodes: OutlineTreeNode[],
  targetId: string,
): { node: OutlineTreeNode; path: OutlineTreeNode[] } | null {
  const walk = (
    current: OutlineTreeNode[],
    ancestors: OutlineTreeNode[],
  ): { node: OutlineTreeNode; path: OutlineTreeNode[] } | null => {
    for (const node of current) {
      if (node.id === targetId) {
        return { node, path: [...ancestors, node] }
      }
      const hit = walk(node.children, [...ancestors, node])
      if (hit) return hit
    }
    return null
  }
  return walk(nodes, [])
}

export function countNodes(nodes: OutlineTreeNode[]): number {
  let n = 0
  const walk = (current: OutlineTreeNode[]) => {
    for (const node of current) {
      n += 1
      walk(node.children)
    }
  }
  walk(nodes)
  return n
}
