# Plan: TipTap Editor UI Polish + Popovers + Task List Fix

## Overview

Three work items for the TipTap notes editor:
1. Restyle the editor UI (toolbar, slash menu, callouts, toggles) to match the app's neon/glass design system
2. Fix task list rendering (text below checkbox → beside it)
3. Add proper popovers for links and images, plus a drag-and-drop upload card

---

## 1. Task List CSS Fix (Bug #2)

**Root cause:** TipTap v3's `TaskItem` extension uses `addNodeView()` (not `renderHTML()`) which creates DOM programmatically: `<li>` > `<label contentEditable="false">` + `<div>`. The current CSS selector `.tiptap-editor [data-type="taskItem"]` sets `display: flex` but TipTap's NodeView applies inline styles or the `label`'s `contentEditable="false"` causes the browser to treat it as a block-level replaced element.

**Fix:** Update CSS in `src/globals.css`:
- Add `display: flex !important` and `flex-direction: row !important` to `[data-type="taskItem"]`
- Style `label` as `flex-shrink: 0; width: 1.25rem; height: 1.25rem; display: flex; align-items: center; justify-content: center; margin-right: 0.5rem;`
- Style the checkbox as a custom neon-styled checkbox (replace native checkbox appearance with a custom `::before` pseudo-element)
- Add strikethrough + opacity for checked state on the content `div > p`
- Override any TipTap default NodeView inline styles with `!important` where needed

**File:** `src/globals.css` — update the `taskItem`/`taskList` CSS block (~lines 917-957)

---

## 2. Toolbar UI Overhaul (Requirement #1)

**Current state:** Plain border + transparent buttons. No glass effect, no hover states, no neon accents, no animations.

**Changes to `components/notes/NoteToolbar.tsx`:**
- Replace the outer `<div>` with a glass-panel style: `backdrop-filter: blur(12px)`, semi-transparent background (`rgba(var(--bg-100-rgb), 0.8)`), subtle border with `rgba(var(--neon-rgb), 0.12)`, soft shadow
- Add hover states to `ToolbarButton`: background transitions to `var(--bg-200)` on hover, scale micro-animation
- Active state: neon background + glow shadow (`box-shadow: 0 0 8px rgba(var(--neon-rgb), 0.15)`)
- Heading dropdown: add neon-accent left border on selected item, glass background
- Add `transition-all duration-150` to all interactive elements
- Use `rounded-xl` consistently (matching sidebar button style)
- Reduce visual noise: make dividers subtler (`rgba(var(--border-300))` with opacity)
- Add keyboard shortcut labels as tooltips (already have `title` attrs)

**Changes to `components/notes/tiptap-extensions/SlashMenuView.tsx`:**
- Add glass-panel backdrop-filter effect to the container
- Selected item: add subtle neon glow left-border indicator
- Icon containers: add rounded-xl with gradient background on selection
- Add `animate-dropdown-in` animation on mount
- Add subtle entrance animation

**Changes to `components/notes/tiptap-extensions/CalloutNodeView.tsx`:**
- Add subtle gradient background (not flat rgba)
- Add left neon border accent
- Emoji picker: glass-panel styling with neon selection ring

**Changes to `components/notes/tiptap-extensions/ToggleNodeView.tsx`:**
- Add hover state on the chevron button (neon color on hover)
- Smooth rotation animation with `transition-transform duration-200`
- Content area: add subtle fade-in animation when expanding

---

## 3. Link Popover (Requirement #3 — flying popover)

**New file:** `components/notes/tiptap-extensions/LinkPopover.tsx`

Since TipTap v3 doesn't include `BubbleMenu`, we'll implement a custom floating popover using ProseMirror plugin state:

**Architecture:**
- Create a ProseMirror plugin (`LinkPopoverPlugin.ts`) that tracks:
  - Whether the cursor/selection is inside a link mark
  - The link's DOM element position (for positioning the popover)
- The plugin stores state `{ active: boolean, linkHref: string, linkElement: HTMLElement | null }`
- `NoteEditor.tsx` reads this plugin state via `editor.storage` and renders `<LinkPopover>` conditionally
- Use `createPortal` to render the popover at `document.body` level, positioned via `getBoundingClientRect()` from the link element

**Popover UI:**
- Shows on click inside a link (not just selection)
- Displays the URL as truncated text
- Action buttons: Open (external link icon), Edit (pencil icon → inline URL input), Unlink (X icon)
- Glass-panel styling with neon accents
- Arrow/pointer pointing to the link
- Dismisses on Escape or clicking outside
- Position: below the link, centered

