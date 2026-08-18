# Fix Skema Agent Empty Response

## Root Cause

The skema agent (`server/routes/skemaAgent.ts`) uses **native OpenAI function calling** via `streamText({ tools })` from the Vercel AI SDK with `@ai-sdk/openai-compatible`. **MiMo doesn't support OpenAI function calling** — it returns an empty response (`text: 0, toolCalls: 0, finishReason: stop`) when tools are passed in the request body.

The **old working agent** (`server/routes/agent.ts`) uses a completely different approach that works with MiMo:
- Direct `fetch` to MiMo API via `streamChatCompletion()` (no AI SDK)
- **Prompt-based tool calling** — tools described in the system prompt, model outputs ` ```tool ` code blocks
- `parseToolCalls()` from `agentService.ts` extracts tool calls from model text output
- Manual multi-round loop with `MAX_AGENT_ITERATIONS`

The same issue affects `libraryAgent.ts` and `agentBuilder.ts` — all three use `streamText({ tools })` which doesn't work with MiMo.

## Solution

Rewrite the skema agent `/chat` endpoint to use the same **prompt-based tool calling** approach as the old working agent. Replace `streamText({ tools })` with `streamChatCompletion()` + prompt-described tools + `parseToolCalls()` + manual loop.

Apply the same fix to the library agent `/chat` endpoint.

## Frontend Impact: None

The frontend's `useSkemaAgentStream.ts` has its own multi-round loop, but when the backend handles all rounds internally and emits `{ done: true }` at the end, the frontend loop breaks after the first request (because `roundDoneRef.current` is true). All SSE events (`content`, `tool_call`, `tool_result`, `ask_user`, `todo_list`, `file_created`, etc.) use the same format the frontend already expects.

The frontend generates tool_call IDs if not provided (line 155) and matches tool_results by name as fallback (line 179), so no format changes needed.

## Implementation Steps

### Step 1: Add skema file tool definitions to `server/services/agentService.ts`

Add three new exports:

**`SKEMA_FILE_TOOLS: ToolDefinition[]`** — Tool metadata for the system prompt:
```
create_file:  { path: string, content: string }
update_file:  { path: string, content: string }
delete_file:  { path: string }
read_file:    { path: string }
list_files:   {} (no params)
set_preview:  { path: string }
search_library: { query: string, category?: string }
ask_user:     { question: string }
create_todo_list: { tasks: any }
```

**`buildSkemaFileToolPrompt(tools: string[]): string`** — Generates the prompt-based tool description (similar to `buildToolSystemPrompt`), instructing the model to output ` ```tool ` code blocks.

**`executeSkemaFileTool(call: ToolCall, workingFiles: ProjectFile[], emitEvent: (e: any) => void): Promise<ToolResult>`** — Executes skema file tools. Moves the logic from `buildSkemaFileTools().*.execute` in `skemaAgent.ts` into this function. Also emits frontend-specific events:
- `create_file` → `{ file_created }` event
- `update_file` → `{ file_updated }` event
- `delete_file` → `{ file_deleted }` event
- `set_preview` → `{ preview_set }` event
- `ask_user` → `{ ask_user }` event
- `create_todo_list` → `{ todo_list }` event

### Step 2: Add library tool definitions to `server/services/agentService.ts`

**`LIBRARY_AGENT_TOOLS: ToolDefinition[]`** — Tool metadata:
```
search_library, read_component, ask_user, execute_code,
write_component_file, delete_component_file, create_todo_list,
verify_component, list_folders, list_folder_contents
```

**`buildLibraryToolPrompt(tools: string[]): string`** — Prompt builder.

**`executeLibraryTool(call: ToolCall, componentId?: string): Promise<ToolResult>`** — Executes library tools. Moves logic from `buildLibraryTools().*.execute` in `libraryAgent.ts`.

### Step 3: Rewrite `server/routes/skemaAgent.ts` `/chat` endpoint

Replace the entire `/chat` handler. Remove `streamText`, `tool`, `z` imports and `createProvider`/`convertToCoreMessages` from aiSdk. New flow:

```
POST /chat:
  1. Parse body: messages, model, provider, context, systemPromptAppend
  2. Detect language, build language instruction
  3. Handle image analysis if needed (same as before)
  4. Build workingFiles from context.files
  5. Build system prompt: SKEMA_AGENT_BASE_PROMPT + fileContext + toolPrompt + systemPromptAppend + langInstruction
     where toolPrompt = buildSkemaFileToolPrompt([...tool names])
  6. Build apiMessages: system + conversation messages
  7. Set SSE headers
  8. Loop up to 6 rounds:
     a. Call streamChatCompletion({ model, messages: apiMessages, stream: true })
     b. Read SSE stream, emit { content } events, accumulate fullResponse
     c. Parse tool calls: parseToolCalls(fullResponse)
     d. If no tool calls → break
     e. Append assistant message to apiMessages
     f. For each tool call:
        - Emit { tool_call: { name, arguments } }
        - Execute via executeSkemaFileTool(call, workingFiles, emitEvent)
        - Emit { tool_result: { name, output, error? } }
        - Append tool result to apiMessages as user message
  9. Emit { done: true }, [DONE], end response
```

