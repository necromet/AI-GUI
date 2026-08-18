# Library Agent vs Skema Agent — AI SDK Implementation Comparison

## Overview

Both the Library Agent and Skema Agent share a **prompt-based tool calling architecture** rather than using the Vercel AI SDK's native `streamText()` with tool definitions. The Vercel AI SDK files (`server/lib/agent/tools/skemaTools.ts`, `server/lib/agent/prompts/skemaPrompt.ts`) exist on disk but are **not wired to the active routes**. AGENTS.md references `lib/agent/agent.ts`, `lib/agent/provider.ts`, and `lib/agent/tools/library.ts` — **none of these files exist**.

---

## Architecture at a Glance

| Aspect | Library Agent | Skema Agent |
|--------|--------------|-------------|
| **Entity** | Library component (DB-backed files) | Skema project board (in-memory files) |
| **Active backend route** | `server/routes/libraryAgent.ts` (~309 lines) | `server/routes/skemaAgent.ts` (~322 lines) |
| **Tool execution** | `executeLibraryTool()` in `server/services/agentService.ts` | `executeSkemaFileTool()` in `server/services/agentService.ts` |
| **Tool definitions** | `LIBRARY_AGENT_TOOLS` (10 tools) | `SKEMA_FILE_TOOLS` (9 tools) |
| **Session service** | `server/services/libraryService.ts` (shared with library CRUD) | `server/services/skemaAgentService.ts` (dedicated) |
| **Session routes** | `server/routes/library.ts` (mixed with library CRUD) | `server/routes/skemaAgent.ts` (self-contained) |
| **Frontend hook** | `components/library/agent/useAgentStream.ts` (389 lines) | `components/skema/agent/useSkemaAgentStream.ts` (387 lines) |
| **Session hook** | `components/library/agent/useAgentSessions.ts` (137 lines) | `components/skema/agent/useSkemaAgentSessions.ts` (138 lines) |
| **Sidebar** | `components/library/AgentSidebar.tsx` (165 lines) | `components/skema/SkemaAgentSidebar.tsx` (137 lines) |

---

## Backend: Agent Loop

Both agents implement the same multi-round loop (max 6 rounds backend, 10 frontend):

```
1. Build system prompt = base_prompt + context + tool_prompt + language_instruction
2. Call streamChatCompletion() (MiMo API via server/services/mimoService.ts)
3. Read SSE stream → forward content/reasoning chunks to client
4. Parse tool calls from full response text via parseToolCalls() (regex-based)
5. If no tool calls → break
6. For each tool call:
   a. Emit tool_call SSE event to client
   b. Execute tool (executeLibraryTool / executeSkemaFileTool)
   c. Emit tool_result SSE event to client
   d. Append tool result as user message
7. Loop back to step 2
8. Emit { done: true } + [DONE]
```

### Key Backend Difference: Tool Definitions

**Library Agent Tools** (`LIBRARY_AGENT_TOOLS`, `agentService.ts:1209`):

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `search_library` | `query`, `category?`, `topK?` | Search component library |
| `read_component` | `id?` | Read component by ID |
| `write_component_file` | `componentId`, `filename`, `content` | Write/update file |
| `delete_component_file` | `componentId`, `filename` | Delete file |
| `ask_user` | `question` | Ask clarifying question |
| `execute_code` | `code` | Run JS in sandbox |
| `create_todo_list` | `tasks` (JSON string) | Create agent plan |
| `verify_component` | `componentId` | Trigger preview render verification |
| `list_folders` | _(none)_ | List all library folders |
| `list_folder_contents` | `folderId` | List components in folder |

**Skema Agent Tools** (`SKEMA_FILE_TOOLS`, `agentService.ts:967`):

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `create_file` | `path`, `content` | Create new project file |
| `update_file` | `path`, `content` | Update existing file |
| `delete_file` | `path` | Delete project file |
| `read_file` | `path` | Read file content |
| `list_files` | _(none)_ | List all project files |
| `set_preview` | `path` | Set which file to preview |
| `search_library` | `query`, `category?` | Search skema component library |
| `ask_user` | `question` | Ask clarifying question |
| `create_todo_list` | `tasks` (JSON string) | Create agent plan |

### Tool Overlap

