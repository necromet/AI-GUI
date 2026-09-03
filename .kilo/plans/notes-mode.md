# Plan: Notes Mode (Notion-like)

## Overview

Add a new "Notes" mode to the mode selector — a Notion-style notes app with block-based editing, page hierarchy, slash commands, drag-to-reorder blocks, and markdown rendering. Notes are stored in PostgreSQL and protected by a password like other modes.

---

## 1. Database Schema

**File:** `server/db/schema.ts`

Add a `notes` table:

```sql
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT DEFAULT '📄',
  cover_url TEXT,
  parent_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  blocks_json TEXT NOT NULL DEFAULT '[]',
  is_favorites BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notes_parent ON notes(parent_id);
CREATE INDEX IF NOT EXISTS idx_notes_sort ON notes(sort_order);
```

Each note stores its content as a JSON array of blocks:

```ts
interface NoteBlock {
  id: string;
  type: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'bullet_list' | 'numbered_list' | 'todo' | 'toggle' | 'code' | 'callout' | 'quote' | 'divider' | 'image';
  content: string;          // text content (markdown inline supported)
  props?: Record<string, any>; // e.g. { checked: true }, { language: 'ts' }, { emoji: '💡' }, { collapsed: false, children: Block[] }
  children?: NoteBlock[];   // for toggle blocks, nested lists
}
```

---

## 2. Backend Routes

**File:** `server/routes/notes.ts` (new)

REST API endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET /api/notes` | List all notes (tree structure) |
| `GET /api/notes/:id` | Get single note with blocks |
| `POST /api/notes` | Create new note |
| `PUT /api/notes/:id` | Update note (title, icon, blocks, parent, sort) |
| `DELETE /api/notes/:id` | Delete note (cascade children) |
| `PUT /api/notes/:id/move` | Move note to different parent + reorder |
| `PUT /api/notes/reorder` | Batch reorder notes |

**File:** `server/index.ts` — register `notesRoutes` at `/api/notes`

---

## 3. Client Database Adapter

**File:** `services/apiDatabaseAdapter.ts`

Add functions:
- `getNotes()` — returns tree-structured notes list
- `getNote(id)` — returns single note with blocks
- `createNote(parentId?, title?)` — creates a new note
- `saveNote(id, updates)` — updates title/icon/blocks/parent/sort
- `deleteNote(id)` — deletes note and children
- `moveNote(id, newParentId, sortOrder)` — move + reorder
- `reorderNotes(ids: string[])` — batch reorder

---

## 4. Type Definitions

**File:** `types.ts`

- Add `'notes'` to the `Mode` type union
- Add `NoteBlock`, `Note` interfaces

---

## 5. Environment / Password

**File:** `.env.example` — add `NOTES_PASSWORD`
**File:** `vite.config.ts` — add `process.env.NOTES_PASSWORD` to `define`
**File:** `components/ModeSelector.tsx` — add Notes card + password modal (password: `andheleadsmeinpaths` per the Psalm 23 pattern)

---

## 6. Frontend Components

### Directory: `components/notes/`

#### `NotesPanel.tsx` — Main container
- Renders the note editor area (full width, no traditional sidebar since Notes uses the main sidebar)
- Manages selected note state, loads note data
- Empty state when no note selected (Notion-style with centered "Select or create a page")

#### `NoteEditor.tsx` — Block-based editor
- Renders an array of `NoteBlock` items
- Each block is a contenteditable div or specialized component
- Supports:
  - **Markdown shortcuts**: `# ` → H1, `## ` → H2, `### ` → H3, `- ` → bullet, `1. ` → numbered, `[] ` → todo, `> ` → quote, `--- ` → divider, ``` → code block
  - **Slash commands**: typing `/` opens a dropdown menu with block type options
  - **Inline markdown**: `**bold**`, `*italic*`, `` `code` ``, `~~strikethrough~~`, `[link](url)`
  - **Enter** creates new block below, **Backspace** on empty block deletes it
  - **Tab/Shift+Tab** for indenting (nested lists, toggles)
  - **Drag handles** on hover to reorder blocks via drag-and-drop

#### `BlockComponent.tsx` — Individual block renderer
- Renders each block type with appropriate styling:
  - `paragraph`: plain contenteditable
  - `heading1/2/3`: larger font, bold
  - `bullet_list`: bullet marker + content
  - `numbered_list`: number + content
  - `todo`: checkbox + content (clickable toggle)
  - `toggle`: chevron + title, expandable children
  - `code`: code block with language selector and syntax highlighting
  - `callout`: icon + colored background box
  - `quote`: left border + italic
  - `divider`: horizontal line
  - `image`: image display with upload placeholder

#### `SlashMenu.tsx` — Command palette
- Dropdown that appears when user types `/`
- Lists available block types with icons and descriptions
- Keyboard navigation (arrow keys + Enter)
- Filter by typing after `/`

#### `DragHandle.tsx` — Drag handle for blocks
- Appears on hover left of each block
- `+` button to add block below
- `⠿` drag handle for reordering
- Uses native HTML drag-and-drop (no external library needed)

#### `PageTree.tsx` — Sidebar page tree (rendered in main Sidebar)
- Recursive tree of pages with expand/collapse
- Right-click context menu (rename, delete, duplicate, move to)
- "New page" button at top
- "Favorites" section
- Drag-to-reorder pages

