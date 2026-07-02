# Plan: Experiments Chat Storage + Full RAG/Agent Backends

## Goal

Add persistent conversation storage to all three experiment tools (RAG, Plugin Agent, Stitch) so that interactions — including HTML output, thinking processes, and chat history — are stored and previewable. Build full backend functionality for RAG (document retrieval + augmented generation) and Plugin Agent (web browsing, code interpreter, tool calling). Conversations are filtered by type in a separate sidebar view per mode.

## Route Structure (no changes needed)

Existing routes remain:
- `/experiments/rag` — RAG chat interface
- `/experiments/plugin-agent` — Plugin Agent chat interface
- `/experiments/stitch` — Stitch project editor (with generation history)

New route:
- `/experiments/stitch/:projectId/history` — View generation history for a Stitch project

## Phases

---

### Phase 1: Data Model + Infrastructure

#### 1a. Add `type` field to conversations (DB migration)

**`services/databaseService.ts`** — Bump `DB_VERSION` from 6 → 7:

```ts
// In upgradeOptions.upgrade:
if (oldVersion < 7) {
  // Add 'type' field to existing conversations
  const tx = db.transaction('conversations', 'readwrite');
  const store = tx.objectStore('conversations');
  let cursor = await store.openCursor();
  while (cursor) {
    const conv = cursor.value;
    if (!conv.type) {
      conv.type = 'chat'; // default for existing conversations
      await cursor.update(conv);
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}
```

Update `DBConversation` interface:
```ts
export interface DBConversation {
  conversation_id?: number;
  title: string | null;
  model_id: number;
  type: 'chat' | 'rag' | 'plugin-agent' | 'stitch'; // NEW
  created_at: string;
  updated_at: string;
}
```

Update `createConversation` to accept optional `type` parameter (default `'chat'`).

Add `getConversationsByType(type: string)` query function.

#### 1b. Update types

**`types.ts`** — Add `type` field to `ChatSession`:
```ts
export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  dbConversationId?: number;
  modelId?: number;
  type?: 'chat' | 'rag' | 'plugin-agent' | 'stitch'; // NEW
}
```

#### 1c. Update Sidebar filtering

**`components/Sidebar.tsx`** — When in experiments mode, filter conversations by `activeView` type. When in chat mode, filter by `type === 'chat'` (or `type` is undefined for legacy).

Currently the Sidebar receives all conversations and groups by date. With the type field:
- Chat mode: `conversations.filter(c => !c.type || c.type === 'chat')`
- Experiments mode: `conversations.filter(c => c.type === activeView)`

Show experiment conversations in the sidebar when in experiments mode (below the tool nav items).

#### 1d. Update App.tsx

**`App.tsx`** — Pass conversation type when creating conversations:
- `ensureConversation()` needs a `type` parameter
- `loadConversations()` needs to load type from DB
- Sidebar receives filtered conversations based on current mode

---

### Phase 2: Stitch Generation History

#### 2a. Store generations as conversation messages

**`components/StitchEditor.tsx`** — When `handleGenerate` completes:
1. Call `ensureConversation('stitch')` to get/create a conversation
2. Save the prompt as a user message
3. Save the thinking + HTML as an assistant message (with thinking in `thinkingContent` and HTML in `content`)
4. The message content format: store HTML as-is in the `content` field. ChatMessage already renders markdown/HTML via `react-markdown` with `rehype-raw`, so HTML source will render as code blocks.

**`components/StitchPanel.tsx`** — When opening a project, also load its conversation history.

#### 2b. Generation history view

**`components/StitchEditor.tsx`** — Add a "History" tab/panel that shows past generations for the current project. Each entry shows:
- The prompt used
- Thinking process (collapsible)
- HTML preview (iframe)
- Timestamp

This reuses the existing thinking panel and iframe preview components.

#### 2c. Route for history

**`App.tsx`** — Add route `/experiments/stitch/:projectId/history` that renders the history view.

---

### Phase 3: RAG System

#### 3a. Backend — Document management

**`server/routes/rag.ts`** (new file):
- `POST /api/rag/documents` — Upload document (PDF, TXT, MD, HTML)
- `GET /api/rag/documents` — List uploaded documents
- `DELETE /api/rag/documents/:id` — Delete document

**`server/services/ragService.ts`** (new file):
- Document parsing: PDF extraction (using `pdf-parse` npm package), text/markdown/HTML reading
- Text chunking: Split into ~500-token chunks with 50-token overlap
- Storage: Store chunks in an in-memory Map (keyed by document ID), persisted to a JSON file on disk (`data/rag_chunks.json`)

#### 3b. Backend — Embedding + Retrieval

**`server/services/embeddingService.ts`** (new file):
- Use OpenAI `text-embedding-3-small` model via `OPENAI_API_KEY`
- Batch embedding for document chunks
- Store embeddings alongside chunks

**`server/routes/rag.ts`** (continued):
- `POST /api/rag/query` — Accept a query, retrieve top-k relevant chunks, return augmented response
  - Embed the query
  - Compute cosine similarity against stored chunk embeddings
  - Take top 5 chunks
  - Build system prompt with retrieved context
  - Stream response from MiMo API

#### 3c. Frontend — RAG Chat Panel

**`components/RAGChatPanel.tsx`** (new, replaces `RAGPanel.tsx`):
- Document management section: upload, list, delete documents
- Chat interface: reuse `PromptInputBox` and `ChatMessage` components
- Messages stored via conversation system with `type='rag'`
- Source citations displayed inline (reuse `SearchAnnotation` rendering)

