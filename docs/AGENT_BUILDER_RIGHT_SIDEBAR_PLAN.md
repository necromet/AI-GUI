# Agent Builder — Right Sidebar & Frontend Polish Plan

> Upgrade `NodeSettingsPanel` and all node config forms to match open-agent-builder's visual quality, then layer on flying popovers, animations, and polish that go beyond the original.

---

## Status: ALL PHASES COMPLETE

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 1 | Foundation — Theme-aware Select, Popover, Switch, Collapsible components | **Done** |
| Phase 2 | NodeSettingsPanel rewrite — framer-motion, content crossfade, panel animations | **Done** |
| Phase 3 | AgentNodeConfig upgrade — MCP tools, JSON schema builder, output format, searchable model picker | **Done** |
| Phase 4 | All config panels — Radix forms, tooltips, sliders, validation | **Done** |
| Phase 5 | Execution animations — edge flow, node pulse, staggered entry, deletion exit | **Done** |
| Phase 6 | Global polish — drag spring physics, onboarding animation, context menu refinement | **Done** |

---

## Animation Reference — Open Agent Builder Patterns

These are the exact animation configurations used in open-agent-builder. We match these for consistency, then improve where it makes sense.

### Panel Slide-In (all right-side panels)

```tsx
// Every panel in open-agent-builder uses this exact pattern:
<AnimatePresence>
  {node && (
    <motion.aside
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
```

- 0.3s linear duration (no spring)
- Slides 400px from right on enter, reverses on exit

**Our improvement:** Use spring physics instead for a premium feel:
```tsx
transition={{ type: "spring", stiffness: 300, damping: 30 }}
```

### Modal Content (settings, confirm dialogs)

```tsx
// Backdrop
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="bg-black/60 backdrop-blur-sm"
/>

// Card
<motion.div
  initial={{ opacity: 0, scale: 0.95, y: 20 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.95, y: 20 }}
  transition={{ type: "spring", damping: 25, stiffness: 300 }}
  style={{
    boxShadow: "0px 32px 40px 6px rgba(0,0,0,0.08), 0px 12px 32px 0px rgba(0,0,0,0.06), ..."
  }}
/>
```

- Spring: damping 25, stiffness 300
- Multi-layer shadow (5 layers for depth)

### Dropdown / Menu (blur transitions)

```tsx
// open-agent-builder's custom Menu uses blur on enter/exit:
<motion.div
  initial={{ opacity: 0, y: -6, scale: 1, filter: "blur(1px)" }}
  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
  exit={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(1px)" }}
  transition={{ ease: [0.1, 0.1, 0.25, 1], duration: 0.2 }}
/>
```

- Custom ease: `[0.1, 0.1, 0.25, 1]`
- Blur: 1px on enter/exit
- Duration: 0.2s

### Combobox Hover Highlight (imperative animation)

```tsx
// Background element tracks mouse position:
animate(bgRef, { y: target.offsetTop }, {
  ease: cubicBezier(0.165, 0.84, 0.44, 1),
  duration: 0.2
})
// Scale micro-bounce on hover:
animate(bgRef, { scale: 0.995 }).then(() => animate(bgRef, { scale: 1 }))
```

### Tooltip (spring with separate filter duration)

```tsx
// Enter:
initial={{ y: 8, opacity: 0, filter: "blur(4px)" }}
animate={{
  y: 0, opacity: 1, filter: "blur(0px)",
  transition: {
    type: "spring", stiffness: 240, damping: 16,
    filter: { duration: 0.4 },  // filter animates independently
    delay
  }
}}

// Exit:
exit={{
  y: -8, opacity: 0, filter: "blur(4px)",
  transition: { type: "spring", stiffness: 300, damping: 16 }
}}
```

- Softer enter spring (240/16), snappier exit (300/16)
- Filter (blur) has its own 0.4s duration
- Backdrop: `bg-black-alpha-64 backdrop-blur-[6px]`

### Checkbox Checkmark

```tsx
<motion.svg
  initial={{ opacity: 0, scale: 0.9, y: 4 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.9, y: 4 }}
/>
```

