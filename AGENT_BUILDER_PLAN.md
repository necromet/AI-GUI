# Agent Builder — Interactive & Intuitive Plan

> Transform the agent-builder from a functional canvas into a polished, delightful workflow editor that feels alive.

---

## Phase 1: Onboarding & Discovery

### 1.1 First-Run Empty State
**Problem:** Blank canvas with no guidance when a user first opens agent-builder.

- [ ] Replace blank canvas with a centered empty-state illustration + 3 CTAs:
  - "Start from Template" → opens TemplateGallery
  - "Build from Scratch" → creates new workflow + drops a Start node automatically
  - "Watch a Tour" → launches interactive walkthrough (1.2)
- [ ] Persist `hasSeenAgentBuilderOnboarding` in localStorage to skip on repeat visits

### 1.2 Interactive Walkthrough (Joyride-style)
- [ ] Overlay tooltips guiding the user through:
  1. Drag a node from the sidebar → drop on canvas
  2. Connect two nodes by dragging handles
  3. Click a node to open settings
  4. Hit Run to execute
- [ ] Use a lightweight approach (CSS-only or tiny lib) — no heavy dependencies

### 1.3 Contextual Hints on Nodes
- [ ] Show subtle placeholder text inside nodes when unconfigured:
  - Agent node: "Click to set model & prompt"
  - HTTP node: "Click to set URL"
  - If/Else: "Click to set condition"
- [ ] Fade hint once the user configures the node

---

## Phase 2: Node Palette (Sidebar) Overhaul

### 2.1 Re-enable Sidebar with Improvements
**Current state:** WorkflowSidebar was removed. The sidebar in `Sidebar.tsx` renders draggable items but only when `isAgentBuilderMode` is true.

- [ ] Ensure the main Sidebar's agent-builder section renders node categories with:
  - Search filtering (already exists in WorkflowSidebar, port to Sidebar)
  - Collapsible category sections with saved expand/collapse state
  - Drag preview thumbnail (small floating card, not just text)
- [ ] Add a **"Favorites"** category — user can star frequently-used nodes, persisted in localStorage

### 2.2 Quick-Add Command Palette (⌘K)
- [ ] Global keyboard shortcut `⌘K` / `Ctrl+K` opens a searchable command palette
- [ ] Searchable list of all node types with icons, descriptions, and category badges
- [ ] Selecting a node places it at the center of the current viewport
- [ ] Also surface recent nodes and "Suggested next nodes" based on the selected node's type

### 2.3 Smart Node Suggestions
- [ ] After placing a node, show a floating "suggested next" bubble near the output handle:
  - After `Start` → suggest `Agent`, `HTTP Request`, `Transform`
  - After `Agent` → suggest `If/Else`, `Transform`, `End`
  - After `If/Else` → suggest `Agent`, `Transform` (for both branches)
- [ ] One-click to auto-place + auto-connect the suggested node

---

## Phase 3: Canvas Interactions & Gestures

### 3.1 Undo / Redo (Real Implementation)
**Current state:** Undo/Redo buttons exist in the toolbar but are visual only (no-op).

- [ ] Implement a command stack (`useUndoRedo` hook):
  - Track: node add/remove, node move, edge add/remove, node data change
  - `⌘Z` → undo, `⌘⇧Z` → redo
  - Update toolbar buttons to reflect stack state (disabled when empty)
- [ ] Toast: "Undo: Added Agent node" / "Redo: Connected Start → Agent"

### 3.2 Multi-Select & Bulk Actions
**Current state:** `handleSelectAll` is a no-op.

- [ ] `⌘A` selects all nodes (already wired, needs implementation)
- [ ] `Shift+Click` adds/removes from selection
- [ ] `Click+Drag` on empty canvas draws a selection rectangle (marquee select)
- [ ] Bulk actions on selection:
  - Delete selected (`Delete` / `Backspace`)
  - Duplicate selected (`⌘D`)
  - Move selected (drag any selected node)
  - Align selected (toolbar button: align left/center/right/top/middle/bottom)