Remove the `buildSkemaFileTools()` function (lines 139-299) — its logic moves to `agentService.ts`.

Keep the `SKEMA_AGENT_BASE_PROMPT` constant (lines 13-137) — update the "Available Tools" section to describe the prompt-based format instead of function calling.

Keep all session CRUD routes unchanged (lines 440-493).

### Step 4: Rewrite `server/routes/libraryAgent.ts` `/chat` endpoint

Same pattern as Step 3. Replace `streamText({ tools })` with `streamChatCompletion()` + `buildLibraryToolPrompt()` + `parseToolCalls()` + `executeLibraryTool()` + manual loop.

Remove `buildLibraryTools()` function — logic moves to `agentService.ts`.

Keep session CRUD and verify-result routes unchanged.

### Step 5: Update `server/routes/agentBuilder.ts` `/chat` endpoint

Same pattern — replace `streamText({ tools })` with prompt-based approach. This one is simpler since the tools are user-defined and stored in DB. Build tool prompt from DB tool definitions, parse calls, execute inline.

### Step 6: Clean up `server/lib/aiSdk.ts`

After Steps 3-5, no route imports from `aiSdk.ts`. The file can be kept (it's harmless) or removed. Check if `agentBuilder.ts` still needs it — if rewritten, it won't.

### Step 7: Revert previous "fix" attempts

- `server/routes/skemaAgent.ts`: Remove the "empty response" fallback warning (added in previous fix attempt) — no longer needed since the approach is completely different.
- `server/routes/libraryAgent.ts`: Same.
- `components/library/agent/MessageBlocks.tsx`: Keep the "No response generated" fallback (line 261) — it's still a valid safety net.

## Files to Modify

| File | Action |
|------|--------|
| `server/services/agentService.ts` | Add `SKEMA_FILE_TOOLS`, `buildSkemaFileToolPrompt()`, `executeSkemaFileTool()`, `LIBRARY_AGENT_TOOLS`, `buildLibraryToolPrompt()`, `executeLibraryTool()` |
| `server/routes/skemaAgent.ts` | Rewrite `/chat` handler. Remove AI SDK imports, remove `buildSkemaFileTools()`. Keep system prompt, file context, session CRUD. |
| `server/routes/libraryAgent.ts` | Rewrite `/chat` handler. Remove AI SDK imports, remove `buildLibraryTools()`. Keep session CRUD, verify-result. |
| `server/routes/agentBuilder.ts` | Rewrite `/chat` handler. Remove AI SDK imports. |
| `server/lib/aiSdk.ts` | No longer imported by any route — can be deleted or kept. |
| `components/library/agent/MessageBlocks.tsx` | Keep existing "No response generated" fallback. No changes needed. |

## Key Compatibility Notes

### SSE event format (backend → frontend)
The frontend expects these events (from `useSkemaAgentStream.ts`):
- `{ content: string }` — text chunk
- `{ reasoning: string }` — thinking/reasoning chunk
- `{ tool_call: { id?: string, name: string, arguments: any } }` — `id` is optional (frontend generates fallback)
- `{ tool_result: { toolCallId?: string, name: string, output: string, error?: string } }` — matched by `toolCallId` or `name`
- `{ ask_user: { question: string } }`
- `{ todo_list: AgentTask[] }`
- `{ file_created }`, `{ file_updated }`, `{ file_deleted }`, `{ preview_set }` — file operation events
- `{ done: true }` — signals end of response

### parseToolCalls() format (from `agentService.ts:878-931`)
Supports three formats the model can output:
1. ` ```tool\n{"name": "...", "arguments": {...}}\n``` ` — primary format
2. `<tool_call><tool_name>...</tool_name><arguments>...</arguments></tool_call>` — XML fallback
3. `{"name": "...", "arguments": {...}}` — bare JSON fallback

### System prompt tool description format
The system prompt should instruct the model to output tool calls as:
```
To use a tool, output a fenced JSON block:
\`\`\`tool
{"name": "tool_name", "arguments": {"param": "value"}}
\`\`\`
```
This matches the primary format that `parseToolCalls()` parses.

## Verification

1. `npm run build` — ensure no TypeScript errors
2. Manual test: send "hello" in Skema agent → should get text response
3. Manual test: send "create a simple landing page" in Skema agent → should see tool_call + tool_result + content
4. Manual test: Library agent → same verification
5. Check server logs: should show `parseToolCalls` results, not `text: 0 toolCalls: 0`
