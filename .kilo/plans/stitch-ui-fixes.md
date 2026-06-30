# Stitch UI Fixes: iframe SecurityError + Header Merge + Sidebar Narrow

## Problem 1: SecurityError on iframe `contentDocument` access

**Root cause**: `StitchExportModal.tsx:20` tries `iframe.contentDocument || iframe.contentWindow?.document` to write HTML, but the iframe has `sandbox="allow-scripts"` (line 125). The sandbox creates a unique origin, making it cross-origin — hence the SecurityError.

**Fix**: Replace `doc.write()` with the `srcdoc` attribute. Remove the `useEffect` that writes to `contentDocument` and instead pass the HTML directly via `srcdoc={html}` on the `<iframe>`.

### File: `components/StitchExportModal.tsx`

1. Remove the `useRef` for `iframeRef` and the `useEffect` (lines 15, 17-27) that writes to `contentDocument`
2. Set `srcdoc={html}` directly on the `<iframe>` element (line 121-127)
3. Remove the `ref={iframeRef}` from the iframe

---

## Problem 2: Merge Stitch header with the app header

**Current state**: The main app header in `App.tsx:776-806` shows: sidebar toggle, model selector, new-chat button. The StitchEditor has its own separate top bar (`StitchEditor.tsx:198-254`) with: back arrow, project title, layout selector, delete button, export button.

**Goal**: When in stitch mode with an active project, replace the model selector area in the main header with stitch controls. Remove the StitchEditor's own top bar.

### File: `App.tsx`

1. Add new state to track the active stitch project: `const [stitchActiveProject, setStitchActiveProject] = useState<StitchProject | null>(null)` — or better, lift this state from StitchPanel
2. In the header area (`App.tsx:776-806`), conditionally render stitch controls when `activeView === 'stitch' && stitchActiveProject`:
   - Back button (to exit project → set `stitchActiveProject` to null)
   - Project title
   - Layout selector (16:9, 1:1, 9:16)
   - Delete selected element button
   - Export button
3. Pass a callback to StitchPanel/StitchEditor so it reports when a project becomes active/inactive

### File: `components/StitchPanel.tsx`

1. Add `onProjectChange?: (project: StitchProject | null) => void` prop
2. Call `onProjectChange(activeProject)` when `setActiveProject` is called (both set and clear)

### File: `components/StitchEditor.tsx`

1. Remove the entire top bar section (lines 198-254)
2. Expose layout change, delete selected, export, and back actions via a new prop or ref:
   - Option A (simpler): Add props like `onLayoutChange`, `onDeleteSelected`, `onExport`, `selectedElementId`, `activeBoard` and let the parent (StitchPanel → App) render the controls in the main header
   - Option B (cleaner): Use `useImperativeHandle` on a forwarded ref to expose `handleChangeLayout`, `handleDeleteSelected`, `handleExportHTML`, `selectedElementId`, `activeBoard`
3. Since StitchPanel already renders StitchEditor, we can pass an `onEditorReady` callback that StitchEditor calls with an object of controls/state

**Recommended approach**: Add an `onControlsChange` callback prop to StitchEditor that reports `{ selectedElementId, activeBoard, onDeleteSelected, onExport, onLayoutChange, isGenerating }`. StitchPanel forwards this to App. App renders the stitch controls in the main header when active.

### File: `App.tsx` header conditional (lines 776-806)

When `activeView === 'stitch' && stitchControls`:
```tsx
<button onClick={stitchControls.onBack}><ArrowLeft size={18} /></button>
<Layers size={16} style={{ color: 'var(--neon-color)' }} />
<span>{stitchControls.projectTitle}</span>
{/* Layout selector buttons */}
{stitchControls.selectedElementId && <button onClick={stitchControls.onDeleteSelected}><Trash2 size={16} /></button>}
<div className="ml-auto">
  <button onClick={stitchControls.onExport}><Download size={14} /> Export</button>
</div>
```

When not in stitch mode: render model selector as usual.

---

## Problem 3: Narrow sidebar in stitch mode

**Current state**: Sidebar is `w-[288px]` when open.

**Fix**: Auto-collapse sidebar when entering stitch mode, OR reduce width.

### File: `App.tsx`

When `activeView` changes to `'stitch'`, set `setIsSidebarOpen(false)` to auto-collapse. This gives maximum canvas space. Alternatively, pass a `narrow` prop to Sidebar.

**Recommended**: Auto-collapse on entering stitch. The user can still manually reopen it.

---

## Files to modify

| File | Changes |
|------|---------|
| `components/StitchExportModal.tsx` | Replace `doc.write()` with `srcdoc` attribute |
| `components/StitchEditor.tsx` | Remove top bar, expose controls via `onControlsChange` prop |
| `components/StitchPanel.tsx` | Add `onProjectChange` + `onControlsChange` forwarding, add `onBack` prop |
| `App.tsx` | Add stitch controls state, render stitch controls in header when active, auto-collapse sidebar on stitch |
