# Fix: Missing `await` on agent.stream()

## Root Cause

`server/routes/libraryAgent.ts:119` calls `agent.stream()` without `await`:

```ts
const streamResult = agent.stream({ ... });
```

`ToolLoopAgent.stream()` returns `Promise<StreamTextResult<TOOLS>>`. Without `await`, `streamResult` is a Promise object. At line 148:

```ts
const reader = (streamResult as any).textStream?.getReader();
```

A Promise doesn't have a `.textStream` property → `reader` is `undefined` → the `if (reader)` block is skipped → the agent loop never starts → callbacks never fire → immediate `[DONE]` with 200 (2ms).

## Fix

In `server/routes/libraryAgent.ts`:

```diff
- const streamResult = agent.stream({
+ await agent.stream({
    messages: modelMessages,
    onStepEnd: (step) => { ... },
  });

- const reader = (streamResult as any).textStream?.getReader();
- if (reader) {
-   try {
-     while (true) { const { done } = await reader.read(); if (done) break; }
-   } catch {}
- }
```

Remove the manual stream consumption (lines 148-158) — `onStepEnd` handles all event emission. The `await` ensures the agent loop runs to completion and callbacks fire for each step.
