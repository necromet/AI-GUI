# Fix CanvasEditor infinite re-render loop

## Problem

When opening `/experiments/skema` (list view), the `CanvasEditor` component causes a "Maximum update depth exceeded" error. The root cause is in the `onControlsChange` useEffect dependency array at `CanvasEditor.tsx:634`:

```ts
}, [isGenerating, gridState, resolution, viewMode, onControlsChange, handleExportZip, showAgentSidebar, handleComponentPlaced, handleComponentRemoved, handleComponentUpdated, selectedModelId]);
```

The callbacks `handleComponentPlaced`, `handleComponentRemoved`, and `handleComponentUpdated` depend on `gridState` and `saveState` (which depends on `board` and `project`). Since `gridState` is also in the dependency array, and `project` may change reference on parent re-renders, these callbacks are recreated frequently, causing the effect to fire repeatedly → `onControlsChange` called → parent re-renders → new `project` reference → callbacks recreated → loop.

## Fix

**File: `components/canvas/CanvasEditor.tsx`**

### Change 1: Remove unstable callbacks from useEffect dependency array (line 634)

Replace:
```ts
}, [isGenerating, gridState, resolution, viewMode, onControlsChange, handleExportZip, showAgentSidebar, handleComponentPlaced, handleComponentRemoved, handleComponentUpdated, selectedModelId]);
```

With:
```ts
}, [isGenerating, gridState, resolution, viewMode, onControlsChange, handleExportZip, showAgentSidebar, selectedModelId]);
```

`gridState` already captures all component placement/removal/updates, so the callbacks don't need to be separate dependencies. `selectedModelId` is stable (just a string state).

## Why this works

- `gridState` is already a dependency and changes whenever components are placed/removed/updated
- The callback references (`handleComponentPlaced` etc.) will still be the latest because the effect runs when `gridState` changes
- `selectedModelId` is a simple string state value — stable
- `showAgentSidebar` is a simple boolean state value — stable
- This matches the pattern used by the `SkemaEditor` component's similar useEffect
