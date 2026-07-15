# Library Agent Rebuild — From Scratch

## Root Cause of Compound Text

The AI SDK `ToolLoopAgent` internally calls `streamText` per step. Each step's stream emits `text-delta` parts. MiMo/DeepSeek regenerate the **full accumulated text** on each step (not just the new portion). So step 2's deltas include step 1's text. No amount of client-side or server-side dedup fixes this reliably — the architecture is wrong for this provider.

**Solution:** Abandon `ToolLoopAgent`. Build the agent loop manually using `streamChatCompletion` (existing MiMo streaming API). This is the same approach the working MiMo agent in `server/routes/library.ts` already uses.

---

## Architecture

```
Client (AgentSidebar.tsx)
  │ POST /api/library-agent/chat
  │ { messages, model, provider, componentId }
  ▼
Server (server/routes/libraryAgent.ts)
  │ Manual tool loop:
  │   while (iteration < MAX) {
  │     1. streamChatCompletion → accumulate full response
  │     2. parseToolCalls from response text
  │     3. strip tool calls → send clean text as ONE content event
  │     4. for each tool call:
  │        a. emit tool_call SSE event
  │        b. execute tool
  │        c. emit tool_result SSE event
  │        d. emit special events (component_updated, todo_list, etc.)
  │     5. push tool results as messages → loop
  │   }
  ▼
Tools (server/services/libraryAgentTools.ts)
  │ executeLibraryTool() — existing, works correctly
  ▼
DB (server/services/libraryService.ts)
  │ SQLite CRUD — unchanged
```

## Files to Change

### 1. `server/routes/libraryAgent.ts` — REWRITE

Replace the entire `/chat` route. Drop `createLibraryAgent`, `agent.stream()`, `onStepEnd`, stream parts iteration.

New implementation:
- Use `streamChatCompletion` from `server/services/mimoService.ts` (already used by the working MiMo agent)
- Manual loop: `while (iteration < MAX_AGENT_ITERATIONS)`
- Each iteration:
  1. Call `streamChatCompletion` with current messages
  2. Read SSE stream, accumulate `fullResponse` from `parsed.choices[0].delta.content`
  3. Call `parseToolCalls(fullResponse)` to extract tool calls
  4. Strip tool call XML/JSON from `fullResponse` → `cleanContent`
  5. If `cleanContent` has text → emit `data: {"content": "..."}` (single event, no duplication)
  6. For each tool call:
     - Emit `data: {"tool_call": {"name": "...", "arguments": {...}}}`
     - Call `executeLibraryTool(call)`
     - Handle `verify_component`: emit verify event, `await waitForVerifyResult()`, update result
     - Handle `ask_user`: emit ask_user event, `break` loop
     - Emit `data: {"tool_result": {...}}`
     - Emit special events via `emitSpecialToolEvents`
  7. Push assistant message + tool result messages to `apiMessages`
  8. If no tool calls → break loop
- Keep `/verify-result` endpoint as-is

Keep: `buildComponentContext`, `parseToolOutputAsJson`, `emitSpecialToolEvents`, imports for `library`, `verifyService`.

Drop: `createLibraryAgent` import, `streamResult.stream` iteration, `currentStepText`/`totalTextSent` dedup logic.

### 2. `lib/agent/agent.ts` — DELETE

No longer needed. The agent loop is now in the route handler.

### 3. `lib/agent/provider.ts` — DELETE

No longer needed. Provider config comes from `mimoService.ts`.

### 4. `lib/agent/tools/library.ts` — DELETE

The AI SDK `tool()` definitions are no longer used. Tool definitions and execution already exist in `server/services/libraryAgentTools.ts` (used by the MiMo agent and now by the rebuilt route).

### 5. `lib/agent/prompts/library.ts` — KEEP but simplify

The system prompt content is still valuable. But it will be used as a string constant in the route handler (not as `instructions` for `ToolLoopAgent`). Move the prompt into `server/routes/libraryAgent.ts` or keep it as a standalone export.

