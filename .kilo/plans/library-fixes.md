# Plan: Fix Library Folder Deletion + Add View Modes

## Problem 1: Folder deletion requires refresh

**Root cause:** After deleting a folder in `confirmDelete()` (`LibraryPanel.tsx:306-316`), the sidebar's `libraryFolders` state is never refreshed. The sidebar fetches folders via its own `fetchLibraryFolders` and only re-fetches on the `library-reload` window event. The `confirmDelete` function for folders does NOT dispatch this event, so the sidebar shows stale data (deleted folder still appears and is clickable, navigating to a dead route).

**Secondary issue:** The `LibraryPanel`'s own `loadFolders()` is also not called after folder deletion, so the panel-level `folders` array (used for component counts, move-to-folder dropdowns, etc.) only updates via the optimistic `setFolders(prev => prev.filter(...))` — not a full refresh from the server.

### Fix

In `LibraryPanel.tsx` `confirmDelete()`, after the folder deletion branch:
1. Call `loadFolders()` to refresh the panel's folder list from the server
2. Dispatch `window.dispatchEvent(new CustomEvent('library-reload'))` to refresh the sidebar's folder list

```diff
 } else {
   // ... existing delete logic ...
   setFolders(prev => prev.filter(f => f.id !== id));
   if (activeFolder?.id === id) {
     navigate('/library', { replace: true });
   }
   onNotification?.('Folder deleted', 'success');
   loadComponents();
+  loadFolders();
+  window.dispatchEvent(new CustomEvent('library-reload'));
 }
```

Also add a safety redirect in `LibraryPanel` — if the user navigates to a folder ID that doesn't exist in the `folders` array (e.g., via a stale sidebar link), redirect to `/library`:

```diff
 const activeFolder = useMemo(() => {
   if (!routeFolderId || folders.length === 0) return null;
-  return folders.find(f => f.id === routeFolderId) || null;
+  const found = folders.find(f => f.id === routeFolderId);
+  if (routeFolderId && folders.length > 0 && !found) {
+    // Folder doesn't exist — navigate away (deferred to avoid setState-during-render)
+    setTimeout(() => navigate('/library', { replace: true }), 0);
+  }
+  return found || null;
 }, [routeFolderId, folders]);
```

---

## Problem 2: Folder/component view modes

The user wants to switch between different layout views for the folders and components grid (e.g., list view, 2-column, 3-column, 4-column grid).

### Implementation

**Files to modify:**
- `components/LibraryPanel.tsx` — add view mode state, toggle UI, apply grid class

**View modes:**
| Mode | Label | Grid class | Icon |
|------|-------|-----------|------|
| `grid-3` | Grid (3-col) | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` | `LayoutGrid` |
| `grid-4` | Grid (4-col) | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` | `Grid3x3` (custom) |
| `list` | List | `grid-cols-1` | `List` |

**State:** `localStorage` key `edward:labs_libraryViewMode` to persist across sessions.

**UI:** A small toggle group in the toolbar (Row 1) next to the search bar, using `SlidingGroup` or simple icon buttons — matching the existing codebase patterns.

**Changes to grid rendering:**
- Replace hardcoded `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` with dynamic class based on view mode
- For `list` view, the cards should render in a horizontal/compact layout (single column, narrower cards)

**List view adjustments for FolderCard and ComponentCard:**
- In list mode, cards use `flex flex-row` layout instead of vertical card layout
- Or simpler: just use `grid-cols-1` which gives full-width cards (still works, just one per row)

### Concrete changes in `LibraryPanel.tsx`:

1. Add state:
```ts
const [viewMode, setViewMode] = useState<string>(() => {
  return localStorage.getItem('edward:labs_libraryViewMode') || 'grid-3';
});
```

2. Add effect to persist:
```ts
useEffect(() => {
  localStorage.setItem('edward:labs_libraryViewMode', viewMode);
}, [viewMode]);
```

3. Add helper for grid class:
```ts
const gridClass = viewMode === 'list' 
  ? 'grid grid-cols-1 gap-3'
  : viewMode === 'grid-4'
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'; // grid-3 default
```

4. Add view toggle buttons in the toolbar (Row 1), after the search bar:
```tsx
<div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--bg-200)' }}>
  {[
    { key: 'grid-3', icon: <LayoutGrid size={14} /> },
    { key: 'grid-4', icon: <Grid3x3 size={14} /> },
    { key: 'list', icon: <List size={14} /> },
  ].map(v => (
    <button key={v.key} onClick={() => setViewMode(v.key)} ...>
      {v.icon}
    </button>
  ))}
</div>
```

5. Replace both hardcoded grids (folders grid at line 625 and components grid at line 651) with `{gridClass}`.

---

## Files to Modify

| File | Change |
|------|--------|
| `components/LibraryPanel.tsx` | Fix `confirmDelete` folder branch, add stale-folder redirect, add view mode state/UI/logic |

## Verification

- `npm run build` must pass
