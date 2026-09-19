# Notes UI/UX Polish Plan

## Current Issues

### 1. No animations anywhere
- Empty state (no note selected) appears instantly — no fade-in
- Note content switches instantly when navigating between notes — no transition
- Emoji picker pops in with no animation
- Sidebar context menu has no entry/exit animation
- Loading state is just a raw spinner with no surrounding fade

### 2. Icons already use lucide-react (confirmed)
- `NoteToolbar.tsx` — all lucide (Bold, Italic, etc.) ✓
- `NotesPanel.tsx` — `StickyNote` ✓
- `Sidebar.tsx` NoteSidebarItem — `Star`, `StarOff`, `MoreHorizontal`, `Plus`, `FileText`, `Trash2`, `ChevronDown`, `ChevronRight` ✓
- **Issue**: No icon consistency problem, but some icons could be upgraded (e.g. `FileText` → `StickyNote` in sidebar empty state)

### 3. Favorites appear in BOTH "Favorites" and "Pages" sections
- `Sidebar.tsx:1094-1123` — `collectFavorites()` recursively gathers ALL favorited notes (including nested children)
- `Sidebar.tsx:1132-1148` — Pages section shows `notes.filter(n => !n.parentId)` — this includes favorited root notes
- Result: a favorited note shows up in both sections = "appears double"

### 4. Sidebar not polished
- `NoteSidebarItem` context menu (`rename`/`favorite`/`delete`) opens instantly with no animation
- The favorite star icon is tiny (`size={10}`) and easy to miss
- The expand/collapse chevron has no rotation transition
- Hover states use inline `onMouseEnter`/`onMouseLeave` handlers instead of CSS classes — inconsistent with other sidebar patterns
- The "New page" button and "Pages" section lack visual separation

---

## Implementation Plan

### Task 1: Add fade-in/fade-out animations to NotesPanel

**File**: `components/notes/NotesPanel.tsx`

**Changes**:
- Wrap the empty state (`!noteId` block) in a div with `animate-fade-in` class
- Wrap the note editor view in a div with `animate-fade-in` class, keyed on `selectedNote.id` so re-renders trigger the animation
- Add `animate-dropdown-in` to the emoji picker popup
- Add `animate-fade-in` to the loading spinner wrapper

**Before** (empty state):
```tsx
<div className="h-full flex flex-col items-center justify-center">
```

**After**:
```tsx
<div className="h-full flex flex-col items-center justify-center animate-fade-in">
```

**Before** (emoji picker):
```tsx
<div className="absolute left-0 top-full z-50 p-2 rounded-lg border shadow-lg grid grid-cols-10 gap-1" ...>
```

**After**:
```tsx
<div className="absolute left-0 top-full z-50 p-2 rounded-lg border shadow-lg grid grid-cols-10 gap-1 animate-dropdown-in" ...>
```

**Before** (editor view):
```tsx
<div className="h-full overflow-y-auto">
  <div className="max-w-3xl mx-auto px-6 py-8">
```

**After**:
```tsx
<div className="h-full overflow-y-auto animate-fade-in">
  <div className="max-w-3xl mx-auto px-6 py-8">
```

---

### Task 2: Animate sidebar NoteSidebarItem

**File**: `components/Sidebar.tsx` (NoteSidebarItem component, lines 420-560)

**Changes**:
- Add `transition-transform duration-200` to the expand/collapse chevron button
- Rotate the chevron 90° when collapsed (instead of swapping icons, rotate `ChevronDown`)
- Add `animate-dropdown-in` to the context menu (`showMenu` div)
- Replace inline `onMouseEnter`/`onMouseLeave` on context menu buttons with `hover:bg-[var(--bg-200)]` class (already partially done, just needs cleanup)

**Before** (chevron):
```tsx
{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
```

**After**:
```tsx
<ChevronDown size={12} className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
```

**Before** (context menu):
```tsx
<div className="absolute left-full top-0 z-50 w-44 rounded-lg border shadow-lg py-1 ml-1" ...>
```

**After**:
```tsx
<div className="absolute left-full top-0 z-50 w-44 rounded-lg border shadow-lg py-1 ml-1 animate-dropdown-in" ...>
```

---

### Task 3: Fix favorites appearing double

**File**: `components/Sidebar.tsx` (notes section, lines 1126-1148)

**Changes**:
- In the Pages section, filter out notes that are already shown in Favorites
- Collect the set of favorited note IDs, then exclude them from the root-level Pages list

**Before**:
```tsx
notesControls.notes.filter(n => !n.parentId).map(note => (
```

**After**:
```tsx
{(() => {
  const favoriteIds = new Set(collectFavorites(notesControls.notes).map(f => f.id));
  return notesControls.notes.filter(n => !n.parentId && !favoriteIds.has(n.id));
})().map(note => (
```

This requires hoisting `collectFavorites` out of the IIFE so both sections can use it.

---

### Task 4: Polish sidebar styling

**File**: `components/Sidebar.tsx` (NoteSidebarItem + notes section)

**Changes**:
- Increase favorite star icon size from `10` to `12` for better visibility
- Add a subtle `transition-all duration-200` to the sidebar item row for smoother hover/active state changes
- Add `border-t` separator between "New page" button and the scrollable list
- Add a subtle gradient or padding to the Favorites section header for visual weight
- Add `animate-fade-in` to the entire notes sidebar content wrapper

---

### Task 5: Add CSS animation for notes-specific transitions (if needed)

**File**: `src/globals.css`

**Changes** (only if existing animations don't cover all cases):
- Add a `--animate-note-switch` keyframe for note content transitions (opacity 0→1, slight translateY)
- Add a `--animate-sidebar-item-in` keyframe for staggered sidebar item entry

**New keyframes** (only if the existing `animate-fade-in` isn't sufficient):
```css
--animate-note-switch: note-switch 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;

@keyframes note-switch {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

---

## Files to modify

| File | Changes |
|------|---------|
| `components/notes/NotesPanel.tsx` | Add animation classes to empty state, editor view, emoji picker, loading spinner |
| `components/Sidebar.tsx` | Fix favorites duplication, animate context menu, polish chevron rotation, enlarge star icon, add transitions |
| `src/globals.css` | Add `note-switch` keyframe if needed |

## Files unchanged

| File | Reason |
|------|--------|
| `components/notes/NoteEditor.tsx` | Editor already has proper tiptap animations |
| `components/notes/NoteToolbar.tsx` | Already uses lucide icons and has good hover states |
| `components/notes/useNotes.ts` | Data layer, no UI changes needed |
| `components/notes/tiptap-extensions/*` | Already have their own animation handling |

## Verification

1. `npm run build` — must pass with no errors
2. Manual checks:
   - Navigate to /notes with no note selected → empty state fades in
   - Select a note → content fades in
   - Switch between notes → smooth transition
   - Open emoji picker → dropdown animation
   - Hover sidebar items → smooth highlight
   - Open context menu → dropdown animation
   - Collapse/expand note tree → chevron rotates smoothly
   - Favorited notes appear ONLY in Favorites section, NOT duplicated in Pages
   - Star icon on favorited notes is clearly visible
