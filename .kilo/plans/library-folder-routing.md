# Library Folder Routing

## Problem
- Library folders are tracked via `searchParams` (`?folderId=xxx`) and local state, not via dedicated routes
- The back button in the component editor always navigates to `/library` (root), losing folder context
- Components opened from a folder lose their folder context when navigated to

## Current Routes
- `/library` — root (folders grid + unfiled components)
- `/library/:componentId` — component editor

## Proposed Routes
- `/library` — root (folders grid + unfiled components)  
- `/library/folder/:folderId` — folder contents view
- `/library/:componentId` — component editor (from root/unfiled)
- `/library/folder/:folderId/:componentId` — component editor (from folder)

## Changes

### 1. `App.tsx` — Add new routes
- Add route `<Route path="/library/folder/:folderId" element={...} />`
- Add route `<Route path="/library/folder/:folderId/:componentId" element={...} />`
- Both render `<LibraryPanel>` with the same props

### 2. `components/LibraryPanel.tsx` — Route-driven folder/component state
- Read `folderId` and `componentId` from `useParams()` instead of `useSearchParams()`
- Derive `activeFolder` from the `folderId` URL param + loaded `folders` array
- Derive `selectedComponent` from `componentId` URL param + loaded `components` array
- `handleSelectFolder` → `navigate(`/library/folder/${folder.id}`)`
- `handleSelectComponent`:
  - If `activeFolder` exists: `navigate(`/library/folder/${activeFolder.id}/${comp.id}`)`
  - Else: `navigate(`/library/${comp.id}`)`
- `handleBackToFolders` → `navigate('/library')`
- Remove `useSearchParams` for folder tracking entirely
- Keep `searchParams` only if still needed for other purposes (check if unused)

### 3. `components/LibraryPanel.tsx` — Back button in component editor
- When `selectedComponent` is set and renders `<ComponentEditor>`:
  - `setSelectedComponent(null)` callback should navigate back to the correct context:
    - If URL has `folderId`: navigate to `/library/folder/${folderId}`
    - Otherwise: navigate to `/library`

### 4. `App.tsx` — Top bar back button
- The `libraryControls.onBack` callback (set in ComponentEditor's `useEffect`) calls `setSelectedComponent(null)`
- This triggers the updated handler in step 3 that navigates to the correct context
- No additional changes needed in App.tsx for the back button logic itself

### 5. `components/LibraryPanel.tsx` — Remove searchParams-based folder sync
- Remove the `useEffect` that syncs `searchParams.get('folderId')` → `activeFolder` state
- Replace with route-param-driven logic: derive `activeFolder` from `folderId` param

## Files to Modify
1. `App.tsx` (add 2 new routes)
2. `components/LibraryPanel.tsx` (switch from searchParams to route params)

## Verification
- `npm run build` to verify no type/build errors
