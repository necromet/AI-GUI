# Agent Builder — Workflow-First Redesign + Back Navigation

## Problem

1. **No back navigation**: From `/experiments/plugin-agent`, there's no way to go back to the `/experiments` tool selection (RAG, Agent Builder, Skema, Python).
2. **Workflows are disconnected**: `selectedWorkflowId` is tracked but never used. The canvas always shows ALL agents and ALL tools. Selecting a workflow in the sidebar just highlights it — it doesn't filter the canvas or load any workflow-specific state. `graph_json` is stored but never read/written by the canvas.
3. **Flat hierarchy**: Agents, tools, and workflows are all peers. Users can create agents/tools without any workflow context.

## Goal

- **Workflow-first**: Users must select or create a workflow before the canvas is usable. The canvas shows only the agents and tools placed in that workflow.
- **Global agents & tools**: Agents and tools remain global (shared library). Users pick from the global pool to add them to a workflow.
- **Back navigation**: Add an `ArrowLeft` back button in the agent-builder sidebar header to return to `/experiments`.

---

## Data Model Changes

### New junction tables (`server/db/schema.ts`)

```sql
CREATE TABLE IF NOT EXISTS agent_builder_workflow_agents (
  workflow_id TEXT NOT NULL REFERENCES agent_builder_workflows(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agent_builder_agents(id) ON DELETE CASCADE,
  PRIMARY KEY (workflow_id, agent_id)
);

CREATE TABLE IF NOT EXISTS agent_builder_workflow_tools (
  workflow_id TEXT NOT NULL REFERENCES agent_builder_workflows(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL REFERENCES agent_builder_tools(id) ON DELETE CASCADE,
  PRIMARY KEY (workflow_id, tool_id)
);
```

### `graph_json` semantics

`agent_builder_workflows.graph_json` stores canvas node positions and edges:
```json
{
  "nodePositions": { "agent-abc123": { "x": 100, "y": 50 }, "tool-def456": { "x": 300, "y": 50 } },
  "edges": [{ "source": "agent-abc123", "target": "tool-def456" }]
}
```

When loading a workflow, the canvas reads the junction tables to know which agents/tools are in the workflow, then uses `graph_json.nodePositions` for layout (fallback: dagre auto-layout for new nodes).

When the user drags a node or connects agent↔tool, the canvas debounces a `PUT /api/agent-builder/workflows/:id` with the updated `graph_json`.

---

## Backend Changes (`server/routes/agentBuilder.ts`)

### New endpoints

```
POST   /api/agent-builder/workflows/:id/agents     → { agentId } → add agent to workflow
DELETE /api/agent-builder/workflows/:id/agents/:aid → remove agent from workflow
POST   /api/agent-builder/workflows/:id/tools       → { toolId } → add tool to workflow
DELETE /api/agent-builder/workflows/:id/tools/:tid  → remove tool from workflow
GET    /api/agent-builder/workflows/:id/detail      → workflow + its agents (with tools) + its tools
```

### Modify `GET /api/agent-builder/workflows/:id/detail`

Returns:
```json
{
  "id": "...",
  "name": "...",
  "description": "...",
  "graph_json": { "nodePositions": {...}, "edges": [...] },
  "agents": [{ "id": "...", "name": "...", "system_prompt": "...", "model": "...", "color": "...", "tools": [...] }],
  "tools": [{ "id": "...", "name": "...", "description": "...", "parameters_schema": {...}, "color": "..." }]
}
```

### No changes to existing CRUD

Agents and tools CRUD stays global. The workflow just references them via junction tables.

---

## Frontend Changes

### 1. Back Navigation

**File: `components/Sidebar.tsx` — `AgentBuilderSidebarContent`**

Add an `onBack` prop (or use `navigate` from react-router). Add an `ArrowLeft` button at the top of the sidebar content, matching the Skema/settings pattern.

**File: `components/agent-builder/AgentBuilderPanel.tsx`**

Add `onBack` to `AgentBuilderSidebarControls` interface. Wire it to `navigate('/experiments')` via the parent App.tsx, or pass `navigate` from the sidebar directly.

Simplest approach: Since `AgentBuilderSidebarContent` is in `Sidebar.tsx` which already has `useNavigate()`, just add a back button that calls `navigate('/experiments')`.

### 2. Workflow-First Flow

