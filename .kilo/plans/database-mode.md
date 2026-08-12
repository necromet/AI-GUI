# Plan: Database Mode — PostgreSQL Explorer

## Overview

Add a new top-level "Database" mode alongside Chat, Experiments, and Library. Developers can connect to external PostgreSQL databases, browse schemas/tables, and run SQL queries. SQL-only (no AI text-to-SQL). Monaco editor for SQL input, table view for results.

---

## 1. Type & Constant Changes

### `types.ts`
- Add `'database'` to `Mode` union: `Mode = 'selector' | 'chat' | 'experiments' | 'library' | 'database'`
- Add `DatabaseConnection` interface:
  ```ts
  export interface DatabaseConnection {
    id: string;
    name: string;
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    createdAt: string;
    updatedAt: string;
  }
  ```
- Add `QueryResult` interface:
  ```ts
  export interface QueryResult {
    columns: string[];
    rows: any[][];
    rowCount: number;
    executionTime: number;
    error?: string;
  }
  ```
- Add `TableInfo`, `ColumnInfo` interfaces for schema browsing

### `constants.tsx`
- No changes needed (no model defaults for database mode)

---

## 2. Password & Auth

### `components/ModeSelector.tsx`
- Add `DATABASE_PASSWORD = 'heleadsmebesidestillwaters'` (Psalm 23 themed, consistent with existing pattern)
- Add `isDatabaseAuthenticated` / `onSelectDatabase` / `onUnlockDatabase` props
- Add 4th card: icon `Database` (from lucide-react), title "Database", description "Connect to PostgreSQL databases and explore with SQL"
- Add password modal for database mode

### `App.tsx`
- Add `isDatabaseAuthenticated` state with `sessionStorage.getItem('edward:labs_database_session')`
- Pass database auth props to `ModeSelector`
- Add `/database` route handling

### `types.ts` (auth)
- `SessionStorage key: 'edward:labs_database_session'`

---

## 3. Routing (`App.tsx`)

- Add `isDatabaseMode = location.pathname.startsWith('/database')`
- Update `currentMode` derivation to include `'database'`
- Add routes:
  - `/database` → `DatabasePanel` (connection list / connect view)
  - `/database/:connectionId` → `DatabasePanel` (connected, schema browser + query editor)
- Add `RequireAuth` wrapper with `isDatabaseAuthenticated`
- Database mode has its own sidebar content (no conversation history)

---

## 4. Database Schema — `database_connections` Table

### `server/db/schema.ts`
Add to `SCHEMA_SQL`:
```sql
CREATE TABLE IF NOT EXISTS database_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 5432,
  database_name TEXT NOT NULL,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  ssl BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

> **Note**: Passwords stored with basic encoding (base64). For a production app, use proper encryption. Since this is a personal dev tool, base64 obfuscation is acceptable.

---

## 5. Server Routes — `server/routes/database.ts`

New file with these endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/database/connections` | Save a new connection |
| `GET` | `/api/database/connections` | List saved connections (masks passwords) |
| `GET` | `/api/database/connections/:id` | Get single connection |
| `PUT` | `/api/database/connections/:id` | Update connection |
| `DELETE` | `/api/database/connections/:id` | Delete connection |
| `POST` | `/api/database/test` | Test a connection (returns success/error) |
| `POST` | `/api/database/schema` | Get schema info (databases, schemas, tables, columns) for a connection |
| `POST` | `/api/database/query` | Execute SQL query against a connection |

### Implementation details:
- Each request creates a temporary `pg.Pool` for the target database (or reuse a cached pool per connection ID)
- Pool caching: `Map<string, pg.Pool>` keyed by connection ID, with idle timeout cleanup
- `schema` endpoint queries `information_schema.tables`, `information_schema.columns`, `pg_catalog.pg_namespace` etc.
- `query` endpoint: executes the SQL, measures execution time, returns columns + rows
- Read-only safety: optionally wrap in `BEGIN; SET TRANSACTION READ ONLY; ... COMMIT` (configurable)
- Max row limit: 1000 rows default, configurable
- Register in `server/index.ts`: `app.use('/api/database', databaseRoutes)`

---

## 6. Client API Adapter — `services/apiDatabaseAdapter.ts`

Add functions:
```ts
export const saveDbConnection = async (conn: {...}) => ...
export const getDbConnections = async () => ...
export const getDbConnection = async (id: string) => ...
export const updateDbConnection = async (id: string, updates: {...}) => ...
export const deleteDbConnection = async (id: string) => ...
export const testDbConnection = async (conn: {...}) => ...
export const getDbSchema = async (connectionId: string) => ...
export const executeDbQuery = async (connectionId: string, sql: string) => ...
```

---

## 7. Frontend Components

### `components/DatabasePanel.tsx` — Main Panel

**States / Views:**
1. **No connection selected** — Show connection list + "New Connection" button
2. **Connecting** — Show connection form (host, port, database, user, password, SSL toggle)
3. **Connected** — Split view: sidebar (schema browser) + main area (SQL editor + results)

