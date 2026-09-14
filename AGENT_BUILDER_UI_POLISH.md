# Agent Builder — UI Overlap Fixes & Animation Polish

> Fix all overlapping components, z-index conflicts, animation issues, and responsive breakpoints.

---

## Part 1: Overlap Fixes

### 1.1 — `+` Button Overlaps Source Handle

**Problem:** The `+` button (`absolute -right-3`, z-10) covers the right source handle, making it unclickable on hover.

**Fix in `CustomNode.tsx`:**
- Move the `+` button further right: `-right-4` instead of `-right-3` (16px outside instead of 12px)
- Reduce button size from `w-5 h-5` to `w-4 h-4`
- This creates a 4px gap between the handle edge and the button

```tsx
// Before
className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 ..."

// After
className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-4 ..."
```

### 1.2 — Branch Label Inconsistent Offsets

**Problem:** While node labels are asymmetric (`-right-12` for loop vs `-right-10` for exit). If/Else labels at `-right-8` are too close to handles at `top-[30%]`/`top-[70%]`.

**Fix in `CustomNode.tsx`:**
- Standardize all branch labels to `-right-9` (36px outside)
- Adjust vertical positions to `top-[28%]` and `top-[68%]` (2% more space from handles)

```tsx
// If/Else
<div className="absolute -right-9 top-[28%] text-[9px] text-green-400">T</div>
<div className="absolute -right-9 top-[68%] text-[9px] text-red-400">F</div>

// While
<div className="absolute -right-9 top-[28%] text-[9px] text-purple-400">loop</div>
<div className="absolute -right-9 top-[68%] text-[9px] text-yellow-400">exit</div>
```

### 1.3 — ExecutionPanel Overlaps Controls/MiniMap

**Problem:** On viewports < ~850px, the expanded ExecutionPanel (560px centered) overlaps Controls (bottom-left) and MiniMap (bottom-right).

**Fix in `WorkflowCanvas.tsx`:**
- Move `<Controls>` to `position="top-left"` instead of default bottom-left
- This puts zoom controls in the top-left corner, away from the bottom execution panel
- MiniMap is already at bottom-right and less likely to conflict, but add a `style` offset

```tsx
<Controls showInteractive={false} position="top-left" />
```

### 1.4 — OnboardingOverlay Scoping

**Problem:** `absolute inset-0` on the overlay positions relative to the nearest positioned ancestor, which may be the entire page layout.

**Fix in `WorkflowCanvas.tsx`:**
- Add `relative` to the inner canvas wrapper div so the overlay scopes to the canvas area only

```tsx
// Before
<div className="flex-1 flex flex-col">

// After
<div className="flex-1 flex flex-col relative">
```

### 1.5 — Back Button Overlaps Toolbar

**Problem:** The "← Back to workflows" button (`absolute top-2 left-2 z-10`) overlaps the WorkflowToolbar.

**Fix in `AgentBuilderMode.tsx`:**
- Move the back button inside the WorkflowCanvas component, or
- Change positioning to `top-2 left-2` with a background and ensure toolbar has left padding to accommodate it
- Better: render the back button as part of the toolbar via a prop

### 1.6 — NodeSettingsPanel Resize Handle Invisible

**Problem:** `opacity: 0` makes the resize handle completely invisible. The `hover:bg` Tailwind class has no effect because the parent opacity is 0.

**Fix in `NodeSettingsPanel.tsx`:**
- Change from `opacity: 0` to `opacity-0` Tailwind class with `hover:opacity-100` — BUT this won't work with inline `style={{ opacity }}`.
- Better: use a thin colored strip that's always slightly visible

```tsx
// Before
style={{ opacity: isResizing ? 1 : 0 }}

// After
style={{ opacity: isResizing ? 1 : 0.15 }}
```

This makes the resize handle a subtle 1px neon strip when idle, fully visible when resizing or hovering.

### 1.7 — Context Menus Don't Clamp to Viewport

**Problem:** Menus render at exact mouse coordinates, potentially off-screen.

**Fix in `NodeContextMenu.tsx` and `CanvasContextMenu.tsx`:**
- After rendering, measure the menu's bounding rect and clamp it to viewport bounds
- Use a `useLayoutEffect` to adjust position after mount

```tsx
const [adjustedPos, setAdjustedPos] = useState({ x, y });

useLayoutEffect(() => {
  if (!ref.current) return;
  const rect = ref.current.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  setAdjustedPos({
    x: Math.min(x, vw - rect.width - 8),
    y: Math.min(y, vh - rect.height - 8),
  });
}, [x, y]);
```

### 1.8 — Z-Index Hierarchy

**Problem:** 8 elements share z-50 with no priority resolution.

**Fix — Establish a z-index scale:**