### Toggle/Switch Thumb

```tsx
<motion.div animate={{ x: checked ? 18 : 0 }} />
// Hover-aware shadows computed in JS for checked/unchecked states
```

### Micro-Interactions

| Pattern | Where |
|---------|-------|
| `active:scale-[0.98]` | Buttons, menu items |
| `active:scale-[0.995]` | Primary CTA buttons |
| `hover:bg-black-alpha-4` | Icon buttons, close buttons |
| `transition-colors` | Nearly all interactive elements |

### Shadow System

Multi-layer shadows via inline `style` (not Tailwind utilities):
- **Modals:** 5 layers (ambient + key + diffused + tight + ring)
- **Tooltips:** 2 layers
- **Menus:** 2 layers
- **Dropdowns:** 5-layer subtle
- **Checkbox checked:** 4-layer orange

---

## Phase 1 — Foundation: Theme-Aware Primitives

The existing `components/ui/select.tsx` and `components/ui/popover.tsx` use `border-[rgba(var(--neon-rgb),0.3)]` but the rest of their styling (bg-popover, text-popover-foreground) relies on CSS variables that don't match the agent-builder's dark theme tokens (`var(--bg-100)`, `var(--text-100)`, etc.). We need thin themed wrappers that the node configs can import without fighting style conflicts.

### 1.1 — Create `components/agent-builder/shared/ThemedSelect.tsx`

Wrap the existing shadcn Select with agent-builder theme tokens:

```tsx
// Uses components/ui/select under the hood
// Applies: bg-[var(--bg-100)], text-[var(--text-100)], border-[var(--border-300)]
// Content portal: bg-[var(--bg-200)], border-[var(--border-300)]
// Hover/focus items: bg-[var(--bg-300)]
// Check indicator: color-[var(--neon-color)]
// Adds provider grouping support (for model list: "Anthropic", "OpenAI", etc.)
```

**Files:**
- `components/agent-builder/shared/ThemedSelect.tsx` — New

### 1.2 — Create `components/agent-builder/shared/ThemedPopover.tsx`

Wrap the existing shadcn Popover for inline help, variable pickers, color pickers:

```tsx
// Uses components/ui/popover under the hood
// Applies: bg-[var(--bg-200)], border-[var(--border-300)], shadow-lg
// Neon border accent on open
```

**Files:**
- `components/agent-builder/shared/ThemedPopover.tsx` — New

### 1.3 — Create `components/agent-builder/shared/ThemedSwitch.tsx`

A toggle switch for boolean fields (replaces native checkboxes), using open-agent-builder's animated thumb pattern:

```tsx
// Uses @radix-ui/react-switch
// Track: bg-[var(--bg-300)] when off, bg-[var(--neon-color)] when on
// Thumb: white, animated with framer-motion:
//   <motion.div animate={{ x: checked ? 18 : 0 }} />
// Hover: context-aware shadows computed based on checked state
// Checked glow: 4-layer box-shadow in neon color (matching checkbox pattern)
```

**Files:**
- `components/agent-builder/shared/ThemedSwitch.tsx` — New

### 1.4 — Create `components/agent-builder/shared/ThemedCollapsible.tsx`

Animated collapsible for "Advanced" sections:

```tsx
// Uses @radix-ui/react-collapsible
// Content animates height with CSS grid-template-rows trick (0fr → 1fr)
// Chevron rotates 90° on open
```

**Files:**
- `components/agent-builder/shared/ThemedCollapsible.tsx` — New

### 1.5 — Create `components/agent-builder/shared/ThemedTooltip.tsx`

Info icon tooltips for field-level help text, using open-agent-builder's spring+blur pattern:

```tsx
// Uses @radix-ui/react-tooltip
// Dark bg, neon border accent, small text
// Triggered on hover with 300ms delay
//
// Animation (matching open-agent-builder's tooltip.tsx):
// Enter: spring(240/16) + blur(4px→0, 0.4s independent)
//        initial={{ y: 8, opacity: 0, filter: "blur(4px)" }}
// Exit:  spring(300/16) + blur(0→4px)
//        exit={{ y: -8, opacity: 0, filter: "blur(4px)" }}
// Backdrop: bg-[var(--bg-300)] backdrop-blur-[6px]
// Shadow: 2-layer (0px 16px 24px -8px rgba(0,0,0,0.06), 0px 8px 16px -4px rgba(0,0,0,0.06))
```