**Connected view layout:**
```
┌─────────────────────────────────────────────────────┐
│ Top bar: connection name · database · disconnect btn │
├──────────┬──────────────────────────────────────────┤
│ Schema   │  SQL Editor (Monaco, language=sql)        │
│ Browser  │  ┌──────────────────────────────────────┐ │
│          │  │ SELECT * FROM users LIMIT 100;       │ │
│ ▸ public │  └──────────────────────────────────────┘ │
│   ▸ users│  [Run Query ▶]  [Limit: 1000]            │
│     - id │  Results (42 rows, 15ms)                  │
│     - name│ ┌────┬──────────┬───────┐               │
│   ▸ posts│ │ id │ name     │ email │               │
│     - id │ │ 1  │ Alice    │ a@... │               │
│     - ...│ │ 2  │ Bob      │ b@... │               │
│          │ └────┴──────────┴───────┘               │
├──────────┴──────────────────────────────────────────┤
│ Query History (collapsible)                          │
└─────────────────────────────────────────────────────┘
```

**Features:**
- Monaco SQL editor with syntax highlighting, autocomplete for known table/column names
- Schema browser: tree view of schemas → tables → columns (with type info)
- Click table → auto-generate `SELECT * FROM table LIMIT 100`
- Click column → copy column name to clipboard
- Results table: sortable headers, copy cell/row/table, export to CSV
- Query history: last 50 queries stored in localStorage, click to re-run
- Execution time display
- Error display with line highlighting
- Keyboard shortcut: Ctrl+Enter to run query

### `components/DatabaseConnectForm.tsx` — Connection Form
- Fields: Name, Host, Port (default 5432), Database, Username, Password, SSL toggle
- "Test Connection" button with loading/success/error state
- "Save & Connect" button
- Pre-fill from saved connection when editing

### `components/DatabaseSchemaBrowser.tsx` — Schema Tree
- Expandable tree: schemas → tables/views → columns
- Each column shows: name, data type, nullable, primary key indicator
- Context menu: "Query this table" → generates SELECT
- Refresh button to reload schema

### `components/DatabaseResultsTable.tsx` — Results Grid
- Virtualized table for large result sets
- Column headers with sort
- Row count + execution time
- Copy buttons (cell, row, all)
- Export to CSV
- NULL values shown in muted style
- JSON/JSONB columns pretty-printed on click

---

## 8. Sidebar Changes (`components/Sidebar.tsx`)

When `currentMode === 'database'`:
- Show "Database Explorer" header section
- List saved connections (click to connect)
- "New Connection" button
- Active connection: show schema quick-nav
- No conversation history (unlike chat/experiments)

Add database icon import from lucide-react.

---

## 9. File Summary — All Files to Create/Modify

### New files:
| File | Purpose |
|------|---------|
| `components/DatabasePanel.tsx` | Main database mode panel |
| `components/DatabaseConnectForm.tsx` | Connection form dialog |
| `components/DatabaseSchemaBrowser.tsx` | Schema tree component |
| `components/DatabaseResultsTable.tsx` | Query results table |
| `server/routes/database.ts` | Server API routes |

### Modified files:
| File | Changes |
|------|---------|
| `types.ts` | Add `Mode`, `DatabaseConnection`, `QueryResult`, `TableInfo`, `ColumnInfo` |
| `App.tsx` | Add database mode routing, auth state, sidebar props |
| `components/ModeSelector.tsx` | Add 4th card + password modal |
| `components/Sidebar.tsx` | Add database mode sidebar content |
| `server/db/schema.ts` | Add `database_connections` table |
| `server/index.ts` | Register `/api/database` routes |
| `services/apiDatabaseAdapter.ts` | Add database API functions |

---

## 10. Implementation Order

1. `types.ts` — Add interfaces and Mode union member
2. `server/db/schema.ts` — Add `database_connections` table
3. `server/routes/database.ts` — Create all API endpoints
4. `server/index.ts` — Register routes
5. `services/apiDatabaseAdapter.ts` — Add client API functions
6. `components/DatabaseConnectForm.tsx` — Connection form
7. `components/DatabaseSchemaBrowser.tsx` — Schema tree
8. `components/DatabaseResultsTable.tsx` — Results table
9. `components/DatabasePanel.tsx` — Main panel (composes above)
10. `components/ModeSelector.tsx` — Add database card + auth
11. `components/Sidebar.tsx` — Add database sidebar content
12. `App.tsx` — Wire everything together (routing, auth, props)

---

## 11. Security Considerations

- Connection passwords stored base64-encoded in PostgreSQL (acceptable for personal dev tool)
- SQL queries executed server-side only — no direct DB access from browser
- Optional read-only transaction mode to prevent accidental mutations
- Max row limit (1000) to prevent memory issues
- Connection pool cleanup after idle timeout (5 minutes)
- No connection string logging in server output
