# Library Agent — Vercel AI SDK → Cline SDK Migration Plan

## Overview

Migrate the Library Agent (and Skema Agent, which shares the same pattern) from the **Vercel AI SDK** (`ai` + `@ai-sdk/openai-compatible`) to the **Cline SDK** (`@cline/sdk`). This gives the agent access to Cline's richer agent runtime: built-in tool suite, plugin architecture, tool policies, checkpoint/undo, MCP support, and multi-agent teams.

**Requires Node.js 22+.**

---

## Current State

### Dependencies

```
ai                          ^7.0.28   (Vercel AI SDK)
@ai-sdk/openai-compatible   ^3.0.11   (OpenAI-compatible provider adapter)
zod                         ^4.4.3    (schema validation)
```

### Files Using Vercel AI SDK

| File | Usage |
|------|-------|
| `server/routes/libraryAgent.ts` | `streamText()`, `tool()`, `CoreMessage`, `createOpenAICompatible()` |
| `server/routes/skemaAgent.ts` | Same pattern — `streamText()`, `tool()`, `CoreMessage`, `createOpenAICompatible()` |

### Current Architecture

```
POST /api/library-agent/chat
  → createOpenAICompatible(apiKey, baseURL)
  → aiProvider.chatModel(model)
  → streamText({ model, system, messages, tools, maxSteps: 6 })
  → iterate textStream → SSE {content} events
  → await toolCalls → SSE {tool_call} events
  → await toolResults → SSE {tool_result} events
  → emit {done: true}
```

Key characteristics:
- `streamText()` handles the tool execution loop internally (`maxSteps: 6`)
- Tools defined with `tool()` + Zod schemas + `execute` functions
- Provider created via `createOpenAICompatible()` for MiMo/DeepSeek
- Messages converted to `CoreMessage[]` format
- SSE events emitted after streaming completes (not real-time per-token)

---

## Target State — Cline SDK

### Packages

| Package | Purpose |
|---------|---------|
| `@cline/sdk` | Public SDK surface (re-exports `@cline/core`) |
| `@cline/core` | Node runtime for sessions, built-in tools, persistence, hub support |
| `@cline/agents` | Browser-compatible stateless agent execution loop |
| `@cline/llms` | Provider gateway and model catalogs |
| `@cline/shared` | Types, schemas, tool helpers, hooks, storage helpers |

### Dependencies

```
@cline/sdk    (replaces ai + @ai-sdk/openai-compatible)
zod           (retained — Cline SDK uses Zod for tool schemas)
```

### Target Architecture

```
POST /api/library-agent/chat
  → new Agent({ providerId, modelId, apiKey, baseUrl, tools, systemPrompt, maxIterations })
  → agent.subscribe(event => SSE events)
  → agent.run(input)
  → emit {done: true}
```

Key characteristics:
- `Agent` class (alias for `AgentRuntime` from `@cline/agents`) manages the full agent loop
- Tools defined with `createTool()` + Zod schemas (or raw JSON Schema)
- Provider configured via `providerId` / `modelId` / `apiKey` / `baseUrl`
- Supports `openai-compatible` provider for MiMo/DeepSeek
- Event-based streaming via `agent.subscribe()` with typed `AgentRuntimeEvent`
- `maxIterations` replaces `maxSteps`
- Tool policies for approval control (`autoApprove: true/false`, `enabled: true/false`)
- Built-in abort via `agent.abort(reason)`
- Conversation restore via `agent.restore(messages)`

---

## Cline SDK Event Types (Verified)

From `agent.subscribe(listener)`, the `AgentRuntimeEvent` types are:

| Event Type | Payload | When |
|------------|---------|------|
| `assistant-text-delta` | `{ text: string }` | LLM streams text tokens |
| `tool-started` | `{ toolCall: { id, toolName, input } }` | Tool execution begins |
| `tool-finished` | `{ toolCall: { id, toolName, input }, result }` | Tool execution completes |
| `tool-failed` | `{ toolCall: { id, toolName, input }, error: Error }` | Tool execution fails |
| `usage-updated` | `{ usage: { inputTokens, outputTokens, totalCost } }` | Token/cost update |
| `run-finished` | `{ result: AgentRunResult }` | Run completes (`status: completed | aborted | failed`) |

