# Plan: Rename Skema `website` → `canvas`

Rename the `'website'` project type to `'canvas'` across the entire Skema feature — types, database, backend, and frontend.

---

## Scope

The string `'website'` appears in **28 files** across 4 layers. The string `'all'` (used as a universal component filter) remains unchanged — it is independent of the project type rename.

---

## Change Categories

### 1. TypeScript Type Definitions (2 files)

| File | Line | Current | New |
|------|------|---------|-----|
| `types.ts` | 140 | `SkemaProjectType = 'website' \| 'ig-carousel' \| 'ig-story'` | `'canvas' \| 'ig-carousel' \| 'ig-story'` |
| `types/skemaSpec.ts` | 69 | `'website' \| 'ig-carousel' \| 'ig-story' \| 'all'` | `'canvas' \| 'ig-carousel' \| 'ig-story' \| 'all'` |

### 2. Server Interface (1 file)

| File | Line | Current | New |
|------|------|---------|-----|
| `server/services/skemaLibraryService.ts` | 10 | `'website' \| 'ig-carousel' \| 'ig-story' \| 'all'` | `'canvas' \| 'ig-carousel' \| 'ig-story' \| 'all'` |

### 3. Database Schema Defaults (4 files)

| File | Line | Current | New |
|------|------|---------|-----|
| `server/db/schema.ts` | 51 | `DEFAULT 'website'` | `DEFAULT 'canvas'` |
| `docs/edlab-init.sql` | 56 | `DEFAULT 'website'` | `DEFAULT 'canvas'` |
| `docs/database-ddl-postgresql.md` | 88 | `DEFAULT 'website'` | `DEFAULT 'canvas'` |
| `docs/database-ddl.md` | 79 | `DEFAULT 'website'` | `DEFAULT 'canvas'` |

### 4. Backend Fallback Defaults — `|| 'website'` (4 files, 6 sites)

| File | Line | Code |
|------|------|------|
| `server/routes/skema.ts` | 47 | `project_type \|\| 'website'` → `'canvas'` |
| `server/db/skemaProjects.ts` | 51 | `project.project_type \|\| 'website'` → `'canvas'` |
| `server/services/agentService.ts` | 728 | `context?.projectType \|\| 'website'` → `'canvas'` |
| `services/apiDatabaseAdapter.ts` | 224 | `project.projectType \|\| 'website'` → `'canvas'` |
| `services/skemaService.ts` | 246 | `= 'website'` default param → `'canvas'` |
| `services/skemaService.ts` | 309 | `\|\| 'website'` → `'canvas'` |

### 5. Frontend Project Type UI (1 file)

| File | Line | Change |
|------|------|--------|
| `components/SkemaPanel.tsx` | 33 | `value: 'website'` → `value: 'canvas'` |
| `components/SkemaPanel.tsx` | 34 | `label: 'Website'` → `label: 'Canvas'` |
| `components/SkemaPanel.tsx` | 34 | `desc: 'Landing pages, dashboards, portfolios'` → update description |
| `components/SkemaPanel.tsx` | 34 | `icon: <Globe .../>` → consider new icon (or keep) |
| `components/SkemaPanel.tsx` | 261 | `selectedType === 'website'` → `'canvas'` |
| `components/SkemaPanel.tsx` | 274 | `handleCreateProject('website', ...)` → `'canvas'` |

### 6. `isIgContent` Pattern — No Change Needed

These files check `projectType === 'ig-carousel' || projectType === 'ig-story'` — they do NOT reference `'website'`. No changes needed:

- `components/SkemaEditor.tsx:52-54`
- `components/SkemaExportModal.tsx:23`
- `components/skema/agent/useSkemaAgentStream.ts:56,260`
- `server/services/agentService.ts:735`
- `server/services/skemaSpecPrompt.ts:66`

### 7. Documentation Plans (`.kilo/plans/`) — Optional

These are planning docs, not runtime code. Update for consistency:

- `.kilo/plans/stitch-instagram-carousel.md`
- `.kilo/plans/stitch-ig-json-spec.md`
- `.kilo/plans/stitch-library-enhancement.md`
- `.kilo/plans/stitch-agent-vercel-ai-sdk.md`

### 8. Database Migration — Existing Data

Existing `skema_projects` rows have `project_type = 'website'`. A migration UPDATE is needed:

```sql
UPDATE skema_projects SET project_type = 'canvas' WHERE project_type = 'website';
```

---

## Files Changed (Summary)

| # | File | Sites | Layer |
|---|------|-------|-------|
| 1 | `types.ts` | 1 | Type |
| 2 | `types/skemaSpec.ts` | 1 | Type |
| 3 | `server/services/skemaLibraryService.ts` | 1 | Server |
| 4 | `server/db/schema.ts` | 1 | DB schema |
| 5 | `server/db/skemaProjects.ts` | 1 | DB module |
| 6 | `server/routes/skema.ts` | 1 | Route |
| 7 | `server/services/agentService.ts` | 1 | Service |
| 8 | `services/apiDatabaseAdapter.ts` | 1 | Client adapter |
| 9 | `services/skemaService.ts` | 2 | Client service |
| 10 | `components/SkemaPanel.tsx` | 4 | UI |
| 11 | `docs/edlab-init.sql` | 1 | DDL |
| 12 | `docs/database-ddl-postgresql.md` | 1 | DDL doc |
| 13 | `docs/database-ddl.md` | 1 | DDL doc |
| 14 | PostgreSQL `skema_projects` table | 1 | Migration |

**Total: 14 locations, 17 string replacements**

---

## What Stays Unchanged

- `'ig-carousel'` and `'ig-story'` values — untouched
- `'all'` component filter — untouched (it means "universal", not "website")
- `isIgContent` checks — untouched (they test for IG types, not website)
- Skema agent tools (`generate_html`, `edit_html`, `generate_spec`, `edit_spec`) — untouched
- Board layouts (`16:9`, `4:5`, `9:16`, etc.) — untouched

---

## Execution Order

1. Update TypeScript types (`types.ts`, `types/skemaSpec.ts`)
2. Update server interface (`skemaLibraryService.ts`)
3. Update backend defaults (6 sites across 4 files)
4. Update frontend UI (`SkemaPanel.tsx` label + value + icon + branch conditions)
5. Run DB migration (`UPDATE skema_projects SET project_type = 'canvas' WHERE project_type = 'website'`)
6. Update DDL files (3 docs)
7. Build + verify
