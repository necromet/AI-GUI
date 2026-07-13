# Library Agent — How It Really Works

## Short Answer

`AgentSidebar.tsx` is the **client-side UI** — it handles rendering and SSE parsing. But the real logic lives on the **server** in `server/routes/library.ts` (the agent loop) and `server/services/libraryAgentTools.ts` (tool definitions + execution). The agent is a **multi-step tool-calling loop** powered by the MiMo LLM, not a single request/response.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  AgentSidebar.tsx (Client)                              │
│                                                         │
│  handleSend() ──POST /api/library/agent/chat──►         │
│                                                         │
│  ◄── SSE stream ──────────────────────────────────────  │
│  • content        → render markdown text                │
│  • tool_call      → show tool card (running)            │
│  • tool_progress  → update progress text                │
│  • tool_result    → show tool card (done/error)          │
│  • todo_list      → render plan checklist               │
│  • ask_user       → show question bubble                │
│  • verify_component → dispatch DOM event to preview     │
│  • component_created/updated → refresh library + notify │
│  • tool_summary   → final summary of all tool results   │
│  • [DONE]         → end stream                          │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  server/routes/library.ts — POST /api/library/agent/chat│
│                                                         │
│  1. Build system prompt (base + component context +     │
│     tool definitions + language instruction)             │
│  2. Agent loop (max 10 iterations):                     │
│     a. Stream MiMo API → accumulate fullResponse        │
│     b. parseToolCalls(fullResponse)                     │
│     c. If no tools → send content, break                │
│     d. Strip tool syntax from content, send clean text  │
│     e. For each tool call:                              │
│        • Send tool_call SSE event                       │
│        • executeLibraryTool(call)                       │
│        • Send tool_result SSE event                     │
│        • Handle special cases (ask_user, verify, etc.)  │
│        • Push tool result to apiMessages for next loop  │
│  3. Send tool_summary + [DONE]                          │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  server/services/libraryAgentTools.ts                   │
│                                                         │
│  LIBRARY_TOOLS[] — 13 tool definitions                  │
│  buildLibraryToolSystemPrompt() — tool usage docs       │
│  executeLibraryTool(call) — dispatches to library svc   │
│  parseToolCalls(response) — regex-based parser          │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  server/services/libraryService.ts                      │
│                                                         │
│  CRUD for components, files, folders, sessions          │
│  searchComponents() — relevance-scored search           │
│  writeComponentFile() — create/update file in component │
│  Sessions: createSession, getSession, updateMessages    │
└─────────────────────────────────────────────────────────┘
```

---

## The 13 Tools

| Tool | What It Does |
|------|-------------|
| `search_library` | Natural-language search over component library |
| `create_component` | Create a new component with files |
| `read_component` | Read component metadata + all file contents |
| `update_component` | Update metadata and/or replace files |
| `write_component_file` | Write/update a single file in a component |
| `delete_component_file` | Delete a file from a component |
| `create_todo_list` | Create a structured task plan (displayed as checklist) |
| `verify_component` | Trigger live render in preview iframe, check for errors |
| `ask_user` | Ask the user a clarifying question (pauses the loop) |
| `execute_code` | Run JavaScript in a sandboxed VM |
| `list_folders` | List all library folders |
| `create_folder` | Create a new folder |
| `move_to_folder` | Move a component into/out of a folder |
| `list_folder_contents` | List components in a folder |

---

## The Agent Loop (Server)

This is the core. Located at `server/routes/library.ts:593-815`.

```
while (iteration < 10):
  1. Stream MiMo API response → accumulate into fullResponse
  2. parseToolCalls(fullResponse) — regex extracts tool blocks
  3. If NO tool calls found:
     → Send fullResponse as `content` SSE event
     → BREAK (conversation turn ends)
  4. If tool calls found:
     → Strip tool syntax from text → send clean `content` event
     → Push full (unstripped) response to apiMessages (for context)
     → For EACH tool call:
       a. Send `tool_call` SSE event (name + arguments)
       b. Execute tool via executeLibraryTool()
       c. Handle special results:
          - ask_user → send `ask_user` event, set flag, break inner loop
          - create_component → send `component_created` event
          - write_component_file / update_component → send `component_updated` event
          - create_todo_list → send `todo_list` event (renders as plan)
          - verify_component → send `verify_component` event, wait for iframe result
       d. Send `tool_result` SSE event
       e. Push tool result text to apiMessages (as user message)
  5. If ask_user was detected → break outer loop
  6. Next iteration → MiMo sees tool results and continues reasoning