**Files:**
- `components/agent-builder/shared/ThemedTooltip.tsx` — New

### 1.6 — Create `components/agent-builder/shared/ThemedSlider.tsx`

For temperature, max tokens, and numeric ranges:

```tsx
// Uses @radix-ui/react-slider
// Track: bg-[var(--bg-300)]
// Range: bg-[var(--neon-color)]
// Thumb: white, ring-[var(--neon-color)], scale on hover
```

**Files:**
- `components/agent-builder/shared/ThemedSlider.tsx` — New

### 1.7 — Update `components/agent-builder/shared/formStyles.ts`

Add new field class variants for the themed components:

```ts
// Add: themedSelect, themedSwitch, collapsibleTrigger, tooltipTrigger
// Keep existing fieldClasses as-is for backward compat during migration
```

**Files:**
- `components/agent-builder/shared/formStyles.ts` — Modified

---

## Phase 2 — NodeSettingsPanel Rewrite

The current panel uses `requestAnimationFrame` + `entered` state for a simple opacity/translateX fade. Open Agent Builder uses `framer-motion` `AnimatePresence` with `initial/animate/exit` for smooth enter/exit and crossfade when switching between nodes.

### 2.1 — Wrap panel in `AnimatePresence` with `motion.div`

Replace the CSS transition approach with framer-motion. The open-agent-builder slides from 400px with linear 0.3s — we improve with spring physics and blur:

```tsx
// Current (edward:labs):
// requestAnimationFrame(() => setEntered(true))
// opacity: entered ? 1 : 0, transform: entered ? 'translateX(0)' : 'translateX(12px)'

// Target:
<AnimatePresence mode="wait">
  {selectedNode && (
    <motion.div
      key={selectedNode.id}           // triggers exit/enter on node switch
      initial={{ x: 80, opacity: 0, filter: "blur(2px)" }}
      animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
      exit={{ x: 80, opacity: 0, filter: "blur(2px)" }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
        filter: { duration: 0.2 },    // blur animates independently
      }}
    >
      ...panel content...
    </motion.div>
  )}
</AnimatePresence>
```

**Key behaviors:**
- Node A → Node B: content crossfades (exit old, enter new) via `mode="wait"`
- Closing panel: slides out right + fades + slight blur
- Opening panel: slides in from right + fades + blur clears
- Spring physics (300/30) for a premium feel — snappier than open-agent-builder's linear 0.3s
- Blur transition (2px → 0) adds depth — borrowed from open-agent-builder's dropdown pattern

**Files:**
- `components/agent-builder/NodeSettingsPanel.tsx` — Major rewrite

### 2.2 — Staggered content entry

When a node config panel mounts, its fields should stagger in:

```tsx
// Wrap the config panel body in a motion.div container
// Each field section gets:
//   initial={{ opacity: 0, y: 8 }}
//   animate={{ opacity: 1, y: 0 }}
//   transition={{ delay: index * 0.04 }}
```

**Files:**
- `components/agent-builder/NodeSettingsPanel.tsx` — Modified
- `components/agent-builder/shared/StaggeredContainer.tsx` — New helper

### 2.3 — Resize handle improvement

The current resize handle is invisible until hovered. Add a subtle visual indicator:

```tsx
// Add a tiny grip dot pattern on the resize handle area
// Show a neon line on hover/drag (already partially done)
// Add cursor feedback: cursor-col-resize → visible indicator
```

**Files:**
- `components/agent-builder/NodeSettingsPanel.tsx` — Modified

### 2.4 — Header polish

Add visual improvements to the panel header:

- Node type icon (from ICON_MAP) instead of generic Settings gear
- Colored icon background that matches node type color
- Smooth label edit: focus ring animation
- Paste config / JSON toggle buttons: subtle hover scale
- Close button: rotate-90 on hover (X icon)

