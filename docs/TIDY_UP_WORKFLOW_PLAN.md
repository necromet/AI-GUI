# Tidy Up Workflow — Auto-Cleanup Button

## Problem

Nodes placed on the agent-builder canvas quickly become messy: uneven spacing, overlapping nodes, misaligned branches, inconsistent gaps. The existing "Auto-arrange" button uses a basic dagre LR layout but does not snap to grid, align branches, or guarantee uniform spacing.

**Goal:** A single **Tidy Up** button that comprehensively cleans up the canvas — clean left-to-right flow, grid-aligned positions, consistent spacing, branch-aware positioning — in one click.

---

## What "Tidy Up" Does (vs existing Auto-arrange)

| Aspect | Auto-arrange (existing) | Tidy Up (new) |
|--------|------------------------|---------------|
| Layout engine | dagre LR | dagre LR + post-processing |
| Grid snapping | No | Yes — 20px grid |
| Branch separation | Generic | True/False, loop/exit, approve/reject on separate rows |
| Node dimension estimate | Fixed 180×72 | Per-type (note is wider, start/end narrower) |
| Overlap prevention | Implicit | Explicit collision resolution |
| Spacing uniformity | dagre defaults | Configurable gap constants |
| Viewport | fitView | fitView with 0.2 padding |
| Undo support | Yes | Yes (snapshot before layout) |

---

## Design

### Button

- **Location:** Next to the existing "Auto-arrange" button in the toolbar cluster (both `WorkflowHeaderBar` and `WorkflowToolbar` render paths)
- **Icon:** `Sparkles` (lucide-react) — universally recognized for "auto-cleanup"
- **Label:** "Tidy up workflow"
- **Shortcut:** `Shift + T` (not bound to anything currently)

### Algorithm — `tidyUpLayout(nodes, edges)`

```
1. Build dagre graph with enhanced parameters
   - rankdir: 'LR' (left → right flow)
   - ranksep: 140 (horizontal gap between ranks)
   - nodesep: 80  (vertical gap between nodes at same rank)
   - Node dimensions vary by type (see table below)

2. Run dagre.layout(graph)

3. Post-process each node position:
   a. Snap to 20px grid: round(x/20)*20, round(y/20)*20
   b. Branch adjustment:
      - if-else:   true-handle target shifted up −40px, false-handle target shifted down +40px
      - while:     continue target shifted up −40px, break target shifted down +40px
      - user-approval: approve target shifted up −40px, reject target shifted down +40px
   c. Collision resolution: if two nodes overlap (within 160×70 bounding boxes),
      push the lower one down by the overlap amount + 20px

4. Center the layout: translate all nodes so the bounding-box center is at (0, 0)

5. fitView({ padding: 0.2, duration: 300 })
```

### Node Dimension Estimates

| Node type | Width | Height |
|-----------|-------|--------|
| start, end | 140 | 64 |
| note | 220 | 80 |
| if-else, while, user-approval | 180 | 88 |
| all others | 180 | 72 |

### Grid Constants

```ts
const GRID = 20;        // snap-to-grid size
const RANK_SEP = 140;   // horizontal gap between ranks
const NODE_SEP = 80;    // vertical gap between nodes at same rank
const BRANCH_OFFSET = 40; // vertical offset for branch handles
```

---

## File-by-File Changes

### 1. `components/agent-builder/WorkflowCanvas.tsx` — Add `handleTidyUp`

Add a new `handleTidyUp` callback (alongside the existing `handleAutoLayout`):

