# Migration Plan: SQLite → PostgreSQL

Migrate the edward:labs Express backend from `better-sqlite3` (local file) to a remote PostgreSQL instance (`13.140.162.178:5432`, database `edlab`, user `postgres`).

---

## Current State

- **Driver**: `better-sqlite3` — synchronous API
- **DB file**: `data/edwardlabs.db` (WAL mode)
- **Init**: `server/db/index.ts` — lazy singleton via `getDatabase()`
- **Pattern**: `db.prepare(sql).all()/.get()/.run()` — all sync, no async/await
- **Consumers**: 6 DB modules (`server/db/*.ts`), 3 services (`server/services/*.ts`), 2 route files with inline SQL
- **Transactions**: Only `ragService.ts` uses `db.transaction()`

### Files That Touch the Database

| File | Access Pattern | Tables |
|------|---------------|--------|
| `server/db/index.ts` | Init + migrations | All (DDL) |
| `server/db/conversations.ts` | Module | `conversations` |
| `server/db/messages.ts` | Module | `messages`, `conversations` |
| `server/db/models.ts` | Module | `models` |
| `server/db/tokenStats.ts` | Module | `messages`, `conversations`, `models` |
| `server/db/skemaProjects.ts` | Module | `skema_projects` |
| `server/services/libraryService.ts` | Service | `library_*` tables |
| `server/services/ragService.ts` | Service | `rag_*` tables |
| `server/services/skemaLibraryService.ts` | Service | `skema_components`, `skema_component_embeddings` |
| `server/routes/python.ts` | Inline SQL | `python_projects` |
| `server/routes/skemaAgent.ts` | Inline SQL | `skema_agent_sessions` |

---

## Target State

- **Driver**: `pg` (node-postgres) — async API
- **Connection**: `postgresql://postgres:***@13.140.162.178:5432/edlab`
- **Pool**: `pg.Pool` — connection pooling (default 10 connections)
- **Pattern**: `pool.query(sql, params)` → `Promise<QueryResult>`
- **Schema**: Already created via `docs/edlab-init.sql` (15 tables, pgcrypto extension)

---

## Key Differences to Handle

### 1. Sync → Async

Every `db.prepare(sql).get()` call becomes `await pool.query(sql, params)`. This is the **largest change** — every function that touches the DB must become `async`, and every caller must `await` it.

### 2. Parameter Placeholders

| SQLite | PostgreSQL |
|--------|-----------|
| `?` positional | `$1, $2, $3` positional |
| `?` with array | `ANY($1)` for IN clauses |

### 3. SQL Syntax

| SQLite | PostgreSQL |
|--------|-----------|
| `datetime('now')` | `NOW()` (handled by DDL defaults) |
| `INTEGER` booleans (0/1) | `BOOLEAN` (true/false) |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` |
| `lastInsertRowid` | `RETURNING id` |
| `changes()` | Check `rowCount` on result |
| `AUTOINCREMENT` | `SERIAL` (handled by DDL) |
| `PRAGMA` | Not applicable |
| `JSONB` stored as TEXT | Native `JSONB` — use `$1::jsonb` for inserts |

### 4. Transaction API

| SQLite (`better-sqlite3`) | PostgreSQL (`pg`) |
|---------------------------|-------------------|
| `db.transaction(() => { ... })` | `const client = await pool.connect(); try { await client.query('BEGIN'); ...; await client.query('COMMIT'); } catch { await client.query('ROLLBACK'); } finally { client.release(); }` |

### 5. Result Shape

| better-sqlite3 | pg |
|----------------|-----|
| `.get()` → object or `undefined` | `.query()` → `result.rows[0]` or `undefined` |
| `.all()` → array | `.query()` → `result.rows` |
| `.run()` → `{ changes, lastInsertRowid }` | `.query()` → `result.rowCount`, use `RETURNING id` for insert ID |

### 6. JSON Columns

SQLite stores JSON as `TEXT` and parses with `JSON.parse()`. PostgreSQL `JSONB` columns accept native JS objects when parameterized as `$1::jsonb`. The app code does explicit `JSON.parse()`/`JSON.stringify()` — this can remain or be simplified.

---

## Migration Phases

### Phase 1: Install pg + Create Pool Wrapper

**Install dependency:**

```bash
npm install pg
npm install -D @types/pg
```

**Create `server/db/pg.ts`:**

```typescript
import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.PG_HOST || '13.140.162.178',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'edlab',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[db] PostgreSQL pool error:', err.message);
});

