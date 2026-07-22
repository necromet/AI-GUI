# Python Executor for /experiments

## Overview

Add a **Python Executor** tool to the Experiments mode — a full code-editor experience where users can create, manage, and execute Python files with auto venv + auto pip install. Integrates with the Library so users can reference/load Python code saved there.

## What Already Exists

- **`server/services/pythonExecutor.ts`** — Full execution engine: venv creation, pip install, code execution with timeout (30s), output truncation (100KB)
- **`server/routes/python.ts`** — `POST /api/python/execute` endpoint (accepts `code` + `requirements[]`)
- **Library Python support** — `LibraryComponent` has `category: 'python'` and `contentType: 'python'`; `ComponentEditor` has run/stop buttons and output panel for `.py` files
- **`CodeEditor`** — ACE editor component with Python syntax highlighting

## Implementation Plan

### 1. Auto-detect imports (enhance pythonExecutor)

**File:** `server/services/pythonExecutor.ts`

Add an `autoDetectImports(code)` function that:
- Parses Python `import X` and `from X import Y` statements via regex
- Filters out stdlib modules (hardcoded list: `os`, `sys`, `json`, `re`, `math`, `datetime`, `collections`, `itertools`, `pathlib`, `io`, `csv`, `urllib`, `http`, `typing`, `functools`, `dataclasses`, `abc`, `enum`, `copy`, `hashlib`, `uuid`, `random`, `time`, `threading`, `subprocess`, `argparse`, `logging`, `unittest`, `contextlib`, `textwrap`, `string`, `struct`, `binascii`, `base64`, `tempfile`, `shutil`, `glob`, `fnmatch`, `socket`, `ssl`, `email`, `html`, `xml`, `multiprocessing`, `concurrent`, `asyncio`, `pprint`, `traceback`, `warnings`, `inspect`, `ast`, `dis`, `types`, `operator`, `heapq`, `bisect`, `array`, `queue`, `weakref`, `abc`, `numbers`, `decimal`, `fractions`, `statistics`, `secrets`, `hmac`, `zlib`, `gzip`, `bz2`, `lzma`, `zipfile`, `tarfile`, `configparser`, `tomllib`, `netrc`, `plistlib`, `signal`, `mmap`, `codecs`, `unicodedata`, `locale`, `gettext`)
- Returns remaining third-party package names as `string[]`

**File:** `server/routes/python.ts`

Update the `/execute` endpoint to:
1. Call `autoDetectImports(code)` first
2. Merge auto-detected packages with explicitly provided `requirements`
3. Pass merged list to `executePython()`

### 2. DB Schema — Python projects table

**File:** `server/db/schema.ts`

Add to `SCHEMA_SQL`:
```sql
CREATE TABLE IF NOT EXISTS python_projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  files_json TEXT NOT NULL DEFAULT '[]',
  settings_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Each project stores an array of files (like stitch projects store boards as JSON). A file: `{ filename: string, content: string, isEntry: boolean }`.

### 3. Server routes — Python project CRUD

**File:** `server/routes/python.ts`

Add CRUD endpoints:
- `GET /api/python/projects` — list all projects
- `GET /api/python/projects/:id` — get single project
- `POST /api/python/projects` — create project
- `PUT /api/python/projects/:id` — update project
- `DELETE /api/python/projects/:id` — delete project

Each project has a `files` array (multiple `.py` files). The execution sends the entry file's code (or the combined code with `sys.path` manipulation for multi-file support).

### 4. Client-side API adapter

**File:** `services/apiDatabaseAdapter.ts`

Add functions:
- `getPythonProjects()` 
- `getPythonProject(id)`
- `savePythonProject(project)`
- `deletePythonProject(id)`

### 5. PythonExecutorPanel component (main UI)

**File:** `components/PythonExecutorPanel.tsx`

Layout (modeled after StitchPanel + ComponentEditor):

```
┌─────────────────────────────────────────────────────────────┐
│ [Python icon] Python Executor          [New Project] button │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Project Grid (when no project selected):                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ Project 1│ │ Project 2│ │ Project 3│                    │
│  │ 3 files  │ │ 1 file   │ │ 5 files  │                    │
│  └──────────┘ └──────────┘ └──────────┘                   │
│                                                             │
│  Editor (when project selected):                            │
│  ┌──────────────────────┬──────────────────────────────┐   │
│  │ File Tabs            │                              │   │
│  │ [main.py] [utils.py] │   Code Editor (ACE)          │   │
│  │                      │   with Python syntax          │   │
│  │ Pip packages:        │   highlighting               │   │
│  │ [numpy, pandas    ]  │                              │   │
│  │                      │                              │   │
│  │ [▶ Run] [■ Stop]    │                              │   │
│  │                      ├──────────────────────────────┤   │
│  │ Library Reference    │   Output Panel               │   │
│  │ ┌──────────────────┐ │   stdout / stderr            │   │
│  │ │ Search library.. │ │   exit code                  │   │
│  │ │                  │ │   running indicator           │   │
│  │ │ [py_component]   │ │                              │   │
│  │ │ [py_component]   │ │                              │   │
│  │ └──────────────────┘ │                              │   │
│  └──────────────────────┴──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key features:**
- **Project management**: Create/delete Python projects (persisted in SQLite)
- **Multi-file tabs**: Add/remove `.py` files within a project, tab switching
- **Code editor**: ACE editor with Python mode (reuses existing `CodeEditor` component)
- **Run/Stop**: Execute the active file via `/api/python/execute`
- **Auto-detect pip**: Shows auto-detected packages, allows manual override
- **Output panel**: stdout (white), stderr (red), exit code, timed-out indicator, clear button
- **Library reference sidebar**: Search/browse Python components from Library, click to load code into a new tab

