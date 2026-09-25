# Agent Builder — Interactive Edges and Data Node Separation Plan

## Summary

Improve the Agent Builder canvas and replace the overloaded Database / Document node with explicit, opt-in data capabilities:

- Make every connection line easy to click and manage.
- Remove the True/False quick-add `+` buttons from If/Else nodes.
- Split Chat History and Chat Memory into independent workflow node types.
- Restrict Database / Document to PostgreSQL queries and document retrieval.
- Reuse encrypted Database Explorer connections so credentials never enter workflow JSON.
- Prevent history, memory, and database access from being enabled implicitly.

PostgreSQL is the only external database supported in this iteration, matching the existing Database Explorer backend.

## 1. Interactive Canvas Connections

### Edge rendering and selection

- Add a custom `InteractiveWorkflowEdge` React Flow edge and register it in `WorkflowCanvas` through `edgeTypes`.
- Render each connection with two paths:
  - the existing visible path;
  - an invisible 18px-wide interaction path using `stroke="transparent"` and `pointerEvents="stroke"`.
- Normalize loaded, imported, and newly created edges to `type: "interactive"` so old workflows gain the behavior automatically without a stored-data migration.
- Clicking an edge must stop canvas propagation, select that edge, and open an edge popover anchored at the pointer.
- Expand the existing edge-label popover to show:
  - source node → target node;
  - editable label;
  - branch name for conditional handles;
  - Delete connection action.
- Selected edges receive a theme-aware accent stroke and remain keyboard-deletable with Delete/Backspace when focus is not in a form field.
- Clicking the canvas clears edge selection. Clicking a node replaces edge selection with node selection.
- Keep edge-label changes and deletion in the existing undo/redo snapshot history.
- Add accessible keyboard focus, Enter/Space activation, and a visible focus state for the edge label/control. The wide hit target must also work on touch devices.

### Remove quick-add controls

- Remove both `+` buttons from the If/Else node while retaining the True and False output handles and labels.
- Remove the `ab-branch-quick-add` event listener, branch-specific canvas-context state, and any now-unused quick-add code.
- Remove the unused `EdgeAddButton` component if no remaining caller exists.
- Users continue creating conditional connections by dragging from the True or False handle.

## 2. Separate Chat History and Chat Memory Nodes

### New node contracts

Add `chat-history` and `chat-memory` to the shared/frontend node-type unions, definitions, palette, colors, icons, validation, executor dispatch, preview, templates, import/export, and node settings registry.

#### Chat History node

Configuration:

- Operation: `read` or `append`; default is unset so the node is visibly unconfigured when first added.
- Scope: `conversation` or `workflow`; default `conversation`.
- Read fields: maximum messages (default 20, maximum 200), role filter (`all`, `user`, `assistant`), and output format (`messages`, `transcript`).
- Append fields: role (`user` or `assistant`) and content supporting `{{variable}}` pills.
- Output includes messages/content, count, and scope metadata.

#### Chat Memory node

Configuration:

- Operation: `get`, `set`, or `delete`; default is unset.
- Scope: `conversation` or `workflow`; default `conversation`.
- Key supports `{{variable}}` and is required for all operations.
- Set value supports `{{variable}}`, with value type `string`, `number`, `boolean`, or `json`.
- Get output includes the resolved key, value, existence flag, and scope.
- Delete removes only the resolved key; bulk-clear is intentionally excluded from workflow execution.

### Make persistence fully opt-in

- Remove automatic `saveChatMessages()` calls from Agent node execution.
- Stop forcing `includeChatHistory: true` in shared workflow chat. Agent nodes must respect their saved setting.
- Do not add Chat History or Chat Memory nodes automatically to new workflows or templates.
- Client-side shared-chat history may still be sent as ephemeral request context, but it is consumed only when the workflow explicitly enables it; it must not be written to PostgreSQL automatically.

### Conversation isolation and schema migration

