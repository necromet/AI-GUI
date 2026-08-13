# Plan: Convert Catalogue from sidebar tab to popup modal

## Problem

The Catalogue is currently a sidebar tab in three locations. This takes up valuable sidebar space and competes with Components/Properties tabs. Converting it to a modal frees the tab bar and makes the catalogue accessible from anywhere.

## Current locations

1. `Sidebar.tsx` → `CanvasSidebarContent` — 3 tabs: Components / Catalogue / Properties
2. `canvas/CanvasSidebar.tsx` — same 3 tabs
3. `canvas/CanvasProperties.tsx` — 2 tabs: Properties / Catalogue

## Changes

### 1. Create `components/canvas/CatalogueModal.tsx` (new file)

A thin modal wrapper using the existing `Dialog` + `DialogContent` from `components/ui/dialog.tsx`. Renders the `CanvasCatalogue` component inside a wide dialog (`max-w-3xl`).

Props:
- `isOpen: boolean`
- `onClose: () => void`
- `onAddToCanvas: (component: LibraryComponent) => void`

### 2. `Sidebar.tsx` — `CanvasSidebarContent`

- Remove `'catalogue'` from the `tab` state type and the `tabs` array
- Remove the `{tab === 'catalogue' && ...}` block
- Add a `Catalogue` button (with `Package` icon) at the top of the Components tab, next to or above the Quick Add section. Clicking it opens the `CatalogueModal`
- Add `showCatalogue` state to control the modal
- Remove the `CanvasCatalogue` import (replaced by `CatalogueModal`)

### 3. `canvas/CanvasSidebar.tsx`

- Same changes: remove `'catalogue'` tab, remove the `{tab === 'catalogue' && ...}` block, add a button to open `CatalogueModal`
- Add `showCatalogue` state
- Remove the `CanvasCatalogue` import

### 4. `canvas/CanvasProperties.tsx`

- Remove `'catalogue'` from the `tab` state type and remove the Catalogue tab button
- Remove the `{tab === 'catalogue' ? ...}` conditional — always show Properties content
- Add a `Catalogue` button (small, icon-only) in the properties header or at the bottom that opens `CatalogueModal`
- Add `showCatalogue` state
- Remove the `CanvasCatalogue` import

### 5. No changes to `CanvasCatalogue.tsx` or `CanvasCatalogueCard.tsx`

These remain as-is — they're just rendered inside the modal now instead of a tab panel.

## Files to create

1. `components/canvas/CatalogueModal.tsx`

## Files to edit

1. `components/Sidebar.tsx` — `CanvasSidebarContent`
2. `components/canvas/CanvasSidebar.tsx`
3. `components/canvas/CanvasProperties.tsx`

## Files NOT changed

- `components/canvas/CanvasCatalogue.tsx`
- `components/canvas/CanvasCatalogueCard.tsx`
- `components/canvas/CanvasEditor.tsx` — `onCatalogueAdd` callback unchanged

## Verification

`npm run build`