**New state**: `selectedWorkflowDetail` — the full workflow with its agents and tools, loaded from `GET /api/agent-builder/workflows/:id/detail`.

**File: `components/agent-builder/AgentBuilderPanel.tsx`**

- When no workflow is selected: show a **workflow picker** (empty state or workflow list).
- When a workflow is selected: show canvas/chat with the workflow's agents and tools.
- `selectedWorkflowId` gates the entire canvas/chat view.

**File: `components/agent-builder/hooks/useAgentBuilder.ts`**

Add:
- `fetchWorkflowDetail(id)` → calls `GET /api/agent-builder/workflows/:id/detail`
- `addAgentToWorkflow(workflowId, agentId)` → `POST /api/agent-builder/workflows/:id/agents`
- `removeAgentFromWorkflow(workflowId, agentId)` → `DELETE /api/agent-builder/workflows/:id/agents/:aid`
- `addToolToWorkflow(workflowId, toolId)` → `POST /api/agent-builder/workflows/:id/tools`
- `removeToolFromWorkflow(workflowId, toolId)` → `DELETE /api/agent-builder/workflows/:id/tools/:tid`
- `saveWorkflowGraph(workflowId, graphJson)` → `PUT /api/agent-builder/workflows/:id` with `{ graph_json }`

**File: `components/agent-builder/AgentBuilderCanvas.tsx`**

- Accept `workflowDetail` (workflow agents + tools + graph_json) instead of raw `agents` + `tools`.
- Use `graph_json.nodePositions` for node placement; dagre only for nodes without saved positions.
- On node drag end / edge connect → call `saveWorkflowGraph` (debounced).

### 3. Sidebar Changes

**File: `components/Sidebar.tsx` — `AgentBuilderSidebarContent`**

Restructure into two layers:

**Layer 1 — Workflow list (always visible at top)**:
- Shows all workflows with select/delete.
- "New Workflow" button.
- Back button to `/experiments`.

**Layer 2 — When a workflow is selected**:
- Canvas/Chat toggle.
- **"In This Workflow" section**: Shows agents and tools currently in the selected workflow. Each has a ✕ button to remove.
- **"Available Agents" section**: Global agents not yet in this workflow. Click to add.
- **"Available Tools" section**: Global tools not yet in this workflow. Click to add.
- Create new agent/tool buttons (these create global agents/tools, then auto-add to workflow).

### 4. Empty State

When no workflow is selected, the main area shows an empty state:
- "Select a workflow to get started" with the workflow list prominent.
- Or a "Create your first workflow" CTA.

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `server/db/schema.ts` | EDIT | Add `agent_builder_workflow_agents` and `agent_builder_workflow_tools` junction tables |
| `server/routes/agentBuilder.ts` | EDIT | Add workflow-agent/tool junction endpoints + `/workflows/:id/detail` |
| `components/agent-builder/hooks/useAgentBuilder.ts` | EDIT | Add `fetchWorkflowDetail`, `addAgentToWorkflow`, `removeAgentFromWorkflow`, `addToolToWorkflow`, `removeToolFromWorkflow`, `saveWorkflowGraph` |
| `components/agent-builder/AgentBuilderPanel.tsx` | EDIT | Workflow-first gating: show picker when no workflow selected, pass workflow detail to canvas |
| `components/agent-builder/AgentBuilderCanvas.tsx` | EDIT | Accept workflow detail, use `graph_json.nodePositions`, debounce save on drag/connect |
| `components/Sidebar.tsx` | EDIT | Add back button to `AgentBuilderSidebarContent`, restructure into workflow-first layout with "In Workflow" / "Available" sections |
| `components/agent-builder/types.ts` | EDIT | Add `WorkflowDetail` type (workflow + agents + tools) |

---

## Implementation Steps

1. **DB schema** — Add 2 junction tables
2. **Backend** — Add junction CRUD endpoints + `/workflows/:id/detail`
3. **Types** — Add `WorkflowDetail` interface
4. **Hook** — Add `fetchWorkflowDetail`, junction CRUD, `saveWorkflowGraph`
5. **Panel** — Workflow-first gating (picker vs canvas)
6. **Canvas** — Accept workflow detail, use `graph_json.nodePositions`, debounce save
7. **Sidebar** — Back button + restructured workflow-first sidebar content
8. **Build** — Verify `npm run build` passes
