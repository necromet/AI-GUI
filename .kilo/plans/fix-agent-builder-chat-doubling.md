# Fix: Agent Builder Chat Panel Doubling on Workflow Switch

## Problem

In `/experiments/plugin-agent`, when a user has a chat panel open for workflow A and selects workflow B in the sidebar, the chat for workflow B opens behind the existing one instead of replacing it. The root cause is that `AgentChatView` lacks proper state isolation between workflows.

## Root Cause Analysis

Three issues in `components/agent-builder/AgentBuilderPanel.tsx`:

1. **`selectedAgentId` is not cleared when switching workflows** (line 50-51). When you switch from workflow A to B, `selectedAgentId` still points to workflow A's agent. The auto-select effect (line 75-79) only fires when `!selectedAgentId`, so it never triggers for workflow B.

2. **`AgentChatView` has no `key` prop** (line 258-262). React reuses the same component instance across workflow switches. The `useAgentChat()` hook's internal state (messages, toolCalls, isStreaming) persists across renders. The `clearMessages` effect in `AgentChatView` (line 26-28) runs asynchronously after render, causing the old chat content to flash/remain visible.

3. **`selectedAgent` resolves to a stale agent** (line 122). `agents.find(a => a.id === selectedAgentId)` searches the GLOBAL agents list, so it finds workflow A's agent even when workflow B is selected. This causes `AgentChatView` to render with the wrong agent until `workflowDetail` loads and the auto-select effect runs.

## Fix

**File: `components/agent-builder/AgentBuilderPanel.tsx`**

### Change 1: Clear `selectedAgentId` when workflow changes
Add logic so that when `selectedWorkflowId` changes, `selectedAgentId` is reset to `null`. This allows the auto-select effect (line 75-79) to pick the first agent of the new workflow.

```tsx
useEffect(() => {
  setSelectedAgentId(null);
  setWorkflowDetail(null);
}, [selectedWorkflowId]);
```

Replace the existing workflow detail loading effect (line 67-73) with this combined version that also resets the selected agent.

### Change 2: Add `key` prop to `AgentChatView`
Force React to unmount/remount `AgentChatView` when the workflow changes, ensuring `useAgentChat()` state is fully reset:

```tsx
<AgentChatView
  key={selectedWorkflowId}
  agent={fullAgent || selectedAgent}
  workflowAgents={workflowDetail?.agents}
  onSelectAgent={(id) => setSelectedAgentId(id || null)}
/>
```

### Change 3: Guard `selectedAgent` against stale IDs
Ensure `selectedAgent` only resolves to an agent that belongs to the current workflow:

```tsx
const selectedAgent = (() => {
  if (!selectedAgentId) return null;
  const wfAgent = workflowDetail?.agents.find(a => a.id === selectedAgentId);
  if (wfAgent) return wfAgent;
  return agents.find(a => a.id === selectedAgentId) || null;
})();
```

## Files to Edit

- `components/agent-builder/AgentBuilderPanel.tsx` (3 changes)

## Verification

- `npm run build` must pass