**Files:**
- `components/agent-builder/NodeSettingsPanel.tsx` — Modified

---

## Phase 3 — AgentNodeConfig Upgrade

The agent node config is the most visible panel and the biggest gap vs open-agent-builder. Currently missing: MCP tools section, output format with JSON schema builder, searchable model picker.

### 3.1 — Searchable model selector with provider grouping

Replace native `<select>` with a `cmdk`-based combobox (cmdk is already installed):

```tsx
// Model picker as a Popover trigger
// Shows: search input at top
// Groups: "MiMo" header → mimo models, "DeepSeek" header → deepseek models
// Each item: model name + provider badge + check indicator
// Keyboard: arrow keys navigate, enter selects, type to filter
```

**Files:**
- `components/agent-builder/shared/ModelPicker.tsx` — New
- `components/agent-builder/nodes/AgentNodeConfig.tsx` — Modified

### 3.2 — Prompt templates as flying popover

Replace the native `<select>` for prompt templates with a themed popover:

```tsx
// Trigger: "Templates" button with FileCode icon
// Content: Popover with list of template cards
// Each card: name + preview of system prompt (truncated)
// Click: applies template, closes popover with exit animation
// Entry: fade-in + scale from trigger
```

**Files:**
- `components/agent-builder/nodes/AgentNodeConfig.tsx` — Modified

### 3.3 — Temperature as slider + number input

Replace the plain number input with a slider + number combo:

```tsx
// Layout: [Slider 0────●────2] [0.7] (number input synced)
// Slider uses ThemedSlider from Phase 1
// Number input: compact, right-aligned, allows direct typing
// Visual: slider thumb snaps to value, neon range fill
```

**Files:**
- `components/agent-builder/nodes/AgentNodeConfig.tsx` — Modified

### 3.4 — Max tokens as slider + number input

Same pattern as temperature but with larger range (1–32768):

```tsx
// [Slider 1──────────●──────────32768] [4096]
// Logarithmic scale for better UX (128, 256, 512, 1024, 2048, 4096, 8192, ...)
```

**Files:**
- `components/agent-builder/nodes/AgentNodeConfig.tsx` — Modified

### 3.5 — Output format with JSON schema builder

Port the open-agent-builder's output schema UI:

```tsx
// Section: "Output Format"
// Select: Text / JSON (ThemedSelect)
//
// When JSON selected, show:
//   "Output Schema Builder" label + [Add Field] button
//   Field rows: [name input] [type select: string/number/boolean/array/object] [delete btn]
//   "View Raw JSON" collapsible → textarea with schema JSON
//
// Animations:
//   JSON section: expand-in animation on reveal
//   Field rows: staggered entry
//   Add field: slide-in-up from bottom
//   Delete field: fade-out + height collapse
```

**Files:**
- `components/agent-builder/nodes/AgentNodeConfig.tsx` — Modified (major)

### 3.6 — MCP Tools section

This is the largest new feature. Add ability to attach MCP tools to an agent node:

```tsx
// Section: "MCP Tools"
// Current tools: list of attached tool cards (name + tool count + remove button)
// [Add MCP Tool] button → opens ThemedPopover or slide-down panel
//
// MCP Server list (from /api/mcp/servers):
//   Each server: expandable card
//     Header: server name + "Connected" badge + tool count
//     Expanded: description + available tools chips + [Add] / [Remove] button
//   "Add New MCP Server" card → link to settings
//
// Since edward:labs doesn't have Convex/Clerk, the MCP server list
// comes from the existing server-side /api/mcp/servers endpoint
// (or we add a simple mcp_servers table to PostgreSQL)
```

**Backend changes needed:**
- `server/db/schema.ts` — Add `mcp_servers` table (name, url, auth_type, auth_value, tools_json)
- `server/routes/mcp.ts` — CRUD for MCP servers (GET list, POST create, PUT update, DELETE)
- `server/services/workflowExecutors/agent.ts` — Accept `mcpTools` array, resolve and call MCP tools during execution

