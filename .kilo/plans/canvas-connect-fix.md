# Canvas Edge Connection & Auto-Render Fix

## Problem

Two related bugs:

1. **Drawing an edge on the canvas does not persist the tool-agent relationship.** The React Flow canvas has no `onConnect` handler. Edges are display-only (computed from `agent.tools` data). Users can't drag from a tool handle to an agent handle to wire them.

2. **After attaching a tool (via detail panel button), the canvas doesn't re-render.** `attachTool()` in `useAgentBuilder.ts` calls the API but never updates the local `agents` state. The parent (`AgentBuilderPanel`) does `getAgentWithTools` → `setFullAgent`, but that only updates the detail panel's local state. The `agents` array (which drives the canvas) stays stale.

## Root Causes

### Root Cause A — No `onConnect` handler on React Flow
**File**: `AgentBuilderCanvas.tsx:144-156`

The `<ReactFlow>` has no `onConnect` prop. Edges are read-only — they're computed from `agents[].tools[]` and injected via `setEdges`. There is no way for the user to draw a new edge.

### Root Cause B — `attachTool`/`detachTool` don't update agents state
**File**: `hooks/useAgentBuilder.ts:122-132`

```ts
const attachTool = useCallback(async (agentId, toolId) => {
  await fetch(...);  // API call succeeds
  // ← NO state update here. agents[] stays stale.
}, []);
```

After the API call, nothing triggers a re-render of `agents`. The canvas layout depends on `agents` having `.tools` populated.

### Root Cause C — Canvas layout memo depends on stale `agents`
**File**: `AgentBuilderCanvas.tsx:115-118`

```ts
const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
  () => autoLayout(agents, tools),
  [agents, tools]
);
```

Since `agents` never updates after attach/detach, the layout never recomputes.

### Root Cause D — Edge interaction disabled
**File**: `AgentBuilderCanvas.tsx:152-153`

```ts
edgesFocusable={false}
edgesReconnectable={false}
```

These props prevent edge interaction, which is correct for display-only edges but wrong if we want users to draw edges.

## Fix Plan

### Fix 1: Add `onConnect` to canvas → call `attachTool`

**File**: `AgentBuilderCanvas.tsx`

Add a new prop `onConnect: (sourceId: string, targetId: string) => void` and wire it to React Flow's `onConnect` callback. When the user draws an edge:

1. Parse the source/target node IDs (format: `agent-{id}` / `tool-{id}`)
2. Determine direction (tool→agent or agent→tool — both should work)
3. Call `onConnect(agentId, toolId)`

```tsx
import { type Connection } from '@xyflow/react';

const handleConnect = useCallback((connection: Connection) => {
  if (!connection.source || !connection.target) return;
  const sourceType = connection.source.startsWith('agent-') ? 'agent' : 'tool';
  const targetType = connection.target.startsWith('agent-') ? 'agent' : 'tool';
  
  let agentId: string, toolId: string;
  if (sourceType === 'agent' && targetType === 'tool') {
    agentId = connection.source.replace('agent-', '');
    toolId = connection.target.replace('tool-', '');
  } else if (sourceType === 'tool' && targetType === 'agent') {
    toolId = connection.source.replace('tool-', '');
    agentId = connection.target.replace('agent-', '');
  } else {
    return; // agent-to-agent or tool-to-tool — ignore
  }
  
  onConnect?.(agentId, toolId);
}, [onConnect]);
```

### Fix 2: Update `attachTool`/`detachTool` in useAgentBuilder to refetch agents

**File**: `hooks/useAgentBuilder.ts`

After the API call, refetch the agents list so the local state is fresh:

```ts
const attachTool = useCallback(async (agentId: string, toolId: string) => {
  await fetch(`${API}/agents/${agentId}/tools`, { ... });
  await fetchAgents(); // ← refetch to get updated tools array
}, [fetchAgents]);

const detachTool = useCallback(async (agentId: string, toolId: string) => {
  await fetch(`${API}/agents/${agentId}/tools/${toolId}`, { method: 'DELETE' });
  await fetchAgents(); // ← refetch
}, [fetchAgents]);
```

### Fix 3: Wire `onConnect` through the component tree

**File**: `AgentBuilderPanel.tsx`

Pass `onConnect` from the panel to the canvas:

```tsx
const handleCanvasConnect = useCallback(async (agentId: string, toolId: string) => {
  await attachTool(agentId, toolId);
  onNotification('Tool connected', 'success');
}, [attachTool, onNotification]);

// In JSX:
<AgentBuilderCanvas
  ...
  onConnect={handleCanvasConnect}
/>
```

### Fix 4: Enable connection interaction on canvas

**File**: `AgentBuilderCanvas.tsx`

Remove `edgesFocusable={false}` and add `onConnect`. Keep `edgesReconnectable={false}` (we don't want users reconnecting existing edges, only drawing new ones).

### Fix 5: Add `isValidConnection` to prevent invalid edges

**File**: `AgentBuilderCanvas.tsx`

Only allow connections between agent↔tool nodes (not agent↔agent or tool↔tool):

```tsx
const isValidConnection = useCallback((connection: Connection) => {
  const srcIsAgent = connection.source?.startsWith('agent-');
  const tgtIsAgent = connection.target?.startsWith('agent-');
  return srcIsAgent !== tgtIsAgent; // XOR — must be different types
}, []);
```

## Files to Change

| File | Changes |
|------|---------|
| `components/agent-builder/AgentBuilderCanvas.tsx` | Add `onConnect` prop, `handleConnect` callback, `isValidConnection`, remove `edgesFocusable={false}`, add `onConnect={handleConnect}` to `<ReactFlow>` |
| `components/agent-builder/AgentBuilderPanel.tsx` | Add `handleCanvasConnect` callback, pass it as `onConnect` to `<AgentBuilderCanvas>` |
| `components/agent-builder/hooks/useAgentBuilder.ts` | Add `fetchAgents()` call after `attachTool` and `detachTool` API calls |

## Verification

1. Create an agent and a tool in the sidebar
2. On the canvas, drag from the tool's source handle to the agent's target handle
3. Verify: edge appears, tool count badge updates on the agent node, notification shows "Tool connected"
4. Open the agent detail panel → verify the tool appears in "Attached Tools"
5. Disconnect: in the detail panel, click the unlink button on an attached tool
6. Verify: edge disappears from canvas, tool count decrements
