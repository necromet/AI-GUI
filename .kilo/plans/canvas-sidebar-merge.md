# Plan: Merge CanvasSidebar into Main Sidebar

## Problem

The CanvasEditor currently renders its own left sidebar (`CanvasSidebar.tsx`, 270px) inside the editor layout. This is separate from the app-wide `Sidebar.tsx` (288px). When a canvas project is active, the main sidebar closes (`setIsSidebarOpen(false)` at App.tsx:1387), and the CanvasSidebar takes over. This results in:

- Two separate sidebar implementations with inconsistent styling
- The main sidebar is hidden when canvas is active, wasting its infrastructure (header, footer, navigation)
- The CanvasSidebar is locked at 270px and can't benefit from the main sidebar's wider layout

## Goal

Move all CanvasSidebar content (Components/Catalogue/Properties tabs, AI Describe, Quick Add) into the main `Sidebar.tsx` so it renders when a canvas project is active. Remove the standalone CanvasSidebar from CanvasEditor's layout. Redesign the main sidebar to accommodate the canvas content cohesively.

## Architecture

### Current flow

```
App.tsx
├── <Sidebar> (288px, hides when canvas active)
└── <main>
    └── <CanvasEditor>
        ├── <CanvasSidebar> (270px, separate sidebar)
        ├── <CanvasGrid>
        └── <SkemaAgentSidebar>
```

### Target flow

```
App.tsx
├── <Sidebar canvasControls={...}> (288px, shows canvas content when active)
└── <main>
    └── <CanvasEditor>  (no CanvasSidebar)
        ├── <CanvasGrid>
        └── <SkemaAgentSidebar>
```

### Data flow

CanvasEditor already exposes `CanvasControls` via `onControlsChange`. The sidebar-specific data (onAiGenerate, onQuickAdd, components, selectedComponent, etc.) needs to be added to a controls interface and threaded through.

Pattern: Same as `libraryControls` — CanvasEditor exports controls → App.tsx stores in state → Sidebar receives as prop.

## Implementation Steps

### Step 1: Create `CanvasSidebarControls` interface

In `components/canvas/CanvasEditor.tsx`, define a new interface for sidebar-specific data:

```ts
export interface CanvasSidebarControls {
  // AI Describe
  onAiGenerate: (prompt: string) => void;
  // Quick Add
  onQuickAdd: (type: SectionType) => void;
  // Component data
  components: GridComponent[];
  selectedComponent: GridComponent | null;
  resolution: ResolutionConfig;
  // Component actions
  onUpdatePrompt: (id: string, prompt: string) => void;
  onUpdateTsxCode: (id: string, tsxCode: string) => void;
  onRemove: (id: string) => void;
  onRegenerate: (id: string) => void;
  onMove: (id: string, dc: number, dr: number) => void;
  // Catalogue
  onCatalogueAdd: (component: any) => void;
  // File tree
  projectFiles: ProjectFile[];
  activeFile: string | null;
  onFileSelect: (path: string) => void;
}
```

Add a new prop `onSidebarControlsChange?: (controls: CanvasSidebarControls | null) => void` to `CanvasEditorProps`.

### Step 2: Expose sidebar controls from CanvasEditor

In `CanvasEditor`, add a `useEffect` that calls `onSidebarControlsChange` with the sidebar data (mirroring the existing `onControlsChange` pattern at line 601-623):

```ts
useEffect(() => {
  onSidebarControlsChange?.({
    onAiGenerate: handleAiGenerate,
    onQuickAdd: handleQuickAdd,
    components: gridState.components,
    selectedComponent,
    resolution,
    onUpdatePrompt: handleUpdatePrompt,
    onUpdateTsxCode: handleUpdateTsxCode,
    onRemove: handleRemove,
    onRegenerate: handleRegenerate,
    onMove: handleMove,
    onCatalogueAdd: handleCatalogueAdd,
    projectFiles,
    activeFile,
    onFileSelect: (path) => {
      setActiveFile(path);
      const comp = gridState.components.find(c => `src/components/${c.fileName || toPascalCase(c.type)}.tsx` === path);
      if (comp) setSelectedId(comp.id);
    },
  });
  return () => onSidebarControlsChange?.(null);
}, [/* deps */]);
```

### Step 3: Thread through SkemaPanel and App.tsx

**SkemaPanel.tsx**: Add `onSidebarControlsChange` prop, pass through to CanvasEditor.

