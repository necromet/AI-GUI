# Agent Builder Enhancement Plan

## Node CRUD Popover + MiMo/DeepSeek Models + Frontend Enhancement

---

## 1. Flying Popover for Node CRUD

### 1.1 Context Menu on Node Right-Click

**Create** `components/agent-builder/NodeContextMenu.tsx`

A floating popover that appears at cursor position on right-click of any node:

```
┌─────────────────────────┐
│ ✏️  Edit Settings        │  ← Opens NodeSettingsPanel
│ 📋 Duplicate            │  ← Clones node with offset
│ 🔗 Disconnect All       │  ← Removes all edges
│ 🗑️  Delete Node          │  ← Removes node + edges
└─────────────────────────┘
```

- Positioned at mouse coordinates (x, y)
- Dismisses on click outside or Escape
- Uses `onNodeContextMenu` from React Flow
- Animated entry (scale + fade)

### 1.2 Edge Add Button

**Create** `components/agent-builder/EdgeAddButton.tsx`

A "+" button that appears when hovering over an edge midpoint. Clicking it:
1. Inserts a new node between the two connected nodes
2. Shows a mini popover to pick node type
3. Re-wires edges: source → new node → target

### 1.3 Canvas Context Menu

**Create** `components/agent-builder/CanvasContextMenu.tsx`

Right-click on empty canvas space shows:

```
┌─────────────────────────┐
│ ➕ Add Agent            │
│ ➕ Add MCP Tool         │
│ ➕ Add Transform        │
│ ➕ Add If/Else          │
│ ➕ Add While Loop       │
│ ───────────────────── │
│ 📋 Paste               │
│ 🔍 Select All          │
│ 🗑️  Delete Selected     │
└─────────────────────────┘
```

Node is created at the click position.

### 1.4 Quick Add Buttons on Node

**Modify** `components/agent-builder/CustomNode.tsx`

Add small "+" handles that appear on hover at each edge of a node:
- Right side "+" → shows node type picker → creates connected node
- Enables rapid workflow building without using the sidebar

### Files

| File | Action |
|------|--------|
| `components/agent-builder/NodeContextMenu.tsx` | **Create** |
| `components/agent-builder/CanvasContextMenu.tsx` | **Create** |
| `components/agent-builder/EdgeAddButton.tsx` | **Create** |
| `components/agent-builder/CustomNode.tsx` | **Modify** — add quick-add handles |
| `components/agent-builder/WorkflowCanvas.tsx` | **Modify** — wire context menus |

---

## 2. MiMo + DeepSeek Models

### 2.1 Update AgentNodeConfig Model List

**Modify** `components/agent-builder/nodes/AgentNodeConfig.tsx`

Replace hardcoded Claude/GPT/Groq list with models from `constants.tsx`:

```typescript
const MODELS = [
  { value: 'mimo-v2.5', label: 'MiMo V2.5', provider: 'mimo' },
  { value: 'mimo-v2.5-pro', label: 'MiMo V2.5 Pro', provider: 'mimo' },
  { value: 'mimo-v2.5-direct', label: 'MiMo V2.5 (API Key)', provider: 'mimo-direct' },
  { value: 'mimo-v2.5-pro-direct', label: 'MiMo V2.5 Pro (API Key)', provider: 'mimo-direct' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner', provider: 'deepseek' },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', provider: 'deepseek' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', provider: 'deepseek' },
];
```

### 2.2 Update Agent Executor

**Modify** `server/services/workflowExecutors/agent.ts`

Update `detectProvider()` to recognize MiMo and DeepSeek model prefixes. Update `callLLM()` to route to the correct API endpoint:
- MiMo → proxied via Vite dev server or direct API
- DeepSeek → `https://api.deepseek.com/v1` (OpenAI-compatible)

### 2.3 Update Backend API Key Resolution

**Modify** `server/routes/workflows.ts`

