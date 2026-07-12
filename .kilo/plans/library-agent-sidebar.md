# Library Agent Sidebar: Collapsible + Routes

## Problem
1. AgentDock uses `position: fixed` — overlaps content but doesn't shrink the editor
2. No way to collapse/expand the agent sidebar
3. `/library/:componentId` route exists but LibraryPanel ignores the URL param

## Changes

### 1. ComponentEditor — flex layout with collapsible sidebar
**File:** `components/library/ComponentEditor.tsx`

- Add `agentDockOpen` state (default: `true`), persisted to `localStorage` key `edward:labs_agentDockOpen`
- Wire AgentDock's `onClose` prop to the toggle function so the X button inside the dock also collapses it
- Replace the `fixed` AgentDock wrapper with a normal flex-row layout:
  ```
  <div className="flex h-full w-full">
    <div className="flex-1 flex flex-col ...">  {/* editor content */}
    {agentDockOpen && (
      <div className="flex-shrink-0">
        <AgentDock ... />
      </div>
    )}
  </div>
  ```
- AgentDock already manages its own width via internal `style={{ width }}`, so the wrapper div just needs `flex-shrink-0` — no explicit width needed.
- Add `agentDockOpen` and `onToggleAgentDock` to the `LibraryControls` interface so the App.tsx header can render the toggle button.

### 2. App.tsx — toggle button in top bar
**File:** `App.tsx`

- In the `libraryControls` header section (lines ~1043–1049), add a toggle button next to Save:
  ```tsx
  <Button
    variant="ghost"
    size="icon"
    onClick={libraryControls.onToggleAgentDock}
    title={libraryControls.agentDockOpen ? 'Hide Agent' : 'Show Agent'}
  >
    {libraryControls.agentDockOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
  </Button>
  ```
- Import `PanelRightClose` and `PanelRightOpen` from lucide-react.

### 3. LibraryPanel — route-driven component selection
**File:** `components/LibraryPanel.tsx`

- Import `useParams, useNavigate` from `react-router-dom`
- Read `componentId` from `useParams()`
- On mount / when components load, if `componentId` is present, find and set `selectedComponent`
- When a component is selected (click card), `navigate(`/library/${comp.id}`)`
- When going back, `navigate('/library')`
- When a component is deleted that was selected, `navigate('/library')`

### 4. ComponentCard — no changes needed
The `onSelect` callback in LibraryPanel will handle navigation.

## Files Modified
1. `components/library/ComponentEditor.tsx` — flex layout, collapsible sidebar state, expose via LibraryControls
2. `App.tsx` — add toggle button in library header
3. `components/LibraryPanel.tsx` — route-driven selection with `useParams`/`useNavigate`