| Tool | Library | Skema |
|------|---------|-------|
| `search_library` | Yes | Yes |
| `ask_user` | Yes | Yes |
| `create_todo_list` | Yes | Yes |
| `execute_code` | Yes | No |
| `verify_component` | Yes (unique) | No |
| `list_folders` / `list_folder_contents` | Yes (unique) | No |
| `read_component` / `write_component_file` / `delete_component_file` | Yes | No |
| `create_file` / `update_file` / `delete_file` / `read_file` / `list_files` / `set_preview` | No | Yes (unique) |

---

## Backend: File Storage

| Aspect | Library Agent | Skema Agent |
|--------|--------------|-------------|
| **Storage** | PostgreSQL `library_component_files` table | In-memory `ProjectFile[]` array |
| **Mutations** | DB queries via `libraryService` | Array mutations, emitted via SSE events |
| **Persistence** | Immediate (DB writes) | Client-side (events trigger React state updates) |

---

## Backend: Session Management

### Database Schema

**Library Agent:**
```sql
CREATE TABLE library_agent_sessions (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES library_components(id) ON DELETE CASCADE,
  title TEXT,
  messages_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Skema Agent:**
```sql
CREATE TABLE skema_agent_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES skema_projects(id) ON DELETE CASCADE,
  board_idx INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  messages_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Key difference: Skema sessions are scoped to `project_id` + `board_idx` (per-board within a project).

### Session CRUD Routes

| Operation | Library | Skema |
|-----------|---------|-------|
| **Create** | `POST /api/library/agent/sessions` `{componentId}` | `POST /api/skema-agent/sessions` `{projectId, boardIdx}` |
| **List** | `GET /api/library/agent/sessions/:componentId` | `GET /api/skema-agent/sessions/:projectId?boardIdx=N` |
| **Get one** | `GET /api/library/agent/session/:id` | `GET /api/skema-agent/session/:id` |
| **Update** | `PUT /api/library/agent/sessions/:id` | `PUT /api/skema-agent/sessions/:id` |
| **Delete** | `DELETE /api/library/agent/sessions/:id` | `DELETE /api/skema-agent/sessions/:id` |
| **Max per entity** | 20 per component | 20 per project |
| **Eviction** | FIFO by `updated_at` per component | FIFO by `updated_at` per project |

---

## Frontend: SSE Streaming Hooks

`useAgentStream` (Library) and `useSkemaAgentStream` (Skema) are structurally near-identical (~387 lines each).

### Differences

| Aspect | Library | Skema |
|--------|---------|-------|
| **Endpoint** | `/api/library-agent/chat` | `/api/skema-agent/chat` |
| **Entity guard** | `!selectedComponent` prevents sending | No entity guard |
| **Request body** | `{ messages, model, provider, stream, componentId, systemPromptAppend }` | `{ messages, model, provider, stream, context, systemPromptAppend }` |
| **Context builder** | None (componentId sent directly) | `buildContext()` → `{ layout, projectTitle, model, provider, files }` |
| **Domain events** | `component_created`, `component_updated`, `verify_component` | `file_created`, `file_updated`, `file_deleted`, `preview_set` |
| **Verify flow** | Yes (listens for `agent-verify-result`, POSTs to `/api/library-agent/verify-result`) | No |

### SSE Event Protocol (shared)

```
data: {"content": "..."}           — streaming text chunk
data: {"reasoning": "..."}         — thinking/reasoning content
data: {"tool_call": {...}}         — tool invocation start
data: {"tool_result": {...}}       — tool result
data: {"ask_user": {"question"}}   — agent asks user a question
data: {"todo_list": [...]}         — agent plan/tasks
data: {"done": true}               — stream complete
data: [DONE]                       — SSE terminator
```

### Agent Loop (frontend, both agents)

1. Build server messages from conversation history
2. POST to backend, read SSE stream
3. Parse chunks, update message blocks in real-time using `flushSync` for tool calls
4. After stream ends: if tool calls were made AND no `done` AND no `ask_user`, append tool results to server messages and loop (300ms delay)
5. Max 10 rounds on frontend

---

## Frontend: Types

Both agents define identical `MessageBlock` and `AgentMessage` types independently:

```typescript
type MessageBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id?: string; name: string; arguments: Record<string, any>;
      result?: { output: string; error?: string }; collapsed?: boolean; progress?: string }
  | { type: 'ask_user'; question: string }
  | { type: 'agent_plan'; tasks: AgentTask[] };

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isThinking?: boolean;
  blocks?: MessageBlock[];
}
```

