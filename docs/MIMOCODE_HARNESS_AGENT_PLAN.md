# MiMoCode-Harness Agent for Agent Builder

## Problem

Agent Builder agents today are thin LLM wrappers:

| Surface | Behavior | Gap |
|---------|----------|-----|
| Agent chat (`POST /api/agent-builder/chat`) | Single SSE completion; tool calls are **faked** (`"Tool X executed with args"`) | No real tools, no multi-round loop |
| Workflow Agent node (`server/services/workflowExecutors/agent.ts`) | Real tool loop (max 10) with native `tool_calls` | Only 3 built-ins (`web_browse`, `execute_code`, `search_web`) + MCP |
| Library / Skema agents | Richer tools via `agentService` | Domain-specific, not reusable as a general harness |

None of them share MiMoCode’s harness: native tool calling, workspace file tools, skills, persistent memory, task tree, permission gates, plan/build modes, or subagents.

**Goal:** Give Agent Builder agents a MiMo-powered agent harness with the same architecture and capability set as MiMoCode (OpenCode-lineage), shared by the agent chat surface and the workflow Agent node.

---

## Current State (what we build on)

| Asset | Location | Reuse |
|-------|----------|-------|
| Native tool loop (non-stream) | `server/services/workflowExecutors/agent.ts` | Pattern for `tools` + `tool_calls` against MiMo |
| SSE multi-round loop | `server/lib/agentRunner.ts` | Event emitter, disconnect handling, maxRounds |
| Prompt tool format | `server/lib/formatToolPrompt.ts` + `parseToolCalls()` | Keep as **fallback** when native tools are unavailable |
| Web / code tools | `server/services/tools/{webTools,codeTools,htmlTools}.ts` | Port into harness tool set |
| MCP executor | `server/services/workflowExecutors/mcp.ts` | Expose as harness `mcp_call` tool |
| Agent CRUD + sessions | `server/routes/agentBuilder.ts`, `agent_builder_*` tables | Persist harness config |
| Approval gate (workflow) | `components/agent-builder/hooks/useApprovalWatch.ts` | Model for permission `ask` |
| OpenCode sidecar | `server/services/opencodeSidecar.ts` | **Not used** — we port harness *architecture*, not the CLI |

MiMo already supports OpenAI-compatible `tools` / `tool_calls` (see `callLLM` in `workflowExecutors/agent.ts` and `streamChatCompletion` in `mimoService.ts`). The harness should use that as the primary protocol.

---

## Target Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Harness Runner (SSE)        │
                    │  loop · steps · doom-loop · usage    │
                    └──────────────┬──────────────────────┘
                                   │
     ┌────────────┬────────────────┼────────────────┬─────────────┐
     ▼            ▼                ▼                ▼             ▼
 Prompt       Tool           Permission        Memory         Task Tree
 Assembler    Registry       Gate              (MEMORY.md)    (T1…)
     │            │                │                │             │
     │     ┌──────┴──────┐         │                │             │
     │     ▼             ▼         │                │             │
     │  Built-in      Custom /     │                │             │
     │  tools         agent tools  │                │             │
     │  (FS/shell/    + MCP        │                │             │
     │   web/skill)                │                │             │
     ▼                             ▼                ▼             ▼
 system = soul + env + skills + agent prompt + tool docs
```

### MiMoCode capability → harness mapping

| MiMoCode | Harness module | Notes |
|----------|----------------|-------|
| `read` / `write` / `edit` | `tools/fsTools.ts` | Workspace-rooted; path escapes denied |
| `bash` / `shell` | `tools/shellTool.ts` | Workspace cwd; timeout; permission `ask` by default |
| `glob` / `grep` | `tools/searchTools.ts` | Workspace-only |
| `webfetch` / `websearch` | reuse `webTools.ts` | Rename aliases in prompt docs |
| `skill` + skill discovery | `skills.ts` + `tools/skillTool.ts` | `SKILL.md` under `.mimocode/skills/` or `/skills` |
| `recall` / memory | `memory.ts` + `tools/memoryTool.ts` | `MEMORY.md` + `notes.md` in workspace |
| `task` (subagents) | `subagents.ts` | Phase 3 — `explore` (read-only) / `general` |
| `todowrite` / task tree | `tasks.ts` + `tools/taskTool.ts` | T1 / T1.1 tree in session state |
| `question` | `tools/questionTool.ts` | SSE `question` event → UI prompt |
| Permission rules | `permissions.ts` | `allow` / `deny` / `ask` + glob patterns |
| Agent modes | `types.ts` `HarnessMode` | `build` (full) / `plan` (read-only) |
| System prompt layers | `promptAssembler.ts` | soul + env + skills + agent + tools |
| Doom-loop / step cap | `runner.ts` | Same-tool ×3 → ask/stop; `maxSteps` config |

### Protocol choice: native `tool_calls` first

1. **Primary:** MiMo OpenAI-compatible `tools` + `message.tool_calls` (already used in `workflowExecutors/agent.ts`).
2. **Fallback:** fenced ` ```tool ` blocks + `parseToolCalls()` when a provider lacks native tools (DeepSeek edge cases, mocks).
3. Results return as proper `role: 'tool'` messages when native; as user-tagged messages in fallback.

