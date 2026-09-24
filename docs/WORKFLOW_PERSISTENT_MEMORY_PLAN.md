# Persistent Workflow Chat History & Chat Memory

## Problem

Today, `chatHistory` lives only in the LangGraph in-memory state during a single workflow execution. When the execution ends, it's gone. The `chat-memory` source in the Database node reads past execution `variables` — an indirect, lossy approach with no dedicated store.

**Goal:** Persist chat history and chat memory in PostgreSQL, scoped by `workflow_id`, so they survive across executions and are queryable by the Database node.

---

## Current State

| Concern | Today | Problem |
|---------|-------|---------|
| Chat history | `state.chatHistory` in LangGraph state | Ephemeral — lost when execution ends |
| Chat memory | Reads past `executions.variables` | No dedicated store; conflates workflow variables with memory |
| Database node reads | `state.chatHistory` (in-memory) / `executions.variables` (indirect) | No real persistence layer |

---

## Design

### Two New PostgreSQL Tables

```sql
-- Persistent chat history per workflow
CREATE TABLE IF NOT EXISTS workflow_chat_history (
  id            TEXT PRIMARY KEY,
  workflow_id   TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  execution_id  TEXT,
  thread_id     TEXT,
  role          TEXT NOT NULL,          -- 'user' | 'assistant' | 'system'
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wch_workflow
  ON workflow_chat_history(workflow_id, created_at);

-- Persistent key-value chat memory per workflow
CREATE TABLE IF NOT EXISTS workflow_chat_memory (
  id            TEXT PRIMARY KEY,
  workflow_id   TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  memory_key    TEXT NOT NULL,
  memory_value  TEXT NOT NULL,          -- JSON-encoded value
  execution_id  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workflow_id, memory_key)       -- upsert semantics
);
CREATE INDEX IF NOT EXISTS idx_wcm_workflow
  ON workflow_chat_memory(workflow_id, memory_key);
```

**Design decisions:**
- Both tables cascade-delete with their workflow.
- `workflow_chat_history` is append-only (immutable log).
- `workflow_chat_memory` uses `UNIQUE(workflow_id, memory_key)` for upsert — one current value per key.
- `execution_id` is nullable metadata (helps trace which run produced an entry) but queries filter by `workflow_id`.

---

## File-by-File Changes

### 1. `server/db/schema.ts` — Add table DDL

Append the two `CREATE TABLE` statements + indexes to `SCHEMA_SQL`, before the closing backtick. No migration system needed — `SCHEMA_SQL` runs `CREATE TABLE IF NOT EXISTS` on every startup.

### 2. `server/db/workflowMemory.ts` — **New file** (DB access layer)

```ts
// Chat History
export async function saveChatMessages(
  workflowId: string,
  executionId: string | null,
  threadId: string | null,
  messages: Array<{ role: string; content: string }>
): Promise<void>

export async function getChatHistory(
  workflowId: string,
  opts?: { limit?: number; roleFilter?: 'all' | 'user' | 'assistant' }
): Promise<Array<{ role: string; content: string; created_at: string }>>

export async function clearChatHistory(workflowId: string): Promise<void>

// Chat Memory
export async function saveMemory(
  workflowId: string,
  key: string,
  value: any,
  executionId?: string | null
): Promise<void>   // UPSERT on (workflow_id, memory_key)

export async function saveMemoryBulk(
  workflowId: string,
  entries: Array<{ key: string; value: any }>,
  executionId?: string | null
): Promise<void>

export async function getMemory(
  workflowId: string,
  key?: string            // omit to get all
): Promise<Array<{ key: string; value: any; updatedAt: string }>>

export async function deleteMemory(workflowId: string, key: string): Promise<void>
export async function clearMemory(workflowId: string): Promise<void>
```

Uses `pool` from `server/db/pg.ts` (same pattern as `server/db/workflows.ts`).

### 3. `server/services/workflowExecutor.ts` — Persist chat history on the fly

**Changes:**

a) Add `workflowId` to `ExecutorOptions`:

```ts
export interface ExecutorOptions {
  // ...existing...
  workflowId?: string;   // NEW
}
```