The `getApiKeys()` function already checks env vars. Add:
- `MIMO_API_KEY` / `MIMO_BASE_URL`
- `MIMO_DIRECT_API_KEY` / `MIMO_DIRECT_BASE_URL`
- `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL`

### Files

| File | Action |
|------|--------|
| `components/agent-builder/nodes/AgentNodeConfig.tsx` | **Modify** — MiMo/DeepSeek models |
| `server/services/workflowExecutors/agent.ts` | **Modify** — provider routing |
| `server/routes/workflows.ts` | **Modify** — API key resolution |

---

## 3. Frontend Enhancement

### 3.1 Node Visual Redesign

**Modify** `components/agent-builder/CustomNode.tsx`

Current nodes are basic. Enhance with:
- **Glow effect**: Subtle colored glow matching node type color on hover
- **Status indicator**: Small dot (green=ready, yellow=running, red=failed) during execution
- **Compact metrics**: Show token count or execution time after run
- **Better typography**: Larger label, smaller subtext
- **Animated connections**: Edge color pulses during execution flow

### 3.2 Sidebar Enhancement

**Modify** `components/agent-builder/WorkflowSidebar.tsx`

- Add search/filter for node types
- Add icons from Lucide instead of first-letter badges
- Add hover preview with node description
- Add "Recent" section showing recently used node types
- Collapse/expand categories

### 3.3 Settings Panel Enhancement

**Modify** `components/agent-builder/NodeSettingsPanel.tsx`

- Add a colored accent bar at top matching node type color
- Add node type icon in header
- Add "Test" button for agent/MCP/HTTP nodes (runs single node)
- Add JSON preview toggle (shows raw node data)

### 3.4 Toolbar Enhancement

**Modify** `components/agent-builder/WorkflowToolbar.tsx`

- Add undo/redo buttons
- Add zoom controls
- Add auto-layout button (dagre algorithm)
- Add keyboard shortcuts indicator

### 3.5 Execution Panel Enhancement

**Modify** `components/agent-builder/ExecutionPanel.tsx`

- Add execution timeline with node-by-node progress bar
- Add token usage counter
- Add execution duration timer
- Add "Copy output" button per node

### 3.6 Overall Theme Polish

**Modify** `components/agent-builder/styles.css`

- Add glassmorphism effects to panels
- Add smooth transitions for all interactions
- Add subtle grid pattern to canvas background
- Add node selection highlight animation

### Files

| File | Action |
|------|--------|
| `components/agent-builder/CustomNode.tsx` | **Modify** — visual redesign |
| `components/agent-builder/WorkflowSidebar.tsx` | **Modify** — search, icons, previews |
| `components/agent-builder/NodeSettingsPanel.tsx` | **Modify** — accent bar, test button |
| `components/agent-builder/WorkflowToolbar.tsx` | **Modify** — undo/redo, layout |
| `components/agent-builder/ExecutionPanel.tsx` | **Modify** — timeline, tokens, duration |
| `components/agent-builder/styles.css` | **Modify** — glassmorphism, animations |

---

## Implementation Order

```
Step 1: Models (quick win)
  ├── AgentNodeConfig.tsx — swap model list
  ├── agent.ts — add MiMo/DeepSeek provider routing
  └── workflows.ts — add API key resolution

Step 2: Node Context Menu (CRUD popover)
  ├── NodeContextMenu.tsx — create
  ├── CanvasContextMenu.tsx — create
  ├── WorkflowCanvas.tsx — wire onNodeContextMenu + onPaneContextMenu
  └── CustomNode.tsx — add quick-add handles

Step 3: Frontend Enhancement
  ├── CustomNode.tsx — glow, status, typography
  ├── WorkflowSidebar.tsx — search, icons
  ├── NodeSettingsPanel.tsx — accent bar, test button
  ├── WorkflowToolbar.tsx — undo/redo
  ├── ExecutionPanel.tsx — timeline, tokens
  └── styles.css — polish
```