### AgentRunResult

```typescript
interface AgentRunResult {
  agentId: string
  agentRole?: string
  runId: string
  status: 'completed' | 'aborted' | 'failed'
  iterations: number
  outputText: string
  messages: readonly AgentMessage[]
  usage: AgentUsage
  error?: Error
}
```

---

## Cline SDK Tool API (Verified)

### createTool()

```typescript
import { createTool } from '@cline/sdk'

const myTool = createTool({
  name: 'search_database',
  description: 'Search the application database.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().describe('Maximum results'),
  }),
  async execute(input, context) {
    // input is typed from Zod schema
    // context: { agentId, conversationId, iteration, abortSignal, metadata }
    return { results: [] }
  },
})
```

`inputSchema` accepts either:
- **Zod schema** — `z.object({...})` (type-safe)
- **Raw JSON Schema** — `{ type: 'object', properties: {...} }`

### Tool defaults from createTool()

| Field | Default |
|-------|---------|
| `timeoutMs` | `30000` |
| `retryable` | `true` |
| `maxRetries` | `3` |

### AgentToolContext (2nd arg to execute)

```typescript
interface AgentToolContext {
  agentId: string
  conversationId: string
  iteration: number
  abortSignal?: AbortSignal
  metadata?: Record<string, unknown>
}
```

### ToolPolicy

```typescript
interface ToolPolicy {
  enabled?: boolean      // default: true
  autoApprove?: boolean  // default: true
}
```

---

## Cline SDK Provider Config (Verified)

### OpenAI-Compatible (MiMo, DeepSeek)

```typescript
const agent = new Agent({
  providerId: 'openai-compatible',
  modelId: 'mimo-v2.5',
  apiKey: process.env.MIMO_API_KEY,
  baseUrl: 'https://token-plan-sgp.xiaomimimo.com/v1',
  ...
})
```

### Named Providers

```typescript
const agent = new Agent({
  providerId: 'anthropic',      // or 'openai', 'google', 'bedrock', etc.
  modelId: 'claude-sonnet-4-6',
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...
})
```

### Provider config fields

| Field | Type | Description |
|-------|------|-------------|
| `providerId` | `string` | Provider ID (`openai-compatible`, `anthropic`, `openai`, etc.) |
| `modelId` | `string` | Model ID |
| `apiKey` | `string` | API key |
| `baseUrl` | `string` | Custom base URL (for openai-compatible) |
| `headers` | `Record<string, string>` | Custom HTTP headers |

---

## Implementation Steps

### Step 1: Install Cline SDK, Remove Vercel AI SDK

```bash
npm install @cline/sdk
npm uninstall ai @ai-sdk/openai-compatible
```

Update `package.json`:
```diff
  "dependencies": {
-   "@ai-sdk/openai-compatible": "^3.0.11",
-   "ai": "^7.0.28",
+   "@cline/sdk": "^1.x.x",
    "zod": "^4.4.3",
    ...
  }
```

**Prerequisite:** Node.js 22+. Check with `node --version`.

### Step 2: Rewrite `server/routes/libraryAgent.ts`

#### 2a. Replace imports

```diff
- import { streamText, tool, type CoreMessage } from 'ai';
- import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
+ import { Agent, createTool } from '@cline/sdk';
  import { z } from 'zod';
```

#### 2b. Replace provider creation

```diff
- function createProvider(providerName?: string) {
-   const config = getProviderConfig(providerName);
-   return createOpenAICompatible({
-     apiKey: config.key,
-     baseURL: config.base,
-   });
- }
+ function resolveProvider(providerName?: string) {
+   const config = getProviderConfig(providerName);
+   return {
+     apiKey: config.key,
+     baseUrl: config.base,
+     providerId: 'openai-compatible',
+     modelId: config.model || 'mimo-v2.5',
+   };
+ }
```

Note: Cline SDK uses `baseUrl` (lowercase 'u') — not `baseURL`.

#### 2c. Replace tool definitions

Each `tool()` call becomes a `createTool()` call. Both use Zod schemas and async `execute` functions.

