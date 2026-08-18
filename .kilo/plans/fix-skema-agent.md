# Plan: Fix Skema Agent to Work Properly

## Problem Analysis

After comparing the Library Agent (fully functional) and Skema Agent implementations, the following issues prevent the Skema Agent from working properly:

### Critical Bug: Message Conversion

**File**: `server/routes/skemaAgent.ts:183-188`

The Skema agent does a naive message conversion that **discards all tool call context** from previous conversation rounds:

```typescript
// CURRENT (broken)
for (const msg of messages) {
  const role = msg.role === 'model' ? 'assistant' : msg.role;
  apiMessages.push({ role, content: msg.content || '' });
}
```

The Library agent uses `convertMessagesForPromptBased()` which properly converts:
- `assistant` messages with `tool_calls` → merges tool calls back into content as ` ```tool ` code blocks
- `tool` role messages → `[Tool: name] Result: ...` user messages

Without this, multi-round conversations lose all tool context from previous rounds, causing the agent to repeat tool calls or lose track of what it already did.

### Missing Tools

The Skema agent's `SKEMA_FILE_TOOLS` is missing 3 tools that the Library agent and the unused `skemaTools.ts` both have:

| Tool | Library Agent | Skema (active) | Skema (unused AI SDK) |
|------|--------------|----------------|----------------------|
| `execute_code` | Yes | **No** | Yes |
| `web_browse` | No | **No** | Yes |
| `search_web` | No | **No** | Yes |

All three have working implementations in `agentService.ts` (`toolExecuteCode`, `toolWebBrowse`, `toolSearchWeb`).

### Missing HTML Context in System Prompt

The frontend `buildContext()` in `useSkemaAgentStream.ts:57-67` receives `currentHtml` as a prop but **doesn't include it in the context** sent to the backend. The backend's `buildFileContext()` only lists file paths/sizes but not content. For an HTML editing agent, not knowing the current HTML makes editing unreliable.

---

## Implementation Plan

### Step 1: Fix message conversion in `server/routes/skemaAgent.ts`

**What**: Replace the naive message loop with `convertMessagesForPromptBased()`.

**File**: `server/routes/skemaAgent.ts`

- Add `convertMessagesForPromptBased` to the import from `../services/agentService` (line 3)
- Replace lines 183-188 with:
  ```typescript
  const apiMessages: ChatMessage[] = [];
  apiMessages.push({ role: 'system', content: fullSystem });
  apiMessages.push(...convertMessagesForPromptBased(messages));
  ```

This matches exactly what the Library agent does at `libraryAgent.ts:241-243`.

### Step 2: Add `execute_code`, `web_browse`, `search_web` tools to `SKEMA_FILE_TOOLS`

**File**: `server/services/agentService.ts`

Add three new tool definitions to the `SKEMA_FILE_TOOLS` array (after `create_todo_list` at line 1031):

```typescript
{
  name: 'execute_code',
  description: 'Execute JavaScript code in a sandboxed environment and return the output. Use console.log() to see results.',
  parameters: {
    code: { type: 'string', description: 'JavaScript code to execute' },
  },
},
{
  name: 'web_browse',
  description: 'Fetch and extract text content from a URL. Returns the readable text of the webpage.',
  parameters: {
    url: { type: 'string', description: 'The URL to fetch' },
  },
},
{
  name: 'search_web',
  description: 'Search the web for information on a topic. Returns relevant search results.',
  parameters: {
    query: { type: 'string', description: 'Search query' },
  },
},
```

Add corresponding handlers in `executeSkemaFileTool()` (after `create_todo_list` case, before `default`):

```typescript
case 'execute_code': {
  const code = call.arguments.code;
  if (!code) { result.output = 'Error: No code provided.'; result.error = 'No code'; break; }
  result.output = await toolExecuteCode(code);
  break;
}

case 'web_browse': {
  const url = call.arguments.url;
  if (!url) { result.output = 'Error: No URL provided.'; result.error = 'No URL'; break; }
  result.output = await toolWebBrowse(url);
  break;
}

case 'search_web': {
  const query = call.arguments.query;
  if (!query) { result.output = 'Error: No search query provided.'; result.error = 'No query'; break; }
  result.output = await toolSearchWeb(query);
  break;
}
```

Also update the `/tools` endpoint in `skemaAgent.ts:263-266` to include the new tool names.

### Step 3: Pass `currentHtml` in frontend context

**File**: `components/skema/agent/useSkemaAgentStream.ts`

In `buildContext()` (line 57-67), add `currentHtml` to the returned context object:

```typescript
const buildContext = useCallback(() => {
  const board = project.boards[activeBoardIdx];
  const layout = board?.layout || '16:9';
  return {
    layout,
    projectTitle: project.title,
    model: selectedModelId || modelConfig?.apiModelId || modelConfig?.id || 'mimo-v2.5',
    provider: modelConfig?.provider,
    files: currentFiles || [],
    currentHtml,
  };
}, [project, activeBoardIdx, currentFiles, modelConfig, selectedModelId, currentHtml]);
```

### Step 4: Use HTML context in backend system prompt

**File**: `server/routes/skemaAgent.ts`

In `buildFileContext()` or in the `/chat` route handler, when `context.currentHtml` is provided, include a truncated version in the system prompt so the agent knows the current state of the HTML being edited. Add after the `fileContext` line (around line 162):

```typescript
let htmlContext = '';
if (context.currentHtml) {
  const MAX_HTML_CHARS = 8000;
  const truncated = context.currentHtml.length > MAX_HTML_CHARS
    ? context.currentHtml.substring(0, MAX_HTML_CHARS) + '\n... [truncated]'
    : context.currentHtml;
  htmlContext = `CURRENT HTML IN PREVIEW:\n\`\`\`html\n${truncated}\n\`\`\`\n\nWhen the user asks to modify "this" or "the current design", edit the HTML above using update_file on the entry file.`;
}
```

And include `htmlContext` in the `fullSystem` assembly at line 167.

### Step 5: Update `/tools` endpoint

**File**: `server/routes/skemaAgent.ts:263-266`

Update the tool names list to include the new tools:

```typescript
const skemaFileToolNames = ['create_file', 'update_file', 'delete_file', 'read_file', 'list_files', 'set_preview', 'search_library', 'ask_user', 'create_todo_list', 'execute_code', 'web_browse', 'search_web'];
```

---

## Files to Modify

| File | Change |
|------|--------|
| `server/routes/skemaAgent.ts` | Fix message conversion, add HTML context, update tools endpoint |
| `server/services/agentService.ts` | Add 3 tools to `SKEMA_FILE_TOOLS` + 3 handler cases in `executeSkemaFileTool` |
| `components/skema/agent/useSkemaAgentStream.ts` | Add `currentHtml` to `buildContext()` |

## Files NOT Modified

- `server/lib/agent/tools/skemaTools.ts` — unused Vercel AI SDK file, left as-is
- `server/lib/agent/prompts/skemaPrompt.ts` — unused prompt file, left as-is
- `server/services/skemaAgentService.ts` — session CRUD, no changes needed
- `components/skema/SkemaAgentSidebar.tsx` — no changes needed
- `components/skema/agent/useSkemaAgentSessions.ts` — no changes needed
- `components/skema/agent/types.ts` — no changes needed