### 6. Route registration in App.tsx

**File:** `App.tsx`

Add routes:
```tsx
<Route path="/experiments/python" element={<RequireAuth isAuth={isExperimentsAuthenticated}><PythonExecutorPanel ... /></RequireAuth>} />
<Route path="/experiments/python/:projectId" element={<RequireAuth isAuth={isExperimentsAuthenticated}><PythonExecutorPanel ... initialProjectId={...} /></RequireAuth>} />
```

### 7. Sidebar navigation entry

**File:** `components/Sidebar.tsx`

Add "Python Executor" entry under Experiments tools:
```tsx
<li>
  <Button ... className={itemClassName(activeView === 'python')} onClick={() => navigate('/experiments/python')}>
    <Terminal size={16} ... />
    <span className="truncate">Python</span>
  </Button>
</li>
```

Update `activeView` type to include `'python'`.

### 8. ModeSelector update

**File:** `components/ModeSelector.tsx`

Update the Experiments description to include Python:
```
"RAG, Plugin Agent, Stitch, Python, and experimental tools"
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `server/services/pythonExecutor.ts` | Modify | Add `autoDetectImports()` function |
| `server/routes/python.ts` | Modify | Add project CRUD routes, merge auto-detected imports |
| `server/db/schema.ts` | Modify | Add `python_projects` table |
| `services/apiDatabaseAdapter.ts` | Modify | Add Python project API functions |
| `components/PythonExecutorPanel.tsx` | **Create** | Main Python executor UI component |
| `App.tsx` | Modify | Add routes + imports for PythonExecutorPanel |
| `components/Sidebar.tsx` | Modify | Add Python tool entry in experiments nav |
| `components/ModeSelector.tsx` | Modify | Update description text |
| `types.ts` | Modify | Add `'python'` to `ConversationType` if needed |

## Python-to-Library Reference Flow

1. User opens Python Executor in Experiments
2. Left panel shows a "Library Reference" section
3. Search input queries `/api/library/components/search` filtered to `category: 'python'`
4. Results show Python component cards (name, description, file count)
5. Clicking a result opens the component's entry `.py` file as a new tab in the editor (read-only reference, or copy-to-project)
6. User can also "Import from Library" to copy a Python component's files into the current project

## Auto-install Pipeline

1. User writes code with `import numpy as np` and `from PIL import Image`
2. On "Run", client sends code to `/api/python/execute` (no explicit requirements)
3. Server runs `autoDetectImports(code)` → detects `numpy`, `Pillow` (PIL maps to Pillow)
4. Merges with any manually specified requirements
5. Calls `installPackages()` for missing packages
6. Executes code with installed packages
7. Returns stdout/stderr/exitCode

Package name mapping (common aliases):
- `PIL` → `Pillow`
- `cv2` → `opencv-python`
- `sklearn` → `scikit-learn`
- `yaml` → `PyYAML`
- `bs4` → `beautifulsoup4`
- `gi` → `PyGObject` (skip — system dep)