| z-index | Purpose | Elements |
|---------|---------|----------|
| `z-10` | Node-level UI | + button, resize handle, copy button |
| `z-20` | Canvas overlays | EdgeAddButton picker |
| `z-30` | Onboarding | OnboardingOverlay |
| `z-40` | Dropdowns (in-flow) | VariableAutocomplete, validation dropdown |
| `z-50` | Context menus | NodeContextMenu, CanvasContextMenu |
| `z-[60]` | Modal overlays | CommandPalette, ShortcutOverlay, TemplateGallery |

**Files to update:**
- `CommandPalette.tsx` line 86: `z-50` → `z-[60]`
- `ShortcutOverlay.tsx` line 52: `z-50` → `z-[60]`
- `TemplateGallery.tsx` line 38: `z-50` → `z-[60]`
- `VariableAutocomplete.tsx` line 135: `z-50` → `z-40`
- `WorkflowToolbar.tsx` line 136: `z-50` → `z-40`

---

## Part 2: Animation Fixes

### 2.1 — Entrance Animation vs Hover Transform Conflict

**Problem:** `ab-node-enter` animation (scale 0.9→1) fights with hover `transform: scale(1.03)`. Causes a snap when hovering during entry.

**Fix in `globals.css`:**
- Change `ab-node-enter` to only animate `opacity`, not `transform`
- Let the hover transition handle all transform changes

```css
@keyframes ab-node-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

This eliminates the transform conflict entirely. The node fades in smoothly, and hover scale works independently.

### 2.2 — Running Nodes Skip Entrance Animation

**Problem:** Inline `animation: 'ab-pulse-border ...'` overrides the class-based `ab-node-enter` animation.

**Fix in `CustomNode.tsx`:**
- Use separate elements for entrance and pulse — entrance on the outer div, pulse on an inner overlay
- OR: combine the animations

```tsx
// Before
...(execStatus?.status === 'running' ? { animation: 'ab-pulse-border 1.5s ease-in-out infinite' } : {}),