**Files:**
- `components/agent-builder/nodes/AgentNodeConfig.tsx` — Modified (major)
- `components/agent-builder/shared/MCPToolPicker.tsx` — New
- `server/db/schema.ts` — Modified
- `server/routes/mcp.ts` — New
- `server/services/workflowExecutors/agent.ts` — Modified

### 3.7 — Advanced section with ThemedCollapsible

Replace the manual state + chevron with ThemedCollapsible:

```tsx
// <ThemedCollapsible trigger="Advanced">
//   <Slider field="Max Tokens" />
//   <Slider field="Temperature" />
//   <Select field="Output Format" />
//   <Switch field="Include Chat History" />
// </ThemedCollapsible>
//
// Animation: height expands smoothly, chevron rotates
```

**Files:**
- `components/agent-builder/nodes/AgentNodeConfig.tsx` — Modified

---

## Phase 4 — All Config Panels Polish

Apply themed components and animations to every node config panel.

### 4.1 — TransformNodeConfig

- Add a header label ("JavaScript Transform") with description tooltip
- Monaco editor: add language indicator badge
- Add a "Variables" popover that lists available upstream variables as clickable chips

**Files:**
- `components/agent-builder/nodes/TransformNodeConfig.tsx` — Modified

### 4.2 — IfElseNodeConfig

- Monaco editor: add "Condition" label
- Add tooltips explaining the True/False output handles
- Add variable reference picker popover

**Files:**
- `components/agent-builder/nodes/IfElseNodeConfig.tsx` — Modified

### 4.3 — WhileNodeConfig

- Max iterations: replace with ThemedSlider (1–100 range)
- Monaco editor: add condition label + tooltip

**Files:**
- `components/agent-builder/nodes/WhileNodeConfig.tsx` — Modified

### 4.4 — MCPNodeConfig

- Action select → ThemedSelect with icons per action
- URL/query inputs → themed inputs with validation states
- Add a "Test" button that fires the MCP action and shows result in a popover

**Files:**
- `components/agent-builder/nodes/MCPNodeConfig.tsx` — Modified

### 4.5 — HTTPNodeConfig

- Method select → ThemedSelect with color-coded badges (GET=green, POST=blue, etc.)
- Auth type select → ThemedSelect
- Conditional auth fields: animate-in when auth type changes
- Headers/body textareas: themed styling

**Files:**
- `components/agent-builder/nodes/HTTPNodeConfig.tsx` — Modified

### 4.6 — GuardrailsNodeConfig

- Checkboxes → ThemedSwitch toggles
- Violation action → ThemedSelect
- Add section labels with tooltips explaining each guardrail type
- Stagger toggle entry animation

**Files:**
- `components/agent-builder/nodes/GuardrailsNodeConfig.tsx` — Modified

### 4.7 — ExtractNodeConfig

- Model select → ThemedSelect (reuse ModelPicker)
- JSON schema textarea → Monaco editor (JSON mode) for better editing
- Advanced section → ThemedCollapsible

**Files:**
- `components/agent-builder/nodes/ExtractNodeConfig.tsx` — Modified

### 4.8 — SetStateNodeConfig

- Type select → ThemedSelect with color-coded type badges
- Value inputs → conditional rendering with animation (text input for string, number input for number, toggle for boolean, Monaco for JSON, expression input for expression)
- Add/remove variable: slide-in/slide-out animation

**Files:**
- `components/agent-builder/nodes/SetStateNodeConfig.tsx` — Modified

### 4.9 — StartNodeConfig

- Input variable definitions: same pattern as SetState
- Add/remove animation

**Files:**
- `components/agent-builder/nodes/StartNodeConfig.tsx` — Modified

### 4.10 — ApprovalNodeConfig

- Approval message textarea → themed
- Output path legend: color-coded badges (approve=green, reject=red)
- Add tooltip explaining the dual-handle behavior

**Files:**
- `components/agent-builder/nodes/ApprovalNodeConfig.tsx` — Modified

### 4.11 — NoteNodeConfig / EndNodeConfig

- Minimal polish: themed textarea, themed description text