Do **not** keep fake tool execution in Agent Builder chat — every `tool_call` must hit the registry.

---

## Workspace Model

Each agent session gets a sandboxed root:

```
data/agent-workspaces/<agentId>/<sessionId>/
  MEMORY.md              # durable project memory
  notes.md               # free-form scratch
  .mimocode/skills/      # optional custom skills (SKILL.md folders)
  ...user/agent files
```

Rules:
- All FS tools resolve paths under the root (`path.resolve` + prefix check). Outside → denied.
- `bash` runs with `cwd` = root; block obvious escapes is best-effort (document; do not claim container isolation).
- Workspace id in every Harness event so the UI can show file paths.
- Cleanup policy: leave workspaces on disk; add a later “clear workspace” action (out of scope for v1).

---

## System Prompt Assembly

```
system =
  [soul]            # tone, hard rules (no secrets dump, no destructive ops without ask)
+ [environment]     # platform, workspace root, date, mode (build|plan), git n/a
+ [skills index]    # "Skills available: name — description (load via skill tool)"
+ [agent prompt]    # agent_builder_agents.system_prompt
+ [tool docs]       # names, JSON schemas, permission hints
+ [language]        # reuse existing language detection helper
```

Keep the existing stitch/HTML prompts out of this harness — they stay on Skema/Library tools.

---

## Database Changes

Append to `SCHEMA_SQL` in `server/db/schema.ts` (runs `IF NOT EXISTS` on startup):

