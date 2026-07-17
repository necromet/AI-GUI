# Plan: Add Python Code + Executor to Component Library

## Goal
Add Python as a supported file type in the component library, with a server-side code executor that runs Python scripts (including pip package support) and displays output in a terminal panel within the ComponentEditor.

---

## Changes

### 1. Types — `types.ts`

- Add `'python'` to the `LibraryComponentFile.contentType` union type (line 82)
- Add `'python'` to the `LibraryComponent.contentType` union type (line 64)

### 2. Constants — `components/library/constants.ts`

- Add `py: 'python'` to `EXT_TO_CONTENT_TYPE` map (line 638)
- Add `python: 'python'` to `ACE_LANG_MAP` (line 647)
- Add `.py` case to `getFileIcon()` (line 656)

### 3. Python Executor Service — `server/services/pythonExecutor.ts` (new file)

- Function `executePython(code: string, requirements?: string[]): Promise<{ stdout, stderr, exitCode, timedOut }>`
- Uses `child_process.spawn` to run `python` (or `python3`)
- If `requirements` provided:
  - Uses a persistent venv at `data/python-venv/` (created once on first use)
  - Runs `pip install` for missing packages before executing code
  - Caches already-installed packages in a `Set` to skip redundant installs
- 30-second timeout per execution
- Stdout/stderr captured and returned
- Temp `.py` file written to `data/tmp/` and cleaned up after execution
- Security: process isolation via spawn (no shell injection), timeout, output size limit (100KB)

### 4. Python Route — `server/routes/python.ts` (new file)

- `POST /api/python/execute` — accepts `{ code: string, requirements?: string[] }`
- Calls `executePython()` from the service
- Returns `{ stdout, stderr, exitCode, timedOut }`

### 5. Server Registration — `server/index.ts`

- Import and register `pythonRoutes` at `/api/python`

### 6. ComponentEditor — `components/library/ComponentEditor.tsx`

- Add a "Run" button in the editor toolbar (next to undo/redo) that appears when the active file's `contentType` is `'python'`
- Add `PythonOutputPanel` below the editor (similar to preview errors panel) showing:
  - stdout output in a monospace terminal-style panel
  - stderr output in red
  - A text input for `requirements` (comma-separated pip packages)
  - "Running..." spinner state
  - "Run" / "Stop" controls
- State: `pythonOutput`, `pythonRunning`, `pythonRequirements`
- Calls `POST /api/python/execute` on run

### 7. Preview for Python files — `components/library/constants.ts`

- Update `buildPreviewHtml()`: when entry file is `.py`, show the code in a styled `<pre>` block (read-only preview) instead of trying to render it as HTML

---

## Files Modified (7)

| File | Change |
|------|--------|
| `types.ts` | Add `'python'` to content type unions |
| `components/library/constants.ts` | Python extension mapping, icon, preview |
| `components/library/ComponentEditor.tsx` | Run button + output panel |
| `server/index.ts` | Register python route |
| `server/services/pythonExecutor.ts` | **New** — Python execution service |
| `server/routes/python.ts` | **New** — Python execute route |

## Verification

1. `npm run build` — ensure no type errors
2. Manual test: create a component with a `.py` file, verify it appears in the editor with Python syntax highlighting
3. Manual test: click "Run" on a Python file, verify output appears in the terminal panel
4. Manual test: add pip requirements, verify packages install and code runs
