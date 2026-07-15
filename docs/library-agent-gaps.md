# Library Agent — Gaps, Bugs & Loopholes

## Architecture Overview (Current State)

Two parallel agent implementations exist:

| Path | Implementation | Client calls? |
|------|---------------|--------------|
| `/api/library-agent/chat` | Vercel AI SDK `ToolLoopAgent` (`server/routes/libraryAgent.ts`) | **Yes** |
| `/api/library/agent/chat` | Manual MiMo streaming + tool loop (`server/routes/library.ts:629`) | **No** (dead code for agent chat) |

The client (`AgentSidebar.tsx`) calls `/api/library-agent/chat`. The MiMo-based agent at `/api/library/agent/chat` has more complete verify/ask_user handling but is not used by the client.

---

## Streaming & Text Accumulation

### How streaming currently works

```
Step 1: LLM generates "Let me read the component." → calls read_component
Step 2: LLM generates "Let me read the component.\nI see the issue..." → calls write_component_file
Step 3: LLM generates "Let me read the component.\nI see the issue...\nDone." → finishes
```

**Server (`libraryAgent.ts:122-131`):** Uses `onStepEnd` which fires ONCE at the END of each step. The `step.text` is the full accumulated text for that step. A delta extraction attempt strips the previous step's text:

```ts
const deltaText = step.text.startsWith(previousText)
  ? step.text.slice(previousText.length)
  : step.text;
```

**Client (`AgentSidebar.tsx:683-697`):** Concatenates every `content` event:

```ts
fullText += parsed.content;  // accumulates: "A", "AB", "ABC"
const { cleanText, toolBlocks } = extractToolBlocks(fullText);
```

### Problem 1: No real-time streaming — silent waits during tool execution

`onStepEnd` fires at step boundaries. Between the start of a step (LLM thinking + tool execution) and `onStepEnd`, the client receives nothing. A single step with a `write_component_file` tool can take 5-15 seconds. The user sees no output during this time.

**Fix:** Use the `streamResult.stream` iterable for real-time text/reasoning deltas. The stream emits `TextStreamTextDeltaPart`, `TextStreamReasoningDeltaPart`, etc. as they arrive — not at step boundaries. Reserve `onStepEnd` for tool call/result events only.

### Problem 2: Delta extraction is fragile — can send full accumulated text

If `step.text` doesn't start with `previousText` (e.g., the model restarts generation after a tool call, or the step text is different due to tool interleaving), the fallback sends the FULL `step.text`:

```ts
const deltaText = step.text.startsWith(previousText)
  ? step.text.slice(previousText.length)
  : step.text;  // ← sends everything, client duplicates it
```

When this happens, the client receives "Let me read the component." on step 1, then "Let me read the component.\nI see..." on step 2 (full text, not delta). The client concatenates: `"Let me read the component." + "Let me read the component.\nI see..." = "Let me read the component.Let me read the component.\nI see..."`.

**Fix:** Track the total accumulated text sent to the client. Always extract the delta against the last-sent text, not the previous step's text. Or better: switch to streaming parts (Problem 1 fix) which are inherently deltas.

### Problem 3: Client runs `extractToolBlocks` on every content chunk

`AgentSidebar.tsx:685` runs three regex passes over the FULL accumulated text on every `content` event:

```ts
const { cleanText, toolBlocks } = extractToolBlocks(fullText);
```

This re-parses the entire text history on every chunk. For a 5000-char response with 20 chunks, that's 100K characters of regex processing. The regex also has the nested-JSON bug (Bug #7 below).

**Fix:** Only run `extractToolBlocks` on the final text (after stream ends), or process only the new delta.

---

## Gaps Between Agent (Server) and Frontend (Client)

### 1. `verify_component` is fire-and-forget — agent never sees the result

**Severity: Critical**

The AI SDK agent's `verify_component` tool (`lib/agent/tools/library.ts:173-181`) returns JSON immediately:
```ts
execute: async (args) => {
  return JSON.stringify({ verify_component: true, componentId: args.componentId });
}
```

The agent loop continues to the next step without waiting. The verify result is never fed back to the agent.

Meanwhile, the MiMo agent (`server/routes/library.ts:808-824`) has a working implementation using `waitForVerifyResult()` — it blocks for up to 10 seconds, polls the `verifyResults` Map, and updates the tool result with actual render errors. This code is unreachable from the client.

**The `verifyResults` Map (`library.ts:513`) is written to by the client but never read by the AI SDK agent.**

**Fix:** The `verify_component` tool needs to block until the preview reports back. Options:
- Make `execute` async, poll the `verifyResults` Map (like the MiMo agent does)
- Use an `EventEmitter` or `Promise`-based approach where the tool resolves when the client POSTs back

### 2. `ask_user` doesn't pause the agent loop

**Severity: Critical**

Same pattern as verify. The `ask_user` tool returns JSON, the agent loop continues. The user sees the question bubble but the agent is already done or has moved to the next step.

The MiMo agent (`library.ts:767-777`) detects `ask_user` and breaks the loop. The AI SDK agent has no such logic.

