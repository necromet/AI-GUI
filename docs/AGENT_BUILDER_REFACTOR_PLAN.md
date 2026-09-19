# Agent Builder Refactoring Plan

## URL Routing + Code Consolidation + Dead Code Removal

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Current State Analysis](#2-current-state-analysis)
3. [Refactoring Goals](#3-refactoring-goals)
4. [Phase 1 — Add URL Routing for Workflows](#4-phase-1--add-url-routing-for-workflows)
5. [Phase 2 — Consolidate Two Systems](#5-phase-2--consolidate-two-systems)
6. [Phase 3 — Extract Shared Utilities](#6-phase-3--extract-shared-utilities)
7. [Phase 4 — Split Backend Routes](#7-phase-4--split-backend-routes)
8. [Phase 5 — Clean Up Dead Code](#8-phase-5--clean-up-dead-code)
9. [File Manifest](#9-file-manifest)

---

## 1. Problem Statement

The `/agent-builder` directory contains **two parallel, non-integrated systems**:

| | System A (Workflow Engine) | System B (Agent-Tool Builder) |
|---|---|---|
| **Status** | Active — rendered at `/agent-builder` | Dead code — not routed |
| **Entry** | `AgentBuilderMode.tsx` | `AgentBuilderPanel.tsx` |
| **Hook** | `useWorkflow.ts` → `/api/workflows` | `useAgentBuilder.ts` → `/api/agent-builder` |
| **DB tables** | `workflows`, `executions`, etc. (5 tables) | `agent_builder_*` (7 tables) |
| **Backend** | `server/routes/workflows.ts` (582 lines) | `server/routes/agentBuilder.ts` (467 lines) |
| **Node types** | 12 (start, agent, mcp, if-else, etc.) | 2 (agent, tool) |
| **Features** | Execution engine, SSE, approvals, templates | Agent/Tool CRUD, chat, dagre layout |

**Additional issues:**
- Workflow list → canvas uses **state** instead of URL params (no deep linking, broken back button)
- `ICON_MAP` duplicated 4 times across files
- SSE stream parsing duplicated 3 times
- `types.ts` has two conflicting `Workflow` type definitions
- `styles.css` (492 lines) only serves System B (unused)
- `App.tsx` imports System B types that are always null

---

## 2. Current State Analysis

### Files by System

**System A (KEEP — 30 files):**
```
AgentBuilderMode.tsx          — Route component (list + canvas)
WorkflowCanvas.tsx            — React Flow canvas
WorkflowSidebar.tsx           — Node palette
WorkflowToolbar.tsx           — Save/export toolbar
ExecutionPanel.tsx            — Execution UI with SSE
NodeSettingsPanel.tsx         — Node config panel
CustomNode.tsx                — Custom React Flow node
EdgeAddButton.tsx             — Edge insertion
CanvasContextMenu.tsx         — Canvas right-click
NodeContextMenu.tsx           — Node right-click
TemplateGallery.tsx           — Template selection
VariablePicker.tsx            — Variable helper
useWorkflow.ts                — Workflow CRUD hook
useWorkflowExecution.ts       — SSE execution hook
hooks/useAutoSave.ts          — Auto-save
hooks/useApprovalWatch.ts     — Approval polling
nodes/index.ts                — Barrel export
nodes/StartNodeConfig.tsx     — 12 node config panels
nodes/AgentNodeConfig.tsx
nodes/MCPNodeConfig.tsx
nodes/TransformNodeConfig.tsx
nodes/IfElseNodeConfig.tsx
nodes/WhileNodeConfig.tsx
nodes/ApprovalNodeConfig.tsx
nodes/EndNodeConfig.tsx
nodes/NoteNodeConfig.tsx
nodes/HTTPNodeConfig.tsx
nodes/ExtractNodeConfig.tsx
nodes/SetStateNodeConfig.tsx
constants.ts                  — Node definitions
```

**System B (REMOVE — 12 files):**
```
AgentBuilderPanel.tsx         — Dead orchestrator (never routed)
AgentBuilderCanvas.tsx        — Dagre canvas (dead)
AgentNode.tsx                 — Agent node (dead)
ToolNode.tsx                  — Tool node (dead)
AgentChatView.tsx             — Chat view (dead)
AgentDetailPanel.tsx          — Agent detail (dead)
ToolDetailPanel.tsx           — Tool detail (dead)
AgentSidebar.tsx              — Sidebar controls (dead)
hooks/useAgentBuilder.ts      — CRUD hook (dead)
hooks/useAgentChat.ts         — Chat hook (dead)
styles.css                    — CSS for System B (dead)
node-panels/AgentPanel.tsx    — Duplicate of nodes/AgentNodeConfig
node-panels/MCPPanel.tsx      — Duplicate of nodes/MCPNodeConfig
node-panels/LogicPanel.tsx    — Duplicate of nodes/IfElseNodeConfig
```

**Shared (KEEP — 2 files):**
```
types.ts                      — Needs deduplication
```

### App.tsx Dead Code

```tsx
// Line 26: imports System B type (always null)
import type { AgentBuilderSidebarControls } from './components/agent-builder/AgentBuilderPanel';
// Line 230: state for System B (never populated)
const [agentBuilderControls, setAgentBuilderControls] = useState<AgentBuilderSidebarControls | null>(null);
// Sidebar passes this to children — always null
```

---

## 3. Refactoring Goals

1. **URL routing**: `/agent-builder` (list) and `/agent-builder/:workflowId` (canvas)
2. **Single system**: Keep System A, remove System B
3. **No duplication**: Extract shared ICON_MAP, SSE parser, context menu styles
4. **Clean types**: Single `Workflow` type, remove System B types
5. **Split backend**: Break 582-line `workflows.ts` into focused modules
6. **Remove dead code**: 12 System B files + App.tsx dead imports

---

## 4. Phase 1 — Add URL Routing for Workflows

**Goal**: Each workflow gets its own URL: `/agent-builder/:workflowId`

### 4.1 Modify `App.tsx`

Add a new route with parameter:

```tsx
// Current (line 1502):
<Route path="/agent-builder" element={
  <AgentBuilderMode />
} />

// New:
<Route path="/agent-builder/*" element={
  <AgentBuilderMode />
} />
```

The `*` wildcard allows `AgentBuilderMode` to handle sub-routes internally.

### 4.2 Rewrite `AgentBuilderMode.tsx`

Replace state-based navigation with React Router:

```tsx
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';

// Route: /agent-builder (workflow list)
function WorkflowListView() {
  const navigate = useNavigate();
  // ... fetch workflows, render grid
  // onClick → navigate(`/agent-builder/${wf.id}`)
}

// Route: /agent-builder/:workflowId (canvas)
function WorkflowCanvasView() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  // ... render WorkflowCanvas with workflowId
  // Back button → navigate('/agent-builder')
}

// Main component
export default function AgentBuilderMode() {
  return (
    <Routes>
      <Route index element={<WorkflowListView />} />
      <Route path=":workflowId" element={<WorkflowCanvasView />} />
    </Routes>
  );
}
```

**Benefits:**
- Deep linking — `/agent-builder/abc123` opens that workflow directly
- Browser back/forward works
- Shareable URLs
- Template gallery can navigate after creation: `navigate('/agent-builder/' + newId)`

### 4.3 Update `TemplateGallery.tsx`

After creating a workflow from template, navigate to it:

```tsx
const handleSelect = async (template) => {
  const result = await saveWorkflow(undefined, { name: template.name, nodes: template.nodes, edges: template.edges });
  if (result?.id) navigate(`/agent-builder/${result.id}`);
};
```

### 4.4 Update `WorkflowCanvas.tsx`

Remove the workflow loading `useEffect` — the parent now passes `workflowId` from the URL param. The canvas should accept `workflowId` as a prop (already does).

### Files

| File | Action |
|------|--------|
| `App.tsx` | **Modify** — change route to `/agent-builder/*`, remove dead System B imports |
| `AgentBuilderMode.tsx` | **Rewrite** — React Router sub-routes |

---

## 5. Phase 2 — Consolidate Two Systems

**Goal**: Remove System B, keep only System A.

### 5.1 Decision: Keep System A

System A (workflow engine) is the active, routed system with:
- 12 node types vs 2
- Full execution engine with SSE
- Approval gates
- Template gallery
- MCP/Firecrawl integration
- 37 new files just built

System B (agent-tool builder) is dead code with:
- No routing in App.tsx
- Simpler 2-node-type canvas
- Fake tool execution (returns string, doesn't actually execute)
- Separate DB tables that duplicate workflow storage

### 5.2 Merge Useful System B Features into System A

**From `useAgentBuilder.ts`** — the agent/tool CRUD pattern can inform future enhancements, but the actual endpoints (`/api/agent-builder`) serve a different DB schema. No merging needed — just delete.

**From `AgentChatView.tsx`** — the chat-with-agent UI is useful but tightly coupled to System B's `AgentBuilderSession` type. Can be rebuilt later if needed.

**From `AgentBuilderCanvas.tsx`** — the dagre auto-layout algorithm is useful. Extract the layout function:

```typescript
// Extract from AgentBuilderCanvas.tsx → lib/layoutUtils.ts
export function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  // dagre-based layout algorithm
}
```

### 5.3 Remove System B Files

Delete these files:
```
components/agent-builder/AgentBuilderPanel.tsx
components/agent-builder/AgentBuilderCanvas.tsx
components/agent-builder/AgentNode.tsx
components/agent-builder/ToolNode.tsx
components/agent-builder/AgentChatView.tsx
components/agent-builder/AgentDetailPanel.tsx
components/agent-builder/ToolDetailPanel.tsx
components/agent-builder/AgentSidebar.tsx
components/agent-builder/hooks/useAgentBuilder.ts
components/agent-builder/hooks/useAgentChat.ts
components/agent-builder/styles.css
components/agent-builder/node-panels/AgentPanel.tsx
components/agent-builder/node-panels/MCPPanel.tsx
components/agent-builder/node-panels/LogicPanel.tsx
```

### 5.4 Clean Up `types.ts`

Remove all System B types (lines 3-78):
```
AgentBuilderTool
AgentBuilderAgent
AgentBuilderWorkflow
WorkflowDetail
AgentBuilderSession
AgentBuilderMessage
AgentBuilderToolCall
AgentBuilderToolResult
AgentStreamChunk
DEFAULT_PARAMETERS_SCHEMA
TOOL_COLORS
AGENT_COLORS
```

Keep only System A types (lines 105-178).

### 5.5 Clean Up `App.tsx`

Remove:
```tsx
import type { AgentBuilderSidebarControls } from './components/agent-builder/AgentBuilderPanel';
const [agentBuilderControls, setAgentBuilderControls] = useState<AgentBuilderSidebarControls | null>(null);
// All references to agentBuilderControls in Sidebar props
```

### Files

| File | Action |
|------|--------|
| 12 System B files | **Delete** |
| `types.ts` | **Modify** — remove System B types |
| `App.tsx` | **Modify** — remove dead imports/state |

---

## 6. Phase 3 — Extract Shared Utilities

**Goal**: Eliminate duplication.

### 6.1 Extract ICON_MAP

**Create** `components/agent-builder/shared/icons.ts`:

```typescript
import {
  Play, Square, Bot, Wrench, GitBranch, Repeat, UserCheck,
  Code, Database, FileText, Globe, StickyNote, Circle
} from 'lucide-react';

export const ICON_MAP: Record<string, any> = {
  play: Play, square: Square, bot: Bot, wrench: Wrench,
  'git-branch': GitBranch, repeat: Repeat, 'user-check': UserCheck,
  code: Code, database: Database, 'file-text': FileText,
  globe: Globe, 'sticky-note': StickyNote, circle: Circle,
};
```

Update these files to import from `shared/icons.ts`:
- `CustomNode.tsx` — remove local ICON_MAP
- `WorkflowSidebar.tsx` — remove local ICON_MAP
- `EdgeAddButton.tsx` — remove local ICON_MAP
- `CanvasContextMenu.tsx` — remove local ICON_MAP

### 6.2 Extract SSE Stream Parser

**Create** `components/agent-builder/shared/useSSEStream.ts`:

```typescript
export async function* parseSSEStream(response: Response): AsyncGenerator<any> {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  if (!reader) return;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        yield JSON.parse(data);
      } catch {}
    }
  }
}
```

Update these files to use `parseSSEStream`:
- `useWorkflowExecution.ts` — replace manual SSE parsing
- `ExecutionPanel.tsx` — replace manual SSE parsing

### 6.3 Extract Context Menu Animation

Already exists in `styles.css` as `@keyframes ctxMenuIn`. Remove the inline `<style>` tags from:
- `NodeContextMenu.tsx`
- `CanvasContextMenu.tsx`

Add a CSS class `.ab-ctx-menu` that applies the animation.

### Files

| File | Action |
|------|--------|
| `shared/icons.ts` | **Create** |
| `shared/useSSEStream.ts` | **Create** |
| `CustomNode.tsx` | **Modify** — import ICON_MAP |
| `WorkflowSidebar.tsx` | **Modify** — import ICON_MAP |
| `EdgeAddButton.tsx` | **Modify** — import ICON_MAP |
| `CanvasContextMenu.tsx` | **Modify** — import ICON_MAP, remove inline style |
| `NodeContextMenu.tsx` | **Modify** — remove inline style |
| `useWorkflowExecution.ts` | **Modify** — use SSE parser |
| `ExecutionPanel.tsx` | **Modify** — use SSE parser |

---

## 7. Phase 4 — Split Backend Routes

**Goal**: Break `server/routes/workflows.ts` (582 lines) into focused modules.

### 4.1 Current Structure

The file contains:
- Workflow CRUD (GET/POST/PUT/DELETE) — ~80 lines
- Template CRUD — ~40 lines
- MCP server CRUD — ~60 lines
- Execution endpoints (execute, execute-stream, execute-engine, resume) — ~120 lines
- Approval endpoints — ~30 lines
- LLM key management — ~30 lines
- Single-node execution (execute-agent, execute-mcp, execute-firecrawl) — ~40 lines
- Export/Import — ~60 lines
- Helpers (parseWorkflow, getApiKeys, generateExportCode) — ~50 lines

### 4.2 Split Into

| New File | Content | Est. Lines |
|----------|---------|------------|
| `server/routes/workflows.ts` | Workflow CRUD + templates + import/export | ~180 |
| `server/routes/workflowExecution.ts` | execute, execute-stream, execute-engine, resume | ~150 |
| `server/routes/workflowMCP.ts` | MCP server CRUD + test connection | ~80 |
| `server/routes/workflowApprovals.ts` | Approval CRUD + resume | ~50 |
| `server/routes/workflowKeys.ts` | LLM key CRUD + config endpoint | ~50 |
| `server/routes/workflowNodes.ts` | Single-node execution (agent, mcp, firecrawl) | ~50 |

### 4.3 Shared Helpers

**Create** `server/routes/workflowHelpers.ts`:

```typescript
export function parseWorkflow(row: any) { ... }
export async function getApiKeys(): Promise<Record<string, string>> { ... }
export function generateExportCode(workflow: any): string { ... }
```

### 4.4 Update `server/index.ts`

Replace single mount:
```typescript
// Current:
app.use('/api/workflows', workflowRoutes);

// New:
app.use('/api/workflows', workflowRoutes);           // CRUD + templates
app.use('/api/workflows', workflowExecutionRoutes);   // execution
app.use('/api/workflows', workflowMCPRoutes);         // MCP
app.use('/api/workflows', workflowApprovalRoutes);    // approvals
app.use('/api/workflows', workflowKeyRoutes);         // keys
app.use('/api/workflows', workflowNodeRoutes);        // single-node exec
```

Express allows multiple routers on the same path — they merge.

### Files

| File | Action |
|------|--------|
| `server/routes/workflows.ts` | **Rewrite** — CRUD + templates only |
| `server/routes/workflowExecution.ts` | **Create** — execution endpoints |
| `server/routes/workflowMCP.ts` | **Create** — MCP endpoints |
| `server/routes/workflowApprovals.ts` | **Create** — approval endpoints |
| `server/routes/workflowKeys.ts` | **Create** — key management |
| `server/routes/workflowNodes.ts` | **Create** — single-node execution |
| `server/routes/workflowHelpers.ts` | **Create** — shared helpers |
| `server/index.ts` | **Modify** — mount new routers |

---

## 8. Phase 5 — Clean Up Dead Code

### 5.1 Remove System B Backend

**Option A (Recommended)**: Keep `server/routes/agentBuilder.ts` and `server/db/schema.ts` agent_builder tables for now — they don't affect the frontend and can be deprecated later.

**Option B**: Delete `server/routes/agentBuilder.ts` and drop `agent_builder_*` tables. This is cleaner but requires a DB migration.

### 5.2 Remove Dead App.tsx Code

Remove:
- `import type { AgentBuilderSidebarControls }` (line 26)
- `const [agentBuilderControls, setAgentBuilderControls]` (line 230)
- All `agentBuilderControls` references in Sidebar props

### 5.3 Remove Duplicate Node Panels

Delete `node-panels/` directory (3 files) — these are duplicates of `nodes/` config panels:
```
components/agent-builder/node-panels/AgentPanel.tsx
components/agent-builder/node-panels/MCPPanel.tsx
components/agent-builder/node-panels/LogicPanel.tsx
```

### 5.4 Verify No Remaining Imports

After deletion, search for any remaining imports of deleted files and fix them.

---

## 9. File Manifest

### Files to Create (6)

| File | Phase | Purpose |
|------|-------|---------|
| `components/agent-builder/shared/icons.ts` | 3 | Shared ICON_MAP |
| `components/agent-builder/shared/useSSEStream.ts` | 3 | Shared SSE parser |
| `server/routes/workflowExecution.ts` | 4 | Execution endpoints |
| `server/routes/workflowMCP.ts` | 4 | MCP endpoints |
| `server/routes/workflowApprovals.ts` | 4 | Approval endpoints |
| `server/routes/workflowKeys.ts` | 4 | Key management |
| `server/routes/workflowNodes.ts` | 4 | Single-node execution |
| `server/routes/workflowHelpers.ts` | 4 | Shared helpers |

### Files to Modify (12)

| File | Phase | Change |
|------|-------|--------|
| `App.tsx` | 1, 2 | Route to `/agent-builder/*`, remove System B imports |
| `AgentBuilderMode.tsx` | 1 | Rewrite with React Router sub-routes |
| `TemplateGallery.tsx` | 1 | Navigate after template selection |
| `types.ts` | 2 | Remove System B types |
| `CustomNode.tsx` | 3 | Import shared ICON_MAP |
| `WorkflowSidebar.tsx` | 3 | Import shared ICON_MAP |
| `EdgeAddButton.tsx` | 3 | Import shared ICON_MAP |
| `CanvasContextMenu.tsx` | 3 | Import shared ICON_MAP, remove inline style |
| `NodeContextMenu.tsx` | 3 | Remove inline style |
| `useWorkflowExecution.ts` | 3 | Use shared SSE parser |
| `ExecutionPanel.tsx` | 3 | Use shared SSE parser |
| `server/index.ts` | 4 | Mount split route modules |
| `server/routes/workflows.ts` | 4 | Slim down to CRUD only |

### Files to Delete (15)

| File | Phase | Reason |
|------|-------|--------|
| `AgentBuilderPanel.tsx` | 2 | System B dead code |
| `AgentBuilderCanvas.tsx` | 2 | System B dead code |
| `AgentNode.tsx` | 2 | System B dead code |
| `ToolNode.tsx` | 2 | System B dead code |
| `AgentChatView.tsx` | 2 | System B dead code |
| `AgentDetailPanel.tsx` | 2 | System B dead code |
| `ToolDetailPanel.tsx` | 2 | System B dead code |
| `AgentSidebar.tsx` | 2 | System B dead code |
| `hooks/useAgentBuilder.ts` | 2 | System B dead code |
| `hooks/useAgentChat.ts` | 2 | System B dead code |
| `styles.css` | 2 | System B CSS (492 lines, unused) |
| `node-panels/AgentPanel.tsx` | 5 | Duplicate of nodes/AgentNodeConfig |
| `node-panels/MCPPanel.tsx` | 5 | Duplicate of nodes/MCPNodeConfig |
| `node-panels/LogicPanel.tsx` | 5 | Duplicate of nodes/IfElseNodeConfig |

### Summary

| Category | Created | Modified | Deleted |
|----------|---------|----------|---------|
| Frontend | 2 | 10 | 15 |
| Backend | 6 | 2 | 0 |
| **Total** | **8** | **12** | **15** |

**Net result**: 15 dead files removed, 8 focused files created, 12 files cleaned up. Agent-builder directory goes from 46 files → 39 files (and much cleaner).
