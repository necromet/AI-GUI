# Fix: Agent Route Missing `thinking: disabled` — Empty Model Responses

## Root Cause

**The agent route (`server/routes/agent.ts`) does NOT set `thinking: { type: 'disabled' }`** on the `streamChatCompletion` call.

MiMo v2.5 is a reasoning model. When `thinking` is unspecified, the model may produce output in `reasoning_content` (reasoning tokens) instead of `content` (regular tokens). The streaming loop at `agent.ts:114-122` only accumulates `content` into `fullResponse`:

```javascript
const content = parsed.choices?.[0]?.delta?.content;
const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;

if (content) {
  fullResponse += content;    // ← only content is accumulated
} else if (reasoning) {
  // reasoning is forwarded to client but NOT added to fullResponse
}
```

If the model spends its entire output budget on reasoning tokens, `fullResponse` stays empty → `parseToolCalls('')` finds 0 tool calls → the agent loop breaks with no HTML generated.

**Evidence:** 
- The stitch `/generate-html` route explicitly sets `thinking: { type: 'disabled' }` (stitch.ts:246) — this path works
- The agent `/chat` route has no `thinking` parameter — returns 0-length response
- Image analysis also works because it's a simple completion call (not reasoning-intensive)

## Fix

### `server/routes/agent.ts` — Add `thinking: { type: 'disabled' }` to agent loop

**Line 74-79** — the `streamChatCompletion` call:

```javascript
// BEFORE:
const response = await streamChatCompletion({
  model: model || 'mimo-v2.5',
  messages: apiMessages,
  stream: true,
  ...(max_tokens ? { max_tokens } : {}),
}, provider);

// AFTER:
const response = await streamChatCompletion({
  model: model || 'mimo-v2.5',
  messages: apiMessages,
  stream: true,
  thinking: { type: 'disabled' },
  ...(max_tokens ? { max_tokens } : {}),
}, provider);
```

This forces the model to output tool calls in the `content` field where `parseToolCalls()` can find them.

## Files Modified

| File | Change |
|------|--------|
| `server/routes/agent.ts` | Add `thinking: { type: 'disabled' }` to the `streamChatCompletion` call in the agent loop |

## Why This Is Safe

- Tool calls are custom-formatted (````tool` fenced blocks) and MUST be in `content` to be parsed
- The model can still reason internally about what to generate — the thinking just happens in the content field
- The non-streaming fallback path (line 181-185) also doesn't set `thinking` — same fix should apply there for consistency
- The direct `/generate-html` route already uses `thinking: { type: 'disabled' }` — this brings the agent path in line

## Verification

After the fix, the log should show:
```
[agent/chat] Model response length: > 0
[agent/chat] Tool calls found: 1 (or more)
```
Instead of the current:
```
[agent/chat] Model response length: 0
[agent/chat] Tool calls found: 0
```