**Fix:** Remove the `execute` function from `ask_user`. Without `execute`, the SDK pauses the loop and emits a `ToolUIPart` with `state: 'call'`. The client provides the answer via `addToolOutput()`.

### 3. History sent as plain text loses all tool context

**Severity: High**

`AgentSidebar.tsx:638`:
```ts
const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
```

This strips out:
- Tool call blocks (what tools the agent called)
- Tool results (what the tools returned)
- Agent plan blocks
- Ask-user blocks
- Reasoning/thinking content

The server receives only `{ role, content }` for each message. On multi-turn conversations, the agent has no memory of what tools it used or what happened. It re-reads the component from scratch every turn.

**Fix:** Send structured messages that include tool calls and results in the format the model expects (OpenAI-style `tool_calls` + `tool` role messages).

### 4. No reasoning/thinking loop between tool calls

**Severity: High**

The agent can chain tool calls without explaining what it's doing:

```
read_component → write_component_file → verify_component → write_component_file → done
```

The user sees tool call cards appearing in rapid succession with no explanation of:
- What the agent found when reading the file
- What it decided to change and why
- What errors it found after verification
- How it's fixing those errors

The system prompt (`lib/agent/prompts/library.ts:46-47`) says:
```
### 2. Analyze
Check: imports valid? Logic correct? JSX valid? Sandbox constraints met?
```

But this is advisory — the LLM can skip it. There's no enforcement that the agent must output reasoning text between tool calls.

**Fix:** Add a hard requirement to the system prompt:
```
After EVERY tool call, you MUST output a brief reasoning paragraph (1-3 sentences) explaining:
- What you observed from the tool result
- What you plan to do next and why
NEVER chain tool calls without reasoning text between them.
```

Additionally, the server could enforce this: if a step has tool calls but no text, inject a "Please explain your reasoning" message before continuing the loop.

### 5. Task status IDs are hardcoded and don't match actual tasks

**Severity: Medium**

`AgentSidebar.tsx:710-711`:
```ts
const statusToolMap: Record<string, string> = {
  'read_component': '1', 'create_todo_list': '3', 'write_component_file': '4', 'verify_component': '5',
};
```

Task IDs are assumed to be `'1'`, `'3'`, `'4'`, `'5'`. But the agent's `create_todo_list` tool generates task IDs dynamically (`t.id || String(i + 1)`). If the agent creates a plan with different IDs or fewer tasks, the status mapping silently fails — tasks never show as in-progress or completed.

**Fix:** Map tool names to task *titles* or *indices* instead of hardcoded IDs. Or update task statuses by matching against the plan's actual task structure.

### 6. Agent is stateless — no conversation memory between steps

**Severity: Medium**

A new `ToolLoopAgent` is created per request (`libraryAgent.ts:112`):
```ts
const agent = createLibraryAgent(model || 'mimo-v2.5', { provider, maxTokens });
```

The agent has no persistence. Combined with gap #3 (history stripped of tool context), multi-turn conversations are effectively starting from scratch each time — the agent re-reads the component, re-analyzes, and has no awareness of what it already did.