**App.tsx**:
1. Add state: `const [canvasSidebarControls, setCanvasSidebarControls] = useState<CanvasSidebarControls | null>(null);`
2. Pass `onSidebarControlsChange={setCanvasSidebarControls}` to SkemaPanel
3. Pass `canvasSidebarControls` to Sidebar
4. Remove the auto-close sidebar behavior (`setIsSidebarOpen(false)` at line 1387) — sidebar should stay open to show canvas content

### Step 4: Add canvas content to Sidebar.tsx

Add `canvasControls?: CanvasSidebarControls | null` prop to `SidebarProps`.

In the experiments mode branch (line 258-371), when `activeView === 'skema'` AND `canvasControls` is present, render the canvas sidebar content instead of the tools list + conversation history:

```tsx
{currentMode === 'experiments' && activeView === 'skema' && canvasControls ? (
  // Canvas sidebar content
  <div className="flex-1 flex flex-col overflow-hidden">
    {/* Tabs: Components / Catalogue / Properties */}
    <CanvasSidebarTabs 
      canvasControls={canvasControls}
    />
  </div>
) : currentMode === 'experiments' ? (
  // existing experiments layout (tools + conv history)
  ...
) : ...}
```

The canvas sidebar content includes:
- **Tab bar** (Components / Catalogue / Properties) — reuse the existing tab implementation from CanvasSidebar
- **Components tab**: AI Describe textarea + Generate TSX button + Quick Add buttons + Project Files
- **Catalogue tab**: `<CanvasCatalogue>` component
- **Properties tab**: selected component properties editor with nudging, code editing, regenerate/delete

This can be extracted as a new component `CanvasSidebarContent` (or inline in Sidebar) that receives `CanvasSidebarControls`.

### Step 5: Remove CanvasSidebar from CanvasEditor

In `CanvasEditor.tsx`:
1. Remove the `<CanvasSidebar>` import and usage (lines 627-646)
2. Remove the `onSidebarControlsChange` cleanup (already handled in step 2)
3. The layout becomes just `<CanvasGrid>` + `<SkemaAgentSidebar>`

### Step 6: Redesign sidebar styling for canvas mode

When canvas controls are active, the sidebar should:
- Keep the header (edward:labs + time + Lab badge + close)
- Replace the tools/conversations area with canvas tabs
- Keep the footer (Back to selector, Token Stats, Settings, Light Mode, user)
- The tab bar sits right below the header, styled consistently with the sidebar

Key styling decisions:
- Tab bar: full-width, matching the sidebar's dark theme, using the same font sizes as existing sidebar items
- AI Describe textarea and Generate button: styled to fit within the sidebar's narrower width (288px vs 270px — close enough, minimal adjustments)
- Quick Add buttons: same list style as sidebar nav items
- Properties panel: scrollable, fits within sidebar width

### Step 7: Keep sidebar open in canvas mode

In App.tsx, remove or conditionally skip `setIsSidebarOpen(false)` when navigating to a canvas project. The sidebar should remain open to show the canvas tools.

## Files to Modify

| File | Changes |
|------|---------|
| `components/canvas/CanvasEditor.tsx` | Add `CanvasSidebarControls` interface, `onSidebarControlsChange` prop, expose sidebar controls via useEffect, remove `<CanvasSidebar>` from render |
| `components/canvas/CanvasSidebar.tsx` | Keep as-is for now (can be deprecated later), or extract reusable parts |
| `components/SkemaPanel.tsx` | Add `onSidebarControlsChange` prop, pass through to CanvasEditor |
| `App.tsx` | Add `canvasSidebarControls` state, pass to Sidebar + SkemaPanel, keep sidebar open in canvas mode |
| `components/Sidebar.tsx` | Add `canvasControls` prop, render canvas sidebar content when in skema mode |

## Verification

1. `npm run build` — must pass
2. Open a canvas project — sidebar shows canvas tabs (Components/Catalogue/Properties)
3. AI Describe + Generate works from sidebar
4. Quick Add works from sidebar
5. Catalogue tab loads and add-to-canvas works
6. Properties tab shows selected component, nudge/delete/regenerate work
7. Sidebar footer (Back to selector, Settings, etc.) still works
8. Closing sidebar + reopening works
9. Non-canvas modes (chat, RAG, etc.) are unaffected
