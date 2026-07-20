# Move sidebar toggle out of global header for Python tools

## Problem
When in `/experiments/python`, the global header bar (App.tsx line 1095) renders the sidebar toggle (PanelLeft) button. The PythonExecutorPanel has its own top bar with back/save/library/run buttons. Having two bars stacked is redundant — the sidebar toggle should live inside PythonExecutorPanel's top bar instead.

## Plan

### 1. Hide global header when in Python mode

**File:** `App.tsx` (line ~1094)

Change the header render condition from:
```
{(!isLibraryMode || libraryControls) && (
  <div className="flex items-center ...">
```
to:
```
{(!isLibraryMode || libraryControls) && activeView !== 'python' && (
  <div className="flex items-center ...">
```

This skips the entire global header bar (sidebar toggle + stitch/library/default content) when in Python mode.

### 2. Pass sidebar toggle props to PythonExecutorPanel

**File:** `App.tsx` (PythonExecutorPanel instances, ~line 1468-1490)

Add two new props to both PythonExecutorPanel renders:
```tsx
<PythonExecutorPanel
  ...
  isSidebarOpen={isSidebarOpen}
  onToggleSidebar={() => setIsSidebarOpen(true)}
/>
```

### 3. Update PythonExecutorPanel to accept and render sidebar toggle

**File:** `components/PythonExecutorPanel.tsx`

- Add `isSidebarOpen` and `onToggleSidebar` to `PythonExecutorPanelProps`
- In the **grid view** top bar (project list), add the PanelLeft button before the title when `!isSidebarOpen`
- In the **editor view** top bar, add the PanelLeft button before the back chevron when `!isSidebarOpen`

This keeps the sidebar toggle accessible but inside Python's own header, not in a separate global bar.

## Files to modify
| File | Change |
|------|--------|
| `App.tsx` | Skip global header for `activeView === 'python'`; pass sidebar props |
| `components/PythonExecutorPanel.tsx` | Accept sidebar props; render PanelLeft toggle in own top bar |