Key prompt additions:
- "After EVERY tool call, output reasoning text explaining what you observed and plan to do next."
- "NEVER chain tool calls without text between them."

### 6. `components/library/AgentSidebar.tsx` — SIMPLIFY

The client SSE parsing is mostly correct already. Changes:
- **Remove `extractToolBlocks` entirely** — the server no longer embeds tool calls in text content. Tool calls come as structured `tool_call` SSE events.
- **Remove the inline tool block rendering** — no more `%%TOOL_BLOCK_PLACEHOLDER%%` parsing.
- **Keep**: SSE parsing loop, `tool_call`/`tool_result`/`content`/`ask_user`/`verify_component`/`component_created`/`component_updated`/`todo_list` handlers, session management, plan rendering, markdown rendering.
- **Keep**: `isStreamingRef` guard, structured history sending.
- **Fix**: On `content` event, just append to the last text block. No regex processing needed.

### 7. `server/services/verifyService.ts` — KEEP

Shared verify result store. Already works correctly.

### 8. `server/services/libraryAgentTools.ts` — KEEP

Tool definitions + `executeLibraryTool`. Already works correctly. Add `verify_component` handling (currently missing — needs to emit verify event and wait for result, like the MiMo agent does).

### 9. `server/routes/library.ts` — CLEANUP

Remove the `/agent/chat` route (dead code — client uses `/api/library-agent/chat`). Keep the session CRUD routes (`/agent/sessions/*`, `/agent/session/:id`) and `/agent/verify-result`.

---

## SSE Protocol

Server → Client events:

| Event | Payload | When |
|-------|---------|------|
| `content` | `{ content: string }` | Clean text from LLM (one per step, no duplication) |
| `reasoning` | `{ reasoning: string }` | Reasoning/thinking text |
| `tool_call` | `{ tool_call: { name, arguments } }` | Tool call detected |
| `tool_result` | `{ tool_result: { name, input, output, error } }` | Tool execution complete |
| `component_created` | `{ component_created: LibraryComponent }` | After create_component |
| `component_updated` | `{ component_updated: LibraryComponent }` | After write_component_file |
| `todo_list` | `{ todo_list: Task[] }` | After create_todo_list |
| `verify_component` | `{ verify_component: { componentId } }` | Triggers preview render |
| `ask_user` | `{ ask_user: { question } }` | Agent asks user a question |
| `tool_summary` | `ToolResult[]` | End of stream (all tool results) |
| `[DONE]` | — | Stream complete |

---

## Tool Execution Flow

### verify_component
1. Agent outputs `<tool_call>` with `verify_component`
2. Server parses tool call, emits `tool_call` SSE event
3. Server emits `verify_component` SSE event → client dispatches `agent-verify-component` CustomEvent
4. `ComponentEditor` switches to preview mode, renders component
5. After 8s (or error detection), `ComponentEditor` dispatches `agent-verify-result`
6. `AgentSidebar` catches result, POSTs to `/api/library-agent/verify-result`
7. Server's `waitForVerifyResult` resolves
8. Server emits `tool_result` with success/error
9. Server pushes result to `apiMessages` and continues loop

### ask_user
1. Agent outputs `<tool_call>` with `ask_user`
2. Server parses tool call, emits `tool_call` SSE event
3. Server emits `ask_user` SSE event
4. Server breaks loop (doesn't execute the tool)
5. Client shows question bubble, sets `pendingAskUser`
6. User types answer → `handleSend` called → new request to server
7. Server starts new loop with full history (including the ask_user as a message)

---

## Implementation Order

1. Rewrite `server/routes/libraryAgent.ts` — manual loop with `streamChatCompletion`
2. Delete `lib/agent/agent.ts`, `lib/agent/provider.ts`, `lib/agent/tools/library.ts`
3. Simplify `components/library/AgentSidebar.tsx` — remove `extractToolBlocks`, simplify content handling
4. Clean up `server/routes/library.ts` — remove dead `/agent/chat` route
5. Verify build passes
