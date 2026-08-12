# Database Panel Full-Screen Fix

## Problem
The database editor panel does not fill the full available space. The Monaco editor renders at only 200px height (the `minHeight` fallback) instead of expanding to fill the viewport. When query results appear, the split between editor and results should adjust proportionally.

## Root Cause
Two issues in the layout chain:

1. **Scroll container overflow** (`App.tsx:1517`): The content area uses `overflow-y-auto`, which allows scrolling. The `h-full` on the DatabasePanel wrapper resolves against a scrollable container, so it doesn't constrain height properly.

2. **Percentage height in flex context** (`DatabasePanel.tsx:711`): The editor container uses `height: '100%'` — but `height: 100%` in a flex column requires the parent to have an explicit height (not just `flex-1`), so it falls back to `minHeight: 200px`.

## Changes

### 1. `App.tsx` line ~1517 — Conditional overflow on scroll container

When on `/database` routes, use `overflow-hidden` instead of `overflow-y-auto` so the DatabasePanel fills the viewport exactly (no scrolling).

```tsx
// Before
<div className="flex-1 overflow-y-auto relative scroll-smooth" id="scroll-container">

// After — add conditional class
<div className={`flex-1 relative scroll-smooth ${location.pathname.startsWith('/database') ? 'overflow-hidden' : 'overflow-y-auto'}`} id="scroll-container">
```

### 2. `DatabasePanel.tsx` lines 700-810 — Restructure connected view layout

Remove the unnecessary wrapper, use flex sizing instead of percentage heights:

**Current structure** (broken):
```
flex-1 flex-col animate-fade-in
  └── flex-1 flex min-h-0                    ← unnecessary wrapper
      └── flex-1 flex-col min-w-0 min-h-0
          └── flex-col height:100% min-h:200px  ← percentage doesn't resolve
              └── flex-1 flex min-h-0
                  ├── SQL Editor (flex-1)
                  └── Explain Canvas (flex-1)
          └── Results height:(1-ratio)%          ← percentage doesn't resolve
```

**New structure** (working):
```
flex-1 flex-col animate-fade-in min-h-0
  └── flex-1 flex-col min-w-0 min-h-0
      ├── ProgressBar (shrink-0, conditional)
      ├── Editor+Explain flex-1 min-h-0 min-h:200px  ← flex sizing works
      │   ├── SQL Editor (flex-1)
      │   └── Explain Canvas (flex-1)
      ├── ResizeHandle (shrink-0, conditional)
      └── Results flex-1 min-h-0                     ← flex sizing works
```

Key changes:
- Remove line 701 `<div className="flex-1 flex min-h-0">` wrapper + its closing `</div>` (line 812)
- Add `min-h-0` to root div (line 700)
- Editor area: replace `height: percentage` with `flex-1 min-h-0` + `minHeight: 200px`
- When results visible: editor gets `style={{ flex: editorSplitRatio }}`, results gets `style={{ flex: 1 - editorSplitRatio }}`
- When no results: editor gets `flex-1` (default, no inline flex needed)
- Results section: replace `height: percentage` with `flex-1 min-h-0`

### 3. `DatabasePanel.tsx` line ~524 — Update drag handler selector

The `handleEditorSplitDrag` uses `.closest('.flex-col.flex-1')?.parentElement` to find the container. After removing the wrapper div, update this selector to match the new DOM structure. The container is now the direct `flex-col flex-1` parent of the editor/results split.

```tsx
// Before
const container = (e.target as HTMLElement).closest('.flex-col.flex-1')?.parentElement;

// After — target the main content column directly
const container = (e.target as HTMLElement).closest('.flex-col.flex-1.min-h-0');
```

## Files to Modify
- `App.tsx` (~line 1517): conditional overflow class
- `DatabasePanel.tsx` (~lines 700-810): restructure layout
- `DatabasePanel.tsx` (~line 524): update drag handler container selector