**Files:**
- `components/notes/tiptap-extensions/LinkPopoverPlugin.ts` — ProseMirror plugin
- `components/notes/tiptap-extensions/LinkPopover.tsx` — React popover component
- `components/notes/NoteEditor.tsx` — Add plugin, render popover
- `components/notes/NoteToolbar.tsx` — Update `setLink` to use inline input instead of `window.prompt()`

---

## 4. Floating Selection Toolbar (BubbleMenu-style)

**New file:** `components/notes/tiptap-extensions/FloatingToolbar.tsx`

Since TipTap v3 doesn't include `BubbleMenu`, we implement a custom floating toolbar:

**Architecture:**
- ProseMirror plugin (`FloatingToolbarPlugin.ts`) that tracks text selection
- When user selects non-empty text: show a floating toolbar positioned above the selection
- Uses `window.getSelection()` → `getRangeAt(0).getBoundingClientRect()` for positioning
- Renders via `createPortal` at `document.body` level

**Toolbar contents (minimal set):**
- Bold, Italic, Code, Highlight, Link
- Styled as a compact glass-panel bar with neon accents (same design language as fixed toolbar)

**Files:**
- `components/notes/tiptap-extensions/FloatingToolbarPlugin.ts` — ProseMirror plugin
- `components/notes/tiptap-extensions/FloatingToolbar.tsx` — React component

---

## 5. Image Popover + Drag-and-Drop Card (Requirement #3)

### Image Popover

**New file:** `components/notes/tiptap-extensions/ImagePopover.tsx`

Similar architecture to LinkPopover:
- ProseMirror plugin tracks when an image node is selected (`NodeSelection`)
- Shows a floating popover above/below the image with:
  - Alt text input field
  - "Open in new tab" button
  - "Delete" button (trash icon)
- Glass-panel styling

### Drag-and-Drop Upload Card

**Modify:** `components/notes/NoteEditor.tsx` — add drop zone handling

- Add `onDrop` and `onDragOver` event handlers to the `EditorContent` wrapper
- When files are dragged over the editor:
  - Show a full-overlay drop card with dashed neon border, upload icon, "Drop image or file here" text
  - Semi-transparent backdrop
- On drop:
  - For images: Convert to base64 data URL, insert via `editor.chain().focus().setImage({ src: dataUrl }).run()`
  - For other files: Insert as a download link in a paragraph
- Also update the toolbar "Image" button to use a file input instead of `window.prompt()`

**New file:** `components/notes/tiptap-extensions/EditorDropZone.tsx` — drop overlay component

---

## 6. Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `src/globals.css` | Modify | Fix task list CSS, update toolbar/slash-menu/callout/toggle styles |
| `components/notes/NoteToolbar.tsx` | Modify | Glass-panel toolbar, hover/active states, inline link input |
| `components/notes/NoteEditor.tsx` | Modify | Add LinkPopover, ImagePopover, FloatingToolbar, drop zone, ProseMirror plugins |
| `components/notes/tiptap-extensions/SlashMenuView.tsx` | Modify | Glass-panel styling, entrance animation |
| `components/notes/tiptap-extensions/CalloutNodeView.tsx` | Modify | Gradient background, neon border |
| `components/notes/tiptap-extensions/ToggleNodeView.tsx` | Modify | Hover states, smooth animation |
| `components/notes/tiptap-extensions/LinkPopoverPlugin.ts` | **New** | ProseMirror plugin for link detection |
| `components/notes/tiptap-extensions/LinkPopover.tsx` | **New** | Floating link edit/open/unlink popover |
| `components/notes/tiptap-extensions/ImagePopoverPlugin.ts` | **New** | ProseMirror plugin for image selection detection |
| `components/notes/tiptap-extensions/ImagePopover.tsx` | **New** | Floating image edit/delete popover |
| `components/notes/tiptap-extensions/FloatingToolbarPlugin.ts` | **New** | ProseMirror plugin for text selection tracking |
| `components/notes/tiptap-extensions/FloatingToolbar.tsx` | **New** | Inline floating formatting toolbar (Bold/Italic/Code/Highlight/Link) |
| `components/notes/tiptap-extensions/EditorDropZone.tsx` | **New** | Drag-and-drop file upload overlay |
| `components/notes/tiptap-extensions/index.ts` | Modify | Export new plugins/components |

---

## 7. Implementation Order

1. Fix task list CSS (quick win, pure CSS)
2. Restyle toolbar (NoteToolbar.tsx + globals.css)
3. Restyle slash menu, callout, toggle
4. Add LinkPopover (plugin + component + integration)
5. Add ImagePopover (plugin + component + integration)
6. Add floating selection toolbar
7. Add drag-and-drop zone
8. Build + verify