**Files:**
- `components/agent-builder/nodes/NoteNodeConfig.tsx` — Modified
- `components/agent-builder/nodes/EndNodeConfig.tsx` — Modified

---

## Phase 5 — Execution & Canvas Animations

### 5.1 — Edge flow animation during execution

Add animated dashed stroke on active edges:

```css
/* globals.css — add to agent-builder section */
.ab-edge-active {
  stroke: var(--neon-color) !important;
  stroke-width: 2.5px !important;
  stroke-dasharray: 8 4;
  animation: ab-edge-flow 1s linear infinite;
}

@keyframes ab-edge-flow {
  to { stroke-dashoffset: -12; }
}
```

Apply via ReactFlow's `edgeClassName` callback based on execution status.

**Files:**
- `src/globals.css` — Modified
- `components/agent-builder/WorkflowCanvas.tsx` — Modified

### 5.2 — Node execution glow (pulse ring)

Port the open-agent-builder's `pulse-heat` animation, adapted to neon color:

```css
.ab-node-executing {
  animation: ab-pulse-glow 2s ease-in-out infinite;
}

@keyframes ab-pulse-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(var(--neon-rgb), 0.4),
                0 0 20px 0 rgba(var(--neon-rgb), 0.2);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(var(--neon-rgb), 0),
                0 0 30px 0 rgba(var(--neon-rgb), 0);
  }
}
```

**Files:**
- `src/globals.css` — Modified
- `components/agent-builder/CustomNode.tsx` — Modified

### 5.3 — Node deletion exit animation

When a node is deleted, it should fade out + scale down:

```tsx
// Use framer-motion's AnimatePresence around the node list
// On delete: exit={{ scale: 0.8, opacity: 0 }} transition={{ duration: 0.2 }}
// Note: ReactFlow manages its own DOM, so this requires wrapping
// the custom node component with motion and handling removal via
// onNodesChange + a "removing" state
```

**Files:**
- `components/agent-builder/CustomNode.tsx` — Modified
- `components/agent-builder/WorkflowCanvas.tsx` — Modified

### 5.4 — Staggered node entry on workflow load

When loading a workflow, nodes should appear with a cascade delay:

```tsx
// In WorkflowCanvas, after loading nodes:
// Apply staggered animation delays based on topological order
// Each node gets: animation-delay: index * 50ms
// Use the existing ab-node-enter animation with incremental delays
```

**Files:**
- `components/agent-builder/WorkflowCanvas.tsx` — Modified
- `components/agent-builder/CustomNode.tsx` — Modified

### 5.5 — Completed/failed node states

Add visual completion and failure states:

```css
.ab-node-completed {
  border-color: #34d399 !important;
  transition: border-color 0.4s ease-out;
}

.ab-node-failed {
  animation: ab-shake 0.4s ease-out;
  border-color: #ef4444 !important;
}

@keyframes ab-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
```

**Files:**
- `src/globals.css` — Modified
- `components/agent-builder/CustomNode.tsx` — Modified

---

## Phase 6 — Global Polish

### 6.1 — Drag spring physics

When dragging nodes from the sidebar, add a subtle scale effect:

```tsx
// In WorkflowSidebar (and Sidebar.tsx node palette):
// onDragStart: set a drag image with slight rotation + scale
// The dragged ghost image: scale(1.05) rotate(2deg)
```

**Files:**
- `components/agent-builder/WorkflowSidebar.tsx` — Modified
- `components/Sidebar.tsx` — Modified (node palette section)

### 6.2 — Context menu animation upgrade

Replace the existing CSS `ctx-menu-in`/`ctx-menu-out` with framer-motion, matching open-agent-builder's Menu/blur pattern:

```tsx
// NodeContextMenu + CanvasContextMenu:
// Wrap in AnimatePresence
<motion.div
  initial={{ opacity: 0, y: -6, scale: 1, filter: "blur(1px)" }}
  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
  exit={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(1px)" }}
  transition={{ ease: [0.1, 0.1, 0.25, 1], duration: 0.2 }}
/>
```

