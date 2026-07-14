# Fix: agent.stream() — stream consumption + text deduplication

## Issue 1: Stream never consumed (FIXED)

**Root Cause:** `ToolLoopAgent.stream()` calls `streamText()` internally, which returns `StreamTextResult` synchronously with lazy `ReadableStream`s. Without consuming `result.stream`, the agent loop never executes — `onStepEnd` never fires.

**Fix applied** at `server/routes/libraryAgent.ts:119-150`:
- Store `agent.stream()` result in `streamResult`
- Add `for await (const _part of streamResult.stream)` to consume the lazy stream

## Issue 2: Text duplication — `step.text` is cumulative across steps (TODO)

**Root Cause:** In the AI SDK's `streamText` with agent loop (`stopWhen`), each step's model response generates its full thinking as text. The model re-states its entire plan/goal in each response, so `step.text` (from `DefaultStepResult.text` getter, `node_modules/ai/dist/internal/index.js:2615-2617`) is cumulative — it includes all text from previous steps.

The frontend (`AgentSidebar.tsx:683-684`) treats each SSE `{ content }` event as a **delta**: `fullText += parsed.content`. When the server emits cumulative `step.text`, the frontend appends the full text each time, causing quadruple (or more) duplication.

**Fix:** In the `onStepEnd` handler, compute the delta between the current step's text and the previously-seen text:

```diff
+    let previousTextLength = 0;

     const streamResult = await agent.stream({
       messages: modelMessages,
       onStepEnd: (step) => {
+        const fullText = step.text;
+        const deltaText = fullText.slice(previousTextLength);
+        previousTextLength = fullText.length;
+
-        if (step.text) {
-          res.write(`data: ${JSON.stringify({ content: step.text })}\n\n`);
+        if (deltaText) {
+          res.write(`data: ${JSON.stringify({ content: deltaText })}\n\n`);
         }
         // ... rest unchanged
       },
     });

     for await (const _part of streamResult.stream) { ... }
```

- `previousTextLength` tracks the cumulative length of text emitted so far
- `fullText.slice(previousTextLength)` extracts only the new text since last step
- This preserves the frontend's delta-append semantics (`fullText += parsed.content`)