```

The loop lets the AI chain multiple tools: read → plan → write → verify → fix → re-verify.

---

## Tool Call Parsing

`parseToolCalls()` in `server/services/agentService.ts:878-931` recognizes three formats (checked in order, first match wins):

1. **XML format** (MiMo sometimes outputs this):
   ```xml
   <tool_call>
    <tool_name>read_component</tool_name>
    <arguments>{"id": "abc"}</arguments>
    </tool_call>
   ```

2. **Code block format** (instructed in system prompt):
   ```tool
   {"name": "read_component", "arguments": {"id": "abc"}}
   ```

3. **Bare JSON fallback**:
   ```json
   {"name": "read_component", "arguments": {"id": "abc"}}
   ```

Deduplication: identical `name:arguments` pairs are skipped.

---

## System Prompt Construction

Built at `server/routes/library.ts:615-616`:

```
fullSystem = LIBRARY_AGENT_BASE_PROMPT   ← role, sandbox constraints, workflow rules
           + componentContext             ← current component name/id/category/files
           + buildLibraryToolSystemPrompt() ← tool definitions + usage rules
           + langInstruction              ← "Respond in [detected language]"
```

The base prompt (`library.ts:303-460`) is ~160 lines covering:
- File content purity rules (no tool syntax in code)
- Preview sandbox capabilities (what works, what doesn't)
- Error diagnosis patterns (SyntaxError, ReferenceError, etc.)
- Mandatory 6-step workflow: Read → Analyze → Todo → Write → Verify → Report
- Anti-pattern rules (never skip steps, never rewrite on review requests, etc.)

---

## Session Management

Sessions are per-component, stored server-side via `libraryService`:

| Endpoint | Action |
|----------|--------|
| `GET /api/library/agent/sessions/:componentId` | List sessions for a component |
| `POST /api/library/agent/sessions` | Create new session (linked to componentId) |
| `GET /api/library/agent/session/:id` | Get session + messages JSON |
| `PUT /api/library/agent/session/:id` | Update messages and/or title |
| `DELETE /api/library/agent/session/:id` | Delete session |

Client loads the latest session on component select (`AgentSidebar.tsx:497-544`). Max 3 sessions per component. After each stream completes, client saves all messages to the session (`AgentSidebar.tsx:801-821`). First user message becomes the session title.

---

## Client-Side Rendering Pipeline

`AgentSidebar.tsx` uses a **block-based message model**:

```typescript
type MessageBlock =
  | { type: 'text'; content: string; toolBlocks?: ExtractedToolBlock[] }
  | { type: 'tool_call'; name: string; arguments: ...; result?: ...; collapsed?: boolean; progress?: string }
  | { type: 'ask_user'; question: string }
  | { type: 'agent_plan'; tasks: AgentTask[] }