- Custom ease `[0.1, 0.1, 0.25, 1]` — open-agent-builder's signature curve
- Blur 1px on enter/exit for depth
- 0.2s duration

**Files:**
- `components/agent-builder/NodeContextMenu.tsx` — Modified
- `components/agent-builder/CanvasContextMenu.tsx` — Modified

### 6.3 — Command palette animation

Upgrade the command palette entry/exit with modal spring pattern:

```tsx
// Wrap in AnimatePresence
// Backdrop: motion.div fade (opacity 0→1)
// Palette card:
<motion.div
  initial={{ opacity: 0, scale: 0.95, y: 20 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.95, y: 20 }}
  transition={{ type: "spring", damping: 25, stiffness: 300 }}
/>
// Results list: staggered item entry (delay: index * 0.03)
// Multi-layer shadow (5 layers, matching open-agent-builder modal pattern)
```

**Files:**
- `components/agent-builder/CommandPalette.tsx` — Modified

### 6.4 — Onboarding overlay animation upgrade

Replace the CSS transition with framer-motion for the onboarding overlay:

```tsx
// Backdrop: motion.div with opacity fade
// Card: motion.div with spring physics
// Option cards: staggered entry with whileHover scale
```

**Files:**
- `components/agent-builder/OnboardingOverlay.tsx` — Modified

### 6.5 — Execution panel animation

Upgrade the bottom execution panel:

```tsx
// Collapsed → Expanded: framer-motion layout animation
// Node result items: staggered entry as they complete
// Progress bar: smooth width animation
// Status badge: scale spring on state change
```

**Files:**
- `components/agent-builder/ExecutionPanel.tsx` — Modified

### 6.6 — Template gallery animation

```tsx
// Modal: fade + scale entry
// Template cards: staggered grid entry
// Hover: whileHover={{ y: -2 }} with shadow increase
// Category filter: layout animation on tab switch
```

**Files:**
- `components/agent-builder/TemplateGallery.tsx` — Modified

### 6.7 — Edge add button animation

The "+" button that appears between nodes on edge hover:

```tsx
// Add framer-motion: scale spring on appear
// whileHover={{ scale: 1.1 }}
// whileTap={{ scale: 0.95 }}
```

**Files:**
- `components/agent-builder/EdgeAddButton.tsx` — Modified

---

## Implementation Order

```
Phase 1  ──→  Phase 2  ──→  Phase 3  ──→  Phase 4  ──→  Phase 5  ──→  Phase 6
(1-2 days)    (1 day)       (2-3 days)    (2 days)      (1-2 days)    (1-2 days)
```

Phase 1 must come first (shared primitives). Phases 2-3 can overlap. Phases 4-6 are independent and can be done in any order after Phase 2.

---

## Files Summary

### New files (10)

| File | Purpose |
|------|---------|
| `components/agent-builder/shared/ThemedSelect.tsx` | Theme-aware Radix Select wrapper |
| `components/agent-builder/shared/ThemedPopover.tsx` | Theme-aware Radix Popover wrapper |
| `components/agent-builder/shared/ThemedSwitch.tsx` | Toggle switch for boolean fields |
| `components/agent-builder/shared/ThemedCollapsible.tsx` | Animated collapsible section |
| `components/agent-builder/shared/ThemedTooltip.tsx` | Info icon tooltip for field help |
| `components/agent-builder/shared/ThemedSlider.tsx` | Slider for numeric ranges |
| `components/agent-builder/shared/StaggeredContainer.tsx` | framer-motion staggered entry helper |
| `components/agent-builder/shared/ModelPicker.tsx` | Searchable model selector with provider grouping |
| `components/agent-builder/shared/MCPToolPicker.tsx` | MCP tool attachment UI |
| `server/routes/mcp.ts` | MCP server CRUD API |

### Modified files (22)

