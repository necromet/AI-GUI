# Plan: Merge Canvas Toolbar into Main Header

## Problem

The canvas editor currently has two stacked header bars:
1. **Main header** (App.tsx:1097) — project title, layout badge, agent toggle
2. **Canvas toolbar** (CanvasEditor.tsx:674) — Canvas/Preview toggle, cursor position, template selector, column badge

This wastes vertical space and looks disjointed. The canvas toolbar should be merged into the main header.

## Goal

Consolidate into a single header bar in App.tsx that shows all canvas controls when a canvas project is active. Remove the toolbar from CanvasEditor.

## Target Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [☰] [◀] Layers  Untitled  Desktop 1080p │ Canvas │ Preview │ ... │ Template [▾] 12-col │ [⇄ Agent] │
└──────────────────────────────────────────────────────────────────────┘

Left:    sidebar toggle + back button + icon + title + layout badge
Center:  Canvas/Preview toggle + status text (cursor or file count)
Right:   template selector + col badge + agent toggle
```

## Implementation Steps

### Step 1: Extend `CanvasControls` with toolbar data

**File:** `components/canvas/CanvasEditor.tsx`

Add fields to the `CanvasControls` interface:

```ts
export interface CanvasControls {
  // ... existing fields ...
  template: string;                        // gridState.template key
  onTemplateChange: (template: string) => void;  // calls updateTemplate
  cols: number;                            // resolution.cols
  cursorPos: { col: number; row: number } | null;
  fileCount: number;                       // projectFiles.length
  componentCount: number;                  // generated components count
}
```

### Step 2: Populate new fields in the `onControlsChange` useEffect

**File:** `components/canvas/CanvasEditor.tsx` (line ~621)

Add the new fields to the controls object:

```ts
onControlsChange?.({
  // ... existing ...
  template: gridState.template,
  onTemplateChange: (t) => updateTemplate(t as ResolutionTemplate),
  cols: resolution.cols,
  cursorPos,
  fileCount: projectFiles.length,
  componentCount: gridState.components.filter(c => c.generated).length,
});
```

Add `cursorPos`, `projectFiles`, and `updateTemplate` to the dependency array.

### Step 3: Remove the canvas toolbar from CanvasEditor

**File:** `components/canvas/CanvasEditor.tsx`

Delete the entire toolbar block (lines ~674-764: the `<div className="h-9 ...">` containing Canvas/Preview buttons, cursor info, template selector, and col badge). The CanvasEditor render becomes just:

```tsx
return (
  <div className="flex h-full overflow-hidden">
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-100)' }}>
      {/* Main content area — no toolbar */}
      {viewMode === 'canvas' ? (
        <CanvasGrid ... />
      ) : (
        <div>...</div>
      )}
    </div>
    <SkemaAgentSidebar ... />
    <CanvasExportModal ... />
  </div>
);
```

Also remove now-unused imports: `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Badge`, `Monitor`, `Tablet`, `Smartphone`, `Laptop`, `Eye`, `Code2`.

### Step 4: Redesign the main header in App.tsx for canvas mode

**File:** `App.tsx` (line ~1108)

Replace the current skema header block with a redesigned single-row layout. Import additional icons (`Code2`, `Eye`, `Monitor`, `Tablet`, `Smartphone`, `Laptop`) and `Select` components. Import `RESOLUTIONS` from canvas constants.

New header structure when canvas controls are active:

```tsx
{location.pathname.startsWith('/experiments/skema') && skemaControls ? (
  <>
    {/* Left: back + project info */}
    <div className="flex items-center gap-2 min-w-0">
      <Layers size={16} className="flex-shrink-0" style={{ color: 'var(--neon-color)' }} />
      <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)' }}>
        {skemaControls.projectTitle}
      </span>
      <Badge variant="outline" ...>{skemaControls.layout}</Badge>
    </div>

    {/* Center: Canvas/Preview toggle + status */}
    {'viewMode' in skemaControls && (
      <div className="flex items-center gap-3 ml-4">
        <div className="flex items-center gap-1.5">
          <button onClick={() => (skemaControls as CanvasControls).onViewModeChange('canvas')} ...>
            <Code2 size={12} /> Canvas
          </button>
          <button onClick={() => (skemaControls as CanvasControls).onViewModeChange('preview')} ...>
            <Eye size={12} /> Preview
          </button>
        </div>
        <div className="text-[11px] font-mono" style={{ color: 'var(--text-400)' }}>
          {/* cursor info or file count based on viewMode */}
        </div>
      </div>
    )}

    {/* Right: template + actions */}
    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
      {'template' in skemaControls && (
        <>
          <Select value={...} onValueChange={...}>...</Select>
          <Badge>{(skemaControls as CanvasControls).cols}-col</Badge>
        </>
      )}
      {/* agent toggle */}
    </div>
  </>
) : ...}
```

### Step 5: Update `onViewModeChange` in CanvasEditor

**File:** `components/canvas/CanvasEditor.tsx`

The current `onViewModeToggle` flips between modes. For the header buttons we need a setter. Either:
- Replace `onViewModeToggle` with `onViewModeChange: (mode: 'canvas' | 'preview') => void`, OR
- Keep both (toggle for keyboard shortcut, change for direct set)

Recommended: keep `onViewModeToggle` for backward compat, add `onViewModeChange`:

```ts
onViewModeChange: (mode: 'canvas' | 'preview') => setViewMode(mode),
```

## Files to Modify

| File | Changes |
|------|---------|
| `components/canvas/CanvasEditor.tsx` | Extend `CanvasControls` with 6 new fields, populate in useEffect, remove canvas toolbar div + its imports, add `onViewModeChange` |
| `App.tsx` | Redesign skema header to include Canvas/Preview toggle, cursor info, template selector, col badge. Add imports for `Code2`, `Eye`, `Monitor`, `Tablet`, `Smartphone`, `Laptop`, `Select*`, `RESOLUTIONS` |

## Verification

1. `npm run build` — must pass
2. Canvas project header shows: project title, layout badge, Canvas/Preview toggle, cursor position, template selector, col badge, agent toggle — all in one row
3. Canvas/Preview toggle works
4. Template selector changes resolution and canvas updates
5. Cursor position updates on hover in canvas mode
6. Preview mode shows file count instead of cursor
7. Non-canvas skema modes (SkemaEditor) unaffected
8. Chat/RAG/Library modes unaffected