b) In `createNodeExecutor`, after a node completes and `chatHistoryUpdates` are collected, persist them:

```ts
// Inside the return block of createNodeExecutor, after building `chatHistory`:
const historyUpdates = output?.chatHistoryUpdates || output?.__chatHistoryUpdates || [];
if (historyUpdates.length > 0 && this.options.workflowId) {
  // fire-and-forget — don't block the graph on persistence
  void persistChatHistory(this.options.workflowId, this.options.executionId, this.options.threadId, historyUpdates);
}
```

c) Add a private helper (or import from `workflowMemory.ts`):

```ts
import { saveChatMessages } from '../db/workflowMemory.js';

private async persistChatHistory(...) { ... }
```

d) Pass `workflowId` through to `executeDatabaseNode` context:

```ts
case 'database': return executeDatabaseNode(node.data, state, {
  executionId: this.options.executionId,
  threadId: this.options.threadId,
  workflowId: this.options.workflowId,   // NEW
  llmKeys: keys,
});
```

### 4. `server/services/workflowExecutors/database.ts` — Read from persistent store

**Changes to `getChatHistory`:**

Replace the in-memory-only read with a persistent read + in-memory merge:

```ts
async function getChatHistory(data, state, context) {
  const { limit = 20, roleFilter = 'all', outputFormat = 'messages' } = data;

  // 1. Fetch persistent history from DB (if workflowId available)
  let persistent: Array<{ role: string; content: string }> = [];
  if (context.workflowId) {
    const memory = await import('../../db/workflowMemory.js');
    persistent = await memory.getChatHistory(context.workflowId, { limit, roleFilter });
  }

  // 2. Merge with current execution's in-memory history (dedupe by content+role)
  const inMemory = state.chatHistory || [];
  const merged = dedupeMessages([...persistent, ...inMemory]);

  // 3. Apply limit + format (same as before)
  const limited = merged.slice(-limit);
  // ...format as messages/transcript...
}
```

**Changes to `getChatMemory`:**

Replace the "read past execution variables" approach with the dedicated memory table:

```ts
async function getChatMemory(data, state, context) {
  const memoryKey = data.memoryKey ? substituteVariables(data.memoryKey, state) : '';
  const limit = data.limit || 20;

  if (!context.workflowId) {
    return { error: 'Workflow ID required for chat memory' };
  }

  const memory = await import('../../db/workflowMemory.js');
  const entries = await memory.getMemory(context.workflowId, memoryKey || undefined);
  return { memory: entries.slice(-limit), count: entries.length, source: 'workflow_chat_memory' };
}
```

**Add `writeMemory` mode** (see §6 below for config changes).

### 5. `server/routes/workflowExecution.ts` — Pass `workflowId` to executor

In both `/:id/execute` and `/:id/execute-stream` (and `/:id/resume`), add `workflowId` to the executor options:

```ts
const executor = new WorkflowExecutor(checked.nodes, checked.edges, {
  executionId,
  threadId,
  workflowId: workflow.id,        // NEW
  llmKeys: await getApiKeys(),
  // ...
});
```

### 6. Database Node — Write mode for Chat Memory

The Database node currently only reads. Add a `mode` field so it can also write to `workflow_chat_memory`.

**`components/agent-builder/nodes/DatabaseNodeConfig.tsx` changes:**

Add a "Mode" selector (Read / Write) when `sourceType === 'chat-memory'`:

| Field | Read mode | Write mode |
|-------|-----------|------------|
| `memoryKey` | Filter by key (optional) | Key to write (required) |
| `memoryValue` | — | Value to store (supports `{{var}}`) |
| `limit` | Max entries to return | — |

Defaults: `{ mode: 'read' }`.

**`server/services/workflowExecutors/database.ts` changes:**

```ts
if (sourceType === 'chat-memory') {
  const mode = data.mode || 'read';
  if (mode === 'write') {
    const key = substituteVariables(data.memoryKey, state);
    const rawValue = substituteVariables(data.memoryValue ?? '', state);
    // try JSON.parse, fall back to string
    const value = tryParseJson(rawValue);
    await saveMemory(context.workflowId, key, value, context.executionId);
    return { saved: true, key, value };
  }
  return getChatMemory(data, state, context);
}
```

