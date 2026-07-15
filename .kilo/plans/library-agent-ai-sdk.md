# Library Agent: Switch to AI SDK `streamText` + Manual Tool Loop

## Goal

Replace the raw `streamChatCompletion` + `readSSEStream` approach in `server/routes/libraryAgent.ts` with AI SDK's `streamText` function. Keep the manual tool loop (no `ToolLoopAgent`) to avoid MiMo's compound text regeneration issue.

## Architecture

```
Client (AgentSidebar.tsx) — NO CHANGES
  │ POST /api/library-agent/chat
  ▼
Server (server/routes/libraryAgent.ts) — REWRITE /chat route
  │ Manual tool loop (same as now):
  │   while (iteration < MAX) {
  │     1. streamText({ model, messages }) — single LLM call, no tools
  │     2. Consume result.stream for reasoning deltas (real-time SSE)
  │     3. After stream completes, get full text via result.text
  │     4. parseToolCalls(fullText) — same parser
  │     5. Strip tool calls → send ONE content event
  │     6. Execute tools, emit events (all unchanged)
  │     7. Push results to messages → loop
  │   }
  ▼
Provider (lib/agent/provider.ts) — RECREATE
  │ createOpenAICompatible({ name, apiKey, baseURL })
  │ Returns provider function: provider(modelId) → LanguageModel
  ▼
Tools (server/services/libraryAgentTools.ts) — NO CHANGES
```

## Key Design Decision

**Why `streamText` without tools?** 

AI SDK's `streamText` when called WITHOUT `tools` makes a single LLM call and streams the response — no internal multi-step loop. This means MiMo only generates text once per iteration, avoiding the compound text issue entirely. We parse tool calls from the text output manually (using existing `parseToolCalls`), giving us full control.

If we passed `tools` to `streamText`, it would loop internally (like `ToolLoopAgent`), triggering MiMo's full-text regeneration per step.

## Files to Change

### 1. `lib/agent/provider.ts` — RECREATE (was deleted in previous session)

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export function createProvider(provider?: string) {
  // Same logic as mimoService.getProviderConfig but returns AI SDK provider
  const apiKey = process.env.MIMO_API_KEY || '';
  const baseUrl = process.env.MIMO_BASE_URL || '...';
  // ... mimo-direct, deepseek variants
  return createOpenAICompatible({ name, apiKey, baseURL: baseUrl });
}
```

Returns a function: `(modelId: string) => LanguageModel`

### 2. `server/routes/libraryAgent.ts` — REWRITE `/chat` route only

**Imports change:**
- Remove: `streamChatCompletion`, `readSSEStream`, `ChatMessage` from `mimoService`
- Add: `streamText` from `ai`, `createProvider` from `../../lib/agent/provider`
- Keep: `detectLanguage`, `buildLanguageInstruction` from `mimoService`

**Loop body changes (each iteration):**

Current:
```typescript
const response = await streamChatCompletion({ model, messages, stream: true, thinking: { type: 'disabled' } }, provider);
await readSSEStream(response, (chunk) => { fullResponse += chunk.content; });
```

New:
```typescript
const providerInstance = createProvider(provider);
const modelInstance = providerInstance(model || 'mimo-v2.5');

const result = await streamText({
  model: modelInstance,
  messages: apiMessages,
  maxTokens: max_tokens || undefined,
});

// Stream reasoning deltas to client in real-time
for await (const part of result.stream) {
  if (part.type === 'reasoning-delta') {
    res.write(`data: ${JSON.stringify({ reasoning: part.textDelta })}\n\n`);
  }
}

// Full text after stream completes
const fullResponse = await result.text;
```

Everything after (parseToolCalls, strip tool calls, execute tools, emit events) stays identical.

**Message format:** AI SDK `streamText` accepts messages as `{ role, content }[]` — same shape we already build. No conversion needed.

### 3. No other files change

- `components/library/AgentSidebar.tsx` — No changes (SSE protocol identical)
- `server/services/libraryAgentTools.ts` — No changes (tools unchanged)
- `server/services/verifyService.ts` — No changes
- `server/routes/library.ts` — No changes

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `@ai-sdk/openai-compatible` doesn't forward MiMo's `thinking` parameter | Low — reasoning tokens may appear in content | Pass `providerOptions: { thinking: { type: 'disabled' } }` if available; test empirically |
| AI SDK message format rejects `role: 'tool'` messages in history | Medium — structured history breaks | Convert tool-role messages to `role: 'user'` with formatted content (already done in current code) |
| `result.text` includes reasoning tokens mixed in | Low — content may have thinking text | Use `result.stream` to separate reasoning from text parts; accumulate text only from `text-delta` parts |

## Implementation Order

1. Recreate `lib/agent/provider.ts`
2. Rewrite the `/chat` route in `server/routes/libraryAgent.ts`
3. Run `npm run build` to verify
