# Agent Builder — Bidirectional Drag, If/Else Fix & Hardcoded Values Cleanup

> Fix UX issues and eliminate all hardcoded values in the agent-builder frontend.

---

## Part 1: Bidirectional Node Connections

### Problem
Currently, connections can only be dragged from a **right (source) handle** to a **left (target) handle**. Users expect to drag in either direction.

### Solution
In ReactFlow, a `Handle` with `type="source"` can only initiate connections, and `type="target"` can only receive them. To allow bidirectional drag:

**Every non-terminal handle must be both source AND target.**

### Implementation

#### 1.1 — `CustomNode.tsx` — Dual handles on all connection points

Replace single handles with paired source+target handles at each position:

```
For each connection point (left, right, if/else branches, while branches):
  - Keep existing Handle as type="source" 
  - Add a co-located Handle as type="target" with same id
  - ReactFlow allows multiple handles at the same position
```

**Specific changes:**

| Node | Left Handle | Right Handle(s) |
|------|-------------|-----------------|
| Start | None | Add target handle (so you can drag FROM another node TO start, or FROM start TO another) |
| End | Add source handle (so you can drag FROM end TO something) | None |
| Agent, MCP, Transform, Set-State, Extract, HTTP, Note, User-Approval | Both source+target (co-located) | Both source+target (co-located) |
| If/Else | Both source+target | Both source+target on T and F handles |
| While | Both source+target | Both source+target on loop and exit handles |

**ReactFlow config change in `WorkflowCanvas.tsx`:**
- Add `isConnectableStart` and `isConnectableEnd` props to `<ReactFlow>` (already default true)
- No other config changes needed — ReactFlow handles bidirectional natively when both handle types exist

#### 1.2 — Connection validation

Add `onConnect` validation to prevent invalid connections:
- No self-connections (source === target)
- No duplicate edges (same source+target+handle)
- Note nodes should not be connectable (no handles)

---

## Part 2: Hide + Button on If/Else and While Nodes

### Problem
The quick-add `+` button appears on hover for all nodes including If/Else and While. These nodes have fixed branching semantics — adding a node via `+` doesn't make sense because the user needs to choose which branch (T/F or loop/exit) to connect to.

### Solution

#### 2.1 — `CustomNode.tsx` — Conditional + button rendering

Current logic (line ~189):
```tsx
{!isEnd && !isNote && isHovered && (
  <button>+</button>
)}
```

Change to:
```tsx
{!isEnd && !isNote && !isIfElse && !isWhile && isHovered && (
  <button>+</button>
)}
```

This hides the `+` button on If/Else and While nodes. Users must manually drag from the specific branch handle.

---

## Part 3: Hardcoded Values Cleanup

### Overview

56 hardcoded values found across the agent-builder. Grouped into categories below.

---

### 3.1 — Shared Color Constants

**New file: `components/agent-builder/shared/colors.ts`**

```ts
// Node type colors (single source of truth)
export const NODE_COLORS = {
  start: '#34d399',
  end: '#f87171',
  agent: '#818cf8',
  mcp: '#fbbf24',
  'if-else': '#fb923c',
  while: '#c084fc',
  'user-approval': '#ec4899',
  transform: '#60a5fa',
  'set-state': '#a78bfa',
  extract: '#2dd4bf',
  http: '#94a3b8',
  note: '#fbbf24',
} as const;

// Execution status colors
export const STATUS_COLORS = {
  running: '#fbbf24',
  completed: '#34d399',
  failed: '#f87171',
  pending: '#6b7280',
} as const;

// Semantic colors
export const SEMANTIC_COLORS = {
  danger: '#f87171',
  warning: '#fbbf24',
  success: '#34d399',
  info: '#60a5fa',
  default: '#6b7280',
} as const;

// HTTP method badge colors
export const HTTP_METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET: { bg: '#34d39920', text: '#34d399' },
  POST: { bg: '#818cf820', text: '#818cf8' },
  PUT: { bg: '#fbbf2420', text: '#fbbf24' },
  PATCH: { bg: '#fbbf2420', text: '#fbbf24' },
  DELETE: { bg: '#f8717120', text: '#f87171' },
};

// Variable type colors (for autocomplete dropdown)
export const VARIABLE_TYPE_COLORS: Record<string, string> = {
  string: '#60a5fa',
  object: '#a78bfa',
  array: '#2dd4bf',
  any: '#94a3b8',
};

// Template category colors
export const CATEGORY_COLORS: Record<string, string> = {
  scraping: '#fbbf24',
  ai: '#818cf8',
  data: '#60a5fa',
  workflow: '#ec4899',
  logic: '#fb923c',
};
```