**`services/ragService.ts`** (new, client-side):
- `uploadDocument(file: File)` → POST to `/api/rag/documents`
- `listDocuments()` → GET `/api/rag/documents`
- `deleteDocument(id: string)` → DELETE `/api/rag/documents/:id`
- `queryRAG(query: string, history, model, ...)` → POST `/api/rag/query` (streaming)

#### 3d. New npm dependencies

- `pdf-parse` — PDF text extraction (server-side)

---

### Phase 4: Plugin Agent System

#### 4a. Backend — Tool definitions

**`server/services/agentService.ts`** (new file):
- Define tool schemas for MiMo function calling:
  - `web_browse(url: string)` — Fetch and extract text from a URL
  - `execute_code(language: string, code: string)` — Run JS code in sandboxed VM
  - `search_web(query: string)` — Web search (can use a simple fetch-based approach)
- Agent loop: Send messages with tool definitions → if model returns tool_calls → execute tools → feed results back → repeat until model gives final answer

#### 4b. Backend — Tool implementations

**`web_browse`**: Server-side fetch of URL, extract readable text using simple HTML parsing (strip tags, get text content). Return truncated text.

**`execute_code`**: Use Node.js `vm` module with `runInNewContext` and a timeout. Sandboxed — no filesystem/network access. Return stdout output.

**`search_web`**: Could use a simple scraping approach or stub for now (return placeholder results with a note that a real search API key is needed).

#### 4c. Backend — Agent routes

**`server/routes/agent.ts`** (new file):
- `POST /api/agent/chat` — Streaming chat with tool calling support
  - Accept messages + tool selection
  - Run agent loop server-side
  - Stream intermediate tool calls and final response back to client

#### 4d. Frontend — Plugin Agent Chat Panel

**`components/AgentChatPanel.tsx`** (new, replaces `PluginAgentPanel.tsx`):
- Chat interface with tool toggle buttons (web browse, code interpreter)
- Messages stored via conversation system with `type='plugin-agent'`
- Tool call results rendered as collapsible cards (showing tool name, input, output)
- Code execution results shown with syntax highlighting

**`services/agentService.ts`** (new, client-side):
- `sendAgentMessage(messages, tools, model, ...)` → POST `/api/agent/chat` (streaming)

#### 5e. New npm dependencies

- None required (vm is built-in, fetch is built-in)

---

### Phase 5: Wiring + Polish

#### 5a. App.tsx integration

- Add `ensureConversation(type)` helper that creates conversations with the correct type
- Wire experiment panels to use conversation storage
- Update sidebar conversation list to show experiment conversations
- Handle `loadConversation` for experiment types (route to correct panel)

#### 5b. Sidebar experiment history

- When in experiments mode, show conversations filtered by `type === activeView`
- Clicking a conversation loads its messages and displays them in the appropriate panel
- "New chat" button in experiments mode creates a new conversation of the current type

#### 5c. Route updates

- `/experiments/rag` → RAGChatPanel (with conversation loading)
- `/experiments/plugin-agent` → AgentChatPanel (with conversation loading)
- `/experiments/stitch` → StitchPanel (with generation history)
- `/experiments/rag/:conversationId` → Load specific RAG conversation
- `/experiments/plugin-agent/:conversationId` → Load specific Agent conversation

---

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `pdf-parse` dependency |
| `services/databaseService.ts` | DB version 7 migration, add `type` to conversations, add `getConversationsByType` |
| `services/databaseAdapter.ts` | Pass through new DB functions |
| `types.ts` | Add `type` to `ChatSession` |
| `App.tsx` | Wire experiment panels with conversation storage, update `ensureConversation` with type param, filter sidebar conversations by type, add new routes |
| `components/Sidebar.tsx` | Filter conversations by type based on mode, show experiment history when in experiments mode |
| `components/RAGPanel.tsx` | **Replace** with `RAGChatPanel.tsx` — full chat interface |
| `components/PluginAgentPanel.tsx` | **Replace** with `AgentChatPanel.tsx` — full chat interface |
| `components/StitchEditor.tsx` | Store generations as conversation messages, add history view |
| `components/StitchPanel.tsx` | Link projects to conversations |
| `services/ragService.ts` | **New** — Client-side RAG API calls |
| `services/agentService.ts` | **New** — Client-side Agent API calls |
| `server/routes/rag.ts` | **New** — RAG API endpoints |
| `server/routes/agent.ts` | **New** — Agent API endpoints |
| `server/services/ragService.ts` | **New** — Document parsing, chunking, retrieval |
| `server/services/embeddingService.ts` | **New** — OpenAI embedding wrapper |
| `server/services/agentService.ts` | **New** — Agent loop, tool implementations |
| `server/index.ts` | Register new route modules |

## New Dependencies

| Package | Purpose | Side |
|---------|---------|------|
| `pdf-parse` | PDF text extraction for RAG | Server |

## Risks / Considerations

- **Embedding cost**: OpenAI `text-embedding-3-small` is cheap (~$0.02/1M tokens) but requires `OPENAI_API_KEY`. Fallback: keyword-based search if key is missing.
- **Vector store persistence**: In-memory store with file-based persistence. Lost on server restart unless serialized to disk. Adequate for single-user; would need a real vector DB for multi-user.
- **Code execution sandbox**: Node.js `vm` module is NOT a security sandbox — it's primarily for isolation. For a personal tool this is acceptable, but it should NOT be exposed publicly.
- **Agent loop complexity**: Tool calling with MiMo may not work identically to OpenAI's function calling format. May need adapter logic in `agentService.ts`.
- **DB migration**: Existing conversations get `type: 'chat'` by default. The migration is non-destructive.
- **Scope**: This is a large feature set. Phase 1 + 2 (data model + Stitch history) can be shipped independently. Phases 3 + 4 (RAG + Agent) are independent of each other and can be done in parallel.