```

### SSE Event → Block Mapping

| SSE Event | Client Action |
|-----------|--------------|
| `content` | Append to `fullText`, run `extractToolBlocks()`, update/create text block |
| `tool_call` | Push new `tool_call` block, update plan task status |
| `tool_progress` | Find matching tool_call block, set `progress` text |
| `tool_result` | Find matching tool_call block, set `result` + clear progress |
| `ask_user` | Push `ask_user` block, set `pendingAskUser` state |
| `todo_list` | Push `agent_plan` block with tasks |
| `verify_component` | Dispatch `agent-verify-component` DOM event to preview iframe |
| `component_created` | Toast notification + reload library + dispatch `agent-file-changed` |
| `component_updated` | Update component in parent + reload + dispatch `agent-file-changed` |
| `tool_summary` | (No-op in current client code) |

### `extractToolBlocks()` — Client Safety Net

Even though the server strips tool syntax from `content` events, the client also strips it as a fallback. This function (`AgentSidebar.tsx:22-64`) handles three formats:

1. `<tool_call>` XML blocks → extract name + arguments
2. ````tool` / ````json` code blocks → parse JSON
3. Bare JSON `{"name": "...", "arguments": {...}}` → parse

Each extracted tool block is replaced with `%%TOOL_BLOCK_PLACEHOLDER%%` in the text. The rendering code splits on this placeholder and interleaves markdown text with inline tool cards.

### Structured Layout

When a message has tool calls, `AgentResponseWrapper` (`AgentSidebar.tsx:96-382`) renders a structured layout:
- Pre-plan text → plan checklist → tool calls grouped by phase → post-execution text → ask_user bubbles

Tool phases: Reading → Planning → Writing → Verifying (color-coded).

---

## Verify Flow

This is the most complex part:

1. AI calls `verify_component` tool
2. Server sends `verify_component` SSE event with `componentId`
3. Client dispatches `agent-verify-component` DOM event
4. The preview iframe (ComponentEditor) catches this event, renders the component, checks for errors
5. Preview dispatches `agent-verify-result` DOM event with `{ success, errors }`
6. Client catches `agent-verify-result`, POSTs to `/api/library/agent/verify-result`
7. Server stores result in `verifyResults` Map
8. `waitForVerifyResult()` polls the Map every 200ms (10s timeout)
9. Server updates `result.output` with pass/fail, pushes to apiMessages
10. Next loop iteration: AI sees the verification result, can fix errors or report success

---

## Key Files Summary

| File | Role |
|------|------|
| `components/library/AgentSidebar.tsx` | Client UI: streaming, rendering, sessions, tool cards |
| `server/routes/library.ts` | Server routes: agent loop, session CRUD, component CRUD, system prompt |
| `server/services/libraryAgentTools.ts` | Tool definitions, system prompt builder, tool execution |
| `server/services/agentService.ts` | `parseToolCalls()` regex parser, `toolExecuteCode()` sandbox |
| `server/services/libraryService.ts` | Data layer: components, files, folders, sessions |
| `server/services/mimoService.ts` | MiMo API client: `streamChatCompletion()`, language detection |
| `components/ui/agent-plan.tsx` | `AgentPlan` + `AgentTask` components (todo list rendering) |

---

## Data Flow: User Says "Add a hover effect"

```
1. User types "Add a hover effect" → handleSend()
2. POST /api/library/agent/chat { messages, model, componentId }
3. Server builds system prompt with component context
4. MiMo streams response: "I'll read the component first..."
5. Server accumulates, finds tool call: read_component(id: "xyz")
6. Server sends: { content: "I'll read the component first..." }
7. Server sends: { tool_call: { name: "read_component", arguments: { id: "xyz" } } }
8. Server executes read_component → gets file contents
9. Server sends: { tool_result: { name: "read_component", output: "..." } }
10. Server pushes result to apiMessages, loops again
11. MiMo sees file contents, calls create_todo_list
12. Server sends: { tool_call: ... } + { todo_list: [...] }
13. MiMo calls write_component_file with modified code
14. Server sends: { tool_call: ... } + { tool_result: ... } + { component_updated: ... }
15. MiMo calls verify_component
16. Server sends: { verify_component: { componentId } }
17. Preview iframe renders → posts result back
18. Server receives verification result, loops again
19. MiMo sees "Verification passed", outputs summary text
20. Server sends: { content: "Done! Added hover effect..." }
21. Server sends: { tool_summary: [...] } + [DONE]
22. Client renders final text bubble, saves session
```
