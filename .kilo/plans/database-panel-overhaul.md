# Database Panel: SQL Editor Fix + UI Enhancement + Bug Fixes

## Bugs & Loopholes Found

### Critical Security Issues
1. **SQL Injection via raw query execution** (`server/routes/database.ts:295`) — The query endpoint executes raw user-supplied SQL directly. While this is inherent to a SQL tool, there's no guard against destructive commands (DROP, TRUNCATE, DELETE without WHERE). No confirmation step, no read-only mode option.

2. **Password "encryption" is just base64** (`server/routes/database.ts:7-8`) — `encodePassword`/`decodePassword` use `Buffer.from().toString('base64')`. This is encoding, not encryption. If the app database is compromised, all saved passwords are trivially readable.

3. **No statement timeout on external queries** (`server/routes/database.ts:295`) — `config.pool.query(sql)` has no timeout. A long-running query (e.g., `SELECT pg_sleep(3600)`) will block the connection indefinitely.

4. **`maxRows` truncation is client-side only** (`server/routes/database.ts:300-303`) — The server fetches ALL rows from the database, then slices to `limit` in memory. A `SELECT *` on a 10M-row table will OOM the server before truncation kicks in.

### Functional Bugs
5. **Monaco placeholder never renders** — `DatabasePanel.tsx:382` passes `placeholder` to `CodeEditor`, but Monaco's `Editor` component ignores the `placeholder` option. It's not a built-in Monaco feature.

6. **Global Ctrl+Enter handler fires everywhere** — `DatabasePanel.tsx:190-193` attaches `keydown` listener to `window`. This fires even when the user is typing in the connection form, search inputs, or other panels. Should be scoped to the editor.

7. **No way to cancel a running query** — Once `isExecuting` is true, the only escape is waiting. No AbortController, no timeout, no cancel button.