### 3.3 Minimap Polish
- [ ] Make minimap interactive — click to pan viewport
- [ ] Show node status colors during execution (green=completed, red=failed, blue=running)
- [ ] Toggle minimap visibility with a button

### 3.4 Canvas Gestures
- [ ] `Space + Drag` → pan canvas (already built into ReactFlow, ensure it works)
- [ ] `⌘+Scroll` → zoom (already built in)
- [ ] Double-click empty canvas → open quick-add palette at that position
- [ ] `Escape` → deselect all / close panels

### 3.5 Edge Improvements
- [ ] Animated edges during execution (pulse flow direction)
- [ ] Edge labels — editable on double-click (e.g., "true"/"false" for if/else, custom labels for others)
- [ ] Edge delete — click edge → `Delete` key or trash icon
- [ ] Smart edge routing — avoid crossing nodes where possible (elkjs or dagre layout option)

---

## Phase 4: Node Experience Polish

### 4.1 Rich Node Cards
**Current state:** Nodes show icon, label, category badge, and minimal context.

- [ ] **Agent node** — Show model name as subtitle (e.g., "Claude Sonnet 4"), token budget as small badge
- [ ] **HTTP node** — Show method badge (GET/POST/PUT/DELETE) color-coded, truncated URL
- [ ] **If/Else node** — Show truncated condition text
- [ ] **While node** — Show "max N iterations" badge
- [ ] **Transform node** — Show line count of code snippet
- [ ] **Note node** — Render markdown content inline (bold, bullet points)
- [ ] **Error state** — Red pulsing border + error icon when node config is invalid (e.g., Agent with no model)

### 4.2 Inline Editing
- [ ] Double-click a node label → inline rename (no need to open settings panel)
- [ ] Drag node color chip → reassign node color (cosmetic customization)

### 4.3 Node Status During Execution
**Current state:** ExecutionPanel tracks node status but the canvas nodes don't visually reflect it.

- [ ] Overlay execution state on nodes in the canvas:
  - `pending` → dimmed
  - `running` → pulsing ring animation in node color
  - `completed` → green check badge
  - `failed` → red X badge + error tooltip on hover
- [ ] Show output preview on hover (truncated to 2 lines)

### 4.4 Node Grouping (Sub-Flows)
- [ ] Select multiple nodes → right-click → "Group" creates a visual group box
- [ ] Groups are collapsible — collapse shows a single summary node
- [ ] Groups have a label and color

---

## Phase 5: Settings Panel UX

### 5.1 Panel Improvements
- [ ] **Resizable** — drag panel border to resize (min 280px, max 500px)
- [ ] **Collapsible** — collapse to icon strip, expand on click
- [ ] **Tabbed sections** for complex nodes (Agent: "Prompt" | "Parameters" | "Output")
- [ ] **Live preview** for Agent node — show estimated token cost based on prompt length

### 5.2 Variable Autocomplete
- [ ] In prompt/code editors, typing `{{` triggers an autocomplete dropdown showing:
  - All available variables from upstream nodes
  - Built-in variables (`input`, `lastOutput`, `state`, `loopIndex`)
  - Variable type hints (string, object, array)
- [ ] Clicking a variable inserts `{{nodeId.field}}` syntax

### 5.3 Prompt Templates (Agent Node)
- [ ] "Insert Template" dropdown in the system/user prompt editor:
  - Summarizer, Classifier, Extractor, Translator, Code Generator, Custom
- [ ] Templates insert boilerplate text that the user can modify

### 5.4 Code Editor Enhancement (Transform / If-Else / While)
- [ ] Use Monaco editor (already in the project) instead of plain `<textarea>` for:
  - JavaScript syntax highlighting
  - Autocomplete for `input`, `lastOutput`, `state`, `variables`
  - Error squiggles for invalid JS

---

## Phase 6: Execution Experience

### 6.1 Execution Panel Redesign
- [ ] Move from floating panel to a **bottom drawer** pattern:
  - Minimized: thin bar showing status + elapsed time
  - Expanded: full execution log with node-by-node results