**Fix:** Either persist agent state (AI SDK doesn't provide this natively), or ensure the full tool-call history is sent back so the model can reconstruct context.

---

## Bugs

### 7. `extractToolBlocks` regex breaks on nested JSON

**Severity: Medium**

`AgentSidebar.tsx:51`:
```ts
.replace(/\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[\s\S]*?\}\s*\}/g, ...)
```

The `\{[\s\S]*?\}` pattern for `arguments` uses non-greedy matching, but if the LLM outputs JSON with nested objects (e.g., `{ "name": "foo", "arguments": { "a": { "b": 1 } } }`), the regex stops at the first `}` after `"b": 1`, capturing incomplete JSON. The `JSON.parse` then fails silently.

**Fix:** Use a proper JSON parser (parse from the opening `{` to the matching closing `}`) instead of regex.

### 8. AbortError removes the AI message entirely

**Severity: Medium**

`AgentSidebar.tsx:819-820`:
```ts
if (err.name === 'AbortError') {
  setMessages(prev => prev.filter(m => m.id !== aiMessageId));
}
```

If the agent produced partial content before abort (e.g., a plan + 2 tool calls + partial text), all of it is deleted. The user loses the agent's work-in-progress.

**Fix:** Keep the message but mark it as aborted. Preserve any blocks that were already rendered.

### 9. Session title only set on first exchange

**Severity: Low**

`AgentSidebar.tsx:551`:
```ts
if (msgs.length === 2 && msgs[0].role === 'user') {
  body.title = msgs[0].content.substring(0, 50);
}
```

The title is only set when there are exactly 2 messages (1 user + 1 assistant). If the first assistant message has only tool calls and no text content, or if the user sends a follow-up, the title is never updated.

### 10. Verify result can arrive before tool_call block is rendered

**Severity: Low (race condition)**

The flow is:
1. Server emits `tool_call` SSE event → client adds `tool_call` block to state
2. Server emits `verify_component` SSE event → client dispatches `agent-verify-component` CustomEvent
3. ComponentEditor renders preview, dispatches `agent-verify-result`
4. AgentSidebar catches `agent-verify-result`, POSTs to server

Steps 2-4 happen in `onStepEnd`, which fires after the tool *result* is available. But step 1 (adding the `tool_call` block) and step 2 (dispatching verify) happen in the same SSE processing loop iteration. If React hasn't re-rendered the tool_call block yet, the verify event fires before the user sees "Verifying..." in the UI.

### 11. 8-second hardcoded verify timeout

**Severity: Low**

`ComponentEditor.tsx:215`:
```ts
await new Promise(resolve => setTimeout(resolve, 8000));
```

The verify handler waits exactly 8 seconds for errors to appear. Complex components (heavy animations, lazy-loaded resources) may not render in time. Simple components waste 7+ seconds.

**Fix:** Use a `MutationObserver` or `requestAnimationFrame` loop that resolves when the preview iframe's error state stabilizes (no new errors for N milliseconds).

### 12. `isThinking` never set to `false` on tool-only responses

**Severity: Low**

`AgentSidebar.tsx:815-817`:
```ts
setMessages(prev => prev.map(m =>
  m.id === aiMsgId ? { ...m, isThinking: false } : m
));
```

This runs after the stream ends. But if the agent only produces tool calls and no text, `isThinking` stays `true` until the stream completes. The user sees "Thinking..." for the entire multi-step execution with no intermediate feedback that work is happening.

**Fix:** Set `isThinking: false` on the first `tool_call` event, not just at the end.

---

## Loopholes

### 13. Duplicate agent endpoints — confusion about which is active

`/api/library-agent/chat` (AI SDK) and `/api/library/agent/chat` (MiMo manual) both exist. The MiMo version has better verify/ask_user handling but is unreachable from the client. A developer could easily modify the wrong one.

### 14. No client-side guard against rapid re-submission

`handleSend` checks `isStreaming` before sending. But `setIsStreaming(true)` is a React state update — it's asynchronous. If the user double-clicks the send button rapidly, two requests can fire before the first `isStreaming` update propagates.

**Fix:** Use a `useRef` for the streaming flag (synchronous) in addition to the state.

### 15. `emitSpecialToolEvents` re-fetches components unnecessarily

`libraryAgent.ts:39`:
```ts
const comp = library.getComponent(parsed.componentId);
if (comp) res.write(`data: ${JSON.stringify({ component_created: comp })}\n\n`);
```

After `create_component`, the tool already returns the component data. But `emitSpecialToolEvents` re-fetches it from the DB. If the DB write hasn't committed (unlikely but possible with WAL mode), this could return stale data.

### 16. No input validation on `componentId` in the chat endpoint

`libraryAgent.ts:84`:
```ts
if (componentId) {
  const comp = library.getComponent(componentId);
  if (comp) componentContext = buildComponentContext(comp);
}
```

If `componentId` is a malicious string, `library.getComponent()` is called but the result is silently ignored if null. No validation that it's a valid format. Low risk since it's a read operation, but worth noting.

### 17. Session messages stored as JSON blob — no schema versioning

Sessions store `messagesJson` as a string. If the `AgentMessage` type changes (e.g., new block types, renamed fields), old sessions will fail to deserialize or render incorrectly. No migration path exists.

### 18. `toolApproval` for `delete_component_file` is declared but not functional

`agent.ts:18-20`:
```ts
toolApproval: {
  delete_component_file: 'user-approval',
},
```

The SDK will pause the loop and emit an approval request. But the client has no UI or handler for approval requests. The tool call is silently blocked — the agent thinks it deleted the file but nothing happened.

---

## Summary by Severity

| # | Issue | Severity | Type |
|---|-------|----------|------|
| 1 | `verify_component` result never fed back to agent | Critical | Gap |
| 2 | `ask_user` doesn't pause agent loop | Critical | Gap |
| 3 | History loses all tool context | High | Gap |
| 4 | No reasoning loop between tool calls | High | Gap |
| S1 | No real-time streaming — silent waits during tool execution | High | Streaming |
| S2 | Delta extraction fragile — can duplicate text on client | High | Streaming |
| 5 | Task status IDs hardcoded, don't match plan | Medium | Gap/Bug |
| 6 | Agent stateless per request | Medium | Gap |
| 7 | Regex-based JSON extraction can fail | Medium | Bug |
| 8 | AbortError deletes partial work | Medium | Bug |
| 13 | Duplicate agent endpoints | Medium | Loophole |
| 14 | No guard against rapid re-submission | Medium | Loophole |
| 18 | Tool approval declared but not wired | Medium | Loophole |
| S3 | `extractToolBlocks` re-parses full text on every chunk | Medium | Streaming |
| 9 | Session title only on first exchange | Low | Bug |
| 10 | Verify race condition | Low | Bug |
| 11 | 8-second hardcoded verify timeout | Low | Bug |
| 12 | `isThinking` sticky on tool-only responses | Low | Bug |
| 15 | Redundant component re-fetch | Low | Loophole |
| 16 | No input validation on componentId | Low | Loophole |
| 17 | No session schema versioning | Low | Loophole |
