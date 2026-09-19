# Bugfix Plan: Agent Builder Console Errors

Three recurring console errors in the Agent Builder workflow canvas.

---

## Error 1 — `Maximum update depth exceeded` in `WorkflowToolbar`

**Status:** Fixed

### Root Cause

`WorkflowToolbar.tsx` had a `useEffect` with **no dependency array** (runs every render). Inside, it compared props by reference (`nodes !== prev.nodes`) and called `onHeaderControls()` — which is `setWorkflowHeaderControls` from `App.tsx` — when it detected a "change."

The problem: `nodes` and `edges` from `@xyflow/react`'s `useNodesState`/`useEdgesState` could return new array references without actual content changes. Unstable inline callback props (e.g. `onBack={() => navigate(...)}` in `AgentBuilderMode.tsx:142`) also created new function references every render. Any of these false positives triggered the state setter, which re-rendered App → AgentBuilderMode → WorkflowCanvas → WorkflowToolbar → same false positive → infinite loop.

### Fix

**File:** `components/agent-builder/WorkflowToolbar.tsx` (lines 142-163)

Replaced the fragile shallow-reference comparison with a **serialized fingerprint** approach:

1. **`mountedRef` guard** — on the very first render, push initial controls to the parent once, then return.
2. **Structural fingerprint** — `JSON.stringify` for primitive values (`name`, `workflowId`, `canUndo`, etc.) plus a custom structural string for nodes/edges (node count + id+label pairs, edge count + id+source+target+label tuples). This is reference-agnostic — it only triggers when actual content changes.
3. **Short-circuit** — if the serialized string matches the previous one, skip the callback.

---

## Error 2 — `Parent container needs a width and a height` (React Flow)

**Status:** Fixed

### Root Cause

The `#scroll-container` div in `App.tsx` used `overflow-y-auto` for agent-builder routes. React Flow manages its own internal pan/zoom via CSS transforms, and a native scroll container above it can interfere with canvas interactions and cause the container sizing warning at mount time. Additionally, the `flex-1` wrapper around React Flow lacked `min-h-0`, which in flex columns prevents the element from shrinking below its content's intrinsic minimum height.

### Fix

**File:** `App.tsx` (line 1460)

- Changed `#scroll-container` to use `overflow-hidden` for agent-builder routes (same as database mode), since React Flow handles its own scrolling.
- Added `min-h-0` to `#scroll-container` to ensure proper flex shrinking.

```diff
- className={`flex-1 relative scroll-smooth ${location.pathname.startsWith('/database') ? 'overflow-hidden' : 'overflow-y-auto'}`}
+ className={`flex-1 relative scroll-smooth min-h-0 ${(location.pathname.startsWith('/database') || location.pathname.startsWith('/agent-builder')) ? 'overflow-hidden' : 'overflow-y-auto'}`}
```

**File:** `App.tsx` (line 1115)

- Added `shrink-0` to the top bar div to prevent it from shrinking under flex pressure.

```diff
- className="flex items-center px-3 py-2 md:px-4 md:py-2 sticky top-0 z-10 relative"
+ className="flex items-center px-3 py-2 md:px-4 md:py-2 sticky top-0 z-10 relative shrink-0"
```

**File:** `components/agent-builder/WorkflowCanvas.tsx` (line 388)

- Added `min-h-0` to the React Flow wrapper div so it can shrink properly in the flex column.

```diff
- <div ref={reactFlowWrapper} className="flex-1">
+ <div ref={reactFlowWrapper} className="flex-1 min-h-0">
```

---

## Error 3 — `Node 'end' is not reachable` (LangGraph)

**Status:** Fixed

### Root Cause

**Two separate issues:**

1. **Graph building:** `server/services/workflowExecutor.ts` added **all** workflow nodes to the LangGraph `StateGraph`, including user-created `end` nodes (nodes with `type: "end"`). LangGraph has its own terminal sentinel: the imported `END` constant. When an edge targeted a user's `"end"` node (e.g. `graph.addEdge("transform", "end")`), LangGraph treated `"end"` as a regular node ID — not as the graph terminator. Since no edges pointed *from* the `"end"` node to any other node (or to `END`), LangGraph flagged it as unreachable.

2. **Error handling:** `graph.compile()` was called **outside** the try-catch block in `executeStream()`. If `compile()` threw a validation error, it was an unhandled promise rejection that propagated to the caller as an unhandled error.

### Fix

**File:** `server/services/workflowExecutor.ts`

**Part A — Graph building** (lines 152-233):

1. **`resolveTarget()` method** (lines 152-157) — given a target node ID, looks up whether that node has `type === 'end'`. If so, returns LangGraph's `END` constant. Otherwise returns the ID unchanged.

2. **Skip end nodes in `addNode()`** (lines 163-164) — user `end` nodes are no longer added as graph nodes. They are represented solely by the `END` constant.

3. **All edge targets resolved** — every `addEdge()` and `addConditionalEdges()` call now passes targets through `resolveTarget()`:
   - Single edges: `graph.addEdge(node.id, this.resolveTarget(outEdges[0].target))`
   - Conditional (if-else/while/user-approval): both branch targets resolved
   - Fan-out (multiple edges): `resolvedTargets = [...new Set(outEdges.map(e => this.resolveTarget(e.target)))]`

4. **Fallback to END** — if a resolved target is empty string (no target found), falls back to `END`.

**Part B — Error handling** (lines 100-152):

Moved `buildGraph()` and `graph.compile()` **inside** the try-catch block so any graph validation errors are caught and yielded as `{ type: 'error', error: err.message }` stream events instead of propagating as unhandled rejections.

### Before/After

**Before:** Workflow `start → transform → end` built a graph with nodes `[start, transform, end]` and edges `[START→start, start→transform, transform→end]`. LangGraph couldn't reach the `end` node because it wasn't the built-in `END`.

**After:** Same workflow builds a graph with nodes `[start, transform]` and edges `[START→start, start→transform, transform→END]`. The `end` node is correctly mapped to LangGraph's terminal.

---

## Files Changed

| File | Change |
|------|--------|
| `components/agent-builder/WorkflowToolbar.tsx` | Replaced shallow-reference useEffect with serialized-fingerprint comparison |
| `components/agent-builder/WorkflowCanvas.tsx` | Added `min-h-0` to React Flow wrapper div |
| `App.tsx` | `overflow-hidden` for agent-builder scroll container, `min-h-0` on scroll container, `shrink-0` on top bar |
| `server/services/workflowExecutor.ts` | Added `resolveTarget()`, skip `end` nodes in graph, resolve all edge targets to `END`, moved buildGraph/compile inside try-catch |

## Verification

```bash
npm run build   # Vite production build — passes (verified)
```

No lint/typecheck/test scripts exist in this project. Manual testing needed:
1. Open Agent Builder → open a workflow → confirm no infinite re-render loop
2. Create a workflow with an `end` node → run it → confirm no LangGraph unreachable error
3. Verify React Flow canvas renders without container sizing warnings
4. **Restart the server** — `workflowExecutor.ts` is server-side and requires a restart to pick up changes

## Important Note

The LangGraph `workflowExecutor.ts` fix requires **restarting the Express server** (`npm run dev:server`). Server-side TypeScript files are loaded at runtime by `tsx` and may not hot-reload depending on the dev server configuration. The Vite frontend build covers the other three files.