export async function query<T = any>(sql: string, params?: any[]): Promise<pg.QueryResult<T>> {
  return pool.query<T>(sql, params);
}

export async function getOne<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
  const result = await pool.query<T>(sql, params);
  return result.rows[0];
}

export async function getAll<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}

export async function run(sql: string, params?: any[]): Promise<{ rowCount: number }> {
  const result = await pool.query(sql, params);
  return { rowCount: result.rowCount ?? 0 };
}

export async function runReturning<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
  const result = await pool.query<T>(sql, params);
  return result.rows[0];
}

export async function transaction<T>(fn: (query: typeof pool.query) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client.query.bind(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
```

**Update `.env`:**

```
PG_HOST=13.140.162.178
PG_PORT=5432
PG_DATABASE=edlab
PG_USER=postgres
PG_PASSWORD=0421051853Edw@rd
```

---

### Phase 2: Convert DB Modules (6 files)

Rewrite each `server/db/*.ts` module from `better-sqlite3` sync to `pg` async.

**Conversion pattern:**

```typescript
// BEFORE (SQLite)
export function getConversations() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all();
}

// AFTER (PostgreSQL)
import { getAll } from './pg';

export async function getConversations() {
  return getAll('SELECT * FROM conversations ORDER BY updated_at DESC');
}
```

```typescript
// BEFORE (SQLite)
export function createConversation(title: string, modelId: number, type: string) {
  const db = getDatabase();
  const result = db.prepare('INSERT INTO conversations (title, model_id, type) VALUES (?, ?, ?)').run(title, modelId, type);
  return result.lastInsertRowid;
}

// AFTER (PostgreSQL)
import { runReturning } from './pg';

export async function createConversation(title: string, modelId: number, type: string) {
  const row = await runReturning<{ id: number }>(
    'INSERT INTO conversations (title, model_id, type) VALUES ($1, $2, $3) RETURNING id',
    [title, modelId, type]
  );
  return row!.id;
}
```

**Files to convert:**

| File | Functions | Complexity |
|------|-----------|-----------|
| `server/db/conversations.ts` | ~6 functions | Low — simple CRUD |
| `server/db/messages.ts` | ~6 functions | Low — CRUD + order |
| `server/db/models.ts` | ~7 functions | Low — CRUD + search |
| `server/db/tokenStats.ts` | ~4 functions | Medium — aggregation queries |
| `server/db/skemaProjects.ts` | ~6 functions | Low — CRUD |
| `server/db/index.ts` | Init + migrations | Medium — remove SQLite init, add PG pool init |

**`server/db/index.ts` changes:**

```typescript
// BEFORE
import Database from 'better-sqlite3';
let db: Database.Database | null = null;
export function getDatabase(): Database.Database { ... }

// AFTER
import { pool, query } from './pg';
export { pool };

export async function initializeDatabase(): Promise<void> {
  console.log('[db] PostgreSQL connected to edlab');
  // Migrations are handled by the DDL (already applied)
}
```

---

### Phase 3: Convert Services (3 files)

**`server/services/libraryService.ts`** — largest file (~600 lines, 20+ functions):

All functions call `getDatabase()` and use sync `.prepare().all()/.get()/.run()`. Each must become `async` with `await query/getAll/getOne/run`.

Key functions to convert:

| Function | SQL Pattern | Notes |
|----------|-------------|-------|
| `getComponents()` | `SELECT ... WHERE` with optional filters | Dynamic WHERE clause |
| `getComponent(id)` | `SELECT ... WHERE id = ?` | Single row |
| `createComponent()` | `INSERT ... RETURNING id` | Returns new ID |
| `updateComponent()` | `UPDATE ... SET` | Partial update |
| `deleteComponent()` | `DELETE ... CASCADE` | Cascades to files/embeddings/sessions |
| `searchComponents()` | Load all embeddings, compute cosine sim | **In-memory vector search** — keep as-is since pgvector isn't installed |
| `writeComponentFile()` | `INSERT OR IGNORE` / `UPDATE` | **Needs `ON CONFLICT DO UPDATE`** |
| `createSession()` | `INSERT ... RETURNING id` | FIFO eviction logic |
| `getSessions()` | `SELECT ... LIMIT 3` | Simple |

**`server/services/ragService.ts`** — uses `db.transaction()`:

```typescript
// BEFORE
const insertMany = db.transaction((chunks) => {
  for (const chunk of chunks) {
    insertStmt.run(chunk.id, docId, chunk.text, chunk.embedding, chunk.start, chunk.end);
  }
});
insertMany(chunks);

// AFTER
await transaction(async (q) => {
  for (const chunk of chunks) {
    await q(
      'INSERT INTO rag_chunks (id, document_id, text, embedding, start_index, end_index) VALUES ($1,$2,$3,$4,$5,$6)',
      [chunk.id, docId, chunk.text, chunk.embedding, chunk.start, chunk.end]
    );
  }
});
```

**`server/services/skemaLibraryService.ts`** — similar pattern to libraryService.

---

### Phase 4: Convert Routes with Inline SQL (2 files)

**`server/routes/python.ts`** — calls `getDatabase()` directly:

```typescript
// BEFORE
const db = getDatabase();
const projects = db.prepare('SELECT * FROM python_projects ORDER BY updated_at DESC').all();

// AFTER
import { getAll } from '../db/pg';
const projects = await getAll('SELECT * FROM python_projects ORDER BY updated_at DESC');
```

**`server/routes/skemaAgent.ts`** — same pattern for `skema_agent_sessions`.

---

### Phase 5: Update Route Consumers

Routes that call DB modules (`conversations.ts`, `messages.ts`, `models.ts`, `stats.ts`, `skema.ts`) already use the return values — they just need `await` added since the DB functions are now async.

```typescript
// BEFORE
router.get('/', (req, res) => {
  const convos = getConversations();
  res.json(convos);
});

// AFTER
router.get('/', async (req, res) => {
  const convos = await getConversations();
  res.json(convos);
});
```

---

### Phase 6: Update Embedding Search

The embedding search currently loads all embeddings from SQLite and computes cosine similarity in-memory. With PostgreSQL (no pgvector), this remains the same — just change the SQL query syntax.

If pgvector is installed later:

```sql
-- Replace in-memory cosine with pgvector
SELECT lc.*, 1 - (le.embedding <=> $1::vector) AS score
FROM library_embeddings le
JOIN library_components lc ON lc.id = le.component_id
ORDER BY le.embedding <=> $1::vector
LIMIT $2;
```

---

### Phase 7: Remove SQLite Dependencies

**Remove:**
- `better-sqlite3` from `package.json`
- `@types/better-sqlite3` from `package.json`
- `data/edwardlabs.db` file (or keep for rollback)
- SQLite-specific pragmas and `db.exec()` calls

**Update `server/db/index.ts`:**
- Replace `getDatabase()` singleton with `initializeDatabase()` that just logs connection
- Export `pool` from `server/db/pg.ts` for direct access if needed

---

### Phase 8: Update Environment & Docker

**`.env` changes:**

```diff
+ PG_HOST=13.140.162.178
+ PG_PORT=5432
+ PG_DATABASE=edlab
+ PG_USER=postgres
+ PG_PASSWORD=<password>
- DATABASE_PATH=data/edwardlabs.db
```

**Docker (`Dockerfile.backend`):**

```diff
- # No changes needed — SQLite file was a volume mount
+ # Ensure network access to PostgreSQL host
+ ENV PG_HOST=13.140.162.178
```

**Vite config (`vite.config.ts`):**

No changes needed — `PG_*` env vars are server-side only (not injected via Vite `define`).

---

## File Change Summary

| File | Change Type | Effort |
|------|------------|--------|
| `server/db/pg.ts` | **NEW** — pg pool + helpers | Low |
| `server/db/index.ts` | **REWRITE** — remove SQLite, init PG | Medium |
| `server/db/conversations.ts` | **REWRITE** — sync → async | Low |
| `server/db/messages.ts` | **REWRITE** — sync → async | Low |
| `server/db/models.ts` | **REWRITE** — sync → async | Low |
| `server/db/tokenStats.ts` | **REWRITE** — sync → async | Medium |
| `server/db/skemaProjects.ts` | **REWRITE** — sync → async | Low |
| `server/services/libraryService.ts` | **REWRITE** — sync → async (~20 functions) | High |
| `server/services/ragService.ts` | **REWRITE** — sync → async + transactions | Medium |
| `server/services/skemaLibraryService.ts` | **REWRITE** — sync → async | Medium |
| `server/routes/python.ts` | **EDIT** — inline SQL async | Low |
| `server/routes/skemaAgent.ts` | **EDIT** — inline SQL async | Low |
| `server/routes/conversations.ts` | **EDIT** — add await | Low |
| `server/routes/messages.ts` | **EDIT** — add await | Low |
| `server/routes/models.ts` | **EDIT** — add await | Low |
| `server/routes/stats.ts` | **EDIT** — add await | Low |
| `server/routes/skema.ts` | **EDIT** — add await | Low |
| `server/routes/library.ts` | **EDIT** — add await | Medium |
| `server/routes/libraryAgent.ts` | **EDIT** — add await | Low |
| `server/routes/rag.ts` | **EDIT** — add await | Low |
| `server/index.ts` | **EDIT** — replace getDatabase() call | Low |
| `package.json` | **EDIT** — swap deps | Low |
| `.env` | **EDIT** — add PG_* vars | Low |

**Total: ~23 files, ~1 new file**

---

## Gap Analysis

A line-by-line audit of every file that touches the database reveals the following gaps not covered in the high-level plan above.

### G1. `db.exec()` Multi-Statement Calls — PG Doesn't Support Them

`better-sqlite3`'s `db.exec(sql)` runs multiple semicolon-separated statements in one call. PostgreSQL's `pool.query()` does **NOT** support multi-statement strings by default.

| File | Line | Usage |
|------|------|-------|
| `server/db/index.ts` | 22 | `db.exec(SCHEMA_SQL)` — runs 15+ CREATE TABLE statements |
| `server/db/index.ts` | 23 | `db.exec(SEED_SQL)` — runs INSERT |
| `server/db/index.ts` | 37, 41, 45, 49 | `db.exec("ALTER TABLE ...")` — runtime migrations |

**Fix:** Split `SCHEMA_SQL` into individual statements (e.g., via `;` splitting + `for...of`) or use a migration library (`node-pg-migrate`, `knex`, `drizzle-orm`).

### G2. `PRAGMA table_info()` — SQLite-Specific Metadata Query

Used in runtime migrations to check if columns exist before adding them.

| File | Line | Usage |
|------|------|-------|
| `server/db/index.ts` | 33 | `PRAGMA table_info(stitch_projects)` |
| `server/db/index.ts` | 66 | `PRAGMA table_info(library_components)` |

**PG equivalent:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = $1 AND column_name = $2
```

### G3. `stitch_projects` Table — Missing from Schema DDL

`server/db/index.ts:32-51` adds 4 columns (`project_type`, `boards_json`, `images_json`, `theme_json`) to a `stitch_projects` table. This table is **NOT** in `server/db/schema.ts` — it was created by a prior migration that's been lost. The PostgreSQL DDL (`edlab-init.sql`) also doesn't include it.

**Fix:** Add `stitch_projects` to the PG DDL, or remove the migration code if the table is no longer used (check if any routes reference it).

### G4. `datetime('now')` in Runtime Queries (4 Sites)

Not just DDL defaults — runtime queries also use SQLite's `datetime()` function:

| File | Line | Expression | PG Fix |
|------|------|------------|--------|
| `server/db/conversations.ts` | 38 | `datetime('now')` in UPDATE | `NOW()` |
| `server/db/messages.ts` | 54 | `datetime('now')` in INSERT | `NOW()` |
| `server/routes/python.ts` | 206 | `datetime('now')` in UPDATE | `NOW()` |
| `server/db/tokenStats.ts` | 86 | `datetime('now', '-' \|\| ? \|\| ' days')` | `NOW() - $1 * INTERVAL '1 day'` |

### G5. `DATE()` and `strftime` — SQLite Date Functions

`server/db/tokenStats.ts` uses SQLite-specific date extraction:

| Line | Expression | PG Fix |
|------|------------|--------|
| 80 | `DATE(timestamp) as date` | `DATE(timestamp)` — works on `TIMESTAMPTZ` too, no change needed |
| 87 | `GROUP BY DATE(timestamp)` | Same — compatible |

### G6. `HAVING` with Column Alias — SQLite-Only

`server/db/tokenStats.ts` line 106:
```sql
HAVING totalTokens > 0
```
SQLite allows column aliases in `HAVING`. **PostgreSQL does NOT** — must use the aggregate expression:
```sql
HAVING SUM(msg.token_count) > 0
```

### G7. `GROUP BY` with `f.*` — Non-Aggregated Columns

`server/services/libraryService.ts` lines 533-538 and 545-550:
```sql
SELECT f.*, COUNT(c.id) as component_count
FROM library_folders f LEFT JOIN library_components c ON c.folder_id = f.id
GROUP BY f.id
```
SQLite allows `GROUP BY f.id` while selecting `f.*`. **PostgreSQL requires ALL non-aggregated columns in GROUP BY**, or use a subquery:
```sql
SELECT f.*, (SELECT COUNT(*) FROM library_components c WHERE c.folder_id = f.id) as component_count
FROM library_folders f
```

### G8. Boolean Reads/Writes — 18 Code Sites

The codebase uses `? 1 : 0` for writes and `=== 1` for reads on boolean columns. All must change to `true`/`false`.

**Writes (`? 1 : 0`):**

| File | Line | Column |
|------|------|--------|
| `server/db/models.ts` | 52, 71 | `is_custom` |
| `server/services/libraryService.ts` | 96, 119 | `is_entry` |
| `server/services/libraryService.ts` | 188, 299 | `is_global` |
| `server/services/libraryService.ts` | 189, 300 | `agent_accessible` |
| `server/services/libraryService.ts` | 523, 571 | `agent_accessible` (folders) |
| `server/services/skemaLibraryService.ts` | 65 | `is_global` |

**Reads (`=== 1`):**

| File | Line | Column |
|------|------|--------|
| `server/services/libraryService.ts` | 50 | `is_entry === 1` |
| `server/services/libraryService.ts` | 67, 501 | `is_global === 1`, `agent_accessible === 1` |
| `server/services/skemaLibraryService.ts` | 40 | `is_global === 1` |

**WHERE clauses:**

| File | Line | Clause |
|------|------|--------|
| `server/db/models.ts` | 18 | `WHERE active = 1` → `WHERE active = TRUE` |
| `server/db/models.ts` | 76 | `SET active = 0` → `SET active = FALSE` |
| `server/services/libraryService.ts` | 249, 336, 390 | `agent_accessible = 1` → `agent_accessible = TRUE` |

**TypeScript interfaces also need updating:**
```typescript
// BEFORE
active: number;
is_custom: number;

// AFTER
active: boolean;
is_custom: boolean;
```

### G9. `result.changes` → `result.rowCount` (9 Sites)

`better-sqlite3` returns `{ changes }` from `.run()`. PostgreSQL `pg` returns `{ rowCount }`.

| File | Line |
|------|------|
| `server/services/libraryService.ts` | 130, 326, 475, 583, 590 |
| `server/services/skemaLibraryService.ts` | 114 |
| `server/services/ragService.ts` | 95 |
| `server/routes/skemaAgent.ts` | 470 |
| `server/routes/python.ts` | 230 |

### G10. JSONB Columns — `JSON.parse`/`JSON.stringify` Can Be Simplified

With PG `JSONB`, reads return native JS objects (no `JSON.parse` needed), and writes accept JS objects directly (no `JSON.stringify` needed). The following 20+ sites can be simplified:

| File | Columns | Parse/Serialize Sites |
|------|---------|----------------------|
| `server/services/libraryService.ts` | `tags`, `metadata`, `embedding`, `messages_json` | ~10 sites |
| `server/services/ragService.ts` | `embedding` | 2 sites |
| `server/services/skemaLibraryService.ts` | `tags`, `embedding` | 4 sites |
| `server/routes/python.ts` | `files_json`, `settings_json` | 6 sites |
| `server/db/skemaProjects.ts` | `boards_json`, `images_json`, `theme_json`, `full_design_spec_json` | ~8 sites |

**Note:** Embeddings are stored as `JSON.stringify(vector)` in a `TEXT` column. If pgvector is installed later, this changes to native `vector(1536)` type.

### G11. TypeScript Interface Mismatches

`server/db/models.ts` defines:
```typescript
interface DBModel {
  active: number;     // → should be boolean
  is_custom: number;  // → should be boolean
}
```

Similar interfaces exist in `libraryService.ts` for `is_global`, `agent_accessible`, `is_entry`. All `number` types for boolean columns must change to `boolean`.

### G12. No `LIKE` Queries Found — Good

No `LIKE` queries exist in the codebase. String search uses `ILIKE`-compatible patterns or exact matches.

### G13. `LIMIT ?` with Parameter — Compatible

`server/services/libraryService.ts` line 451 uses `LIMIT ?`. PostgreSQL supports `LIMIT $N` — this is compatible after placeholder conversion.

### G14. `ON CONFLICT(id) DO UPDATE SET excluded.*` — Compatible

`server/db/skemaProjects.ts` lines 41-49 uses SQLite's upsert syntax. PostgreSQL supports the same syntax — no change needed beyond placeholder conversion.

---

## Updated Gap Summary

| Gap | Count | Severity | Phase |
|-----|-------|----------|-------|
| `db.exec()` multi-statement | 7 calls | **Critical** | 2 |
| `PRAGMA table_info` → `information_schema` | 2 calls | **Medium** | 2 |
| `stitch_projects` missing from DDL | 1 table | **High** | 1 |
| `datetime('now')` in runtime queries | 4 sites | **High** | 2-4 |
| `HAVING` with column alias | 1 site | **Medium** | 2 |
| `GROUP BY f.*` | 2 sites | **Medium** | 3 |
| Boolean `? 1 : 0` / `=== 1` | 18 sites | **High** | 2-3 |
| `result.changes` → `rowCount` | 9 sites | **High** | 2-4 |
| JSONB `JSON.parse`/`JSON.stringify` simplification | 20+ sites | **Low** (optional) | 2-4 |
| TypeScript interface `number` → `boolean` | 5 interfaces | **Medium** | 2 |
| `?` → `$1` parameter placeholders | ~100 queries | **Critical** | 2-4 |
| `lastInsertRowid` → `RETURNING id` | 3 sites | **High** | 2 |
| Sync → async API | 105 call sites | **Critical** | 2-5 |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Network latency to remote PG | Every query adds ~2-5ms | Connection pooling (20 conns), batch queries where possible |
| Sync → async cascade | Every caller must handle promises | TypeScript catches missed awaits at compile time |
| `INSERT OR IGNORE` → `ON CONFLICT` | Syntax differences in upserts | Audit all INSERT statements, use `ON CONFLICT (col) DO UPDATE SET ...` |
| Boolean type mismatch | SQLite stores 0/1, PG stores true/false | Audit all boolean reads/writes, ensure JS `true`/`false` used |
| `lastInsertRowid` → `RETURNING id` | Must add `RETURNING` to all INSERTs | Pattern is mechanical, grep for all `.run()` calls |
| Remote PG downtime | App crashes | Add connection error handling, retry logic, health check endpoint |
| No pgvector | Vector search remains in-memory | Acceptable for current scale, plan pgvector install later |
| Transaction rollback safety | SQLite auto-rolls back, PG needs explicit | Wrap multi-statement operations in `BEGIN`/`COMMIT`/`ROLLBACK` |

---

## Execution Order

```
1.  Install pg + @types/pg                        (5 min)
2.  Create server/db/pg.ts                        (15 min)
3.  Update .env with PG_* vars                    (5 min)
4.  Resolve stitch_projects DDL gap               (10 min)
5.  Convert server/db/index.ts                    (20 min)
    - Remove getDatabase(), add PG pool init
    - Replace db.exec() multi-statement with split execution
    - Replace PRAGMA table_info with information_schema
6.  Convert server/db/conversations.ts            (15 min)
    - ? → $1, datetime('now') → NOW(), lastInsertRowid → RETURNING
7.  Convert server/db/messages.ts                 (15 min)
    - ? → $1, datetime('now') → NOW(), lastInsertRowid → RETURNING
8.  Convert server/db/models.ts                   (20 min)
    - ? → $1, boolean 0/1 ↔ true/false, lastInsertRowid → RETURNING
    - Update DBModel interface: active/is_custom number → boolean
9.  Convert server/db/tokenStats.ts               (25 min)
    - ? → $1, datetime() arithmetic → INTERVAL, HAVING alias fix
10. Convert server/db/skemaProjects.ts            (15 min)
    - ? → $1, JSON.parse/stringify review
11. Convert server/services/libraryService.ts     (60 min)
    - 35 queries: ? → $1, boolean 18 sites, GROUP BY f.* fix,
      result.changes → rowCount, JSONB simplification
12. Convert server/services/ragService.ts         (25 min)
    - ? → $1, db.transaction() → async BEGIN/COMMIT/ROLLBACK
13. Convert server/services/skemaLibraryService.ts(25 min)
    - ? → $1, boolean reads/writes, embedding JSON.parse
14. Convert server/routes/python.ts               (15 min)
    - 7 inline queries: ? → $1, datetime('now') → NOW(),
      result.changes → rowCount, JSON.parse/stringify
15. Convert server/routes/skemaAgent.ts           (15 min)
    - 10 inline queries: ? → $1, result.changes → rowCount
16. Update all route files (add await)            (30 min)
17. Update TypeScript interfaces (boolean types)  (15 min)
18. Update server/index.ts                        (5 min)
19. Update package.json                           (5 min)
20. Build + test                                  (45 min)
```

**Estimated total: ~6 hours** (up from 4.5h due to gap analysis findings)

---

## Rollback Plan

1. Keep `better-sqlite3` in `package.json` (as optional) during migration
2. Keep `data/edwardlabs.db` file untouched
3. Add `DATABASE_DRIVER=sqlite|pg` env toggle in `server/db/index.ts`
4. If PostgreSQL fails, switch back to SQLite by setting `DATABASE_DRIVER=sqlite`