- Add a stable `conversation_id`/scope column to workflow history and memory storage.
- Shared chat generates one opaque conversation ID per local chat session and sends it with every request.
- Builder test runs use the execution ID as their conversation scope unless an explicit conversation ID is supplied.
- Update history reads/writes and memory reads/writes to require `(workflow_id, scope_type, scope_id)`.
- Replace the memory uniqueness constraint with `(workflow_id, scope_type, scope_id, memory_key)`.
- Backfill existing rows under a `legacy` workflow scope. New conversation-scoped reads must never fall back to legacy/global records.
- Workflow-scoped persistence remains available only when the node explicitly selects `workflow`, with a UI warning that all executions share the data.

### Existing workflow compatibility

During graph normalization, migrate legacy Database nodes in memory:

- `sourceType: "chat-history"` → `type/nodeType: "chat-history"` with equivalent read settings.
- `sourceType: "chat-memory"` → `type/nodeType: "chat-memory"` with equivalent read/write settings.
- `sourceType: "documents"` → remain `database`, with `dataSource: "documents"`.

Autosave writes the normalized representation after load. Migration must be idempotent and preserve IDs, positions, labels, edges, and variable references.

## 3. Database / Document Node Redesign

### Data-source selection

- Rename the card description to “Query PostgreSQL or retrieve uploaded documents.”
- Replace `sourceType` with `dataSource: "postgres" | "documents" | ""`.
- Default `dataSource` to an empty value. The node remains invalid until the user explicitly selects PostgreSQL or Documents.
- Remove all Chat History and Chat Memory controls and executor branches from this node.

### PostgreSQL mode

#### Connection inputs

- Reuse `database_connections` and the existing AES-256-GCM password encryption.
- The node panel provides:
  - saved connection picker;
  - “Add connection” inline dialog containing name, host, port, database, username, password, and SSL;
  - Test Connection action;
  - Save & Use action.
- Credentials are submitted directly to `/api/database/connections`; workflow node data stores only `connectionId` and a non-sensitive display name.
- Passwords are never returned by APIs, included in workflow JSON, copied during workflow duplication, exposed to variables, logs, execution snapshots, or shared-chat responses.
- Imported workflows with an unknown connection ID are marked unconfigured and require the owner to select or create a connection.

#### Query inputs

- SQL editor: required, multiline, read-only SQL, with variable-pill highlighting.
- Variable values are parameterized rather than interpolated into SQL text:
  - each `{{variable}}` token outside comments/quoted strings is replaced server-side with a PostgreSQL positional parameter;
  - resolved values are passed separately to `pg`;
  - repeated tokens reuse the same parameter;
  - unresolved tokens fail validation before connecting.
- Dynamic table, schema, column, or SQL-keyword substitution is not supported because PostgreSQL cannot parameterize identifiers safely.
- Additional fields:
  - maximum rows: default 100, range 1–1000;
  - timeout: default 30 seconds, range 1–30 seconds;
  - output format: `rows`, `first-row`, `scalar`, or `json`;
  - include column metadata: default true.
- Execution output contains selected data, columns when enabled, row count, truncation flag, and execution time. It never contains connection details.

#### Query safety

- Extract connection encryption, pool lookup, timeout, and query execution from `server/routes/database.ts` into a shared server service used by both Database Explorer and workflow execution.
- Permit one read-only PostgreSQL statement only. Validate with `pgsql-ast-parser` and execute inside a read-only transaction; do not rely solely on the current first-keyword regex.
- Reject mutation/DDL, multiple statements, data-modifying CTEs, `COPY`, unsafe `SET`, transaction control, and unresolved templates.
- Apply server-side row and timeout caps regardless of node configuration.
- Roll back on failure, release the client in `finally`, and return sanitized errors without credentials or connection strings.
- Recommend a read-only database account in the UI. Shared-chat publishing is blocked for workflows containing PostgreSQL nodes unless the owner explicitly enables “Allow this database query in shared chat” on that node.

### Documents mode

Inputs:

- Document selector populated from the existing RAG document list; empty selection means all documents.
- Search query with `{{variable}}` pills; required.
- Top K: default 5, range 1–20.
- Minimum similarity score: default 0, range 0–1.
- Output format: `combined-text` or `chunks`.
- Include metadata toggle: default true.

Runtime changes:

- Extend document retrieval to accept optional document IDs and minimum score.
- Return similarity score, document ID/name, chunk positions, and text when metadata is enabled.
- Return a valid empty result when no document matches; do not silently fall back to unrestricted retrieval.
- Deleted document IDs produce a validation warning and are ignored until the owner updates the node.

## 4. Validation, Security, and Affected Flows

- Extend workflow validation with node-specific errors for unset operations/source, missing connection, empty SQL/query/key/value, invalid limits, unresolved variables, and deleted resources.
- Redact secret-shaped fields from execution logs and snapshots as a defense in depth measure.
- Ensure workflow export/import and templates contain connection references only. Never export credential payloads.
- Duplicating a workflow preserves connection references but does not duplicate credentials.
- Deleting a Database Explorer connection invalidates referencing workflow nodes and closes its cached pool.
- Database and workflow APIs remain protected by Agent Builder/Database mode authentication; public shared-chat execution receives only the fixed saved query and parameter values.
- Update CustomNode summaries:
  - Chat History: operation, scope, and limit;
  - Chat Memory: operation, scope, and key;
  - PostgreSQL: connection display name and output format, never SQL/credentials;
  - Documents: selected-document count and Top K.
- Update command palette, sidebar categories, onboarding, template validation, Mermaid/export output, auto-layout sizing, and any hard-coded node-type lists.
- Remove obsolete legacy branches only after normalization and migration tests are in place.

## 5. Implementation Sequence

1. Add the custom interactive edge and remove If/Else quick-add behavior.
2. Add new node types, definitions, panels, validation rules, and legacy graph normalization.
3. Add conversation-scoped history/memory schema and dedicated executors; remove implicit persistence/history forcing.
4. Extract the shared PostgreSQL connection/query service and implement PostgreSQL node mode.
5. Extend RAG retrieval and implement Documents node mode.
6. Update shared-chat restrictions, import/export/templates, summaries, and documentation.
7. Run migrations, automated tests, production build, and manual interaction/security checks.

## 6. Test and Acceptance Plan

### Canvas

- Thin, animated, branch, overlapping, selected, and touch-target edges are clickable across zoom levels.
- Edge click opens the correct editor; label edit/delete participate in undo/redo.
- Canvas/node clicks clear edge state correctly.
- If/Else nodes have no `+` controls, while both branch handles still connect normally.

### Migration and opt-in behavior

- Legacy Database history/memory/document nodes normalize to the correct new type without losing edges or settings.
- New workflows contain no implicit history/memory configuration.
- Agent execution does not write history automatically.
- Shared chat does not force history or persist it unless explicit nodes do so.
- Two conversations using the same workflow cannot read each other’s conversation-scoped history or memory.
- Workflow-scoped memory is shared only when deliberately selected.

### PostgreSQL

- Create/test/select encrypted connections; verify workflow JSON and API responses never contain passwords.
- Execute parameterized variables for string, number, boolean, null, and JSON values.
- Reject unresolved tokens, dynamic identifiers, multi-statements, writes, DDL, data-changing CTEs, and timeout/row-limit bypass attempts.
- Verify rows, first-row, scalar, JSON, truncation, timeout, and empty-result outputs.
- Missing/deleted connections fail validation with an actionable message.
- Shared-chat publishing is blocked until database exposure is explicitly enabled.

### Documents

- Retrieve across all documents or selected documents, enforce Top K/minimum score, and return requested metadata format.
- Missing/deleted selections and no-match results behave predictably.

### Verification

- Add unit tests for edge state, graph migration, scoped memory/history, SQL token parameterization, SQL safety, output formatting, validation, and redaction.
- Add route/integration tests for encrypted connection reuse and query execution using a test PostgreSQL database when available.
- Run `npm run test:agent-builder` and `npm run build`.

## Assumptions

- “Links” means React Flow connection edges between nodes; clicking opens connection management rather than navigating to another page.
- Database support is PostgreSQL-only for this release.
- Workflow database queries are read-only by design.
- Manual credentials are entered in the node workflow, but saved through the encrypted Database Explorer connection store; credentials are never embedded in node data.
- History and memory are opt-in nodes with conversation scope by default, while shared workflow-wide scope requires an explicit choice.