```ts
const handleTidyUp = useCallback(() => {
  if (nodes.length === 0) return;
  undoRedo.pushSnapshot(nodes, edges, 'Tidy up');

  // 1. Build dagre graph with per-type dimensions
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'LR', ranksep: 140, nodesep: 80, marginx: 40, marginy: 40 });

  const getNodeSize = (nodeType: string) => {
    if (nodeType === 'start' || nodeType === 'end') return { width: 140, height: 64 };
    if (nodeType === 'note') return { width: 220, height: 80 };
    if (['if-else', 'while', 'user-approval'].includes(nodeType)) return { width: 180, height: 88 };
    return { width: 180, height: 72 };
  };

  nodes.forEach(node => {
    const size = getNodeSize(node.data?.nodeType as string);
    graph.setNode(node.id, size);
  });
  edges.forEach(edge => {
    if (nodes.some(n => n.id === edge.source) && nodes.some(n => n.id === edge.target))
      graph.setEdge(edge.source, edge.target);
  });
  dagre.layout(graph);

  // 2. Collect raw positions from dagre
  let rawPositions = nodes.map(node => {
    const point = graph.node(node.id);
    const size = getNodeSize(node.data?.nodeType as string);
    return {
      id: node.id,
      x: (point?.x ?? 0) - size.width / 2,
      y: (point?.y ?? 0) - size.height / 2,
    };
  });

  // 3. Branch adjustments
  const BRANCH_OFFSET = 40;
  const branchParents = edges.filter(e =>
    ['if', 'else', 'continue', 'break', 'approve', 'reject'].includes(String(e.sourceHandle))
  );
  for (const edge of branchParents) {
    const offset = ['if', 'continue', 'approve'].includes(String(edge.sourceHandle)) ? -BRANCH_OFFSET : BRANCH_OFFSET;
    const target = rawPositions.find(p => p.id === edge.target);
    if (target) target.y += offset;
  }

  // 4. Snap to grid
  const GRID = 20;
  rawPositions = rawPositions.map(p => ({
    ...p,
    x: Math.round(p.x / GRID) * GRID,
    y: Math.round(p.y / GRID) * GRID,
  }));

  // 5. Collision resolution
  rawPositions.sort((a, b) => a.x - b.x || a.y - b.y);
  for (let i = 1; i < rawPositions.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = rawPositions[j], b = rawPositions[i];
      if (Math.abs(a.x - b.x) < 160 && Math.abs(a.y - b.y) < 70) {
        b.y = a.y + 90;
        b.y = Math.round(b.y / GRID) * GRID;
      }
    }
  }

  // 6. Center layout
  const minX = Math.min(...rawPositions.map(p => p.x));
  const maxX = Math.max(...rawPositions.map(p => p.x));
  const minY = Math.min(...rawPositions.map(p => p.y));
  const maxY = Math.max(...rawPositions.map(p => p.y));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  rawPositions = rawPositions.map(p => ({ ...p, x: p.x - cx, y: p.y - cy }));

  // 7. Apply
  const positionMap = new Map(rawPositions.map(p => [p.id, p]));
  setNodes(current => current.map(node => {
    const pos = positionMap.get(node.id);
    return pos ? { ...node, position: { x: pos.x, y: pos.y } } : node;
  }));
  requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
}, [nodes, edges, undoRedo, setNodes, fitView]);
```

Pass `onTidyUp={handleTidyUp}` to `WorkflowToolbar`.

### 2. `components/agent-builder/WorkflowToolbar.tsx` — Wire the button

- Add `onTidyUp: () => void` to `Props`
- Add to `controlsRef` (both initial + update assignments)
- Add `onTidyUp` to `WorkflowHeaderControls` type
- Render button in the non-header-controls fallback toolbar (next to auto-layout)
- Import `Sparkles` from lucide-react

### 3. `components/agent-builder/types.ts` — Add to `WorkflowHeaderControls`

```ts
onTidyUp: () => void;
```

### 4. `components/agent-builder/WorkflowHeaderBar.tsx` — Render the button

Add an `IconButton` with `Sparkles` icon next to the existing "Auto-arrange" button:

```tsx
<IconButton label="Tidy up workflow" shortcut="⇧ T" onClick={w.onTidyUp}>
  <Sparkles size={14} />
</IconButton>
```

### 5. `components/agent-builder/WorkflowCanvas.tsx` — Keyboard shortcut

In the existing `handleKeyDown` effect, add:

```ts
if (e.key === 'T' && e.shiftKey && !isInput && !e.ctrlKey && !e.metaKey) {
  e.preventDefault();
  handleTidyUp();
  return;
}
```

Add `handleTidyUp` to the dependency array.

---

## Files Touched (Summary)

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `components/agent-builder/WorkflowCanvas.tsx` | Edit | Add `handleTidyUp` callback + shortcut |
| 2 | `components/agent-builder/WorkflowToolbar.tsx` | Edit | Add `onTidyUp` prop + button in fallback toolbar |
| 3 | `components/agent-builder/types.ts` | Edit | Add `onTidyUp` to `WorkflowHeaderControls` |
| 4 | `components/agent-builder/WorkflowHeaderBar.tsx` | Edit | Add Sparkles button in header bar |

---

## Verification

1. `npm run build` — must pass
2. `npx tsx tests/agent-builder/graph.test.ts` — all 10 tests must pass
3. Manual: place 5+ nodes in a messy arrangement → click Tidy Up → verify clean LR flow with consistent spacing, branches on separate rows, grid-aligned
4. Manual: verify `Shift+T` triggers the same action
5. Manual: verify undo (`Ctrl+Z`) reverts the tidy-up
