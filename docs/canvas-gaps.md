# Canvas — Gap Analysis: layout_craft.html vs React Implementation

Gaps between `docs/layout_craft.html` (reference) and `components/canvas/` (React).

---

## 1. CanvasGrid.tsx

### Missing Left/Right move buttons on component header

**Reference** (line 802-805): Each component has 6 action buttons — Up, Down, Left, Right, Regenerate, Delete.

**React** (CanvasGrid.tsx:344-356): Only 4 buttons — Up, Down, Regenerate, Delete. Missing Left/Right arrow buttons.

**Fix:** Add Left/Right `ActionButton` components calling `onMove(comp.id, -1, 0)` and `onMove(comp.id, 1, 0)`.

### Cursor coordinate display missing from toolbar

**Reference** (line 450-451): Canvas toolbar shows `col X / row Y` as the mouse moves.

**React**: Canvas toolbar in `CanvasEditor.tsx` shows "N sections" and resolution but no live cursor position.

**Fix:** Add `ctCursor` state to CanvasGrid, pass cursor position up via callback or render inline in toolbar.

### Selection label positioning

**Reference** (line 197-207): Selection label has `.sel-label-top` (top: -26px) and `.sel-label-bot` (bottom: -26px) classes that flip based on row position.

**React** (CanvasGrid.tsx:280-289): Uses inline `top`/`bottom` calculation. Functionally equivalent but the label can overlap with the column ruler when selecting near the top.

**Fix:** Add ruler height offset (26px) to the label position calculation.

### Overlap toast missing

**Reference** (line 654): When drawing overlaps an existing component, shows toast "Overlaps existing component".

**React** (CanvasGrid.tsx:120-123): Silently resets `dStart`/`dEnd` with no user feedback.

**Fix:** Add `toast.error('Overlaps existing component')` in the overlap branch. Requires passing `onNotification` prop or importing `sonner`.

### Drawing starts during hover (visual glitch)

**Reference** (line 627-633): `onDown` only starts drawing if the click is NOT on a `.comp` or `.prompt-bar`.

**React** (CanvasGrid.tsx:82-93): Same guard exists but also checks `[role="dialog"]` and `[data-portal]`. However, the hover cell continues showing during the draw operation's initial frame before `setHoverPos(null)` takes effect.

**Fix:** Minor — set `hoverPos` to `null` synchronously at the start of `handleMouseDown`.

---

## 2. CanvasEditor.tsx

### Canvas toolbar missing "Draw to place component" mode text

**Reference** (line 450): Shows `<span class="ct-dot" style="background:var(--accent)"></span><span id="ctMode">Draw to place component</span>`.

**React** (CanvasEditor.tsx:362-369): Shows "N sections" and resolution — no mode indicator.

**Fix:** Add a mode indicator to the left side of the canvas toolbar.

### Grid column switcher missing

**Reference** (line 456-460): Grid selector with 12/16/24 column options that dynamically rebuilds the grid.

**React**: Template selector replaces this with resolution presets. The reference's dynamic column switching (12→16→24) is lost — the React version uses fixed templates.

**Fix:** Add a column count selector alongside the template picker, or document this as an intentional design change (fixed templates > dynamic columns).

### `idCounter` is module-level (shared across instances)

**Reference** (line 524): `idCtr` is a global `let` — works fine in vanilla JS.

**React** (CanvasEditor.tsx:44): `let idCounter = 0` is module-level. If two CanvasEditor instances exist (e.g., during hot reload or if the component remounts), IDs can collide.

**Fix:** Move `idCounter` into a `useRef` inside the component.

### Regenerate doesn't persist intermediate generating state

**Reference** (line 772-776): `regenComp` sets `generating = true`, re-renders, then after 1200ms sets `generating = false` and re-renders again. Both states are persisted immediately.

**React** (CanvasEditor.tsx:282-310): `handleRegenerate` uses `setGridState` for the generating state but only calls `onSave` (persist) when generation completes. If the user navigates away during regeneration, the generating state is lost.

**Fix:** Call `saveState` (or at least `onSave`) when setting `generating: true`.

---

## 3. CanvasSidebar.tsx

### Section type label says "Quick Add" not "Quick Add (Full Width)"

**Reference** (line 442): `<div class="sb-title">Quick Add (Full Width)</div>`

**React** (CanvasSidebar.tsx:60): `<div ...>Quick Add</div>` — missing "(Full Width)" suffix.

**Fix:** Add "(Full Width)" to the label text.

### Sidebar divider missing

**Reference** (line 440): `<div style="height:1px;background:var(--border-s);margin:0 14px"></div>` between AI section and Quick Add section.

**React** (CanvasSidebar.tsx:57): Uses `<div className="h-px mx-3.5" style={{ background: 'var(--border-200)' }} />` — functionally equivalent but uses `--border-200` instead of `--border-s`. Minor style difference.

### Button icon missing on "Generate Full Page"