```diff
- import { tool } from 'ai';
+ import { createTool } from '@cline/sdk';

  const tools = {
-   search_library: tool({
+   search_library: createTool({
+     name: 'search_library',
      description: 'Search the component library...',
-     parameters: z.object({
+     inputSchema: z.object({
        query: z.string().describe('Natural language search query'),
        ...
      }),
-     execute: async ({ query, category, topK }) => {
+     execute: async (input, context) => {
+       const { query, category, topK } = input;
        ...
      },
    }),
    ...
  };
```

Key differences:
- `createTool()` requires an explicit `name` field (not inferred from object key)
- Uses `inputSchema` instead of `parameters`
- `execute` receives `(input, context)` — context provides `agentId`, `conversationId`, `iteration`, `abortSignal`
- Tools get automatic defaults: `timeoutMs: 30000`, `retryable: true`, `maxRetries: 3`

#### 2d. Replace the agent loop

The biggest change. Replace `streamText()` + manual SSE emission with `Agent` + `subscribe()`.

**Current (Vercel AI SDK):**
```typescript
const aiModel = aiProvider.chatModel(model || 'mimo-v2.5');
const result = streamText({
  model: aiModel,
  system: fullSystem,
  messages: coreMessages,
  tools,
  maxSteps: 6,
});

const stream = result.textStream;
for await (const chunk of stream) {
  fullText += chunk;
  emitEvent({ content: chunk });
}

const toolCalls = await result.toolCalls;
const toolResults = await result.toolResults;
// ... emit tool_call, tool_result events after streaming
```

**Target (Cline SDK):**
```typescript
const provider = resolveProvider(providerName);

const agent = new Agent({
  providerId: provider.providerId,
  modelId: model || provider.modelId,
  apiKey: provider.apiKey,
  baseUrl: provider.baseUrl,
  systemPrompt: fullSystem,
  tools: Object.values(tools),
  maxIterations: 6,
  toolPolicies: {
    delete_component_file: { autoApprove: false },
  },
});

let fullText = '';

agent.subscribe((event) => {
  switch (event.type) {
    case 'assistant-text-delta':
      fullText += event.text ?? '';
      emitEvent({ content: event.text });
      break;
    case 'tool-started':
      emitEvent({
        tool_call: {
          id: event.toolCall.id,
          name: event.toolCall.toolName,
          arguments: event.toolCall.input,
        },
      });
      if (event.toolCall.toolName === 'verify_component') {
        emitEvent({ verify_component: { componentId: event.toolCall.input.componentId } });
      }
      break;
    case 'tool-finished':
      emitEvent({
        tool_result: {
          toolCallId: event.toolCall.id,
          name: event.toolCall.toolName,
          output: typeof event.result === 'string' ? event.result : JSON.stringify(event.result),
        },
      });
      handleSpecialToolEvents(event.toolCall.toolName, event.result);
      break;
    case 'tool-failed':
      emitEvent({
        tool_result: {
          toolCallId: event.toolCall.id,
          name: event.toolCall.toolName,
          output: '',
          error: event.error?.message || 'Tool execution failed',
        },
      });
      break;
    case 'usage-updated':
      // Optional: emit token usage to client
      break;
    case 'run-finished':
      // Final status — handled after agent.run() returns
      break;
  }
});

const result = await agent.run(convertToClineMessages(messages));
// result.status: 'completed' | 'aborted' | 'failed'
// result.outputText: final assistant text
// result.usage: { inputTokens, outputTokens, totalCost }
```

**Key improvement:** Real-time per-token streaming via `assistant-text-delta` events. The current Vercel AI SDK path only emits text after `streamText()` completes each step — the Cline SDK streams tokens as they arrive.

#### 2e. Message format conversion

The Cline SDK's `agent.run()` accepts a string (single prompt) or `AgentMessage[]`. For multi-turn conversations:

```diff
- function convertToCoreMessages(messages: any[]): CoreMessage[] {
+ function convertToClineMessages(messages: any[]): AgentMessage[] {
    // Map messages to Cline SDK format
    // 'model' → 'assistant'
    // Include tool_calls and tool results for conversation continuity
  }
```

Alternatively, use `agent.restore(messages)` to load conversation history before calling `agent.run()`.

#### 2f. Abort handling