| File | Changes |
|------|---------|
| `components/agent-builder/NodeSettingsPanel.tsx` | framer-motion AnimatePresence, content crossfade, staggered fields, header polish |
| `components/agent-builder/nodes/AgentNodeConfig.tsx` | MCP tools, JSON schema builder, model picker, sliders, collapsible, tooltips |
| `components/agent-builder/nodes/TransformNodeConfig.tsx` | ThemedSelect, tooltip, variable popover |
| `components/agent-builder/nodes/IfElseNodeConfig.tsx` | Tooltip, variable picker |
| `components/agent-builder/nodes/WhileNodeConfig.tsx` | ThemedSlider for iterations, tooltip |
| `components/agent-builder/nodes/MCPNodeConfig.tsx` | ThemedSelect, test button |
| `components/agent-builder/nodes/HTTPNodeConfig.tsx` | ThemedSelect, conditional field animations |
| `components/agent-builder/nodes/GuardrailsNodeConfig.tsx` | ThemedSwitch, ThemedSelect, tooltips |
| `components/agent-builder/nodes/ExtractNodeConfig.tsx` | Model picker, Monaco editor, collapsible |
| `components/agent-builder/nodes/SetStateNodeConfig.tsx` | ThemedSelect, conditional input animations |
| `components/agent-builder/nodes/StartNodeConfig.tsx` | Themed inputs, add/remove animation |
| `components/agent-builder/nodes/ApprovalNodeConfig.tsx` | Themed textarea, tooltip |
| `components/agent-builder/nodes/NoteNodeConfig.tsx` | Themed textarea |
| `components/agent-builder/nodes/EndNodeConfig.tsx` | Themed description |
| `components/agent-builder/shared/formStyles.ts` | New field class variants |
| `components/agent-builder/WorkflowCanvas.tsx` | Edge animation classes, staggered node entry |
| `components/agent-builder/CustomNode.tsx` | Execution glow, completion/failure states, exit animation |
| `components/agent-builder/WorkflowSidebar.tsx` | Drag spring physics |
| `components/agent-builder/NodeContextMenu.tsx` | framer-motion entry/exit |
| `components/agent-builder/CanvasContextMenu.tsx` | framer-motion entry/exit |
| `components/agent-builder/CommandPalette.tsx` | framer-motion entry/exit, staggered results |
| `components/agent-builder/OnboardingOverlay.tsx` | framer-motion upgrade |
| `components/agent-builder/ExecutionPanel.tsx` | Staggered result items, layout animation |
| `components/agent-builder/TemplateGallery.tsx` | Card stagger, hover animation |
| `components/agent-builder/EdgeAddButton.tsx` | Scale spring animation |
| `src/globals.css` | Edge flow, node glow, completed/failed keyframes |
| `server/db/schema.ts` | mcp_servers table |
| `server/services/workflowExecutors/agent.ts` | MCP tool resolution |

---

## Libraries Used (all already installed)

| Library | Version | Usage |
|---------|---------|-------|
| `framer-motion` | ^12.41.0 | Panel enter/exit, staggered fields, layout animations |
| `@radix-ui/react-select` | ^2.3.2 | ThemedSelect (flying popover dropdown) |
| `@radix-ui/react-popover` | ^1.1.18 | ThemedPopover (templates, variables, MCP picker) |
| `@radix-ui/react-switch` | ^1.3.2 | ThemedSwitch (boolean toggles) |
| `@radix-ui/react-collapsible` | ^1.1.15 | ThemedCollapsible (Advanced sections) |
| `@radix-ui/react-tooltip` | ^1.2.10 | ThemedTooltip (field help) |
| `@radix-ui/react-slider` | ^1.4.7 | ThemedSlider (temperature, tokens) |
| `cmdk` | ^1.1.1 | Searchable model picker |
| `tailwindcss-animate` | ^1.0.7 | CSS animation utilities for Radix components |

No new dependencies required.

---

## Design Tokens Reference

All themed components use the existing agent-builder CSS variables:

```css
--bg-100: #111114        (panel background)
--bg-200: #1a1a1f        (card/section background)
--bg-300: #242429        (hover/active states)
--border-300: #2a2a30    (borders)
--text-100: #e8e8ed      (primary text)
--text-300: #a8a8b3      (secondary text)
--text-500: #68687a      (muted text)
--neon-color             (accent, user-configurable)
--neon-rgb               (accent RGB for rgba() usage)
```