// After — use animation-composition to layer both
style={{
  animation: execStatus?.status === 'running'
    ? 'ab-node-enter 0.15s ease-out, ab-pulse-border 1.5s ease-in-out 0.15s infinite'
    : undefined,
}}
```

The `0.15s` delay on the pulse animation lets the entrance complete first.

### 2.3 — Remove `ctxMenuIn` Inline Style Tags

**Problem:** `ctxMenuIn` keyframe is defined 3 times via inline `<style>` tags in React. Creates duplicate DOM elements and inconsistent definitions.

**Fix:**
- Move `ctxMenuIn` to `globals.css` (once)
- Remove all inline `<style>` tags from `NodeContextMenu.tsx`, `CanvasContextMenu.tsx`, `EdgeAddButton.tsx`

```css
/* globals.css */
@keyframes ctx-menu-in {
  from { opacity: 0; transform: scale(0.95) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.ctx-menu-enter {
  animation: ctx-menu-in 0.12s ease-out;
}
```

Then replace `animation: 'ctxMenuIn 0.12s ease-out'` with `className="ctx-menu-enter"` in all three files.

### 2.4 — Remove Dead CSS

**Problem:** `ab-running-glow`, `ab-exec-progress`, `ab-exec-progress-fill` are defined but never used.

**Fix in `globals.css`:**
- Remove the unused `@keyframes ab-running-glow` block (lines ~1226-1229)
- Remove `.ab-exec-progress` and `.ab-exec-progress-fill` (lines ~1241-1249)

### 2.5 — Add Missing Enter/Exit Transitions

**Problem:** Several conditional renders appear/disappear instantly.

**Fix — Add CSS transitions where needed:**

#### ExecutionPanel expand/collapse content
```tsx
// In ExecutionPanel.tsx, wrap expanded content:
<div
  className="overflow-hidden transition-all duration-200"
  style={{ maxHeight: isExpanded ? '400px' : '0px', opacity: isExpanded ? 1 : 0 }}
>
  {isExpanded && (...)}
</div>
```

#### Validation dropdown
```tsx
// In WorkflowToolbar.tsx, add transition to the dropdown:
className="... transition-all duration-150"
style={{
  opacity: showValidation ? 1 : 0,
  transform: showValidation ? 'translateY(0)' : 'translateY(-4px)',
  pointerEvents: showValidation ? 'auto' : 'none',
}}
```

#### Node status badges
```tsx
// In CustomNode.tsx, wrap each status badge:
<div className="transition-all duration-200" style={{ opacity: execStatus?.status === 'running' ? 1 : 0 }}>
  <Loader2 ... />
</div>
```

#### OnboardingOverlay fade-in
```tsx
// In OnboardingOverlay.tsx, add transition:
const [animState, setAnimState] = useState<'enter' | 'visible' | 'hidden'>('enter');

useEffect(() => {
  if (visible) {
    requestAnimationFrame(() => setAnimState('visible'));
  }
}, [visible]);

// On dismiss:
setAnimState('hidden');
setTimeout(() => setVisible(false), 200); // match transition duration
```

#### Settings panel slide-in
```tsx
// In NodeSettingsPanel.tsx, add transform transition:
className="h-full border-l overflow-y-auto flex flex-col transition-transform duration-200"
style={{
  ...existingStyles,
  transform: 'translateX(0)',
}}
```

---

## Part 3: Responsive Fixes

### 3.1 — Modal Max-Width Constraints

**Fix all fixed-width modals to respect viewport:**

| File | Line | Before | After |
|------|------|--------|-------|
| `CommandPalette.tsx` | 88 | `w-[420px]` | `w-[420px] max-w-[calc(100vw-32px)]` |
| `TemplateGallery.tsx` | 40 | `w-[700px]` | `w-[700px] max-w-[calc(100vw-32px)]` |
| `ShortcutOverlay.tsx` | 54 | `w-[380px]` | `w-[380px] max-w-[calc(100vw-32px)]` |
| `OnboardingOverlay.tsx` | 31 | `w-[440px]` | `w-[440px] max-w-[calc(100vw-32px)]` |

### 3.2 — ExecutionPanel Max-Width

**Fix in `ExecutionPanel.tsx` line 169:**

```tsx
// Before
width: isExpanded ? '560px' : '340px',

// After
width: isExpanded ? 'min(560px, calc(100vw - 120px))' : 'min(340px, calc(100vw - 120px))',
```

### 3.3 — TemplateGallery Responsive Grid

**Fix in `TemplateGallery.tsx` line 83:**

```tsx
// Before
<div className="grid grid-cols-2 gap-3">

// After
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

### 3.4 — WorkflowToolbar Overflow

**Fix in `WorkflowToolbar.tsx`:**
- Add `overflow-hidden` to the toolbar container
- Add `flex-shrink-0` to all button groups so they don't compress
- Add `min-w-[120px]` to the name input so it doesn't collapse to zero

---

## Implementation Order

| Step | Task | Files | Effort |
|------|------|-------|--------|
| 1 | Fix `+` button overlap with source handle | `CustomNode.tsx` | 2 min |
| 2 | Fix branch label offsets | `CustomNode.tsx` | 2 min |
| 3 | Fix entrance animation vs hover conflict | `globals.css`, `CustomNode.tsx` | 5 min |
| 4 | Move `ctxMenuIn` to globals.css, remove inline styles | `globals.css`, 3 component files | 5 min |
| 5 | Remove dead CSS | `globals.css` | 2 min |
| 6 | Fix z-index hierarchy | 5 component files | 5 min |
| 7 | Fix OnboardingOverlay scoping | `WorkflowCanvas.tsx` | 1 min |
| 8 | Fix resize handle visibility | `NodeSettingsPanel.tsx` | 1 min |
| 9 | Fix ExecutionPanel vs Controls overlap | `WorkflowCanvas.tsx` | 1 min |
| 10 | Add viewport clamping to context menus | `NodeContextMenu.tsx`, `CanvasContextMenu.tsx` | 10 min |
| 11 | Add modal max-width constraints | 4 component files | 3 min |
| 12 | Add responsive ExecutionPanel width | `ExecutionPanel.tsx` | 1 min |
| 13 | Add responsive template grid | `TemplateGallery.tsx` | 1 min |
| 14 | Add enter/exit transitions | 4 component files | 10 min |
| 15 | Fix toolbar overflow | `WorkflowToolbar.tsx` | 2 min |
| 16 | Build verification | `npm run build` | 2 min |

**Total estimated effort: ~53 minutes**

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `globals.css` | Fix `ab-node-enter` (opacity only), add `ctx-menu-in` keyframe, remove dead CSS |
| `CustomNode.tsx` | Fix `+` button position, branch label offsets, entrance+pulse animation combo |
| `WorkflowCanvas.tsx` | Move Controls to top-left, add `relative` to canvas wrapper |
| `NodeSettingsPanel.tsx` | Fix resize handle opacity |
| `NodeContextMenu.tsx` | Viewport clamping, remove inline style tag, use `ctx-menu-enter` class |
| `CanvasContextMenu.tsx` | Viewport clamping, remove inline style tag, use `ctx-menu-enter` class |
| `EdgeAddButton.tsx` | Remove inline style tag, use `ctx-menu-enter` class |
| `CommandPalette.tsx` | z-index → z-[60], add max-width |
| `ShortcutOverlay.tsx` | z-index → z-[60], add max-width |
| `TemplateGallery.tsx` | z-index → z-[60], add max-width, responsive grid |
| `OnboardingOverlay.tsx` | Add max-width, fade-in/out transition |
| `VariableAutocomplete.tsx` | z-index → z-40 |
| `WorkflowToolbar.tsx` | z-index → z-40, transition on validation dropdown, overflow fix |
| `ExecutionPanel.tsx` | Responsive width, expand/collapse transition |
| `AgentBuilderMode.tsx` | Fix back button positioning |