```diff
- // Current: AbortController passed to streamText()
+ // Cline SDK: agent.abort(reason)
+ if (reqClosed) {
+   agent.abort('Client disconnected');
+ }
```

#### 2g. Update the chat endpoint

```diff
  router.post('/chat', async (req, res) => {
    // ... (context building unchanged)

-   const aiProvider = createProvider(provider);
-   const tools = buildLibraryTools(componentId);
+   const providerConfig = resolveProvider(provider);
+   const toolMap = buildLibraryTools(componentId);

    // ... (SSE headers unchanged)

-   const result = streamText({ ... });
-   const stream = result.textStream;
-   for await (const chunk of stream) { ... }
-   const toolCalls = await result.toolCalls;
-   const toolResults = await result.toolResults;
+   const agent = new Agent({
+     providerId: providerConfig.providerId,
+     modelId: model || providerConfig.modelId,
+     apiKey: providerConfig.apiKey,
+     baseUrl: providerConfig.baseUrl,
+     systemPrompt: fullSystem,
+     tools: Object.values(toolMap),
+     maxIterations: 6,
+     toolPolicies: {
+       delete_component_file: { autoApprove: false },
+     },
+   });
+
+   agent.subscribe((event) => { /* SSE event mapping */ });
+
+   if (reqClosed) agent.abort('Client disconnected');
+   const result = await agent.run(convertToClineMessages(messages));

    emitEvent({ done: true });
    res.write('data: [DONE]\n\n');
    res.end();
  });
```

### Step 3: Rewrite `server/routes/skemaAgent.ts`

Apply the same changes. The Skema Agent uses the identical pattern (`streamText()` + `tool()` + `createOpenAICompatible()`). The migration is mechanical — same import swaps, same tool conversion, same agent creation.

### Step 4: Update `server/index.ts` (if needed)

No route changes needed — the Express routes stay the same. Only the internal implementation changes.

### Step 5: Handle OpenAI-Compatible Provider

The Cline SDK natively supports OpenAI-compatible endpoints via `providerId: 'openai-compatible'`. For MiMo and DeepSeek:

```typescript
const agent = new Agent({
  providerId: 'openai-compatible',
  modelId: 'mimo-v2.5',
  apiKey: process.env.MIMO_API_KEY,
  baseUrl: 'https://token-plan-sgp.xiaomimimo.com/v1',
  ...
});
```

**Risk:** MiMo uses regex-parsed tool calls (XML/code-block format), not native OpenAI function calling. The Cline SDK's `openai-compatible` provider likely expects native function calling (tool_calls in the API response).

**Mitigation options (in order of preference):**

1. **Test first** — MiMo may support function calling via its OpenAI-compatible API. If it does, no special handling needed.
2. **Use `@cline/agents` directly** — The `@cline/agents` package is the stateless agent loop. You can implement a custom model adapter that parses MiMo's regex-based tool calls and feeds them to the agent loop.
3. **Dual-path** — Keep `ai` for MiMo, use Cline SDK for providers that support native function calling (Anthropic, OpenAI, Google). Route based on `providerName`.
4. **System prompt injection** — Include tool definitions in the system prompt for MiMo (like the current `server/routes/library.ts` does) and parse tool calls from text. This bypasses the Cline SDK's tool execution entirely.

### Step 6: Frontend Changes

**None.** The frontend (`components/library/AgentSidebar.tsx`, `components/skema/agent/useSkemaAgentStream.ts`) communicates via SSE events. The SSE event format is preserved:

```
data: {"content": "..."}
data: {"tool_call": {...}}
data: {"tool_result": {...}}
data: {"done": true}
data: [DONE]
```

### Step 7: Verify Special Event Handling

The current code emits special SSE events after tool execution:

| Event | Trigger | Action |
|-------|---------|--------|
| `component_created` | After `create_component` | Reload library, toast |
| `component_updated` | After `write_component_file` | Reload library, dispatch `agent-file-changed` |
| `todo_list` | After `create_todo_list` | Render plan checklist |
| `ask_user` | After `ask_user` | Show question bubble |
| `verify_component` | After `verify_component` | Trigger sandbox preview |

