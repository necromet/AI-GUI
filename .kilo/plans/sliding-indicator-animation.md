# Plan: Add Sliding Indicator Animation to Button Groups

## Context

The `ToolGroup` component in `Sidebar.tsx` has a smooth sliding indicator animation — an absolutely-positioned background pill that transitions between active items using `transition: top 0.3s cubic-bezier(0.16, 1, 0.3, 1)`. The user wants this same animation pattern applied to all similar "one active at a time" button groups across the codebase.

## Approach

Extract a reusable `SlidingGroup` component that handles the indicator logic (ref measurement, position state, animated div). Then replace each identified button group with this component.

### Reusable Component: `SlidingGroup`

- **Props:** `items`, `activeKey`, `onSelect`, `direction` (vertical/horizontal), `className`, `indicatorClassName`
- **Logic:** Same as current `ToolGroup` — uses `useRef` for container + item buttons, `useEffect` to measure `getBoundingClientRect()` on active change, renders an animated indicator `div`
- **Direction support:** `vertical` (animates `top`/`height`) and `horizontal` (animates `left`/`width`)
- **File:** `components/ui/sliding-group.tsx`

### Target Locations

| # | File | Component | Type | Lines |
|---|------|-----------|------|-------|
| 1 | `Sidebar.tsx` | `ToolGroup` | Replace with `SlidingGroup` | ~398-478 |
| 2 | `Sidebar.tsx` | Settings nav | Vertical list | ~686-703 |
| 3 | `Sidebar.tsx` | Library Code/Preview toggle | Horizontal 2-item | ~793-817 |
| 4 | `Sidebar.tsx` | Popover menu items | Vertical list | ~1030-1075 |
| 5 | `canvas/CanvasSidebar.tsx` | Components/Properties tabs | Horizontal 2-item | ~168-193 |
| 6 | `canvas/CanvasExportModal.tsx` | Export tabs (TSX/HTML/React) | Horizontal | ~110-128 |
| 7 | `SidebarTokenStatsPanel.tsx` | Overview/Per-Model tabs | Horizontal | ~99-114 |
| 8 | `App.tsx` | Skema Canvas/Preview toggle | Horizontal 2-item | ~1153-1177 |
| 9 | `library/AgentSidebar.tsx` | Session list items | Vertical list | ~275-290 |
| 10 | `skema/SkemaAgentSidebar.tsx` | Session list items | Vertical list | ~240-260 |

### Excluded (not suitable)

- **`LibraryPanel.tsx` category tabs** — scrollable horizontal list with variable widths; indicator positioning would be unreliable during scroll
- **`ModelSelect.tsx`** — uses hover-based state, not a single-active pattern in a fixed group
- **`PythonExecutorPanel.tsx` file list** — dynamic add/remove; indicator position would break on item count change
- **`SkemaEditor.tsx` source/preview toggle** — single toggle button, not a group
- **`SettingsPage.tsx` theme/color presets** — grid layout, not linear

## Implementation Steps

1. Create `components/ui/sliding-group.tsx` — reusable component with vertical/horizontal support
2. Refactor `ToolGroup` in `Sidebar.tsx` to use `SlidingGroup`
3. Apply to Settings nav in `Sidebar.tsx`
4. Apply to Library Code/Preview toggle in `Sidebar.tsx`
5. Apply to Popover menu items in `Sidebar.tsx`
6. Apply to Canvas sidebar tabs in `canvas/CanvasSidebar.tsx`
7. Apply to Export tabs in `canvas/CanvasExportModal.tsx`
8. Apply to Token Stats tabs in `SidebarTokenStatsPanel.tsx`
9. Apply to Skema toggle in `App.tsx`
10. Apply to Agent session lists in `library/AgentSidebar.tsx` and `skema/SkemaAgentSidebar.tsx`
11. Verify build passes with `npm run build`