```sql
-- Harness config on agents
ALTER TABLE agent_builder_agents ADD COLUMN IF NOT EXISTS harness_mode TEXT NOT NULL DEFAULT 'build';
ALTER TABLE agent_builder_agents ADD COLUMN IF NOT EXISTS harness_config JSONB NOT NULL DEFAULT '{}';
-- harness_config: { maxSteps, tools: {name: enabled}, permissions: [...], memoryEnabled, skillsEnabled, subagentsEnabled }

-- Task tree per session (optional denormalized state)
CREATE TABLE IF NOT EXISTS agent_builder_tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES agent_builder_sessions(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES agent_builder_tasks(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',   -- open|in_progress|done|blocked|abandoned
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Prefer **ALTER … ADD COLUMN IF NOT EXISTS** (Postgres 9.6+) or plain `ADD COLUMN` guarded by a try/catch in schema init if you want zero-risk on existing DBs — match whatever `schema.ts` already does for other upgrades.

Sessions already store `messages_json`; harness tool traces go in message parts (same shape as Library agent tool blocks).

---

## File-by-File Plan

### Phase 1 — Harness core (native loop + FS/search tools)

| # | File | Action | Scope |
|---|------|--------|-------|
| 1.1 | `server/lib/harness/types.ts` | **Create** | `HarnessTool`, `ToolContext`, `HarnessMode`, `HarnessEvent`, `PermissionRule`, `HarnessConfig` |
| 1.2 | `server/lib/harness/permissions.ts` | **Create** | `evaluate(rules, tool, path?) → allow\|deny\|ask`; default rules |
| 1.3 | `server/lib/harness/workspace.ts` | **Create** | resolve root, safe join, ensure dir, list |
| 1.4 | `server/lib/harness/tools/fsTools.ts` | **Create** | `read`, `write`, `edit` (exact string replace), `glob`, `grep` |
| 1.5 | `server/lib/harness/tools/shellTool.ts` | **Create** | `bash` with timeout + cwd |
| 1.6 | `server/lib/harness/tools/webTools.ts` | **Create** | thin wrappers over existing `server/services/tools/webTools.ts` |
| 1.7 | `server/lib/harness/toolRegistry.ts` | **Create** | register, filter by mode/permissions, JSON schemas for LLM |
| 1.8 | `server/lib/harness/promptAssembler.ts` | **Create** | layered system prompt |
| 1.9 | `server/lib/harness/runner.ts` | **Create** | native tool loop + SSE events + step cap + doom-loop + usage |
| 1.10 | `server/lib/harness/index.ts` | **Create** | public `runHarness()` / `buildHarnessSystemPrompt()` |

**Runner event contract (SSE `data:` JSON):**

```ts
type HarnessEvent =
  | { type: 'content'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | { type: 'tool_result'; id: string; name: string; output: string; error?: string }
  | { type: 'permission_request'; id: string; tool: string; args: unknown }
  | { type: 'task_update'; tasks: TaskNode[] }
  | { type: 'question'; id: string; question: string; options?: string[] }
  | { type: 'done'; output: string; usage?: Usage }
  | { type: 'error'; message: string };
```

### Phase 2 — Skills, memory, tasks

| # | File | Action | Scope |
|---|------|--------|-------|
| 2.1 | `server/lib/harness/skills.ts` | **Create** | discover `SKILL.md` under workspace + optional global `/skills`; parse frontmatter name/description |
| 2.2 | `server/lib/harness/tools/skillTool.ts` | **Create** | `skill` (load body into context), `skill_search` (name + simple BM25/substring) |
| 2.3 | `server/lib/harness/memory.ts` | **Create** | read/append `MEMORY.md`, `notes.md` |
| 2.4 | `server/lib/harness/tools/memoryTool.ts` | **Create** | `memory` (search/append) |
| 2.5 | `server/lib/harness/tools/taskTool.ts` | **Create** | create/start/done/block task tree nodes |
| 2.6 | `server/lib/harness/tasks.ts` | **Create** | in-memory + optional `agent_builder_tasks` persist |
| 2.7 | `server/lib/harness/promptAssembler.ts` | **Edit** | inject skill index + memory summary + task dump |

### Phase 3 — Permissions UI hooks, plan mode, subagents

| # | File | Action | Scope |
|---|------|--------|-------|
| 3.1 | `server/lib/harness/tools/questionTool.ts` | **Create** | pause loop, emit `question`, resume on reply |
| 3.2 | `server/lib/harness/subagents.ts` | **Create** | nested runner; `explore` = read-only tool set; `general` = full minus subagent spawn |
| 3.3 | `server/lib/harness/runner.ts` | **Edit** | honor `ask` (pause → client event); `plan` mode tool filter |
| 3.4 | `server/routes/agentBuilder.ts` | **Edit** | `POST /chat` runs harness; `POST /chat/reply` (or body `replyTo`) for question/permission answers |

### Phase 4 — Frontend (see “Frontend Architecture” below)

| # | File | Action | Scope |
|---|------|--------|-------|
| 4.1 | `components/harness/*` (stream hook, types, blocks) | **Create** | shared harness chat runtime — see Frontend Architecture |
| 4.2 | `components/agent-builder/HarnessPanel.tsx` | **Create** | agent chat + tools + memory + tasks sidecar UI |
| 4.3 | `components/agent-builder/nodes/AgentNodeConfig.tsx` | **Edit** | Harness section: mode, tools, permissions, maxSteps |
| 4.4 | `components/agent-builder/HarnessToolToggles.tsx` | **Create** | tool on/off cards + capability tags (fs / web / shell) |
| 4.5 | `components/agent-builder/HarnessPermissionEditor.tsx` | **Create** | rules table: tool + path glob → allow/deny/ask |
| 4.6 | `components/agent-builder/ExecutionPanel.tsx` | **Edit** | live tool trace for workflow Agent nodes |
| 4.7 | `types.ts` + `lib/agentConfig.ts` | **Edit** | `HarnessConfig` / `HarnessEvent` shared FE/BE |

### Phase 5 — Workflow Agent node integration

| # | File | Action | Scope |
|---|------|--------|-------|
| 5.1 | `server/services/workflowExecutors/agent.ts` | **Edit** | opt-in `harness: true` → call harness runner (non-SSE) with workflow `state` as memoryContext |
| 5.2 | `components/agent-builder/constants.ts` | **Edit** | Agent defaults: `harness: false` until stable, then default true for new nodes |
| 5.3 | `components/agent-builder/nodes/AgentNodeConfig.tsx` | **Edit** | expose harness tools when enabled |

### Phase 6 — Hardening

| # | File | Action | Scope |
|---|------|--------|-------|
| 6.1 | `server/lib/harness/runner.ts` | **Edit** | doom-loop (identical tool_call ×3 → stop/ask), tool output truncation to context budget |
| 6.2 | `server/lib/harness/context.ts` | **Create** | optional compact: summarize old turns when message count > N |
| 6.3 | `tests/agent-builder/harness.test.ts` | **Create** | registry filter, path safety, permission eval, prompt assembly, mock tool loop |
| 6.4 | Docs | **Edit** | AGENTS.md short section: “Harness agents” |

---

## Default Tool Set (v1)

| Tool | Mode `build` | Mode `plan` | Permission default |
|------|:---:|:---:|-----|
| `read` | ✓ | ✓ | allow |
| `glob` | ✓ | ✓ | allow |
| `grep` | ✓ | ✓ | allow |
| `write` | ✓ | — | ask |
| `edit` | ✓ | — | ask |
| `bash` | ✓ | — | ask |
| `webfetch` | ✓ | ✓ | allow |
| `websearch` | ✓ | ✓ | allow |
| `skill` | ✓ | ✓ | allow |
| `skill_search` | ✓ | ✓ | allow |
| `memory` | ✓ | ✓ | allow |
| `task` (tree) | ✓ | ✓ | allow |
| `question` | ✓ | ✓ | allow |
| `mcp_call` (if MCP tools linked) | ✓ | — | ask |
| `subagent` | opt-in | — | ask |

Custom `agent_builder_tools` (name + schema + optional JS implementation) register beside built-ins.

---

## Agent Config Shape

```ts
// shared by server/lib/harness/types.ts and components/agent-builder
export interface HarnessConfig {
  mode: 'build' | 'plan';
  maxSteps: number;            // default 20
  memoryEnabled: boolean;
  skillsEnabled: boolean;
  subagentsEnabled: boolean;
  tools: Record<string, boolean>; // tool name → enabled
  permissions: PermissionRule[];  // { tool: string; pattern?: string; action: 'allow'|'deny'|'ask' }
}

// agent_builder_agents.harness_config
```

---

## Streaming / Chat Route Rewrite (Phase 3 detail)

Replace the fake tool block in `POST /api/agent-builder/chat`:

1. Load agent + linked tools → `HarnessConfig`.
2. Ensure workspace for `(agentId, sessionId)`.
3. `runHarness({ system, messages, tools, workspace, mode, onEvent })`.
4. Pipe `HarnessEvent`s as SSE (same outer shape as today: `{ content }`, `{ tool_call }`, `{ done }` — extend with new types).
5. Persist assistant + tool parts into `agent_builder_sessions.messages_json`.
6. For `question` / `permission_request`, end the HTTP stream with a pending id; client posts `POST /api/agent-builder/chat/resume` with the answer and continues the same session message list.

Keep `runAgentLoop()` for Library/Skema until they migrate (out of scope).

---

## Frontend Architecture

The backend harness is useless without a chat surface that can show **live tool traces**, **ask/permission gates**, **task tree**, and **workspace files**. Existing UI already covers half of this — we extract and extend rather than rebuild.

### What already exists (reuse, don’t fork)

| Asset | Location | Use for harness |
|-------|----------|-----------------|
| Collapsible tool cards | `components/library/agent/MessageBlocks.tsx` (`ToolCallBlock`) | Model for `HarnessToolBlock` — status shimmer, icon map, collapse |
| Task / plan card | `components/ui/agent-plan.tsx` (`AgentPlan`, `AgentTask`) | Task tree block (T1 / T1.1) |
| Ask-user card | `MessageBlocks.tsx` (`AskUserBlock`) | `question` + `permission_request` cards |
| Message list shell | `components/shared/AgentSidebarShell.tsx` + `MessageBubble` / `EmptyState` | Agent Builder harness sidebar |
| Markdown | `components/library/agent/AgentMarkdown.tsx` | Assistant text |
| SSE multi-round client | `components/library/agent/useAgentStream.ts` | Pattern for `useHarnessStream` (events → blocks) |
| Session CRUD client | `components/library/agent/useAgentSessions.ts` | Pattern for harness sessions |
| Themed form kit | `components/agent-builder/shared/*` | Config panels (`ThemedSelect`, `ThemedSwitch`, …) |
| Basic tool results | `components/AgentChatPanel.tsx` | Plugin chat — **replace** with harness blocks when backend lands |

**Principle:** Promote shared pieces into `components/harness/` (or `components/shared/harness/`) so Agent Builder, and later Library/Skema, render the same blocks. Do not copy `MessageBlocks.tsx` a third time.

### Frontend layer map

```
components/harness/
  types.ts                 # MessageBlock union ↔ HarnessEvent
  useHarnessStream.ts      # SSE client, resume pending ask/question
  useHarnessSessions.ts    # load/save agent_builder_sessions
  HarnessMessageList.tsx   # maps blocks → renderers
  blocks/
    TextBlock.tsx          # AgentMarkdown
    ToolBlock.tsx          # from ToolCallBlock (fs/shell/web icons)
    TaskTreeBlock.tsx      # AgentPlan wrapper
    QuestionBlock.tsx      # ask_user style + options
    PermissionBlock.tsx    # allow once / allow always / deny
    ErrorBlock.tsx
  config/
    HarnessToolToggles.tsx
    HarnessPermissionEditor.tsx
    HarnessModeSwitch.tsx
  workspace/
    WorkspaceFileTree.tsx  # list workspace root (GET harness/files)
    WorkspaceFilePreview.tsx
```

Agent Builder then composes thin panels around these.

### Client event → block model

```ts
// components/harness/types.ts (mirror of server HarnessEvent)
type MessageBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown;
      status: 'running' | 'done' | 'error';
      output?: string; error?: string; collapsed?: boolean }
  | { type: 'task_tree'; tasks: AgentTask[] }
  | { type: 'question'; id: string; question: string; options?: string[]; answered?: string }
  | { type: 'permission'; id: string; tool: string; args: unknown;
      pattern?: string; decision?: 'allow' | 'allow_always' | 'deny' }
  | { type: 'error'; message: string };
```

`useHarnessStream` folds SSE frames into `AgentMessage[]` with `blocks: MessageBlock[]` — same shape Library/Skema already use.

### Interaction flows

**1. Streaming chat**

```
User types → POST /api/agent-builder/chat
  ← content frames   → append to text block
  ← tool_call        → push ToolBlock (running)
  ← tool_result      → attach output / error, status done
  ← task_update      → replace TaskTreeBlock
  ← question         → QuestionBlock (input disabled until answered)
  ← permission_request → PermissionBlock (stream pauses)
  ← done | error     → finalize message
```

**2. Permission / question resume** (new)

When the server emits `permission_request` or `question`, it stops streaming and leaves `pendingId` on the session. UI buttons call:

```http
POST /api/agent-builder/chat/resume
{ sessionId, messageId, pendingId, decision: 'allow'|'allow_always'|'deny', answer?: string }
```

Client continues the same message thread (no new user bubble for the decision — the PermissionBlock itself updates).

**3. Tool config** (agent editor + workflow node)

- Tool toggle cards: icon, name, short description, capability chip (`fs` / `shell` / `web` / `meta`), mode badge (`build only` vs `build+plan`).
- Disabled tools are omitted from the registry (not just hidden in UI).
- Permission editor rows: tool name (select) + optional path glob + action select. Defaults pre-filled from the default tool table.

**4. Workspace panel** (right rail or drawer in Agent Builder chat)

- File tree of `data/agent-workspaces/<agent>/<session>/`.
- Click file → `GET /api/agent-builder/harness/files?path=…` preview (text / code / markdown).
- Badge for `MEMORY.md` / `notes.md` / `.mimocode/skills/`.
- Refresh on `tool_result` where `name` is `write` / `edit` / `bash`.

### Agent Builder surfaces that change

| Surface | Today | With harness |
|---------|-------|--------------|
| Agent detail chat | basic stream (or plugin `AgentChatPanel`) | `HarnessMessageList` + stream hook + ask/permission UI |
| `AgentNodeConfig` | model + prompts + MCP picker | + Harness section (mode, tools, permissions, maxSteps, memory/skills toggles) |
| `ExecutionPanel` | node status | live tool list per Agent node run (tool name + status + expand output) |
| `WorkflowHeaderBar` / sidebar | workflow tools | optional “Workspace” entry when a harness agent is on the canvas |
| `AgentBuilderSettingsModal` | app defaults | default harness preset (which tools on, default permissions) |

### Stream hook sketch

```ts
// components/harness/useHarnessStream.ts
export function useHarnessStream(sessionId: string | null) {
  // send(message), resume(pendingId, answer), stop()
  // state: messages: AgentMessage[], isStreaming, pending: Permission|Question|undefined
  // maps HarnessEvent → block updates (same fold logic as useAgentStream)
}
```

Differences vs `useAgentStream`:
- Handles `permission_request` / `question` as **pause + resume** (Library `ask_user` currently just embeds text).
- Tracks `task_update` into a live tree, not only a one-shot plan block.
- Optional `onFileMutated` to refresh the workspace tree.

### Shared types (`types.ts` / `lib/agentConfig.ts`)

```ts
// types.ts (or lib/harnessTypes.ts shared FE/BE)
export type PermissionAction = 'allow' | 'deny' | 'ask';
export interface PermissionRule {
  tool: string;          // tool name or glob e.g. "fs.*" / "*"
  pattern?: string;      // path glob for fs/shell tools
  action: PermissionAction;
}
export interface HarnessConfig { /* as above */ }
```

Put these in `lib/harnessTypes.ts` (imported by both `components/` and `server/lib/harness/`) so the config editor and runner cannot drift.

### Phase 4 file list (frontend)

| # | File | Action | Scope |
|---|------|--------|-------|
| 4.1 | `lib/harnessTypes.ts` | **Create** | shared `HarnessConfig`, `PermissionRule`, `HarnessEvent`, `MessageBlock` |
| 4.2 | `components/harness/types.ts` | **Create** | FE-only block/message types re-exporting shared |
| 4.3 | `components/harness/useHarnessStream.ts` | **Create** | SSE fold + resume + abort |
| 4.4 | `components/harness/useHarnessSessions.ts` | **Create** | session list/load/save via `/api/agent-builder/sessions` |
| 4.5 | `components/harness/blocks/*` | **Create** | Text, Tool, TaskTree, Question, Permission, Error |
| 4.6 | `components/harness/HarnessMessageList.tsx` | **Create** | list + scroll + collapse state |
| 4.7 | `components/harness/config/*` | **Create** | tool toggles, permission editor, mode switch |
| 4.8 | `components/harness/workspace/*` | **Create** | file tree + preview drawer |
| 4.9 | `components/agent-builder/HarnessPanel.tsx` | **Create** | Agent Builder chat composition (list + input + rails) |
| 4.10 | `components/agent-builder/nodes/AgentNodeConfig.tsx` | **Edit** | embed harness config controls |
| 4.11 | `components/agent-builder/ExecutionPanel.tsx` | **Edit** | tool trace rows for harness runs |
| 4.12 | `components/agent-builder/AgentBuilderSettingsModal.tsx` | **Edit** | default harness preset |
| 4.13 | `components/AgentChatPanel.tsx` | **Edit** | optional: switch plugin chat to harness blocks when backend flag is on |

Extract `ToolCallBlock` / `AgentPlan` / `AskUserBlock` imports into `components/harness/blocks/` wrappers first so Library keeps working unchanged.

### Frontend verification

```bash
npm run build
```

Manual golden path (after Phase 3 routes):

1. Open Agent Builder → agent with harness on → chat “List files, then create `notes/hello.md`”.
2. See ToolBlock `glob`/`read` then `write` with running → done shimmer.
3. Click Workspace rail → file appears.
4. Trigger a denied/ask path (e.g. `bash` with default ask) → PermissionBlock → Allow once → stream continues.
5. `question` tool → QuestionBlock options → resume.
6. Workflow canvas: Agent node with harness → Run → ExecutionPanel shows tool trace rows.
7. Reload page → session restores blocks (tool outputs collapsed).

---

## Dependency Matrix

```
Phase 1 types/workspace/permissions
   └─ tools (fs/shell/web)
        └─ registry + promptAssembler
             └─ runner
                  ├─ Phase 2 skills/memory/tasks
                  ├─ Phase 3 ask/plan/subagents + chat route
                  └─ Phase 5 workflow agent opt-in
Phase 4 UI can start after Phase 1 event contract is stable
Phase 6 anytime after Phase 1
```

---

## Testing & Verification

No lint/typecheck scripts exist. Verification baseline:

```bash
npm run build
npm run test:agent-builder
npx tsx tests/agent-builder/harness.test.ts   # once added
```

Harness unit tests (mock LLM + mock tools — no external MiMo calls):

1. Path safety rejects `../../etc/passwd`.
2. `plan` mode excludes `write`/`bash` from registry.
3. Permission `ask` emits `permission_request` and blocks execute until resume.
4. Doom-loop stops after 3 identical tool calls.
5. Prompt assembler includes skill names and agent system_prompt.
6. Native tool_calls path and ```tool``` fallback both dispatch the same registry.

Manual (dev server + Postgres):

1. Create agent with harness mode `build`, enable `write` + `read`.
2. Chat: “Create hello.txt with hi” → observe tool_call/tool_result, file appears under `data/agent-workspaces/...`.
3. Switch to `plan` → write refused / hidden.
4. Drop a `SKILL.md` in `.mimocode/skills/` → `skill_search` finds it.
5. Workflow with Agent node `harness: true` returns toolCalls in node output.

---

## Out of Scope (v1)

- Git snapshots / revert / diff parts
- LSP / diagnostics / notebook tools
- Full context compaction (only a simple truncate + optional summary stub)
- Migrating Library/Skema agents onto the harness
- Running the real `mimo` CLI as a sidecar (OpenCode-style)
- Container/VM isolation for `bash`
- Billing/cost UI beyond token usage fields

---

## File Manifest (summary)

| Path | Status | Phase |
|------|--------|-------|
| `server/lib/harness/types.ts` | Create | 1 |
| `server/lib/harness/permissions.ts` | Create | 1 |
| `server/lib/harness/workspace.ts` | Create | 1 |
| `server/lib/harness/toolRegistry.ts` | Create | 1 |
| `server/lib/harness/promptAssembler.ts` | Create | 1–2 |
| `server/lib/harness/runner.ts` | Create | 1–3, 6 |
| `server/lib/harness/index.ts` | Create | 1 |
| `server/lib/harness/tools/*.ts` | Create | 1–3 |
| `server/lib/harness/skills.ts` | Create | 2 |
| `server/lib/harness/memory.ts` | Create | 2 |
| `server/lib/harness/tasks.ts` | Create | 2 |
| `server/lib/harness/subagents.ts` | Create | 3 |
| `server/lib/harness/context.ts` | Create | 6 |
| `server/db/schema.ts` | Edit | 2 |
| `server/routes/agentBuilder.ts` | Edit | 3 |
| `server/services/workflowExecutors/agent.ts` | Edit | 5 |
| `lib/harnessTypes.ts` | Create | 4 |
| `components/harness/**` (stream, blocks, config, workspace) | Create | 4 |
| `components/agent-builder/HarnessPanel.tsx` | Create | 4 |
| `components/agent-builder/nodes/AgentNodeConfig.tsx` | Edit | 4–5 |
| `components/agent-builder/HarnessToolToggles.tsx` | Create | 4 |
| `components/agent-builder/HarnessPermissionEditor.tsx` | Create | 4 |
| `components/agent-builder/ExecutionPanel.tsx` | Edit | 4 |
| `components/agent-builder/AgentBuilderSettingsModal.tsx` | Edit | 4 |
| `components/AgentChatPanel.tsx` | Edit | 4 |
| `types.ts` / `lib/agentConfig.ts` | Edit | 4 |
| `components/agent-builder/constants.ts` | Edit | 5 |
| `tests/agent-builder/harness.test.ts` | Create | 6 |
| `AGENTS.md` | Edit | 6 |

---

## Implementation Order (suggested commits)

1. **Harness skeleton** — types, workspace, permissions, registry, empty runner + tests for path/permission.
2. **FS + shell + web tools** — real execution against workspace.
3. **Native MiMo tool loop** — `runHarness` wired to `mimoService` / existing `callLLM` pattern; replace fake tools in `POST /agent-builder/chat`.
4. **Skills + memory + task tool**.
5. **UI** — tool toggles, event rendering, permission/ask flow.
6. **Workflow Agent opt-in** + hardening (doom-loop, truncation).
