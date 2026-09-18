import type { Node, Edge } from '@xyflow/react';

/**
 * Remove edges whose source or target node no longer exists.
 * Prevents stale edges from accumulating after node deletion.
 */
export function cleanupInvalidEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const validIds = new Set(nodes.map(n => n.id));
  return edges.filter(e => validIds.has(e.source) && validIds.has(e.target));
}