**Files to update:**
- `CustomNode.tsx` — Replace all inline hex colors with `NODE_COLORS[type]`, `STATUS_COLORS[status]`, `HTTP_METHOD_COLORS[method]`
- `ExecutionPanel.tsx` — Replace status icon colors with `STATUS_COLORS`
- `WorkflowToolbar.tsx` — Replace validation colors with `SEMANTIC_COLORS`
- `TemplateGallery.tsx` — Replace `CATEGORY_COLORS` with import
- `VariableAutocomplete.tsx` — Replace type colors with `VARIABLE_TYPE_COLORS`
- `NodeContextMenu.tsx` — Replace disconnect/delete colors with `SEMANTIC_COLORS`
- `CanvasContextMenu.tsx` — Replace delete color with `SEMANTIC_COLORS`
- `OnboardingOverlay.tsx` — Replace hardcoded icon color

---

### 3.2 — Model List Unification

**Problem:** `AgentNodeConfig.tsx` has a hardcoded `MODELS` array that duplicates `DEFAULT_MODELS` from `constants.tsx` and drifts from it.

**Solution:**

#### New export in `constants.tsx`:
```ts
export const CHAT_MODELS = DEFAULT_MODELS.filter(m => m.modelType === 'chat');
```

#### Updated `AgentNodeConfig.tsx`:
```ts
import { CHAT_MODELS } from '../../constants';

// Replace local MODELS array with:
const MODELS = CHAT_MODELS.map(m => ({
  value: m.id,
  label: m.name,
  provider: m.provider,
}));
```

This ensures the agent-builder model dropdown always reflects the global model list.

---

### 3.3 — Default Model Bug Fix

**Problem:** Default model in `constants.ts` NODE_DEFINITIONS is `'claude-sonnet-4-20250514'` — this model doesn't exist in the agent-builder dropdown.

**Files to fix:**
- `components/agent-builder/constants.ts` line 16: Change `model: 'claude-sonnet-4-20250514'` → `model: 'mimo-v2.5'`
- `server/services/workflowExecutors/agent.ts` line 24: Change default model → `'mimo-v2.5'`
- `server/services/workflowTemplates.ts` ALL templates: Change `model: 'claude-sonnet-4-20250514'` → `model: 'mimo-v2.5'`

---

### 3.4 — NODE_DEFINITIONS Color Reference

**Problem:** `constants.ts` has hardcoded hex colors for each node type. These same colors are duplicated in `CustomNode.tsx`, `TemplateGallery.tsx`, etc.

**Solution:** Import `NODE_COLORS` from `shared/colors.ts` into `constants.ts`:

```ts
import { NODE_COLORS } from './shared/colors';

export const NODE_DEFINITIONS = {
  start: { ..., color: NODE_COLORS.start },
  agent: { ..., color: NODE_COLORS.agent },
  // ...
};
```

---

### 3.5 — Magic Numbers → Named Constants

**New section in `components/agent-builder/constants.ts`:**

```ts
// Canvas configuration
export const AUTO_SAVE_DELAY_MS = 5000;
export const MAX_UNDO_STACK_SIZE = 50;
export const APPROVAL_POLL_INTERVAL_MS = 3000;
export const DEFAULT_NODE_COLOR = '#6b7280';

// Panel configuration
export const PANEL_MIN_WIDTH = 280;
export const PANEL_MAX_WIDTH = 500;

// Agent defaults
export const DEFAULT_AGENT_MODEL = 'mimo-v2.5';
export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_TEMPERATURE = 0.7;
export const MAX_CHAT_HISTORY_MESSAGES = 20;
```

**Files to update:**
- `hooks/useAutoSave.ts` — Use `AUTO_SAVE_DELAY_MS`
- `hooks/useUndoRedo.ts` — Use `MAX_UNDO_STACK_SIZE`
- `hooks/useApprovalWatch.ts` — Use `APPROVAL_POLL_INTERVAL_MS`
- `AgentNodeConfig.tsx` — Use `DEFAULT_MAX_TOKENS`, `DEFAULT_TEMPERATURE`
- `NodeSettingsPanel.tsx` — Use `PANEL_MIN_WIDTH`, `PANEL_MAX_WIDTH`

---

### 3.6 — Server-Side Hardcoded Values

**Lower priority — these are backend concerns but listed for completeness.**

