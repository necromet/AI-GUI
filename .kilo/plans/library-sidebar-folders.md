# Plan: Library Sidebar Folders + "Unfiled" Label Fix

## Context

Two issues with the Library panel:

1. **"Unfiled Components" label is misleading** — When folders exist and you're at the root view, components with `folder_id IS NULL` are labeled "Unfiled Components" (`LibraryPanel.tsx:640`). The label only appears after you create your first folder, making previously-normal components suddenly seem misplaced. The components are genuinely folderless (`folder_id IS NULL` in DB), but the label implies they *should* be in a folder.

2. **Sidebar shows a static placeholder in library mode** — `Sidebar.tsx:846-874` renders a "Component Library" placeholder instead of useful navigation. Folders should appear in the sidebar for quick access.

## Changes

### 1. Rename "Unfiled Components" → "Components" in LibraryPanel

**File:** `components/LibraryPanel.tsx:640`

Change the label from `'Unfiled Components'` to `'Components'`. The unfoldered filter still applies (only `folder_id IS NULL` components show at root when folders exist), but the label no longer implies they're misplaced.

### 2. Add folder navigation to Sidebar

**File:** `components/Sidebar.tsx`

In the library mode block (lines 846-874), replace the static placeholder with:
- The existing "All Components" button
- A fetched list of folders from `/api/library/folders`
- Each folder shows its name, color dot, and component count
- Clicking a folder navigates to `/library?folderId=<id>`

The sidebar will fetch folders independently (like conversations for chat mode). Add a `useEffect` that loads folders when `currentMode === 'library'`.

### 3. Wire folder selection between Sidebar and LibraryPanel

**File:** `components/LibraryPanel.tsx`

- Read `folderId` from URL search params (`useSearchParams`)
- When `?folderId=<id>` is present, look up the folder and set `activeFolder`
- When navigating back to root, clear the search param
- When clicking a folder in the LibraryPanel grid, update the URL param

**File:** `components/Sidebar.tsx`

- Use `useSearchParams` or `navigate()` to set/clear `?folderId`
- Highlight the active folder in the sidebar based on current search params

### 4. Sync folder list between Sidebar and LibraryPanel

When folders are created/deleted/renamed in LibraryPanel, the sidebar needs to reflect changes. Options:
- **Simplest:** Sidebar re-fetches folders on `library-reload` event (already dispatched by LibraryPanel at line 119)
- Add `window.addEventListener('library-reload', ...)` in Sidebar to re-fetch

## Files to Modify

| File | Change |
|------|--------|
| `components/LibraryPanel.tsx:640` | Rename label, read/write `folderId` search param |
| `components/Sidebar.tsx:846-874` | Replace placeholder with folder list, fetch from API |

## No Backend Changes Needed

- `GET /api/library/folders` already returns folders with `componentCount`
- `GET /api/library/components?unfoldered=true` already works
- `GET /api/library/components?folderId=xxx` already works
