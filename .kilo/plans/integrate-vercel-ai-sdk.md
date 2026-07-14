# Integrate Vercel AI SDK for Library Agents

## Goal

Replace the custom agent framework in `lib/agent/` (LLM streaming, tool parsing, agent loop) with Vercel AI SDK v7 (`ai` + `@ai-sdk/openai-compatible`), targeting the library agent route (`server/routes/libraryAgent.ts`).

## Background

The project has a custom agent framework at `lib/agent/`:
- **`llm.ts`** — Raw fetch to OpenAI-compatible MiMo API, manual SSE parsing
- **`processor.ts`** — Custom agent loop: streams LLM, parses tool calls, executes tools, repeats up to maxIterations
- **`tool.ts`** — `defineTool()` with Zod→JSON Schema conversion
- **`permission.ts`** — Simple allow/deny/ask permission rules
- **`prompts/library.ts`** — System prompt for the library agent
- **`tools/library.ts`** — 14 tool definitions for library CRUD, code execution, etc.

The library agent route (`server/routes/libraryAgent.ts`) uses `processAgent()` from the custom framework.

## New Dependencies

```bash
npm install ai @ai-sdk/openai-compatible
```

No additional provider packages needed — `@ai-sdk/openai-compatible` handles any OpenAI-compatible API (MiMo, DeepSeek, etc.).

## Plan

### Step 1 — Create provider adapter

**New file: `lib/agent/provider.ts`**

Map the project's provider config (`mimoService.getProviderConfig()`) to Vercel AI SDK providers using `createOpenAICompatible()`:

```ts
// Pseudocode
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getProviderConfig } from '../../server/services/mimoService';

export function getProvider(provider?: string) {
  const { key, base } = getProviderConfig(provider);
  const instance = createOpenAICompatible({
    name: provider || 'mimo',
    apiKey: key,
    baseURL: base,
  });
  return instance;
}
```

This creates a provider instance per request based on the `provider` string (`'mimo-direct'`, `'deepseek'`, or undefined → default MiMo token-plan).

### Step 2 — Rewrite tool definitions

**Edit: `lib/agent/tools/library.ts`**

Convert all 14 tools from the custom `defineTool()` API to Vercel's `tool()` API:

| Current | Vercel AI SDK |
|---|---|
| `defineTool({ name, description, parameters: z.object({...}), execute, permission })` | `tool({ description, parameters: z.object({...}), execute })` |
| `execute` returns `{ title, output, metadata?, error? }` | `execute` returns any value (becomes the tool result) |
| `execute` receives `(args, ctx: ToolContext)` | `execute` receives `(args, { abortSignal })` |
| Permission system is manual | — (handled separately, see Step 4) |

Key changes per tool:
- Replace `defineTool()` wrapper with `tool()` from `ai`
- `execute` no longer needs `ctx` parameter — use closures or global imports for dependencies like `library.*`
- `execute` can return plain objects/strings instead of `{ title, output }` wrapper
- Remove `permission` field — handled by a wrapper in Step 4
- Import `tool` from `ai` and `z` from `zod` (already has it)

### Step 3 — Create the ToolLoopAgent

**New file: `lib/agent/agent.ts`** (or inline in the route)

Create a `ToolLoopAgent` instance that bundles the system prompt and tools:

```ts
import { ToolLoopAgent } from 'ai';
import { LIBRARY_TOOLS } from './tools/library';
import { LIBRARY_AGENT_SYSTEM_PROMPT } from './prompts/library';

export function createLibraryAgent(modelId: string, provider?: string) {
  const providerInstance = getProvider(provider);
  return new ToolLoopAgent({
    model: providerInstance(modelId),
    instructions: LIBRARY_AGENT_SYSTEM_PROMPT,
    tools: Object.fromEntries(LIBRARY_TOOLS.map(t => [t.name, t])),
    maxSteps: 10, // replaces maxIterations
  });
}
```

### Step 4 — Handle permission system

The current `permission.ts` allows/denies/asks for tools like `delete_component_file`. Vercel AI SDK v7 supports `toolApproval` on `ToolLoopAgent`:

```ts
toolApproval: {
  delete_component_file: 'user-approval', // or 'auto-deny'
  delete_component: 'user-approval',
}
```

The route can handle these via the `createAgentUIStreamResponse` or manually by checking tool results.

### Step 5 — Rewrite the library agent route

**Edit: `server/routes/libraryAgent.ts`**

Replace the `processAgent()` async generator loop with Vercel AI SDK's `createAgentUIStreamResponse()` or manual `agent.stream()`.

The current SSE format the client expects:
- `data: {"content": "..."}` — text chunks
- `data: {"reasoning": "..."}` — reasoning chunks
- `data: {"tool_call": {"name": "...", "arguments": {...}}}` — tool call start
- `data: {"tool_result": {"name": "...", "input": {...}, "output": "...", "error": "..."}}` — tool result
- `data: {"tool_summary": [...]}` — final tool summary
- `data: [DONE]` — end marker

#### Approach A: Use `createAgentUIStreamResponse` (preferred if compatible)

```ts
import { createAgentUIStreamResponse } from 'ai';

router.post('/chat', async (req, res) => {
  const { messages, model, provider, max_tokens, componentId } = req.body;
  // ... build system prompt, component context, lang instruction ...
  
  const agent = createLibraryAgent(model || 'mimo-v2.5', provider);
  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,  // client-format messages (role: 'user'/'assistant')
    systemInstruction: fullSystemPrompt,
    maxTokens: max_tokens,
    onChunk: ... // transform to SSE if needed
  });
});
```

**If `createAgentUIStreamResponse` doesn't match the client's SSE format**, use Approach B.

#### Approach B: Manual streaming with `agent.stream()`

```ts
const result = await agent.stream({
  messages: apiMessages,
  maxTokens: max_tokens,
  onStepEnd: async ({ stepNumber, finishReason, toolCalls, toolResults }) => {
    // Emit tool_call and tool_result SSE events
    for (const tc of toolCalls) {
      res.write(`data: ${JSON.stringify({ tool_call: { name: tc.toolName, arguments: tc.args } })}\n\n`);
    }
    for (const tr of toolResults) {
      res.write(`data: ${JSON.stringify({ tool_result: tr })}\n\n`);
    }
  },
});

for await (const chunk of result.textStream) {
  res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
}
```

Keep the same special event handling for `create_component`, `write_component_file`, `create_todo_list`, `verify_component`, `ask_user` tool results (parse output JSON, emit extra SSE events with `component_created`, `component_updated`, `todo_list`, etc.).

### Step 6 — Remove deprecated files (optional, after verifying)

Files that become dead code:
- `lib/agent/llm.ts` — fully replaced by AI SDK
- `lib/agent/processor.ts` — fully replaced by `ToolLoopAgent`
- `lib/agent/tool.ts` — fully replaced by `tool()` from AI SDK

Keep `lib/agent/permission.ts` temporarily (logic absorbed into Step 4). Keep `lib/agent/prompts/library.ts` unchanged. Update `lib/agent/tools/library.ts` imports.

### Step 7 — Update AGENTS.md

Add note about Vercel AI SDK dependency and the provider adapter.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Client SSE format mismatch | Test with existing frontend; adjust `onStepEnd`/`onChunk` to match expected format |
| MiMo API doesn't support OpenAI tool-calling format | Fall back to prompt-based tool calling (already present in Stitch agent) |
| Breaking `lib/agent/` if other code imports it | Only library agent route uses `processAgent()`; Stitch agent has its own system; opencode agent uses sidecar |

## Open Question

The `ToolLoopAgent` in AI SDK v7 expects tools keyed by name in an object (`{ toolName: toolDef }`). The current tools array needs conversion. This is straightforward in Step 3.

Also need to verify: does the MiMo API (`token-plan-sgp.xiaomimimo.com/v1`) support the OpenAI tool-calling format (parallel tool calls, `finish_reason: "tool_calls"`)? The `lib/agent/llm.ts` already handles this, so it should work. If not, the `@ai-sdk/openai-compatible` provider will still work — it just won't get native tool calling, and we'd need to fall back to prompt-based extraction.