| File | Issue | Fix |
|------|-------|-----|
| `server/services/workflowExecutors/agent.ts` | 7 hardcoded API base URLs | Use env vars with fallback defaults |
| `server/services/workflowExecutors/agent.ts` | `MAX_TOOL_ITERATIONS = 10` | Move to shared config |
| `server/services/workflowExecutors/agent.ts` | `state.chatHistory.slice(-20)` | Use `MAX_CHAT_HISTORY_MESSAGES` |
| `server/services/workflowExecutors/mcp.ts` | Firecrawl base URL hardcoded | Use `process.env.FIRECRAWL_BASE_URL` |
| `server/services/workflowExecutors/http.ts` | `timeout = 30000` | Use `HTTP_DEFAULT_TIMEOUT_MS` |
| `server/services/workflowExecutors/logic.ts` | `ABSOLUTE_MAX = 100` | Use `MAX_LOOP_ITERATIONS` |
| `server/services/workflowEngine.ts` | `MAX_ITERATIONS = 200` | Use `ENGINE_MAX_ITERATIONS` |
| `server/routes/workflowKeys.ts` | Missing mimo/deepseek providers | Add all supported providers |

---

## Implementation Order

| Step | Task | Files | Est. Effort |
|------|------|-------|-------------|
| 1 | Create `shared/colors.ts` with all color constants | New file | 5 min |
| 2 | Fix bidirectional handles in `CustomNode.tsx` | `CustomNode.tsx` | 15 min |
| 3 | Hide + button on if-else/while | `CustomNode.tsx` line ~189 | 2 min |
| 4 | Fix default model bug (`claude-sonnet` → `mimo-v2.5`) | `constants.ts`, `agent.ts`, `workflowTemplates.ts` | 5 min |
| 5 | Unify model list (export `CHAT_MODELS`, update `AgentNodeConfig`) | `constants.tsx`, `AgentNodeConfig.tsx` | 5 min |
| 6 | Replace all hardcoded colors with shared constants | 8 files | 20 min |
| 7 | Replace magic numbers with named constants | 4 hook files + 2 config files | 10 min |
| 8 | Server-side cleanup (env vars, shared config) | 6 server files | 15 min |
| 9 | Build verification | `npm run build` | 2 min |

**Total estimated effort: ~75 minutes**

---

## Files Modified Summary

### Frontend (14 files)
| File | Changes |
|------|---------|
| `shared/colors.ts` | **NEW** — All color constants |
| `constants.ts` | Import NODE_COLORS, add named constants (AUTO_SAVE_DELAY_MS, etc.), fix default model |
| `constants.tsx` | Add `CHAT_MODELS` export |
| `CustomNode.tsx` | Bidirectional handles, hide + on if-else/while, use shared colors |
| `AgentNodeConfig.tsx` | Use CHAT_MODELS, use named defaults |
| `WorkflowCanvas.tsx` | Use shared colors for MiniMap/Background |
| `ExecutionPanel.tsx` | Use STATUS_COLORS |
| `WorkflowToolbar.tsx` | Use SEMANTIC_COLORS |
| `TemplateGallery.tsx` | Use CATEGORY_COLORS |
| `VariableAutocomplete.tsx` | Use VARIABLE_TYPE_COLORS |
| `NodeContextMenu.tsx` | Use SEMANTIC_COLORS |
| `CanvasContextMenu.tsx` | Use SEMANTIC_COLORS |
| `OnboardingOverlay.tsx` | Use SEMANTIC_COLORS |
| `NodeSettingsPanel.tsx` | Use PANEL_MIN/MAX_WIDTH, DEFAULT_NODE_COLOR |
| `hooks/useAutoSave.ts` | Use AUTO_SAVE_DELAY_MS |
| `hooks/useUndoRedo.ts` | Use MAX_UNDO_STACK_SIZE |
| `hooks/useApprovalWatch.ts` | Use APPROVAL_POLL_INTERVAL_MS |

### Server (6 files)
| File | Changes |
|------|---------|
| `server/services/workflowExecutors/agent.ts` | Fix default model, use env vars for URLs |
| `server/services/workflowExecutors/mcp.ts` | Use FIRECRAWL_BASE_URL env var |
| `server/services/workflowExecutors/extract.ts` | Use FIRECRAWL_BASE_URL env var |
| `server/services/workflowExecutors/http.ts` | Use HTTP_DEFAULT_TIMEOUT_MS |
| `server/services/workflowTemplates.ts` | Fix model in all templates |
| `server/routes/workflowKeys.ts` | Add missing providers |
