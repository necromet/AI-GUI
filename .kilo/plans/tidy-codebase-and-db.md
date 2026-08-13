# Plan: Tidy Up Codebase + Rewrite DB Schema for PostgreSQL

## Overview

Comprehensive cleanup of the edward:labs codebase: remove dead/legacy code, fix broken imports, normalize localStorage keys, and rewrite the database schema from SQLite DDL to proper PostgreSQL DDL with an auto-migration runner.

---

## 1. Delete Dead/Legacy Files

| File | Reason |
|------|--------|
| `server/db/migrate-sqlite-to-pg.ts` | One-time migration script; imports `better-sqlite3` (not in package.json). Migration is done. |
| `server/db/schema.ts` | Contains SQLite DDL (`AUTOINCREMENT`, `datetime('now')`). Replaced by new PG schema below. |
| `data/edwardlabs.db`, `data/edwardlabs.db-shm`, `data/edwardlabs.db-wal` | Old SQLite database files. App uses PostgreSQL now. |

**Note:** `math-curve-loaders/` is a git submodule (only contains `.git/`). Leave it — it's not dead code.

---

## 2. Rewrite Database Schema for PostgreSQL

**File:** `server/db/schema.ts` (rewrite, not delete)

Replace the entire SQLite schema with proper PostgreSQL DDL:

- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `TEXT PRIMARY KEY` → `VARCHAR(50) PRIMARY KEY` (for UUID-style IDs)
- `datetime('now')` → `NOW()`
- `INTEGER NOT NULL DEFAULT 1` for booleans → `BOOLEAN NOT NULL DEFAULT TRUE`
- `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
- Add `IF NOT EXISTS` on all `CREATE TABLE` statements
- Keep all existing tables: `models`, `conversations`, `messages`, `skema_projects`, `rag_documents`, `rag_chunks`, `skema_components`, `skema_component_embeddings`, `library_components`, `library_embeddings`, `library_component_files`, `library_agent_sessions`, `skema_agent_sessions`, `python_projects`, `library_folders`
- Add the `folder_id` column to `library_components` (was added by migration 001)
- Add `_migrations` tracking table

**File:** `server/db/index.ts` (update)

Update `initializeDatabase()` to:
1. Connect to PG and verify connectivity (existing behavior)
2. Run the schema SQL (create tables if not exist)
3. Run seed data (`INSERT ... ON CONFLICT DO NOTHING` for default model)
4. Run pending migrations from `server/db/migrations/`

---

## 3. Fix Broken Import in Seed Data

**File:** `server/data/seedComponents.ts:1`

```ts
// BROKEN:
import type { StitchComponent } from '../services/stitchLibraryService';

// FIX:
import type { SkemaComponent } from '../services/skemaLibraryService';
```

Also update:
- `SeedComponent` type alias: `Omit<StitchComponent, ...>` → `Omit<SkemaComponent, ...>`
- All `projectType: 'website'` → `projectType: 'canvas'` (matching the migration 001 rename and the `SkemaComponent.projectType` union: `'canvas' | 'ig-carousel' | 'ig-story' | 'all'`)

---

## 4. Normalize localStorage Key Prefixes

Some keys use `edward:labs_` prefix, others don't. Normalize all to use the prefix.

| Current Key | New Key | Files Affected |
|-------------|---------|----------------|
| `neonColor` | `edward:labs_neonColor` | `App.tsx` |
| `neonPreset` | `edward:labs_neonPreset` | `App.tsx` |
| `maxOutputTokens` | `edward:labs_maxOutputTokens` | `App.tsx` |

Keys already using the prefix (no change needed): `edward:labs_fontSize`, `edward:labs_fontFamily`, `edward:labs_defaultModel`, `edward:labs_themePreset`, `edward:labs_agentDockOpen`, `edward:labs_chat_session`, `edward:labs_experiments_session`, `edward:labs_library_session`, `edward:labs_agentConfig_*`.

---

## 5. Remove Unused SQLite References from `.gitignore`

The `.gitignore` already ignores `data/` which covers the SQLite files. No change needed there, but the `data/` directory with old `.db` files should be cleaned up (step 1).

---

## 6. Update `.env.example`

Add PostgreSQL connection variables that `server/db/pg.ts` reads:

```
PG_HOST=13.140.162.178
PG_PORT=5432
PG_DATABASE=edlab
PG_USER=postgres
PG_PASSWORD=YOUR-PG-PASSWORD
```

---

## 7. Verification

After all changes:
1. Run `npm run build` — must succeed with no errors
2. Verify `server/db/schema.ts` exports valid PG DDL
3. Verify `server/db/index.ts` runs schema on startup
4. Verify `seedComponents.ts` compiles without broken imports
5. Verify localStorage keys are consistent

---

## Execution Order

1. Rewrite `server/db/schema.ts` (PG DDL)
2. Update `server/db/index.ts` (auto-migration runner)
3. Fix `server/data/seedComponents.ts` broken import
4. Normalize localStorage keys in `App.tsx`
5. Delete dead files (`migrate-sqlite-to-pg.ts`, old SQLite DB files)
6. Update `.env.example` with PG vars
7. Run `npm run build` to verify