Sidebar props differ in entity context:

| Field | Library `AgentSidebarProps` | Skema `SkemaAgentSidebarProps` |
|-------|---------------------------|-------------------------------|
| Entity | `selectedComponent: LibraryComponent \| null` | `project: SkemaProject` + `activeBoardIdx: number` |
| HTML context | N/A | `currentHtml: string` |
| Files context | N/A | `currentFiles?: ProjectFile[]` |
| Undo/Redo | `onUndoAgent`, `onRedoAgent`, `canUndoAgent`, `canRedoAgent` | Not present |
| File events | `onComponentUpdated`, `onComponentsReload` | `onFileCreated`, `onFileUpdated`, `onFileDeleted`, `onPreviewSet` |

---

## Frontend: Session Hooks

`useAgentSessions` and `useSkemaAgentSessions` are structurally identical (~137 lines each).

| Aspect | Library | Skema |
|--------|---------|-------|
| **Entity key** | `selectedComponent?.id` | `project?.id` + `activeBoardIdx` |
| **Load deps** | `[selectedComponent?.id, setMessages]` | `[project?.id, activeBoardIdx, setMessages]` |
| **API base** | `/api/library/agent/` | `/api/skema-agent/` |
| **Create body** | `{ componentId }` | `{ projectId, boardIdx }` |
| **List query** | `/sessions/${componentId}` | `/sessions/${projectId}?boardIdx=${activeBoardIdx}` |
| **Auto-save** | After streaming ends | Same |
| **Auto-title** | First 50 chars of first user message | Same |

---

## Shared Components

| Component | Location | Used By |
|-----------|----------|---------|
| `AgentSidebarShell` | `components/shared/AgentSidebarShell.tsx` | Both agents |
| `MessageBubble`, `EmptyState`, `ToolCallBlock`, `AgentPlanBlock`, `AskUserBlock`, `TextBlock` | `components/library/agent/MessageBlocks.tsx` | Both |
| `AgentMarkdown` | `components/library/agent/AgentMarkdown.tsx` | Both |
| `ModelPicker` | `components/library/agent/ModelPicker.tsx` | Both |
| `parseToolCalls()` | `server/services/agentService.ts` | Both backends |
| `streamChatCompletion()` | `server/services/mimoService.ts` | Both backends |
| `detectLanguage()` / `buildLanguageInstruction()` | `server/services/mimoService.ts` | Both backends |

---

## Unused Vercel AI SDK Files

The following files exist on disk but are **not wired to any active route**:

| File | Status |
|------|--------|
| `server/lib/agent/tools/skemaTools.ts` | Defines 8 tools using Vercel AI SDK `tool()` + Zod schemas. **Not imported by `server/routes/skemaAgent.ts`.** |
| `server/lib/agent/prompts/skemaPrompt.ts` | Builds rich system prompt with canvas/IG/HTML modes. **Not imported by `server/routes/skemaAgent.ts`.** |
| `lib/agent/agent.ts` | **Does not exist.** Referenced in AGENTS.md but absent from disk. |
| `lib/agent/provider.ts` | **Does not exist.** Referenced in AGENTS.md but absent from disk. |
| `lib/agent/tools/library.ts` | **Does not exist.** Referenced in AGENTS.md but absent from disk. |

---

## UI Differences

| Aspect | Library Agent | Skema Agent |
|--------|--------------|-------------|
| **Sidebar icon** | `BookOpen` | `Sparkles` |
| **Sidebar title** | "Librarian" + category badge | "Skema Agent" |
| **Input placeholder** | `Ask about ${component.name}...` | `Ask about your design...` |
| **Streaming bar** | Hidden | Shown |
| **Collapse button** | Hidden | Shown |
| **Verify workflow** | Yes (renders preview, checks for errors) | No |
| **Undo/Redo** | Yes (sidebar props) | No |

---

## Summary

Both agents are fundamentally **prompt-based agents** that embed tool descriptions in the system prompt, parse tool calls from LLM text output via regex, execute tools server-side, and feed results back as user messages in a multi-round loop. The Vercel AI SDK is installed as a dependency but its agent primitives (`streamText` with tool definitions) are not used by either active agent route. The primary differences are in the **tool sets** (library CRUD vs file CRUD), **file storage** (DB vs in-memory), **session scoping** (component vs project+board), and **UI affordances** (verify workflow, undo/redo, streaming bar).
