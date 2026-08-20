# Plan: TipTap Editor for Notes + Frontend Bug Fixes

## Overview

Replace the custom `contentEditable`-based block editor in `/notes` with [TipTap](https://tiptap.dev/) (ProseMirror-based headless rich text editor). This eliminates ~15 frontend bugs caused by the fragile manual `contentEditable` implementation.

---

## Part 1: Frontend Bugs & Loopholes Found

### Critical Bugs

| # | Bug | File | Line(s) | Severity |
|---|-----|------|---------|----------|
| 1 | **XSS via `dangerouslySetInnerHTML`** — All block components render `block.content` as raw HTML. Pasting rich text or injecting HTML strings executes arbitrary markup. | `BlockComponent.tsx` | 195, 213, 231, 251, 272, 306, 337, 353, 385, 412, 433, 485, 505 | Critical |
| 2 | **Cursor jumps on every keystroke** — `onInput` → `updateBlock` → `setBlocks` → re-render → `dangerouslySetInnerHTML` re-mounts DOM content, resetting cursor to start. Makes typing nearly unusable. | `BlockComponent.tsx` + `NoteEditor.tsx` | All contentEditable blocks | Critical |
| 3 | **`renderInlineMarkdown` is dead code** — The function (lines 14-92) exists but is never called. Blocks render raw text, not markdown. Users see `**bold**` instead of **bold**. | `BlockComponent.tsx` | 14-92 | High |
| 4 | **Undo creates 1 entry per keystroke** — `updateBlock` calls `pushUndo()` on every call, so typing 50 chars = 50 undo entries. Stack fills to 100 instantly, making undo useless. | `useBlockEditor.ts` | 40-43 | High |
| 5 | **Save effect triggers on mount** — `debouncedSave(blocks)` runs immediately on mount, saving unchanged data. Combined with the `note.blocks` reset effect, this creates an infinite save loop. | `NoteEditor.tsx` | 52-55 | High |
| 6 | **Block reset on save** — When editor saves → parent updates `selectedNote` → `useEffect` at line 38-43 resets blocks via `setBlocks(note.blocks)` → cursor lost, undo stack wiped. | `NoteEditor.tsx` | 38-43 | High |
| 7 | **Numbered list always shows "1."** — Hardcoded `1.` in the renderer, never calculates actual position among consecutive `numbered_list` blocks. | `BlockComponent.tsx` | 259 | Medium |
| 8 | **Toggle children update is broken** — Hardcoded `{ id: 'child-1' }` child; shallow merge loses existing children; no multi-child support. | `BlockComponent.tsx` | 346-348 | Medium |
| 9 | **Tab key does nothing for lists** — Tab handler returns early for `bullet_list`/`numbered_list` with no indent/outdent behavior. | `NoteEditor.tsx` | 118-123 | Medium |
| 10 | **Slash menu + Backspace conflict** — Global keydown listener in SlashMenu doesn't prevent block deletion when slash menu is open. | `SlashMenu.tsx` + `NoteEditor.tsx` | 55-76, 70-83 | Medium |
| 11 | **Favorites only shows root-level notes** — `notes.filter(n => n.isFavorite)` on tree structure misses nested favorites. | `Sidebar.tsx` | 1443-1458 | Medium |
| 12 | **No image upload** — Image block only accepts URL input, no file upload despite "Upload or embed" text. | `BlockComponent.tsx` | 448-489 | Low |
| 13 | **Context menu can overflow viewport** — Block menu uses `absolute right-0 top-6`, can clip off-screen near edges. | `BlockComponent.tsx` | 549-553 | Low |
| 14 | **`setBlocksDirectly` pushes to undo stack** — Initial block load is treated as an undoable action. | `useBlockEditor.ts` | 137-140 | Low |
| 15 | **Excessive re-fetching** — `useNotes` calls `loadNotes()` (full tree re-fetch) after every create/update/delete. No optimistic updates. | `useNotes.ts` | 33-60 | Low |

### Summary

The root cause of bugs 1-6, 8-10 is the manual `contentEditable` + React state management approach. TipTap (ProseMirror) solves all of these by design:
- Own document model (no `dangerouslySetInnerHTML`)
- Proper cursor/selection management
- Built-in undo/redo with transaction batching
- Extension-based architecture for custom blocks

---

## Part 2: TipTap Integration

### 2.1 Install TipTap Packages

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/pm \
  @tiptap/extension-placeholder @tiptap/extension-code-block-lowlight \
  @tiptap/extension-task-list @tiptap/extension-task-item \
  @tiptap/extension-highlight @tiptap/extension-link \
  @tiptap/extension-image @tiptap/extension-underline \
  @tiptap/extension-text-align @tiptap/extension-color \
  @tiptap/extension-text-style @tiptap/extension-typography \
  lowlight
```

`@tiptap/starter-kit` includes: Document, Paragraph, Text, Bold, Italic, Strike, Code, Heading, BulletList, OrderedList, ListItem, Blockquote, HorizontalRule, HardBreak, History (undo/redo), CodeBlock, Dropcursor, Gapcursor.

### 2.2 Architecture: TipTap Document ↔ Blocks JSON

The backend stores notes as `blocks_json`. We have two options:

**Option A (Recommended): Store TipTap JSON directly**
- Store the ProseMirror document JSON in `blocks_json` instead of the custom `NoteBlock[]` format
- TipTap has native `getJSON()` / `setContent(json)` — zero serialization needed
- Breaking change for existing notes (needs migration)

**Option B: Keep blocks_json, add adapter layer**
- Write `tiptapToBlocks(editor.getJSON())` and `blocksToTiptap(blocks)` converters
- Backward compatible but adds complexity
- Lossy conversion (ProseMirror has richer structure than our blocks)

**Recommendation: Option A** — Store TipTap JSON directly. Write a one-time migration that converts existing `NoteBlock[]` to TipTap JSON format for any existing notes.

### 2.3 Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add TipTap dependencies |
| `components/notes/NoteEditor.tsx` | **Rewrite** | TipTap `useEditor` hook, toolbar, slash command |
| `components/notes/BlockComponent.tsx` | **Delete** | Replaced by TipTap node views |
| `components/notes/useBlockEditor.ts` | **Delete** | Replaced by TipTap's built-in state management |
| `components/notes/SlashMenu.tsx` | **Rewrite** | TipTap Suggestion extension for slash commands |
| `components/notes/DragHandle.tsx` | **Rewrite** | TipTap DragHandle extension |
| `components/notes/NotesPanel.tsx` | Modify | Update to pass TipTap JSON to save |
| `components/notes/NoteToolbar.tsx` | **New** | Formatting toolbar (bold, italic, headings, etc.) |
| `components/notes/tiptap-extensions/` | **New** | Custom TipTap nodes for callout, toggle blocks |
| `server/db/schema.ts` | No change | `blocks_json` column already stores JSON — format changes |
| `server/routes/notes.ts` | No change | Routes are format-agnostic |
| `types.ts` | Modify | Deprecate `NoteBlock`/`NoteBlockType`, add `TipTapDocument` type |

### 2.4 NoteEditor.tsx — TipTap Core

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

// Editor instance with all extensions
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      codeBlock: false, // replaced by CodeBlockLowlight
      heading: { levels: [1, 2, 3] },
    }),
    Placeholder.configure({ placeholder: "Type '/' for commands..." }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight.configure({ multicolor: false }),
    Link.configure({ openOnClick: false }),
    Image,
    CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
    CalloutNode,      // custom
    ToggleNode,       // custom
    SlashCommand,     // custom suggestion extension
  ],
  content: note.blocks, // TipTap JSON or migration
  onUpdate: ({ editor }) => {
    debouncedSave(note.id, { blocks: editor.getJSON() });
  },
});
```

### 2.5 Custom TipTap Extensions

#### `CalloutNode` — Custom node for callout blocks
- Renders emoji + colored background box
- Configurable emoji via node attributes

#### `ToggleNode` — Collapsible section
- Uses `Node.create()` with `collapsible` attribute
- Custom NodeView with chevron + expand/collapse logic

#### `SlashCommand` — Suggestion extension
- Uses `@tiptap/suggestion` (included in starter-kit deps)
- Filters block types as user types after `/`
- Keyboard navigation (arrow keys + Enter)

### 2.6 NoteToolbar.tsx — Formatting Toolbar

Floating toolbar that appears on text selection:
- Bold, Italic, Strikethrough, Code, Highlight
- Link insertion
- Text alignment

Plus a fixed toolbar at the top for:
- Heading level selector (H1, H2, H3, Paragraph)
- Bullet list, Numbered list, Task list
- Code block, Blockquote, Callout
- Image insert
- Divider

### 2.7 Migration Script

For any existing notes with `NoteBlock[]` format:

```ts
function migrateBlocks(blocks: NoteBlock[]): TipTapJSON {
  // Convert each NoteBlock to a ProseMirror node
  // paragraph → { type: 'paragraph', content: [{ type: 'text', text: content }] }
  // heading1 → { type: 'heading', attrs: { level: 1 }, content: [...] }
  // bullet_list → { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [...] }] }] }
  // etc.
}
```

Run on first load: if `blocks_json` is an array of `NoteBlock`, convert to TipTap JSON and save back.

### 2.8 Fixes Addressed by TipTap

| Bug # | How TipTap Fixes It |
|-------|-------------------|
| 1 (XSS) | ProseMirror manages its own DOM; no `dangerouslySetInnerHTML` |
| 2 (cursor jumps) | ProseMirror's transaction system updates DOM surgically without re-mounting |
| 3 (dead markdown) | TipTap has built-in input rules for `**bold**`, `*italic*`, etc. |
| 4 (undo per keystroke) | History extension batches transactions with configurable delay |
| 5 (save on mount) | `onUpdate` only fires on actual user edits, not programmatic `setContent` |
| 6 (reset on save) | `onUpdate` callback pattern avoids the parent-child state loop |
| 7 (numbered list) | ProseMirror's `OrderedList` renders correct numbers natively |
| 8 (toggle children) | Custom ToggleNode with proper NodeView handles nested content |
| 9 (Tab for lists) | `sinkListItem`/`liftListItem` commands built into ListItem extension |
| 10 (slash + backspace) | Suggestion extension manages its own keyboard lifecycle |
| 12 (image upload) | Add `@tiptap/extension-image` with upload handler |

---

## Part 3: Implementation Steps

### Step 1 — Install & Configure TipTap
- Install packages
- Create `NoteEditor.tsx` with `useEditor` + core extensions
- Wire to `NotesPanel.tsx` save callback

### Step 2 — Custom Extensions
- `CalloutNode` — custom node type
- `ToggleNode` — custom node with NodeView
- `SlashCommand` — suggestion-based slash menu

### Step 3 — Migration Layer
- `migrateBlocks()` function to convert existing `NoteBlock[]` → TipTap JSON
- Run migration on note load if old format detected

### Step 4 — Toolbar & UI
- `NoteToolbar.tsx` — floating + fixed toolbar
- Style TipTap content with existing CSS variables
- Delete `BlockComponent.tsx`, `useBlockEditor.ts`, old `SlashMenu.tsx`, `DragHandle.tsx`

### Step 5 — Sidebar Bug Fixes
- Fix favorites filter to include nested notes (Bug #11)
- Use flattened note list for favorites

### Step 6 — Polish
- Keyboard shortcuts (Ctrl+B, Ctrl+I, etc.) — built into TipTap
- Slash menu search/filter
- Code block syntax highlighting via lowlight
- Image upload support (add file input handler)
- Dark/light theme support for TipTap content styles

---

## Part 4: Dependencies

```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/pm": "^2.x",
  "@tiptap/extension-placeholder": "^2.x",
  "@tiptap/extension-code-block-lowlight": "^2.x",
  "@tiptap/extension-task-list": "^2.x",
  "@tiptap/extension-task-item": "^2.x",
  "@tiptap/extension-highlight": "^2.x",
  "@tiptap/extension-link": "^2.x",
  "@tiptap/extension-image": "^2.x",
  "@tiptap/extension-underline": "^2.x",
  "@tiptap/extension-text-align": "^2.x",
  "@tiptap/extension-color": "^2.x",
  "@tiptap/extension-text-style": "^2.x",
  "@tiptap/extension-typography": "^2.x",
  "lowlight": "^3.x"
}
```

All packages are MIT-licensed, actively maintained, and widely used (1M+ weekly downloads).
