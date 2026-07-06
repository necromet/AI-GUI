# Plan: Multi-File Library Components with Live Preview

## Goal
Each library component supports multiple files (e.g., `index.html`, `style.css`, `script.js`) displayed in a tabbed editor with a combined live preview via iframe.

---

## 1. Database Schema — New `library_component_files` table

**File:** `server/db/schema.ts`

Add to `SCHEMA_SQL`:
```sql
CREATE TABLE IF NOT EXISTS library_component_files (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_entry INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lcf_component ON library_component_files(component_id);
```

**File:** `server/db/index.ts`

Add migration: for every `library_components` row that has no matching `library_component_files`, auto-create a single file entry using the component's existing `content` + `content_type` fields. Filename derived from contentType (e.g., `html` → `index.html`, `tsx` → `Component.tsx`, `js` → `script.js`, `css` → `style.css`, etc.). Mark it as `is_entry = 1`.

---

## 2. Types — Add `LibraryComponentFile` interface

**File:** `types.ts`

```ts
export interface LibraryComponentFile {
  id: string;
  componentId: string;
  filename: string;
  contentType: 'tsx' | 'html' | 'css' | 'js' | 'json' | 'markdown';
  content: string;
  sortOrder: number;
  isEntry: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Update `LibraryComponent`:
```ts
files?: LibraryComponentFile[];
```

**File:** `server/services/libraryService.ts` — mirror the same interface.

---

## 3. Backend Service — CRUD for files

**File:** `server/services/libraryService.ts`

New functions:
- `getComponentFiles(componentId: string): LibraryComponentFile[]` — SELECT from `library_component_files` ordered by `sort_order`
- `addComponentFile(file: Omit<LibraryComponentFile, 'id' | 'createdAt' | 'updatedAt'>): LibraryComponentFile`
- `updateComponentFile(id: string, updates: Partial<...>): LibraryComponentFile | undefined`
- `deleteComponentFile(id: string): boolean`

Update existing:
- `rowToFile(row)` mapper function (similar to `rowToComponent`)
- `addComponent()` — if `files` array is provided in input, insert files alongside the component; otherwise create a single file from the legacy `content` + `contentType` fields
- `rowToComponent()` — include `files` by calling `getComponentFiles(row.id)` (lazy load)
- `getComponent()` — return component with files
- `listComponents()` — return components with files
- `searchComponents()` — return components with files

---

## 4. Backend Routes — File endpoints

**File:** `server/routes/library.ts`

New endpoints:
- `GET /api/library/components/:id` — already exists, now returns `files` array
- `POST /api/library/components` — accept optional `files: [{filename, contentType, content, isEntry}]` in body
- `PUT /api/library/components/:id` — accept optional `files` for full replace

Update agent prompt (`LIBRARY_AGENT_SYSTEM_PROMPT`):
- Document multi-file format:
  ```json
  {
    "name": "My Widget",
    "category": "ui-widget",
    "description": "...",
    "tags": ["tag1"],
    "files": [
      { "filename": "index.html", "contentType": "html", "content": "...", "isEntry": true },
      { "filename": "style.css", "contentType": "css", "content": "..." },
      { "filename": "script.js", "contentType": "js", "content": "..." }
    ]
  }
  ```

---

## 5. Seed Data — Convert to multi-file

**File:** `server/data/seedLibraryComponents.ts`

Convert existing seed entries to multi-file format. Example for "Responsive Navbar":
```ts
{
  name: 'Responsive Navbar',
  ...
  files: [
    { filename: 'index.html', contentType: 'html', content: '...', isEntry: true },
  ]
}
```

Most current seeds are self-contained HTML with inline `<style>` and `<script>`. Keep them as single `index.html` files. For 2-3 examples, split into separate files to demonstrate multi-file capability:
- "Responsive Navbar" → `index.html` + `style.css` + `script.js`
- "Modal Dialog" → `index.html` + `style.css` + `script.js`
- "Data Table" → `index.html` + `style.css` + `script.js`

---

## 6. Frontend — Component Detail View with Tabs + Preview

**File:** `components/LibraryPanel.tsx`

Replace the current single-content detail view (lines 267-357) with:

### Layout
```
┌─────────────────────────────────────────────────┐
│ ← Back   Component Name        [Widget] [html] │
│           Description                           │
├─────────────────────────────────────────────────┤
│ Tags: tag1  tag2                                │
├─────────────────────────────────────────────────┤
│ [index.html] [style.css] [script.js] [+]        │
├──────────────────────────┬──────────────────────┤
│                          │                      │
│   Code Editor            │   Live Preview       │
│   (AceEditor)            │   (iframe srcdoc)    │
│                          │                      │
│                          │                      │
├──────────────────────────┴──────────────────────┤
│ Metadata                                        │
└─────────────────────────────────────────────────┘
```

### Implementation Details

- **File tabs**: Horizontal scrollable tab bar. Active tab highlighted with neon color. Each tab shows filename with content type icon. "+" button to add new file. "×" button on each tab to delete (with confirmation if only 1 file).
- **Left pane — Code Editor**: Use the existing `AceEditor` from `code-editor-sheet.tsx` (already imported in the project). Mode auto-detected from file content type. Read/write with local state. Dirty indicator on tab.
- **Right pane — Live Preview**: `<iframe sandbox="allow-scripts" srcDoc={combinedHtml} />`. The `combinedHtml` is computed by:
  1. Find the entry file (the one with `isEntry: true`, or the `.html` file, or the first file).
  2. If entry file is HTML: parse/combine. Inject `<link>` tags for CSS files and `<script>` tags for JS files.
  3. If entry file is JS: wrap in `<script>` tag with a basic HTML shell.
  4. If entry file is CSS: wrap in `<style>` tag with a basic HTML shell.
  5. Otherwise: show code-only view (no preview).
- **Save button**: Calls `PUT /api/library/components/:id` with updated files.
- **Add file dialog**: Small popover/dialog asking for filename + content type.
- **Delete file**: Confirm dialog, then remove from state and save.

### Preview Combination Logic (new utility function)

```ts
function buildPreviewHtml(files: LibraryComponentFile[]): string {
  const entry = files.find(f => f.isEntry) || files.find(f => f.filename.endsWith('.html')) || files[0];
  if (!entry) return '';

  if (entry.contentType === 'html') {
    let html = entry.content;
    const cssFiles = files.filter(f => f.contentType === 'css' && f.id !== entry.id);
    const jsFiles = files.filter(f => f.contentType === 'js' && f.id !== entry.id);

    // Inject CSS before </head>
    const cssLinks = cssFiles.map(f =>
      `<style data-file="${f.filename}">\n${f.content}\n</style>`
    ).join('\n');

    // Inject JS before </body>
    const jsScripts = jsFiles.map(f =>
      `<script data-file="${f.filename}">\n${f.content}\n</script>`
    ).join('\n');

    if (html.includes('</head>')) {
      html = html.replace('</head>', cssLinks + '\n</head>');
    } else {
      html = cssLinks + '\n' + html;
    }
    if (html.includes('</body>')) {
      html = html.replace('</body>', jsScripts + '\n</body>');
    } else {
      html = html + '\n' + jsScripts;
    }
    return html;
  }

  if (entry.contentType === 'js') {
    return `<!DOCTYPE html><html><head></head><body><script>${entry.content}</script></body></html>`;
  }

  if (entry.contentType === 'css') {
    return `<!DOCTYPE html><html><head><style>${entry.content}</style></head><body><p style="font-family:system-ui;color:#888;">CSS Preview — apply this stylesheet to HTML elements.</p></body></html>`;
  }

  return '';
}
```

---

## 7. Frontend — Create Dialog with Multi-File Support

**File:** `components/LibraryPanel.tsx`

Update the create dialog to support adding multiple files:
- Default: one file row (filename + content type + content textarea)
- "Add File" button to add more rows
- Each file row has: filename input, content type select, content textarea (or AceEditor), remove button
- One file can be marked as "entry point" (radio button or auto-detected from `.html` extension)
- Backward compatible: if only one file is added, works like before

---

## 8. Frontend — Card View File Count Badge

**File:** `components/LibraryPanel.tsx`

On each component card, add a small badge showing the number of files:
```tsx
{comp.files && comp.files.length > 1 && (
  <Badge variant="secondary" className="text-xs px-1.5 py-0.5"
    style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
    {comp.files.length} files
  </Badge>
)}
```

---

## Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `server/db/schema.ts` | Add `library_component_files` table |
| 2 | `server/db/index.ts` | Add migration to auto-create files for existing components |
| 3 | `types.ts` | Add `LibraryComponentFile` interface, update `LibraryComponent` |
| 4 | `server/services/libraryService.ts` | Add file CRUD functions, update component CRUD to include files |
| 5 | `server/routes/library.ts` | Update create/update endpoints to handle files, update agent prompt |
| 6 | `server/data/seedLibraryComponents.ts` | Convert 3 seeds to multi-file format |
| 7 | `components/LibraryPanel.tsx` | Tabbed detail view, live preview, multi-file create dialog, card badge |

---

## Verification

1. Start backend: `npm run dev:server` — check DB migration runs without errors
2. Seed components: call `/api/library/components/seed` — verify multi-file seeds
3. Open Library panel — verify cards show file count badges
4. Click a component — verify tabbed view with code editor + live preview
5. Add/remove files — verify save works and preview updates
6. Create new multi-file component — verify all files persist
7. Use agent to create component — verify agent can create multi-file components
