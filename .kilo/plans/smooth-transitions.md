# Smooth Transitions Plan

## Overview
Add polished entrance/exit animations and smooth CSS transitions across the app's key UI surfaces — modals, panels, cards, dropdowns, sidebar, and page-level transitions. All changes are CSS-only (keyframes + Tailwind utilities) with no new dependencies.

---

## Transitions Inventory

### 1. Dialog / Modal — fullscreen file viewer (`PythonExecutorPanel.tsx`)
**Current:** `DialogContent` uses default zoom-in/out from `dialog.tsx` (0.2s). The fullscreen viewer reuses this — too fast and jarring for a 95vw×92vh modal.
**Fix:** Override with a dedicated fullscreen animation in `globals.css`:
- **Open:** scale(0.97) → scale(1) + fade, 0.3s `cubic-bezier(0.16, 1, 0.3, 1)` (overshoot ease)
- **Close:** scale(1) → scale(0.97) + fade, 0.2s ease-in
- Apply via `data-[state=open]:animate-modal-fs-in data-[state=closed]:animate-modal-fs-out` on the fullscreen `DialogContent`

### 2. Dialog / Modal — standard dialogs (all `DialogContent` usages)
**Current:** `zoom-in-95` (0.2s) — functional but no spring.
**Fix:** Improve the default `DialogContent` animation in `dialog.tsx`:
- **Open:** scale(0.95) + translateY(8px) → scale(1) + translateY(0), 0.25s `cubic-bezier(0.16, 1, 0.3, 1)`
- **Close:** reverse, 0.15s ease-in
- Affects: ModeSelector, CreateComponent, EditComponent, CreateFolder, EditFolder, StitchExport, StitchLibrary, ComponentEditor add/delete file dialogs

### 3. Dialog overlay fade
**Current:** `fade-in 0.2s / fade-out 0.2s` — fine.
**No change needed.**

### 4. Python Executor — grid ↔ editor view transition
**Current:** Instant swap (React conditional render, no animation).
**Fix:**
- **Grid → Editor:** The editor container fades in + slight translateY(8px), 0.3s
- **Editor → Grid:** Grid cards re-enter with staggered `animate-fade-in` (already has `animationDelay: idx * 60ms`) — just ensure the container itself fades in
- Apply `animate-fade-in` to the editor wrapper div and the grid wrapper div

### 5. Python Executor — output panel slide-in
**Current:** Instant appearance when `(output || isRunning)`.
**Fix:**
- **Open:** Slide in from right (`translateX(20px)` → `translateX(0)` + fade), 0.25s
- **Close:** Slide out to right + fade, 0.2s
- Use CSS `animate-slide-in-from-right` (already defined in globals.css) on the output panel container
- Wrap in a key-based container so animation replays on each open

### 6. Python Executor — file viewer CSV table page transition
**Current:** Instant page swap when paginating.
**Fix:**
- Crossfade: outgoing page fades out (0.1s), incoming fades in (0.15s) with slight translateY
- Use `animate-fade-in` on the table body keyed by `csvPage`

### 7. Dropdown menus (`DropdownMenuContent`)
**Current:** `animate-in fade-in-0 zoom-in-95` from Radix defaults (0.2s).
**Fix:** Already has `animate-dropdown-in` defined (scale 0.95 + translateY(-4px), 0.2s). Apply it:
- Update `dropdown-menu.tsx` `DropdownMenuContent` to use `data-[state=open]:animate-dropdown-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95`

### 8. Sidebar slide-in/out
**Current:** `transition-all duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)]` — already smooth.
**No change needed.**

### 9. Sidebar — experiment tool item hover
**Current:** `transition-colors` — only color changes.
**Fix:** Add `transition-all duration-200` for smoother background + color shifts.

### 10. StitchPanel — project card hover lift
**Current:** `transition-all duration-300` with inline `transform: translateY(-2px)` + `boxShadow` on hover.
**No change needed** — already polished.

### 11. Python Executor — add file input expand
**Current:** Instant show/hide of the filename input.
**Fix:**
- **Open:** Height 0 + opacity 0 → auto + opacity 1, 0.2s ease-out
- **Close:** Reverse, 0.15s
- Use `animate-block-expand` (already defined) or a simpler opacity + translateY transition

### 12. Python Executor — drag overlay
**Current:** Instant show/hide of the drag overlay.
**Fix:**
- **Open:** Fade in + scale(1.02) → scale(1), 0.2s
- **Close:** Fade out, 0.15s
- Apply `animate-fade-in` on open, conditional class on close

### 13. Python Executor — data files three-dot dropdown
**Current:** Uses DropdownMenu (see #7 above).
**Covered by #7.**

### 14. Chat message entrance
**Current:** `animate-message-in` (0.4s, translateY 8px → 0).
**No change needed.**

### 15. PromptInputBox — image preview modal
**Current:** Uses `DialogContent` with `hideCloseButton`, `motion.div` for scale animation.
**Fix:** The `motion.div` handles its own animation. Ensure `DialogContent` gets the improved default animation from #2.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/globals.css` | Add `modal-fs-in`, `modal-fs-out`, `slide-in-up`, `expand-in` keyframes + animate vars |
| `components/ui/dialog.tsx` | Improve default `DialogContent` open/close animation; add fullscreen variant support |
| `components/ui/dropdown-menu.tsx` | Apply `animate-dropdown-in` to `DropdownMenuContent` |
| `components/PythonExecutorPanel.tsx` | Animate: grid↔editor transition, output panel slide, add-file expand, drag overlay, CSV page fade, fullscreen modal variant |

## Implementation Order
1. `globals.css` — add new keyframes
2. `dialog.tsx` — improve default + fullscreen modal animations
3. `dropdown-menu.tsx` — apply dropdown animation
4. `PythonExecutorPanel.tsx` — apply all panel-level transitions