#### `useNotes.ts` — Data hook
- Fetches notes tree from API
- CRUD operations (create, update, delete, move)
- Optimistic updates

#### `useBlockEditor.ts` — Editor logic hook
- Manages block array state
- Handles keyboard shortcuts
- Slash command detection
- Block type conversions
- Undo/redo stack

---

## 7. Sidebar Integration

**File:** `components/Sidebar.tsx`

Add a new `currentMode === 'notes'` branch that renders the `PageTree` component:
- "New page" button
- Recursive page tree with expand/collapse
- Search/filter notes
- Favorites section

---

## 8. App.tsx Integration

**File:** `App.tsx`

- Add `isNotesMode` detection: `location.pathname.startsWith('/notes')`
- Add `isNotesAuthenticated` state with sessionStorage key `edward:labs_notes_session`
- Add routes:
  - `/notes` — NotesPanel (no note selected)
  - `/notes/:noteId` — NotesPanel (note selected)
- Pass `NotesPanel` controls to sidebar (like `dbSidebarControls` pattern, but for notes we render the page tree directly in the sidebar)
- Add Notes password modal + unlock handlers to ModeSelector props

---

## 9. ModeSelector Integration

**File:** `components/ModeSelector.tsx`

- Import `StickyNote` icon from lucide-react
- Add `NOTES_PASSWORD` env var
- Add `isNotesAuthenticated` / `onSelectNotes` / `onUnlockNotes` props
- Add Notes card to the `cards` array
- Add password modal for Notes

---

## 10. Files to Create/Modify (Summary)

| File | Action |
|------|--------|
| `types.ts` | Add `NoteBlock`, `Note` types; add `'notes'` to `Mode` |
| `server/db/schema.ts` | Add `notes` table SQL |
| `server/routes/notes.ts` | **NEW** — CRUD REST API |
| `server/index.ts` | Register notes routes |
| `services/apiDatabaseAdapter.ts` | Add notes API functions |
| `components/notes/NotesPanel.tsx` | **NEW** — Main panel |
| `components/notes/NoteEditor.tsx` | **NEW** — Block editor |
| `components/notes/BlockComponent.tsx` | **NEW** — Block renderer |
| `components/notes/SlashMenu.tsx` | **NEW** — Slash command menu |
| `components/notes/DragHandle.tsx` | **NEW** — Drag handle + add button |
| `components/notes/PageTree.tsx` | **NEW** — Sidebar page tree |
| `components/notes/useNotes.ts` | **NEW** — Data fetching hook |
| `components/notes/useBlockEditor.ts` | **NEW** — Editor logic hook |
| `components/ModeSelector.tsx` | Add Notes card + password |
| `components/Sidebar.tsx` | Add notes page tree branch |
| `App.tsx` | Add routes, auth state, controls plumbing |
| `vite.config.ts` | Add `NOTES_PASSWORD` env define |
| `.env.example` | Add `NOTES_PASSWORD` |

---

## 11. Implementation Order

1. **Types + Schema** — Add types to `types.ts`, add `notes` table to schema
2. **Backend** — Create `server/routes/notes.ts`, register in `server/index.ts`
3. **Client adapter** — Add notes functions to `apiDatabaseAdapter.ts`
4. **Mode selector + auth** — Add Notes to ModeSelector, vite config, .env
5. **App.tsx routing** — Add routes, auth state, sidebar integration
6. **Core editor** — `useBlockEditor.ts`, `BlockComponent.tsx`, `NoteEditor.tsx`
7. **Slash menu** — `SlashMenu.tsx`
8. **Drag and reorder** — `DragHandle.tsx` + DnD logic in editor
9. **Page tree sidebar** — `PageTree.tsx`, integrate into `Sidebar.tsx`
10. **Main panel** — `NotesPanel.tsx`, wire everything together
11. **Polish** — Inline markdown rendering, image upload, toggle blocks, callout styling

---

## 12. Block Types Detail

| Block Type | Shortcut | Slash Command | Special Behavior |
|-----------|----------|---------------|-----------------|
| Paragraph | (default) | `/text` | Basic text block |
| Heading 1 | `# ` | `/h1` | Large heading |
| Heading 2 | `## ` | `/h2` | Medium heading |
| Heading 3 | `### ` | `/h3` | Small heading |
| Bullet List | `- ` or `* ` | `/bullet` | Bullet point, Tab to nest |
| Numbered List | `1. ` | `/numbered` | Numbered, Tab to nest |
| To-do | `[] ` | `/todo` | Clickable checkbox |
| Toggle | `> ` (with children) | `/toggle` | Collapsible section |
| Code Block | ``` | `/code` | Syntax highlighted, language selector |
| Callout | | `/callout` | Emoji icon + colored bg |
| Quote | | `/quote` | Blockquote with left border |
| Divider | `---` | `/divider` | Horizontal rule |
| Image | | `/image` | Upload or URL |

---

## 13. Inline Markdown (within blocks)

Rendered in real-time as user types:
- `**text**` → **bold**
- `*text*` → *italic*
- `` `text` `` → `inline code`
- `~~text~~` → ~~strikethrough~~
- `[text](url)` → clickable link
- `==text==` → ==highlight==
