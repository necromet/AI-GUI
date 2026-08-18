# Plan: Skema Agent Rename + Properties Tab UI + CRUD Verification

## Context

The user has three requests:
1. Rename "Canvas Agent" → "Skema Agent" in the agent sidebar
2. Improve the Properties tab button interface in the canvas sidebar
3. Verify/fix database CRUD for `/experiments/skema/{skema_id}` — the user asked whether components are saved to the DB (they are, but the load-by-ID path is inefficient)

## Task 1: Rename "Canvas Agent" → "Skema Agent"

**File:** `components/skema/SkemaAgentSidebar.tsx:103`

Change the hardcoded string `"Canvas Agent"` to `"Skema Agent"` in the header `<p>` tag.

## Task 2: Improve Properties Tab Buttons

**Files:**
- `components/Sidebar.tsx` (lines 147-171 — `CanvasSidebarContent` tab bar)
- `components/canvas/CanvasSidebar.tsx` (lines 169-201 — standalone sidebar tab bar)

Both use `SlidingGroup` with plain text buttons. The current HTML output shows minimal styling:
```html
<button class="flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider ...">Components</button>
<button class="flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider ...">Properties</button>
```

**Changes:**
- Add icons to each tab (e.g. `LayoutGrid` for Components, `Settings`/`SlidersHorizontal` for Properties)
- Add a count badge for components tab showing number of placed components
- Improve visual weight: slightly larger text, icon+label layout, pill-style active state
- Apply to both `Sidebar.tsx` CanvasSidebarContent and `CanvasSidebar.tsx`

## Task 3: Database CRUD — Already Working, Optimize Load Path

**Current save flow (working):**
1. `CanvasEditor.saveState()` → `serializeGridState()` → `__canvas__:{JSON}`
2. → `SkemaPanel.handleSaveProject()` → `db.saveSkemaProject()` → `PUT /api/skema/projects/:id`
3. → PostgreSQL `skema_projects.boards_json`

Components **are** saved to the database on every change (place, remove, move, regenerate, prompt edit, TSX edit).

**Current load-by-ID path (inefficient):**
1. `SkemaPanel.loadProjects()` fetches ALL projects via `GET /api/skema/projects`
2. Then filters by `initialProjectId`

**Fix:** Add a direct fetch path in `SkemaPanel` — when `initialProjectId` is provided, call `db.getSkemaProject(id)` directly instead of loading all projects. Fall back to loading all only when no `initialProjectId`.

**Files:**
- `components/SkemaPanel.tsx` — modify `useEffect` for `initialProjectId` to fetch directly

## Verification

Run `npm run build` to verify no type errors.
