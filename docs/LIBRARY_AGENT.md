# Library Agent — Architecture & Internals

## Table of Contents

- [Overview](#overview)
- [Architecture Diagram](#architecture-diagram)
- [Database Schema](#database-schema)
- [Backend](#backend)
  - [Provider Adapter](#provider-adapter)
  - [System Prompt](#system-prompt)
  - [Tool Definitions](#tool-definitions)
  - [Agent Chat Endpoint](#agent-chat-endpoint)
  - [SSE Event Types](#sse-event-types)
  - [CRUD Routes](#crud-routes)
- [Vercel AI SDK Integration](#vercel-ai-sdk-integration)
- [Frontend](#frontend)
  - [Agent Sidebar](#agent-sidebar)
  - [Multi-Round Agent Loop](#multi-round-agent-loop)
  - [Session Management](#session-management)
  - [Component Editor & Verify Flow](#component-editor--verify-flow)
  - [Message Rendering](#message-rendering)
  - [Agent Configuration](#agent-configuration)
- [Embedding & Search](#embedding--search)
- [TSX Compilation](#tsx-compilation)
- [End-to-End Data Flow Example](#end-to-end-data-flow-example)

---

## Overview

The Library Agent is an AI-powered assistant embedded in the Library mode of the application. It uses the **Vercel AI SDK** (`ai` package) with an OpenAI-compatible provider adapter to connect to MiMo, DeepSeek, or other LLM backends. The agent can search, read, create, and modify library components through a set of 10 structured tools, operating in a multi-round tool-execution loop with SSE streaming to the frontend.

Key characteristics:

- **Vercel AI SDK** handles the tool execution loop internally (`maxSteps: 6` per round)
- **Frontend multi-round loop** — up to 10 rounds of request→tool-execution→response cycles
- **SSE streaming** — text, tool calls, tool results, and special events streamed in real-time
- **Sandboxed verification** — agent can trigger live preview in an iframe and receive error feedback
- **Session persistence** — chat history stored in SQLite per component (max 3 sessions, max 20 total per component with FIFO eviction)
- **Vector search** — components are embedded via OpenAI `text-embedding-3-small` (or TF-IDF fallback) for semantic search

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React 19 + Vite)                                     │
│                                                                 │
│  App.tsx                                                        │
│   └─ <AgentSidebar />   ← mounted when Library mode is active   │
│       ├─ useAgentStream()  ← SSE streaming + multi-round loop   │
│       ├─ useAgentSessions() ← session CRUD via REST             │
│       ├─ MessageBlocks.tsx  ← renders tool calls, plans, etc.   │
│       ├─ AgentMarkdown.tsx  ← markdown with collapsible code    │
│       └─ ModelPicker.tsx   ← model selector popover             │
│                                                                 │
│  ComponentEditor.tsx ← code editor + live preview iframe        │
│       ├─ Listens for `agent-file-changed` CustomEvents          │
│       ├─ Listens for `agent-verify-component` CustomEvents      │
│       └─ Dispatches `agent-verify-result` back to agent         │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST + SSE
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express 5 Backend (port 3001)                                  │
│                                                                 │
│  /api/library-agent/*  → server/routes/libraryAgent.ts          │
│   ├─ POST /chat         ← main agent endpoint (SSE streaming)   │
│   └─ POST /verify-result ← receives sandbox verify results      │
│                                                                 │
│  /api/library/*        → server/routes/library.ts               │
│   ├─ CRUD /components   ← component management                 │
│   ├─ CRUD /folders      ← folder management                    │
│   ├─ CRUD /agent/sessions ← chat session persistence           │
│   ├─ GET  /components/:id/compiled ← TSX→JS via esbuild        │
│   └─ POST /components/search ← vector search                   │
│                                                                 │
│  Services:                                                      │
│   ├─ libraryService.ts   ← SQLite CRUD + vector search          │
│   ├─ embeddingService.ts ← OpenAI embeddings + TF-IDF fallback │
│   ├─ mimoService.ts      ← provider config + language detection │
│   ├─ verifyService.ts    ← in-memory verify result store        │
│   ├─ agentService.ts     ← shared tool: toolExecuteCode (vm)   │
│   └─ tsxCompiler.ts      ← esbuild TSX→ESM compilation         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Vercel AI SDK (`ai` package)                                   │
│   ├─ streamText() from 'ai'                                     │
│   ├─ createOpenAICompatible() from '@ai-sdk/openai-compatible'  │
│   ├─ tool() + zod schemas for tool definitions                  │
│   └─ Handles tool execution loop (maxSteps: 6)                  │
│                                                                 │
│  AI Providers:                                                  │
│   ├─ MiMo (default) — token-plan-sgp.xiaomimimo.com/v1         │
│   ├─ MiMo Direct   — api.xiaomimimo.com/v1                     │
│   └─ DeepSeek      — api.deepseek.com/v1                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### `library_components`

Stores the top-level component metadata.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | Random alphanumeric ID |
| `name` | TEXT NOT NULL | Display name |
| `category` | TEXT NOT NULL | One of: `ui-widget`, `template`, `theme`, `python` |
| `content_type` | TEXT NOT NULL | One of: `tsx`, `html`, `css`, `js`, `json`, `markdown`, `python` |
| `description` | TEXT | Human-readable description |
| `tags` | TEXT | JSON array of strings |
| `content` | TEXT NOT NULL | Primary file content |
| `metadata` | TEXT | JSON object for extra data |
| `thumbnail` | TEXT | Preview image URL |
| `folder_id` | TEXT FK | References `library_folders(id)` |
| `is_global` | INTEGER | Default `1` |
| `agent_accessible` | INTEGER | Default `1` — whether the agent can access it |
| `created_at` | TEXT | ISO 8601 datetime |
| `updated_at` | TEXT | ISO 8601 datetime |

### `library_component_files`

Multi-file support — each component can have multiple files.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | |
| `component_id` | TEXT FK → `library_components(id)` | `ON DELETE CASCADE` |
| `filename` | TEXT NOT NULL | e.g. `Component.tsx`, `style.css` |
| `content_type` | TEXT NOT NULL | Same enum as component |
| `content` | TEXT NOT NULL | Full file content |
| `sort_order` | INTEGER | Default `0` |
| `is_entry` | INTEGER | `0` or `1` — marks the entry-point file |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

### `library_embeddings`

Vector embeddings for semantic search.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | |
| `component_id` | TEXT FK → `library_components(id)` | `ON DELETE CASCADE` |
| `chunk_text` | TEXT NOT NULL | Concatenation of `name + description + tags + category` |
| `embedding` | TEXT NOT NULL | JSON array of floats |

### `library_agent_sessions`

Chat session persistence per component.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | |
| `component_id` | TEXT FK → `library_components(id)` | `ON DELETE CASCADE` |
| `title` | TEXT | Auto-set from first user message (first 50 chars) |
| `messages_json` | TEXT | JSON array of `AgentMessage[]` |
| `created_at` | TEXT | |
| `updated_at` | TEXT | |

Constraints: max 3 sessions displayed per component, max 20 total with FIFO eviction of oldest.

### `library_folders`

Organizational folders for components.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | |
| `name` | TEXT NOT NULL | |
| `description` | TEXT | |
| `color` | TEXT | Default `#6366f1` (indigo) |
| `icon` | TEXT | Default `folder` |
| `sort_order` | INTEGER | |
| `agent_accessible` | INTEGER | |

---

## Backend

### Provider Adapter

The provider adapter lives in `server/routes/libraryAgent.ts` and uses `@ai-sdk/openai-compatible` to create an OpenAI-compatible provider:

```ts
function createProvider(providerName?: string) {
  const config = getProviderConfig(providerName);
  return createOpenAICompatible({
    apiKey: config.key,
    baseURL: config.base,
  });
}
```

`getProviderConfig()` (from `server/services/mimoService.ts`) resolves the provider name:

| Provider Name | API Key Env Var | Base URL Env Var |
|---------------|-----------------|------------------|
| `undefined` (default) | `MIMO_API_KEY` | `MIMO_BASE_URL` |
| `'mimo-direct'` | `MIMO_DIRECT_API_KEY` | `MIMO_DIRECT_BASE_URL` |
| `'deepseek'` | `DEEPSEEK_API_KEY` | `DEEPSEEK_BASE_URL` |

The model is then instantiated via `aiProvider.chatModel(model || 'mimo-v2.5')`.

### System Prompt

`LIBRARY_AGENT_BASE_PROMPT` (~160 lines) instructs the AI to act as a **senior React component engineer**. Key sections:

| Section | Purpose |
|---------|---------|
| File Content Purity Rules | No markdown in files, no incomplete code — write COMPLETE files |
| Announce Intent | Before every tool call, output a short sentence describing the action |
| Reasoning Requirement | After every tool call result, output 1–3 sentences of reasoning |
| Preview Sandbox Capabilities | Documents what works (React 19, Tailwind, motion/framer-motion, @phosphor-icons/react, inline TS types) and what doesn't (shadcn/ui, zustand, react-router, CSS modules, Node.js APIs, enums) |
| Error Diagnosis | Classifies common errors (SyntaxError on interface, ReferenceError, TypeError, React #130, infinite re-renders, blank renders) with fix instructions |
| Recommended Workflow | Read → Analyze → Create To-Do → Execute → Verify → Report |
| Anti-Pattern Rules | Never call `verify_component` with `{"id": ...}`, never call same tool twice, never rewrite for review tasks |

The full system prompt is assembled at request time:

```ts
const fullSystem = [
  LIBRARY_AGENT_BASE_PROMPT,
  componentContext,        // current component metadata
  systemPromptAppend,      // user-customizable from agentConfig
  langInstruction,         // auto-detected language instruction
].filter(Boolean).join('\n\n');
```

Where `componentContext` is built by `buildComponentContext()` and includes the current component's name, ID, category, description, tags, and file list.

### Tool Definitions

`buildLibraryTools(componentId?)` returns **10 tools** defined with Vercel AI SDK's `tool()` + Zod schemas:

| Tool | Parameters | Description |
|------|-----------|-------------|
| `search_library` | `query: string`, `category?: string`, `topK?: number` | Vector similarity search across all library components. Returns IDs, names, categories, descriptions, and relevance scores. |
| `read_component` | `id?: string` | Returns full component metadata + all file contents (truncated at 12,000 chars total, 4,000 per file). Falls back to `componentId` from context. |
| `ask_user` | `question: string` | Returns `{ask_user: true, question}` — signals frontend to display a question and pause for user input. |
| `execute_code` | `code: string` | Runs JavaScript in a sandboxed Node.js `vm.runInNewContext()` with 5-second timeout. |
| `write_component_file` | `componentId: string`, `filename: string`, `content: string` | Creates or updates a file within a component. Auto-detects content type from extension. |
| `delete_component_file` | `componentId: string`, `filename: string` | Removes a file. Prevents deleting the last file. If the deleted file was the entry, promotes the next file. |
| `create_todo_list` | `tasks: any[]` | Returns `{todo_list: true, tasks: [...]}` — signals frontend to render an agent plan checklist. Normalizes task fields. |
| `verify_component` | `componentId: string` | Returns acknowledgment string. Triggers the frontend sandbox to render the component and report errors back via an out-of-band flow. |
| `list_folders` | *(none)* | Returns all folders with their component counts. |
| `list_folder_contents` | `folderId: string` | Returns all components in a specific folder. |

### Agent Chat Endpoint

**`POST /api/library-agent/chat`**

#### Request Body

```ts
{
  messages: Array<{
    role: 'user' | 'assistant' | 'model' | 'tool',
    content: string,
    tool_calls?: [...],
    tool_call_id?: string
  }>,
  model?: string,            // e.g. 'mimo-v2.5'
  provider?: string,         // 'mimo-direct' | 'deepseek'
  componentId?: string,      // currently selected component
  max_tokens?: number,
  systemPromptAppend?: string
}
```

#### Processing Flow

1. Build component context if `componentId` is provided
2. Detect language from the last user message (Unicode range heuristics)
3. Assemble the full system prompt
4. Convert messages to Vercel AI SDK `CoreMessage[]` format via `convertToCoreMessages()`
5. Set SSE headers (`text/event-stream`, `no-cache`, keep-alive, `X-Accel-Buffering: no`)
6. Call `streamText()` with `maxSteps: 6` — Vercel AI SDK handles the tool execution loop internally
7. Stream text chunks as `{content: chunk}` events
8. After streaming completes, emit:
   - `{tool_call: {id, name, arguments}}` for each tool call made
   - `{verify_component: {componentId}}` if `verify_component` was called
   - `{tool_result: {toolCallId, name, output}}` for each tool result
   - Special events based on tool results (see SSE Event Types below)
9. Emit `{done: true}` and `[DONE]`

### SSE Event Types

| Event Shape | Meaning |
|-------------|---------|
| `{content: string}` | Text chunk from the AI |
| `{reasoning: string}` | Reasoning/thinking content |
| `{tool_call: {id, name, arguments}}` | AI is invoking a tool |
| `{tool_result: {toolCallId, name, output, error?}}` | Tool execution result |
| `{verify_component: {componentId}}` | Triggers sandbox verification in frontend |
| `{component_created: LibraryComponent}` | A new component was created |
| `{component_updated: LibraryComponent}` | An existing component was modified |
| `{todo_list: AgentTask[]}` | Agent plan tasks to display as checklist |
| `{ask_user: {question: string}}` | Agent is asking the user a question |
| `{done: true}` | Stream complete |
| `{error: string}` | An error occurred |

### CRUD Routes

#### Components (`/api/library/components`)

| Method | Path | Action |
|--------|------|--------|
| GET | `/components` | List (filterable by `category`, `folderId`, `unfoldered`) |
| GET | `/components/categories` | Get category counts |
| GET | `/components/stats` | Total, categories, agentAccessible counts |
| GET | `/components/:id` | Get single component with all files |
| POST | `/components` | Create component (auto-creates files, generates embedding) |
| POST | `/components/:id/duplicate` | Deep copy a component |
| PUT | `/components/:id` | Update (optionally replace files, re-embeds) |
| DELETE | `/components/:id` | Delete (cascades to files, embeddings, sessions) |
| GET | `/components/:id/compiled` | Returns compiled JS via esbuild |
| POST | `/components/search` | Vector similarity search |
| POST | `/components/reindex` | Rebuild all embeddings |
| POST | `/components/seed` | Seed from `seedLibraryComponents` if empty |
| POST | `/components/:id/move` | Move component to a folder |

#### Folders (`/api/library/folders`)

| Method | Path | Action |
|--------|------|--------|
| GET | `/folders` | List all with component counts |
| GET | `/folders/:id` | Get single folder |
| GET | `/folders/:id/components` | List components in folder |
| POST | `/folders` | Create folder |
| PUT | `/folders/:id` | Update folder |
| DELETE | `/folders/:id` | Delete folder (unlinks components) |

#### Agent Sessions (`/api/library/agent`)

| Method | Path | Action |
|--------|------|--------|
| GET | `/agent/session/:id` | Get single session |
| GET | `/agent/sessions/:componentId` | List sessions for component (limit 3) |
| POST | `/agent/sessions` | Create session (max 20/component, FIFO eviction) |
| PUT | `/agent/sessions/:id` | Update messages/title |
| DELETE | `/agent/sessions/:id` | Delete session |
| POST | `/agent/verify-result` | Receive sandbox verify results |

---

## Vercel AI SDK Integration

The core of the agent loop uses these Vercel AI SDK primitives:

| Import | Source | Purpose |
|--------|--------|---------|
| `streamText` | `ai` | Streams text and tool calls from the LLM |
| `convertToCoreMessages` | `ai` | Converts message format for the SDK |
| `tool` | `ai` | Defines tools with Zod parameter schemas |
| `createOpenAICompatible` | `@ai-sdk/openai-compatible` | Creates provider for OpenAI-compatible APIs |

The `streamText()` call is configured with:

```ts
const result = streamText({
  model: aiProvider.chatModel(model),
  system: fullSystem,
  messages: coreMessages,
  maxSteps: 6,         // AI SDK handles tool loop internally
  tools: libraryTools,
  maxTokens: maxTokens || 4096,
  temperature: 0.7,
});
```

`maxSteps: 6` means the AI SDK will automatically execute tools and feed results back to the LLM for up to 6 steps within a single `streamText()` call. The frontend then handles additional rounds if needed.

---

## Frontend

### Agent Sidebar

`AgentSidebar.tsx` is the main container component, rendered when Library mode is active:

- **Resizable** — width between 280px–700px, default 380px
- **Header** — title, undo/redo buttons (propagated to ComponentEditor's file history)
- **Session Tabs** — switch between up to 3 sessions per component
- **Message List** — scrollable list of `MessageBlock` components
- **Input Bar** — text input with send button, model picker

### Multi-Round Agent Loop

`useAgentStream.ts` implements a client-side multi-round loop with up to **10 rounds** (`MAX_AGENT_ROUNDS = 10`):

#### `handleSend(text)` Flow

1. Create user message + empty AI message (with `isThinking: true`)
2. Build server messages from conversation history via `buildServerMessages()` — reconstructs `tool_calls` and `tool` role messages from the `blocks` array
3. **Round loop** (max 10 iterations):
   - `POST /api/library-agent/chat` with SSE stream
   - Read SSE chunks, parse each `data:` line
   - `handleSSEChunk()` processes each event type:
     - `{content}` → append to the last text block in the AI message
     - `{tool_call}` → add a new `tool_call` block (collapsed by default), match to agent plan task
     - `{tool_result}` → update the matching tool_call block with result
     - `{ask_user}` → set `pendingAskUser` state, add `ask_user` block
     - `{verify_component}` → dispatch `agent-verify-component` CustomEvent to ComponentEditor
     - `{component_created/updated}` → fire notification, dispatch `agent-file-changed` CustomEvent, reload components
     - `{todo_list}` → create `agent_plan` block with tasks
   - After stream ends: if there were tool calls AND no `ask_user` AND not done, **continue to next round** — append assistant message with tool_calls and tool results to `serverMessages`
   - Wait 300ms between rounds
4. Mark AI message as not thinking

#### `buildServerMessages(msgs, newText)`

Converts frontend `AgentMessage[]` (with `blocks` array) back to the server's expected format:

- For assistant messages with `tool_call` blocks that all have results: emits the assistant message with a `tool_calls` array, then individual `tool` role messages for each result
- Otherwise: emits as plain `{role, content}`

#### Abort Handling

Uses `AbortController` — `handleAbort()` calls `abortController.abort()` to cancel the in-flight fetch.

### Session Management

`useAgentSessions.ts` handles session persistence:

1. On component selection: loads sessions via `GET /api/library/agent/sessions/:componentId` (latest 3)
2. Auto-creates a session if none exist via `POST /api/library/agent/sessions`
3. Loads latest session messages from `GET /api/library/agent/session/:id`
4. After streaming ends (detected by `wasStreamingRef` transition): saves messages to `PUT /api/library/agent/sessions/:id`
5. Auto-titles session from first user message (first 50 chars)
6. Supports switching between up to 3 sessions per component

### Component Editor & Verify Flow

`ComponentEditor.tsx` provides a multi-file code editor (Monaco-based) with a live preview iframe:

- Listens for `agent-file-changed` CustomEvents → updates editor files, pushes to undo history
- Listens for `agent-verify-component` CustomEvents → triggers the verify flow
- Agent-changed files get a **neon glow highlight** for 3 seconds

#### Verify Flow (Asynchronous Out-of-Band)

```
Agent calls verify_component tool
         │
         ▼
Server returns acknowledgment string
Server emits {verify_component: {componentId}} SSE event
         │
         ▼
Frontend useAgentStream dispatches `agent-verify-component` CustomEvent
         │
         ▼
ComponentEditor:
  1. Switches to preview mode
  2. Waits 8 seconds for iframe to render
  3. Collects errors from previewErrorsRef (populated by iframe postMessage)
  4. Dispatches `agent-verify-result` CustomEvent with {success, errors}
         │
         ▼
useAgentStream POSTs result to /api/library-agent/verify-result
         │
         ▼
verifyService.ts stores result in-memory Map<string, {errors, success, timestamp}>
```

This is **asynchronous** — the agent continues working after calling verify, and results are reported to the user separately.

### Message Rendering

`MessageBlocks.tsx` renders different block types:

| Component | Renders |
|-----------|---------|
| `MessageBubble` | Routes to user bubble or assistant blocks |
| `TextBlock` | Markdown via `AgentMarkdown` |
| `ToolCallBlock` | Collapsible card with tool icon, name, status badge (running/done/error), progress animation |
| `AgentPlanBlock` | Checklist of agent plan tasks with checkboxes |
| `AskUserBlock` | Highlighted question card |
| `EmptyState` | "Start a conversation" placeholder |

Each of the 10 tools has a unique icon and color mapping for visual distinction.

`AgentMarkdown.tsx` uses `react-markdown` + `remark-gfm` with custom renderers:
- `pre` — collapsible code blocks with line count, copy button, language label
- `code` — inline code styled with the neon accent color

### Agent Configuration

`lib/agentConfig.ts` provides per-agent-type configuration stored in localStorage:

- Key: `edward:labs_agentConfig_library`
- Users can **enable/disable individual tools** from the 10 available
- Users can **append custom instructions** to the system prompt via `systemPromptAppend`
- `AGENT_TOOL_INFO.library` lists all 10 tools with descriptions for the config UI
- `getSystemPromptAppend('library')` is passed in every chat request

---

## Embedding & Search

`server/services/embeddingService.ts` provides vector embeddings:

| Method | Details |
|--------|---------|
| **Primary** | OpenAI `text-embedding-3-small` via `OPENAI_API_KEY` |
| **Fallback** | TF-IDF — tokenizes text, computes term frequency vectors |

Search is performed in `libraryService.searchComponents()`:

1. Load all embeddings from SQLite
2. Compute cosine similarity against the query embedding
3. Return top-K results sorted by score (descending)

Embeddings are created/updated:
- On component creation (synchronous)
- On component update (async, fire-and-forget)

The chunk text is a concatenation of `name + description + tags + category`.

---

## TSX Compilation

`server/services/tsxCompiler.ts` uses **esbuild** to bundle TSX component files into a single ESM module:

| Feature | Behavior |
|---------|----------|
| Internal imports | `./components`, `@/...` resolved to sibling files in the component |
| External packages | `react`, `react-dom`, `motion/react`, `@phosphor-icons/react`, `lucide-react` kept as bare imports (resolved by import maps in preview iframe) |
| Unknown npm packages | Rewritten to `https://esm.sh/{pkg}?external=react,react-dom` |
| CSS files | Injected as inline `<style>` elements via a virtual module |
| `cn()` imports | Virtualized with `clsx` + `tailwind-merge` from esm.sh |
| Entry file detection | `usage.tsx` → `isEntry` flag → `components.tsx` → first file |
| Default export | Auto-added if missing |

The compiled output is served via `GET /api/library/components/:id/compiled` and loaded into the sandboxed preview iframe.

---

## End-to-End Data Flow Example

**User sends: "Add a hover animation to the button"**

```
1.  AgentSidebar.handleSend()
    → useAgentStream.handleSend(text)

2.  User message + empty AI message added to React state

3.  buildServerMessages() converts conversation history to server format

4.  POST /api/library-agent/chat with SSE stream body

5.  Server:
    - Builds system prompt (base + component context + lang instruction)
    - Calls streamText() with 10 tools, maxSteps: 6

6.  AI streams text:
    "I'll read the current component first, then add a hover animation."

7.  AI calls read_component tool
    → Vercel AI SDK executes it
    → Returns file contents to the LLM

8.  AI streams text:
    "I can see the button in Component.tsx. I'll write the updated file
     with a hover animation using Tailwind."

9.  AI calls write_component_file with new content
    → Vercel AI SDK executes it
    → File saved to SQLite

10. Server emits {component_updated: ...} SSE event

11. Frontend receives component_updated
    → Fires agent-file-changed CustomEvent

12. ComponentEditor updates editor files, highlights changed lines

13. AI streams text:
    "Done. The button now has a scale hover effect."

14. Server emits {done: true}, [DONE]

15. Frontend saves session messages to database via PUT /api/library/agent/sessions/:id
```
