# Stitch Fixes and Improvements

## Critical Bugs

### 1. Images completely broken — `addElement` silently drops image elements
**File:** `components/StitchCanvas.tsx:27-89`
`createFabricObject()` returns `null` for `type === 'image'`. When `addElement` (line 111-121) calls `createFabricObject(el)`, it gets `null`, and the `if (obj)` guard prevents anything from happening. Neither the canvas NOR the element state are updated. Images uploaded via `StitchImagePicker` or generated via AI are silently lost.

**Fix:** In `addElement`, detect image type elements and handle them with async `FabricImage.fromElement()` / `FabricImage.fromURL()`, then add to canvas and call `onElementsChange` once the image is loaded. Alternatively, change the approach: always call `onElementsChange` (to save the element to state), and let the sync effect handle rendering.

### 2. Stale closure on Fabric.js event handlers
**File:** `components/StitchCanvas.tsx:163-199`
The canvas setup effect captures `onElementsChange` and `onSelectionChange` in its closure, but these are NOT in the dependency array `[width, height]`. If the parent re-renders with new callback references, the canvas event handlers (`object:modified`, `selection:created`, etc.) will call stale callbacks, potentially overwriting newer state.

**Fix:** Use `useRef` to hold the latest `onElementsChange` and `onSelectionChange`, update them on every render, and have the event handlers read from the ref. This avoids recreating the canvas on callback changes.

### 3. Star shape renders as rectangle
**File:** `components/StitchCanvas.tsx:39-74`
The `createFabricObject` function has no `case 'star':` — it falls through to `default` which creates a `Rect`. The toolbar shows a Star button, but clicking it creates a rectangle.

**Fix:** Add a `case 'star':` that creates a star using Fabric.js `Path` or `Polygon` with star-shaped points.

### 4. Full canvas re-sync on every elements change causes flicker and selection loss
**File:** `components/StitchCanvas.tsx:208-241`
Every `elements` change removes ALL fabric objects and re-adds them. This:
- Loses current selection
- Causes images to flash (async load)
- Degrades performance with many elements
- Re-triggers `object:modified` events

**Fix:** Implement a diff-based sync: compare current fabric objects with incoming elements by `stitchId`, only add/remove/update changed elements.

---

## Medium Bugs

### 5. Export HTML skips HTML-type elements
**File:** `components/StitchEditor.tsx:364-408`
`buildHTMLFromCanvas()` handles `text`, `shape`, `image`, and `default` (empty div). For `html` type elements, it falls through to `default` and renders an empty div instead of embedding `el.html`.

**Fix:** Add a `case 'html':` that outputs `<div style="${style}">${el.html || ''}</div>`.

### 6. Layout change doesn't adjust element positions
**File:** `components/StitchEditor.tsx:84-90`
When switching layouts (e.g., 16:9 → 9:16), element absolute positions stay the same. Elements that were visible in landscape may be completely off-screen in portrait.

**Fix:** Scale element positions proportionally when layout changes: `newX = el.x * (newWidth / oldWidth)`, `newY = el.y * (newHeight / oldHeight)`.

### 7. No keyboard shortcuts
No `Delete` key to remove selected element. No `Escape` to deselect. Users must click the tiny trash icon in the header.

**Fix:** Add a `keydown` listener in `StitchEditor` (or `StitchCanvas`) that handles:
- `Delete`/`Backspace` → delete selected element
- `Escape` → deselect
- `Ctrl+D` → duplicate selected element

### 8. `useEffect` for controls has missing dependencies
**File:** `components/StitchEditor.tsx:205-215`
The `onControlsChange` effect uses `handleDeleteSelected`, `handleExportHTML`, `handleChangeLayout` but doesn't list them as dependencies. These are plain functions (not `useCallback`), so they're recreated every render, but if a render happens without a dependency change, stale handlers are passed to App.tsx.

**Fix:** Either wrap handlers in `useCallback` with proper deps and add them to the effect's dependency array, or use refs for the handlers (simpler pattern).

---

## Improvements

### 9. Add element duplication
No way to duplicate an element. Users must recreate elements from scratch.

**Fix:** Add a `handleDuplicateSelected` function that clones the selected element with a slight offset. Wire it to a toolbar button and `Ctrl+D` shortcut.

### 10. Add z-index controls (bring to front / send to back)
No way to change element stacking order.

**Fix:** Add `bringToFront` and `sendToBack` buttons (or right-click menu) that call `canvas.bringToFront(obj)` / `canvas.sendToBack(obj)` and update `zIndex` in the element state.

### 11. Add background color picker for boards
`StitchBoard` has a `bgColor` field and the canvas uses it, but there's no UI to change it.

**Fix:** Add a color picker control in the toolbar or board sidebar to set `bgColor`.

### 12. Add canvas zoom support
The canvas is fixed at `CANVAS_BASE_W = 960` pixels. For detailed work on small elements, users need zoom.

**Fix:** Add zoom controls (`Ctrl+scroll` or buttons) that scale the canvas container. Use CSS `transform: scale()` on the canvas wrapper (not Fabric's built-in zoom, to keep the coordinate system consistent).

### 13. Improve board thumbnails in sidebar
Board thumbnails in the left sidebar (lines 244-282) just show the layout label text. They should show a mini preview of the canvas content.

**Fix:** Use `canvas.toDataURL()` with a small multiplier to generate board preview thumbnails. Store them in component state and display them in the sidebar.

---

## Files to modify

| # | File | Changes |
|---|------|---------|
| 1 | `components/StitchCanvas.tsx` | Fix image `addElement`, stale closure refs, star shape, diff-based element sync |
| 2 | `components/StitchEditor.tsx` | Fix export HTML for html-type elements, layout scaling, keyboard shortcuts, duplicate, z-index, controls effect deps, bg color picker |
| 3 | `components/StitchToolbar.tsx` | Add duplicate, bring-to-front, send-to-back buttons |

---

## Implementation order

1. **StitchCanvas.tsx** — Fix stale closure (refs for callbacks), fix `addElement` for images, add star shape, diff-based sync
2. **StitchEditor.tsx** — Fix export HTML, layout scaling, keyboard shortcuts, duplicate/z-index handlers, controls effect deps, bg color
3. **StitchToolbar.tsx** — Add duplicate and z-index toolbar buttons
