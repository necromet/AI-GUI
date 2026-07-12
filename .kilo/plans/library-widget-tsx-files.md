# Plan: Widget TSX File Structure + Agent Write File Tool

## Goal

Restructure the library widget (`ui-widget` category) to use exactly 2 files:
- **`components.tsx`** — Component definitions (the builder/source code)
- **`usage.tsx`** — Preview/rendering code (how the component is used)

Add a `write_component_file` tool so the library agent can write to individual files within a component. Add live TSX preview rendering using Babel standalone.

---

## Changes

### 1. Add `writeComponentFile` to `server/services/libraryService.ts`

Add an upsert function that creates or updates a file by filename within a component:

```ts
export function writeComponentFile(
  componentId: string,
  filename: string,
  content: string,
): LibraryComponentFile
```

Logic:
- Find existing file by `(componentId, filename)`
- If found → update content via `updateComponentFile`
- If not found → create via `addComponentFile` with auto-derived contentType and sortOrder

### 2. Add `write_component_file` tool to `server/services/libraryAgentTools.ts`

**Tool definition:**
- `componentId` (string, required)
- `filename` (string, required) — e.g. `components.tsx` or `usage.tsx`
- `content` (string, required) — the file content

**Validation for `ui-widget` category:**
- Look up component, check category
- If `ui-widget`, reject filenames other than `components.tsx` and `usage.tsx`
- Non-widget categories: any filename allowed

**Update system prompt** (`buildLibraryToolSystemPrompt`):
- Add widget file structure rules:
  - `components.tsx` = component definitions (exports)
  - `usage.tsx` = render/preview code (imports from `./components`)
  - Widget files must be exactly these two
- Add instruction: "When creating ui-widget components, always create both `components.tsx` and `usage.tsx`"

**Update `executeLibraryTool`:**
- Add `case 'write_component_file'` handler
- Call `library.writeComponentFile(componentId, filename, content)`
- Return updated file info

### 3. Update widget file enforcement in `create_component` tool (`server/services/libraryAgentTools.ts`)

When `category === 'ui-widget'`:
- If no files provided, auto-generate default `components.tsx` + `usage.tsx`
- If files provided, validate filenames are only `components.tsx` and/or `usage.tsx`
- Reject with error if other filenames are used for widgets

### 4. Add `component_updated` SSE event to `server/routes/library.ts`

After `write_component_file` or `update_component` tool execution succeeds:

```ts
if (call.name === 'write_component_file' && !result.error) {
  const match = result.output.match(/Component ID: (\w+)/);
  if (match) {
    const comp = library.getComponent(match[1]);
    if (comp) {
      res.write(`data: ${JSON.stringify({ component_updated: comp })}\n\n`);
    }
  }
}
```

### 5. Handle `component_updated` SSE event in `components/LibraryPanel.tsx`

In the SSE parsing loop (around line 519), add:

```ts
if (parsed.component_updated) {
  const updated = parsed.component_updated;
  setSelectedComponent(prev => prev?.id === updated.id ? updated : prev);
  loadComponents();
}
```

This refreshes the file editor when the agent writes to a file.

### 6. Update `buildPreviewHtml` in `components/LibraryPanel.tsx`

For TSX widgets (files include `components.tsx` or `usage.tsx`):

1. Find `components.tsx` and `usage.tsx` from the files list
2. Generate preview HTML with React 18 + ReactDOM + Babel standalone CDN
3. Concatenate code: strip `export` from `components.tsx`, strip `import` from `usage.tsx`
4. Wrap in `<script type="text/babel">` inside the iframe
5. Include Tailwind CSS CDN for utility class support

**Preview HTML template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>* { margin: 0; padding: 0; box-sizing: border-box; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    // {componentsCode} — with export keywords stripped
    // {usageCode} — with import statements stripped
  </script>
</body>
</html>
```

**Detection:** If any file has filename `components.tsx` or `usage.tsx`, use the TSX preview path. Otherwise, fall back to existing HTML preview logic.

---

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `server/services/libraryService.ts` | Add `writeComponentFile()` upsert function |
| 2 | `server/services/libraryAgentTools.ts` | Add `write_component_file` tool + widget enforcement in `create_component` + update system prompt |
| 3 | `server/routes/library.ts` | Emit `component_updated` SSE event after file writes |
| 4 | `components/LibraryPanel.tsx` | Handle `component_updated` event + update `buildPreviewHtml` for TSX live preview |

---

## Widget File Convention

```
my-button/
  components.tsx   ← Component definitions (isEntry: true)
  usage.tsx        ← Preview code (renders the component)
```

**components.tsx** example:
```tsx
export function Button({ label, onClick, variant = 'primary' }: {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button
      onClick={onClick}
      className={variant === 'primary' ? 'bg-blue-500 text-white px-4 py-2 rounded' : 'bg-gray-200 px-4 py-2 rounded'}
    >
      {label}
    </button>
  );
}
```

**usage.tsx** example:
```tsx
import { Button } from './components';

export default function Preview() {
  return (
    <div className="p-4 flex gap-2">
      <Button label="Primary" variant="primary" />
      <Button label="Secondary" variant="secondary" />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<Preview />);
```

The preview engine strips imports/exports and concatenates both files for Babel transpilation.