### 7. `components/agent-builder/CustomNode.tsx` — Preview updates

Update the `database` preview to reflect mode and persistent source:

```
read  + chat-history → "Chat history · last N"
read  + chat-memory  → "Memory · key" or "Memory · all"
read  + documents    → "Docs · top N"
write + chat-memory  → "Save memory · key"
```

Update `isConfigured` for `database`:
- `chat-memory` + `write` mode → require `memoryKey`
- `chat-memory` + `read` mode → always configured
- `chat-history` → always configured
- `documents` → require `query`

### 8. `server/db/workflows.ts` — Add convenience getter

Add `getWorkflowIdForExecution(executionId)` so the database executor can resolve `workflow_id` when only `executionId` is available (e.g., single-node tests via `workflowNodes.ts`):

```ts
export async function getWorkflowIdForExecution(executionId: string): Promise<string | null> {
  const exec = await getOne('SELECT workflow_id FROM executions WHERE id = $1', [executionId]);
  return exec?.workflow_id ?? null;
}
```

---

## Data Flow Summary

### Chat History (automatic persistence)

```
Agent node produces chatHistoryUpdates
        │
        ▼
workflowExecutor.createNodeExecutor()
        │
        ├─► state.chatHistory += updates     (in-memory, current run)
        └─► saveChatMessages(workflowId, ...)  (PostgreSQL, permanent)
        
Database node (chat-history source)
        │
        ├─► getChatHistory(workflowId) from DB    (past runs)
        └─► merge with state.chatHistory          (current run)
        └─► apply limit + format → output
```

### Chat Memory (explicit read/write)

```
Database node (chat-memory + write mode)
        │
        └─► saveMemory(workflowId, key, value)  → UPSERT workflow_chat_memory

Database node (chat-memory + read mode)
        │
        └─► getMemory(workflowId, key?)         → workflow_chat_memory rows
        └─► output { memory: [...], count }
```

---

## Edge Cases & Decisions

| Case | Decision |
|------|----------|
| `workflowId` not available (single-node test) | Fall back to in-memory `state.chatHistory` / `state.variables` — same as current behavior |
| Duplicate messages (DB + in-memory merge) | Dedupe by `(role, content)` pair before limiting |
| Memory value type | Store as JSON text; `tryParseJson` on read so strings stay strings, objects stay objects |
| Clearing history/memory | Add `clearChatHistory(workflowId)` / `clearMemory(workflowId)` helpers; expose later via REST if needed (out of scope for this plan) |
| Performance | `saveChatMessages` is fire-and-forget (`void promise`) so it never blocks graph execution |
| CASCADE delete | Deleting a workflow removes all its history and memory |

---

## Files Touched (Summary)

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `server/db/schema.ts` | Edit | Add 2 table DDLs + indexes |
| 2 | `server/db/workflowMemory.ts` | **Create** | DB access layer for history + memory |
| 3 | `server/db/workflows.ts` | Edit | Add `getWorkflowIdForExecution` |
| 4 | `server/services/workflowExecutor.ts` | Edit | Add `workflowId` option; persist `chatHistoryUpdates` |
| 5 | `server/services/workflowExecutors/database.ts` | Edit | Read from persistent store; add write mode |
| 6 | `server/routes/workflowExecution.ts` | Edit | Pass `workflowId` to executor (3 call sites) |
| 7 | `components/agent-builder/nodes/DatabaseNodeConfig.tsx` | Edit | Add mode selector + memory value field |
| 8 | `components/agent-builder/CustomNode.tsx` | Edit | Preview + isConfigured for write mode |
| 9 | `components/agent-builder/constants.ts` | Edit | Add `mode: 'read'` to database defaults |

---

## Verification

1. `npm run build` — must pass
2. `npx tsx tests/agent-builder/graph.test.ts` — all 10 tests must pass
3. Manual test: create a workflow with Agent → Database (chat-history, read) → End; run twice; second run should include first run's messages
4. Manual test: Database (chat-memory, write, key=`user_name`, value=`{{input.name}}`) → Database (chat-memory, read, key=`user_name`); verify value round-trips