- [ ] **Step-through mode** — execute one node at a time, pausing between each:
  - "Step" button advances to next node
  - Current node highlighted with a spotlight effect
  - Useful for debugging

### 6.2 Execution Visual Feedback
- [ ] **Breadcrumbs trail** at top of canvas showing execution path: `Start → Agent → If/Else → Transform → End`
- [ ] **Data flow animation** — show data blobs flowing along edges during execution
- [ ] **Output panel** — click a completed node to see its output in a side panel (JSON tree viewer)

### 6.3 Error Recovery
- [ ] When a node fails, show:
  - Error message inline on the node (tooltip)
  - "Retry from here" button in the execution panel
  - "Edit & Re-run" button that opens the node settings
- [ ] Execution history — show last 5 runs with timestamps, status, and duration in a dropdown

### 6.4 Real-Time Collaboration Indicators (Future)
- [ ] Show a "last saved" timestamp in the toolbar
- [ ] Optimistic UI — show save spinner, then checkmark

---

## Phase 7: Templates & Presets

### 7.1 Template Gallery Enhancement
- [ ] Filter by difficulty (Beginner / Intermediate / Advanced)
- [ ] Filter by use case (Research, Automation, Data Pipeline, Chatbot)
- [ ] Preview — hover shows a minimap thumbnail of the workflow
- [ ] "Use Template" → clones into a new workflow with auto-generated name

### 7.2 Built-in Starter Templates
- [ ] Ship 5+ templates out of the box (seeded in DB):
  1. **Simple Chat Agent** — Start → Agent → End
  2. **Research Pipeline** — Start → HTTP → Agent → Transform → End
  3. **Conditional Router** — Start → Agent → If/Else → [Agent A, Agent B] → End
  4. **Approval Gate** — Start → Agent → User Approval → End
  5. **Iterative Refiner** — Start → Agent → While Loop → Agent → End

### 7.3 Save as Template
- [ ] "Save as Template" button in toolbar → modal with name, description, difficulty, tags
- [ ] Templates stored in `workflow_templates` table, accessible in TemplateGallery

---

## Phase 8: Keyboard-First Workflow

### 8.1 Keyboard Shortcuts Reference
| Shortcut | Action |
|----------|--------|
| `⌘K` | Quick-add node palette |
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |
| `⌘A` | Select all nodes |
| `⌘D` | Duplicate selected |
| `⌘S` | Save workflow |
| `Delete` / `Backspace` | Delete selected |
| `Escape` | Deselect / close panels |
| `⌘Enter` | Run workflow |
| `F` | Fit view |
| `⌘[` / `⌘]` | Zoom out / in |

### 8.2 Shortcut Overlay
- [ ] `?` key opens a shortcut cheat sheet modal
- [ ] Small keyboard icon in toolbar that opens the same modal

---

## Phase 9: Visual Polish & Theming

### 9.1 Canvas Themes
- [ ] Three canvas themes (persisted in localStorage):
  - **Dark** (current default)
  - **Light** — white background, dark nodes
  - **Midnight** — deep navy with neon accents matching edward:labs neon color

### 9.2 Node Animations
- [ ] Subtle entrance animation when a node is placed (scale from 0.9 → 1.0, 150ms)
- [ ] Hover glow effect matching node color
- [ ] Connection snap — handle highlights when dragging an edge near it

### 9.3 Loading States
- [ ] Skeleton loader when opening a workflow
- [ ] Progress indicator when saving
- [ ] Smooth transitions between list view and canvas view

---

## Phase 10: Backend & Persistence

### 10.1 Workflow Versioning
- [ ] Auto-save creates a version history (keep last 20 versions)
- [ ] "Version History" dropdown in toolbar — click to restore a previous version
- [ ] Diff view between versions (show added/removed/changed nodes)

### 10.2 Workflow Sharing
- [ ] "Share" button → generates a shareable link (public workflow)
- [ ] "Duplicate to My Workflows" for shared workflows
- [ ] Export as PNG/SVG image of the canvas (html-to-image, already in project)