**Reference** (line 438): `<button class="btn btn-a ai-btn" onclick="aiFullPage()">✨ Generate Full Page</button>`

**React** (CanvasSidebar.tsx:47-54): Uses `<Sparkles size={14} />` icon — equivalent but uses Lucide icon instead of emoji.

---

## 4. CanvasProperties.tsx

### Prompt textarea doesn't save on blur (only on change)

**Reference** (line 869): The textarea has `id="pnPrompt"` but the save happens in a separate listener (not shown in the snippet — likely on blur or explicit save button).

**React** (CanvasProperties.tsx:133): `onUpdatePrompt` fires on every `onChange` event. This means every keystroke triggers a save to the database. The reference likely debounces or saves on blur.

**Fix:** Debounce `onUpdatePrompt` or save on blur instead of on change.

### Missing "Save" button for prompt changes

**Reference** (line 875-876): Has explicit "Regenerate" and "Delete" buttons after the prompt textarea.

**React**: Same buttons exist but no explicit "Save" for the prompt. The auto-save on change is a reasonable React pattern but differs from the reference.

---

## 5. CanvasExportModal.tsx

### Export modal uses Dialog (portal) instead of inline overlay

**Reference** (line 486-500): Export modal is a fixed overlay (`.modal-ov`) rendered inline in the DOM. Clicking the overlay background closes it.

**React** (CanvasExportModal.tsx:61): Uses Radix `Dialog` component (portal-based). Functionally equivalent but the portal can interfere with canvas click events (the portal guard in `handleMouseDown` addresses this).

### Code output is plain text, not syntax-highlighted

**Reference** (line 887-908): Export code uses `<span class="t">`, `<span class="a">`, `<span class="v">`, `<span class="c">` for syntax highlighting (tags=red, attrs=purple, values=green, comments=gray).

**React** (CanvasExportModal.tsx:153-166): Export code is plain text in a `<pre>` block — no syntax highlighting.

**Fix:** Add syntax highlighting to the export code output. Can use a simple regex-based highlighter or a library like `prism`/`highlight.js`.

### Export button text uses `‹/›` prefix

**Reference** (line 429): `<button class="btn" onclick="openExport()">‹/› Export</button>`

**React**: Export is triggered via `onControlsChange` callback — the button lives in `App.tsx` header, not in the Canvas components. No `‹/›` prefix.

---

## 6. Cross-Cutting Gaps

### No keyboard shortcut for deleting components

**Reference** (line 540): `Delete` or `Backspace` key removes the selected component (when not focused on an input).

**React** (CanvasGrid.tsx:155-167): Same logic exists. ✅ Implemented.

### Escape key behavior

**Reference** (line 539): Escape cancels selection AND deselects all components.

**React** (CanvasGrid.tsx:157-159): Escape calls `cancelSelection()` and `onSelect(null)`. ✅ Implemented.

### Canvas mouseleave hides hover cell

**Reference** (line 536): `mouseleave` sets hover cell `display: none`.

**React** (CanvasGrid.tsx:132-134, 184): `handleMouseLeave` sets `hoverPos` to `null`. ✅ Implemented.

### Toast notifications

**Reference** (line 911): Custom toast implementation using DOM manipulation.

**React**: Uses `sonner` library (`toast.success`, `toast.error`). ✅ Equivalent.

### `color` field not in GridComponent type

**Reference** (line 706): Each component stores `color: COLORS[type] || COLORS.generic`.

**React** (types.ts): `GridComponent` does NOT have a `color` field. Colors are derived from `COLORS[comp.type]` at render time. This is actually cleaner — no redundancy. ✅ No gap.

---

## Summary

| # | Gap | Severity | File | Effort |
|---|-----|----------|------|--------|
| 1 | Missing Left/Right move buttons on component header | Medium | CanvasGrid.tsx | Low |
| 2 | Missing cursor coordinate display in toolbar | Low | CanvasEditor.tsx | Low |
| 3 | Overlap toast notification missing | Medium | CanvasGrid.tsx | Low |
| 4 | Module-level `idCounter` can collide | Low | CanvasEditor.tsx | Low |
| 5 | Regenerate doesn't persist generating state | Low | CanvasEditor.tsx | Low |
| 6 | Prompt textarea saves on every keystroke | Low | CanvasProperties.tsx | Low |
| 7 | Export code has no syntax highlighting | Medium | CanvasExportModal.tsx | Medium |
| 8 | Sidebar label missing "(Full Width)" | Trivial | CanvasSidebar.tsx | Trivial |
| 9 | No dynamic column count switcher (12/16/24) | Low | CanvasEditor.tsx | Medium |
| 10 | Grid column switcher is template-based not column-based | Design | — | — |

**Most impactful to fix:** #1 (Left/Right buttons), #3 (overlap toast), #7 (syntax highlighting).

**Trivial to fix:** #8 (label text), #2 (cursor display).