These must be preserved in the `agent.subscribe()` handler via `handleSpecialToolEvents()`.

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| MiMo doesn't support native function calling | High | High | Use `@cline/agents` with custom model adapter, or dual-path |
| Cline SDK requires Node.js 22+ | Medium | Check first | Upgrade Node if needed |
| `@cline/sdk` API is evolving (pre-1.0) | Medium | Medium | Pin exact version, monitor changelogs |
| Zod version mismatch (v4 vs v3) | Low | Check first | Cline SDK may need `zod@3` — check peer deps |
| Cline SDK bundle size / startup latency | Low | Low | SDK is tree-shakeable |
| Event type name changes between SDK versions | Low | Low | Pin version, wrap in adapter layer |

---

## Dependency Impact

### Before
```
ai                          ^7.0.28   (Vercel AI SDK — streaming, tool loop, message types)
@ai-sdk/openai-compatible   ^3.0.11   (OpenAI-compatible provider)
zod                         ^4.4.3    (schema validation)
```

### After
```
@cline/sdk                  ^1.x.x   (Cline SDK — agent, tools, events, providers)
zod                         ^4.4.3    (retained — or downgrade to ^3.x if required)
```

Net: Remove 2 packages, add 1. The `@cline/sdk` re-exports `@cline/core`, `@cline/agents`, `@cline/llms`, `@cline/shared`.

---

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Swap `ai` + `@ai-sdk/openai-compatible` → `@cline/sdk` |
| `server/routes/libraryAgent.ts` | Rewrite: imports, provider, tools, agent loop, message conversion |
| `server/routes/skemaAgent.ts` | Same rewrite pattern |
| `docs/LIBRARY_AGENT.md` | Update architecture docs |
| `docs/library-agent-architecture.md` | Update architecture docs |

---

## Testing Strategy

1. **Prerequisite check** — `node --version` must be ≥ 22
2. **Provider test: MiMo** — Create agent with `openai-compatible` provider, send simple prompt, verify response
3. **Tool test** — Define a single `createTool()`, verify `execute` is called and result flows back
4. **SSE test** — Send a message, verify `assistant-text-delta`, `tool-started`, `tool-finished` events are emitted
5. **E2E test** — "Add a hover animation" → verify read → plan → write → verify flow works
6. **Provider test: DeepSeek** — Same verification
7. **Abort test** — Disconnect client mid-stream, verify `agent.abort()` is called
8. **Regression: Skema Agent** — Apply same changes, verify Skema agent still works

---

## Rollback Plan

If the Cline SDK doesn't work with MiMo (no native function calling):

1. Keep `ai` + `@ai-sdk/openai-compatible` as dependencies
2. Use Cline SDK only for providers that support native function calling (Anthropic, OpenAI, Google)
3. Add a provider check: if MiMo → use Vercel AI SDK path; if Anthropic/OpenAI → use Cline SDK path
4. Long-term: Migrate MiMo to support function calling, or switch to a provider that does

---

## Quick Reference: API Mapping

| Vercel AI SDK | Cline SDK | Notes |
|---------------|-----------|-------|
| `streamText({ model, system, messages, tools, maxSteps })` | `new Agent({ ... }); agent.run(input)` | Agent manages the loop |
| `tool({ description, parameters, execute })` | `createTool({ name, description, inputSchema, execute })` | `name` required, `parameters` → `inputSchema` |
| `createOpenAICompatible({ apiKey, baseURL })` | `{ providerId: 'openai-compatible', apiKey, baseUrl }` | Config on Agent constructor |
| `result.textStream` (async iterable) | `agent.subscribe(event => ...)` with `assistant-text-delta` | Event-based vs iterable |
| `await result.toolCalls` | `event.type === 'tool-started'` | Real-time events |
| `await result.toolResults` | `event.type === 'tool-finished'` | Real-time events |
| `CoreMessage` | `AgentMessage` | Check `@cline/agents` types |
| `maxSteps: 6` | `maxIterations: 6` | Same concept |
| `z.object({...})` | `z.object({...})` | Same (Zod) |
| `AbortController` | `agent.abort(reason)` | Built-in abort |
| — | `agent.restore(messages)` | Load conversation history |
| — | `agent.snapshot()` | Get runtime state |
| — | `toolPolicies` | Per-tool enablement/approval |
| — | `context.abortSignal` | Per-tool abort signal |