### 10.3 Workflow Validation
- [ ] Pre-run validation checks:
  - Is there a Start node?
  - Is there an End node?
  - Are all nodes connected? (warn on orphans)
  - Are all required fields filled? (Agent needs a model, HTTP needs a URL)
- [ ] Show validation results as a checklist in the toolbar (warning icon with count)

---

## Implementation Priority

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 🔴 P0 | 3.1 Undo/Redo | Medium | High — expected by every user |
| 🔴 P0 | 6.1 Execution Panel Redesign | Medium | High — core interaction |
| 🔴 P0 | 4.3 Node Status During Execution | Low | High — visual feedback |
| 🟠 P1 | 2.2 Quick-Add Command Palette | Medium | High — power users |
| 🟠 P1 | 5.2 Variable Autocomplete | Medium | High — reduces errors |
| 🟠 P1 | 1.1 First-Run Empty State | Low | High — onboarding |
| 🟠 P1 | 3.2 Multi-Select & Bulk Actions | Medium | Medium — productivity |
| 🟡 P2 | 5.4 Code Editor (Monaco) | Medium | Medium — DX improvement |
| 🟡 P2 | 4.1 Rich Node Cards | Low | Medium — visual clarity |
| 🟡 P2 | 10.3 Workflow Validation | Low | Medium — prevents errors |
| 🟡 P2 | 2.3 Smart Node Suggestions | Medium | Medium — discoverability |
| 🟢 P3 | 7.2 Built-in Templates | Low | Medium — quick starts |
| 🟢 P3 | 4.4 Node Grouping | High | Low — advanced use case |
| 🟢 P3 | 10.1 Versioning | High | Low — nice-to-have |
| 🟢 P3 | 9.1 Canvas Themes | Low | Low — cosmetic |

---

## Dependencies & Libraries

| Need | Candidate | Already in project? |
|------|-----------|-------------------|
| Command palette | `cmdk` (12kB) or custom | No |
| Monaco editor | `@monaco-editor/react` | Yes (used in DatabasePanel) |
| Canvas export | `html-to-image` | Yes (used in Skema) |
| Undo/Redo | Custom hook (command stack) | No |
| Layout algorithm | `dagre` or `elkjs` | No |
| Markdown in notes | `react-markdown` | Yes (used in chat) |
| Walkthrough | `react-joyride` or custom CSS | No |

---

## File Change Estimate

| Area | Files Modified | New Files |
|------|---------------|-----------|
| Phase 1 (Onboarding) | `WorkflowCanvas.tsx` | `OnboardingOverlay.tsx`, `Walkthrough.tsx` |
| Phase 2 (Palette) | `Sidebar.tsx`, `constants.ts` | `CommandPalette.tsx`, `SmartSuggestions.tsx` |
| Phase 3 (Canvas) | `WorkflowCanvas.tsx`, `CustomNode.tsx` | `useUndoRedo.ts`, `SelectionRect.tsx` |
| Phase 4 (Nodes) | `CustomNode.tsx`, all `nodes/*.tsx` | `NodeStatusOverlay.tsx`, `NodeGroup.tsx` |
| Phase 5 (Settings) | `NodeSettingsPanel.tsx`, all `nodes/*.tsx` | `VariableAutocomplete.tsx` |
| Phase 6 (Execution) | `ExecutionPanel.tsx`, `CustomNode.tsx` | `ExecutionDrawer.tsx`, `StepThrough.tsx` |
| Phase 7 (Templates) | `TemplateGallery.tsx`, `AgentBuilderMode.tsx` | `SaveAsTemplateModal.tsx` |
| Phase 8 (Keyboard) | `WorkflowCanvas.tsx` | `ShortcutOverlay.tsx` |
| Phase 9 (Polish) | `CustomNode.tsx`, `WorkflowCanvas.tsx` | `CanvasTheme.ts` |
| Phase 10 (Backend) | `WorkflowToolbar.tsx`, server routes | `useVersionHistory.ts`, validation utils |
