# Agent Builder — Workflow Creation Popover + Chat Workflow Flow

## Problem

1. **Workflow creation has no name input**: The "+" button immediately creates a workflow named "New Workflow" — no user input for the name.
2. **Chat tab picks agents globally**: In chat view, users must select an agent from the sidebar's global list. Instead, users should pick a workflow first, then pick one of that workflow's agents to chat with.

## Goal

- **Workflow creation**: Replace the instant-create "+" button with a Popover containing a name input (matching the agent/tool creation pattern).
- **Chat flow**: Workflow → then pick agent. When the user switches to the Chat tab, the sidebar shows the workflow's agents. The user picks one to chat with. The main area shows a workflow-agent picker if no agent is selected within the workflow.

---

## Changes

### 1. Sidebar — Workflow Creation Popover

**File: `components/Sidebar.tsx` — `AgentBuilderSidebarContent`**

Replace the workflow "+" button (line ~457-462) with a `Popover` containing:
- A text `Input` for the workflow name (pre-filled empty, placeholder "Workflow name")
- A "Create Workflow" `Button` (disabled when name is empty)
- On create: calls `controls.onCreateWorkflow({ name })` then auto-selects the new workflow

Pattern: identical to the existing agent/tool creation Popovers already in this component.

New state needed:
- `newWorkflowName` (string)
- `workflowPopoverOpen` (boolean)

### 2. Panel — Chat View Shows Workflow Agents

**File: `components/agent-builder/AgentBuilderPanel.tsx`**

Currently the chat view renders:
```tsx
<AgentChatView agent={fullAgent || selectedAgent} />
```

Change: When `view === 'chat'`, pass `workflowDetail.agents` as available agents and let the user pick one within the chat view. The `selectedAgentId` is still tracked in the panel.

Add a new prop to `AgentChatView`:
```tsx
<AgentChatView
  agent={fullAgent || selectedAgent}
  workflowAgents={workflowDetail?.agents ?? []}
  onSelectAgent={setSelectedAgentId}
/>
```

### 3. Chat View — Agent Picker

**File: `components/agent-builder/AgentChatView.tsx`**

When `workflowAgents` has items and no `agent` is selected, show a picker grid of the workflow's agents instead of the "Select an agent" empty state. Each card shows agent name, model, tool count, and color. Clicking one calls `onSelectAgent(agent.id)`.

When `agent` is selected, show the existing chat UI as-is, but add a small "switch agent" affordance in the chat header (e.g., agent name is clickable to go back to the picker).

Props to add:
- `workflowAgents?: AgentBuilderAgent[]`
- `onSelectAgent?: (id: string) => void`

---

## File Summary

| File | Change |
|------|--------|
| `components/Sidebar.tsx` | Replace workflow "+" with Popover (name input + create button) |
| `components/agent-builder/AgentBuilderPanel.tsx` | Pass `workflowAgents` + `onSelectAgent` to `AgentChatView` |
| `components/agent-builder/AgentChatView.tsx` | Add workflow agent picker (grid of cards) when no agent selected; add switch-agent in header |

## Implementation Order

1. **Sidebar** — Workflow creation Popover
2. **AgentChatView** — Add `workflowAgents` / `onSelectAgent` props + agent picker UI
3. **AgentBuilderPanel** — Wire new props to `AgentChatView`
4. **Build** — Verify `npm run build`
