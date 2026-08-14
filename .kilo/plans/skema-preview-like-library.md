# Plan: Skema Preview → Library-style TSX Preview

## Problem

The Skema editor's "Preview" mode uses a **client-side Sucrase compiler** (`lib/tsxCompiler.ts`) with UMD React/ReactDOM from unpkg. It lacks Tailwind CSS support, proper ESM import maps, and error reporting. The Library's TSX preview uses server-side esbuild compilation, ESM import maps (esm.sh), Tailwind CDN, and a proper error overlay.

## Goal

Make the Skema editor's preview mode use the same rendering pipeline as the Library's TSX preview.

## Changes

### 1. New server endpoint: `POST /api/skema/compile`

**File:** `server/routes/skema.ts`

Add a `POST /compile` endpoint that:
- Accepts `{ files: Array<{ path: string; content: string; language: string; isEntry?: boolean }> }` 
- Maps each `ProjectFile` to `LibraryComponentFile` format:
  - `filename` = basename of `path` (e.g. `src/components/Navbar.tsx` → `Navbar.tsx`)
  - `content` = `content`
  - `contentType` = derive from `language` or extension (`tsx`→`tsx`, `css`→`css`, etc.)
  - `isEntry` = `isEntry` flag
- Calls existing `compileComponent()` from `server/services/tsxCompiler.ts`
- Returns compiled JS with `Content-Type: application/javascript`

The existing `compileComponent()` handles esbuild bundling, import rewriting, CSS injection, and external package resolution. No changes needed to the compiler.

### 2. Replace `compilePreview()` in CanvasEditor

**File:** `components/canvas/CanvasEditor.tsx` (lines 174-190)

Replace the current `compileProject()` (Sucrase) call with:

```typescript
const compilePreview = useCallback(async () => {
  if (projectFiles.length === 0) {
    setPreviewHtml('');
    setCompileErrors([]);
    return;
  }
  try {
    const res = await fetch('/api/skema/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: projectFiles }),
    });
    if (!res.ok) throw new Error(await res.text());
    const compiledJs = await res.text();
    setPreviewHtml(buildCanvasPreviewHtml(compiledJs));
    setCompileErrors([]);
  } catch (err: any) {
    setCompileErrors([err.message]);
  }
}, [projectFiles]);
```

Add debouncing (400ms) via `useEffect` with a timer ref to avoid excessive API calls during rapid edits.

### 3. Add `buildCanvasPreviewHtml()` helper

**File:** `components/canvas/CanvasEditor.tsx`

Add a function that generates the same HTML template as `buildTsxPreview()` in `components/library/constants.ts`. The key insight: `srcDoc` iframes inherit the parent's origin, so `import('/api/...')` works. The compiled JS is fetched via dynamic import inside the iframe.

The template includes:
- ESM import map for react, react-dom, react/jsx-runtime, motion/react, framer-motion, @phosphor-icons/react, lucide-react
- Tailwind CSS CDN (`<script src="https://cdn.tailwindcss.com">`)
- Dark theme styling (`#1a1a1a` bg, `#ececec` text)
- Error overlay with `window.parent.postMessage({ type: 'preview-errors', errors: [...] })` 
- Module script that imports React via ESM, loads the compiled module, and renders

Since we can't use a relative import for the compiled JS (it was fetched as a string, not served at a URL), inline it as a blob URL:

```typescript
function buildCanvasPreviewHtml(compiledJs: string): string {
  const blobUrl = URL.createObjectURL(
    new Blob([compiledJs], { type: 'application/javascript' })
  );
  // ... build HTML with import(blobUrl) in the module script
  // Remember to call URL.revokeObjectURL(blobUrl) when previewHtml changes
}
```

Alternatively, embed the compiled JS directly as a data URL or inline script. The blob URL approach is cleaner for large modules.

### 4. Add `message` event listener for runtime errors

**File:** `components/canvas/CanvasEditor.tsx`

Add a `useEffect` that listens for `message` events from the iframe (like `ComponentEditor.tsx:268`):

```typescript
useEffect(() => {
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'preview-errors') {
      setCompileErrors(e.data.errors || []);
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);
```

### 5. Revoke blob URLs on cleanup

When `previewHtml` changes, revoke any previously created blob URLs to prevent memory leaks. Store the current blob URL in a ref.

## Files to modify

| File | Change |
|------|--------|
| `server/routes/skema.ts` | Add `POST /compile` endpoint (~20 lines) |
| `components/canvas/CanvasEditor.tsx` | Replace `compilePreview()`, add `buildCanvasPreviewHtml()`, add message listener, add debounce |

## Files reused as-is

- `server/services/tsxCompiler.ts` — `compileComponent()` called by new endpoint
- `components/library/constants.ts` — reference for HTML template structure

## Reference: Library preview HTML template

From `buildTsxPreview()` at `components/library/constants.ts:668-757`:
- Import map: react@19, react-dom@19, motion@11, framer-motion@11, @phosphor-icons/react, lucide-react@0.554.0
- Tailwind CDN: `https://cdn.tailwindcss.com`
- Error overlay: `#error-overlay` div with `postMessage` to parent
- Module script: async import of React, then `import('/api/library/components/${id}/compiled')`, then `createRoot().render()`