8. **`rowCount` is misleading for mutations** — `server/routes/database.ts:310` returns `result.rowCount` which is 0 for SELECT queries (it's the number of rows affected, not returned). The frontend displays this as "0 rows" even when results exist.

9. **Connection edit doesn't work** — `DatabasePanel.tsx:53` has `editConnection` state but it's never set to a non-null value. The edit button on connections doesn't exist.

10. **`handleConnect` always creates new** — Even when `editConnection` is set, `handleConnect` calls `db.saveDbConnection` (POST) instead of `db.updateDbConnection` (PUT). Old connection becomes orphaned.

11. **History panel hides editor** — When `showHistory` is true, the Monaco editor is completely unmounted (`DatabasePanel.tsx:334-384`). Any unsaved SQL in the editor is lost when toggling history.

12. **Schema browser has no search** — With hundreds of tables, finding a specific one requires manual scrolling through the entire tree.

13. **No null/empty cell distinction in results** — `CellValue` treats null and empty string differently, but there's no visual separator or tooltip to quickly distinguish them at a glance.

14. **`columns.length === 0` returns null** — `DatabaseResultsTable.tsx:112` — If a DDL/DML query succeeds with no result columns (e.g., INSERT, UPDATE), the component returns nothing. No success feedback is shown.

15. **Connection pool never cleaned on disconnect** — `handleDisconnect` (`DatabasePanel.tsx:131-137`) clears state but doesn't tell the server to close the pool. The server pool stays open until idle timeout.

### UI/UX Issues
16. **Rigid editor/results split** — `DatabasePanel.tsx:296` hardcodes `height: queryResult ? '45%' : '100%'`. No way to resize the split.

17. **Schema panel is fixed 240px** — `DatabasePanel.tsx:282` — Not resizable, either too narrow for long names or wastes space when not needed.

18. **No SQL autocompletion** — Monaco is configured with basic `suggest` but no SQL-specific completion provider for table/column names from the schema.

19. **No query formatting** — No way to format/beautify a SQL query.

20. **No result pagination** — All rows are loaded at once. For large results, this causes browser lag.

21. **Copy cell requires click** — No keyboard shortcut or right-click context menu for copying.

22. **No connection status indicator** — No way to know if a saved connection is still reachable without manually testing.

23. **No keyboard shortcuts documentation** — Only Ctrl+Enter is shown, but there's no help panel or shortcut reference.

---

## Plan

### 1. Fix Critical Security Issues

#### 1a. Add query timeout (`server/routes/database.ts`)
- Add `statement_timeout` to pool config (30s default).
- Add a `timeout` field to the query request body.
- Use `pg`'s built-in timeout support: `pool.query({ text: sql, timeout })`.

#### 1b. Add destructive query detection (`server/routes/database.ts`)
- Before executing, scan SQL for destructive keywords: `DROP`, `TRUNCATE`, `DELETE`, `ALTER`, `UPDATE` without WHERE, `CREATE OR REPLACE`.
- If detected, return a `{ needsConfirmation: true, warning: "..." }` response instead of executing.
- Frontend shows a confirmation dialog before re-sending with `force: true`.

#### 1c. Improve password storage (`server/routes/database.ts`)
- Replace base64 with AES-256-GCM encryption using a server-side key from env var `DB_ENCRYPTION_KEY`.
- If no key is set, fall back to base64 with a console warning.
- Migration: re-encrypt existing passwords on first startup.

#### 1d. Server-side row limiting (`server/routes/database.ts`)
- Parse SQL to inject `LIMIT` clause if none exists (regex check for `LIMIT \d+`).
- Cap at `MAX_ROWS` (1000) regardless of what the user specifies.
- Return `truncated: true` flag when results were capped.

### 2. Fix Monaco Editor

#### 2a. Remove broken placeholder, add proper empty state
- Remove the `placeholder` prop from `CodeEditor` (Monaco doesn't support it natively).
- Add an overlay element positioned absolutely over the editor that shows placeholder text when `!value && !editor.hasTextFocus()`.
- Hide overlay on editor focus, show on blur if empty.

#### 2b. Add SQL autocompletion
- Register a Monaco `CompletionItemProvider` for SQL language after schema loads.
- Provide completions for:
  - Table names (from `schema.tables`)
  - Column names (from selected/all tables)
  - SQL keywords (SELECT, FROM, WHERE, JOIN, etc.)
  - Common functions (COUNT, SUM, NOW(), etc.)
- Register via `monaco.languages.registerCompletionItemProvider('sql', { ... })`.

#### 2c. Custom dark theme matching app
- Define a Monaco theme using the app's CSS variables (`--bg-100`, `--neon-color`, etc.).
- Use `monaco.editor.defineTheme('edward-dark', { ... })`.
- Set neon color for keywords, green for strings, blue for numbers.

#### 2d. Scope keyboard handler to editor
- Remove `window.addEventListener('keydown', handleKeyDown)`.
- Instead, use Monaco's `addAction` or `addCommand` API on the editor instance:
  ```ts
  editor.addAction({
    id: 'execute-query',
    label: 'Execute Query',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: () => executeQuery()
  });
  ```

### 3. Enhance SQL Editor UI

#### 3a. Add SQL toolbar
- Replace the minimal toolbar (`DatabasePanel.tsx:297-332`) with a richer one:
  - Format SQL button (using a lightweight formatter like `sql-formatter`)
  - Clear editor button
  - Word wrap toggle
  - Font size controls
  - Current connection indicator with green dot
  - Query execution time from last run

#### 3b. Add resizable editor/results split
- Replace fixed `45%` height with a draggable splitter.
- Use a thin horizontal divider bar (6px) with cursor `row-resize`.
- Persist split ratio in localStorage.

#### 3c. Add resizable schema panel
- Replace fixed `240px` width with a draggable splitter.
- Persist width in localStorage.

#### 3d. Add query history as overlay, not replacement
- Instead of replacing the editor content, show history as a slide-in panel or dropdown overlay.
- Keep the current SQL intact when browsing history.
- Add a "Copy to editor" action per history entry.

### 4. Enhance Results Table

#### 4a. Add virtual scrolling for large results
- Use a windowed/virtualized table approach for results with 500+ rows.
- Only render visible rows + buffer.
- Use `@tanstack/react-virtual` or manual implementation with fixed row height.

#### 4b. Add column resize
- Make column headers draggable to resize.
- Persist column widths in state.

#### 4c. Add result pagination
- Show "Page 1 of N" with prev/next buttons.
- Default page size: 100 rows.
- Server-side pagination support (OFFSET/LIMIT injection).

#### 4d. Enhance cell value display
- Add type-aware formatting:
  - Numbers: right-aligned, formatted with commas
  - Dates: relative time tooltip
  - JSON: syntax-highlighted in tooltip/expandable
  - Boolean: colored badge (true/false)
  - Null: distinct gray italic with "null" label
  - Empty string: show `""` explicitly
  - Long text: truncate with ellipsis, expand on click

#### 4e. Add row selection and bulk copy
- Click to select row, shift+click for range.
- Selected rows highlighted with neon tint.
- "Copy selected" button.

#### 4f. Show success feedback for DML
- When `columns.length === 0` but no error, show a success banner: "Query executed successfully. N rows affected."

### 5. Enhance Schema Browser

#### 5a. Add schema search
- Add a search input at the top of the schema panel.
- Filter tables and columns in real-time.
- Highlight matching text.

#### 5b. Add table row count estimate
- Query `pg_stat_user_tables` for `n_live_tup` estimates.
- Show as a small badge next to table name.

#### 5c. Add FK relationship indicators
- Show foreign key icons on columns that reference other tables.
- On hover, show the referenced table.column.

#### 5d. Add quick actions per table
- Right-click or hover menu with:
  - SELECT * LIMIT 100
  - COUNT(*)
  - INSERT template
  - Table structure (DESCRIBE equivalent)
  - Copy table name

### 6. Enhance Connection Management

#### 6a. Add connection edit functionality
- Wire up `editConnection` state properly.
- Add edit button on connection cards.
- Use `updateDbConnection` when editing.

#### 6b. Add connection status check
- On load, ping each saved connection with a lightweight query.
- Show status indicator (green dot = reachable, red = unreachable, gray = unchecked).

#### 6c. Add disconnect cleanup
- On disconnect, call a new API endpoint to release the pool.
- Add `DELETE /api/database/connections/:id/pool` endpoint.

#### 6d. Add delete confirmation
- Replace direct delete with a confirmation dialog.

### 7. Add Keyboard Shortcuts & Help

#### 7a. Add shortcuts panel
- Add a `?` or keyboard icon button that shows a shortcuts reference:
  - `Ctrl+Enter` — Execute query
  - `Ctrl+Shift+F` — Format SQL
  - `Ctrl+Z` — Undo
  - `Ctrl+Shift+Z` — Redo
  - `Ctrl+/` — Toggle comment
  - `Ctrl+D` — Select next occurrence
  - `Escape` — Cancel execution / Close panels

#### 7b. Add cancel execution
- Add AbortController support to query execution.
- Show a "Cancel" button next to "Run" while executing.
- Add timeout (60s default) that auto-cancels.

### 8. Visual Polish

#### 8a. Add entrance animations
- Use `animate-fade-in` on panel mount.
- Stagger connection card animations.

#### 8b. Add loading skeletons
- Show skeleton placeholders while schema loads.
- Show skeleton rows while query executes.

#### 8c. Add query execution animation
- Pulse the "Run" button border while executing.
- Show a subtle progress indicator at the top of the results area.

#### 8d. Add empty state illustrations
- No connections: Database icon with "Connect to your first database" message.
- No results: "Execute a query to see results" with a subtle illustration.
- No schema: "Schema not loaded" with refresh prompt.

---

## Implementation Order

1. **Phase 1: Critical fixes** — Security issues (1a-1d), editor bugs (2a, 2d), functional bugs (6-15)
2. **Phase 2: Editor enhancement** — SQL completion (2b), custom theme (2c), toolbar (3a)
3. **Phase 3: Layout** — Resizable splits (3b, 3c), history overlay (3d)
4. **Phase 4: Results table** — Virtual scrolling (4a), column resize (4b), cell formatting (4d), DML feedback (4f)
5. **Phase 5: Schema browser** — Search (5a), row counts (5b), FK indicators (5c), quick actions (5d)
6. **Phase 6: Connection management** — Edit (6a), status check (6b), cleanup (6c), delete confirm (6d)
7. **Phase 7: Polish** — Animations (8a-8d), shortcuts help (7a), cancel execution (7b)

## Files to Modify

| File | Changes |
|------|---------|
| `server/routes/database.ts` | Timeout, encryption, destructive detection, row limiting, pool cleanup endpoint |
| `components/DatabasePanel.tsx` | Full rework: toolbar, resizable splits, history overlay, keyboard scoping, cancel, animations |
| `components/DatabaseConnectForm.tsx` | Edit mode support, connection status |
| `components/DatabaseSchemaBrowser.tsx` | Search, row counts, FK indicators, quick actions |
| `components/DatabaseResultsTable.tsx` | Virtual scrolling, column resize, cell formatting, pagination, DML feedback |
| `services/apiDatabaseAdapter.ts` | AbortController, timeout support, pool cleanup |
| `types.ts` | New types if needed (e.g., ConnectionStatus) |
