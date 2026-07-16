# Plan: Fix Library Agent Tool Issues

## Root Cause Analysis

### Issue 1: "Missing required field: id" in read_component
The `read_component` Zod schema already requires `id: z.string()`. The error occurs inside `execute` (line 222 of `libraryAgent.ts`) when the model sends an empty string or the argument key doesn't match. The `componentId` from the request body (the component the user is editing) is available in `req.body.componentId` but is never passed to tool `execute` functions as a fallback.

**Fix**: In the `read_component` `execute`, fall back to `req.body.componentId` when `id` is empty. This requires passing the request's `componentId` into `buildLibraryTools()` or into a closure.

### Issue 2: create_todo_list "Tool execution failed (invalid arguments or validation error)"
The error at line 519 fires when a tool call's `toolCallId` is missing from `result.toolResults` — meaning the Vercel AI SDK's Zod validation rejected the model's arguments before `execute` ran. The model may send `tasks` as a stringified JSON instead of an array, or wrap tasks in an unexpected envelope. The current schema `z.array(z.object({...}))` is strict.

**Fix**: In `execute`, add defensive parsing — if `tasks` arrives as a string, `JSON.parse` it. Also make the Zod schema more permissive by accepting `z.any()` for `tasks` and doing manual validation inside `execute`.

### Issue 3: verify_component always times out
This is a **deadlock**. The flow is:
1. `streamText()` calls the model → model returns tool calls including `verify_component`
2. AI SDK executes `verify_component`'s `execute()` → calls `waitForVerifyResult()` which blocks for 15s
3. `execute()` returns → `result.toolCalls` resolves → server emits `verify_component` SSE event
4. Client receives event → dispatches `agent-verify-component` → ComponentEditor waits 8s → POSTs result

The problem: step 3 (emit event) only happens AFTER step 2 (execute blocks for 15s). But step 4 (client processes event) needs step 3 to happen first. So the verify result can never arrive in time — it's always a deadlock.

**Fix**: Remove `waitForVerifyResult` from `verify_component`'s `execute()`. Make it non-blocking — emit the verify event from the route handler immediately when the tool call is detected (this already happens at line 505), and have `execute()` return a fast "Verification triggered" message. The client handles verification asynchronously. The model sees a trigger confirmation instead of a 15-second timeout.

### Issue 4: Workflow steps (read → todo → write) should be optional
The system prompt (lines 118-170) uses imperative language: "MUST follow in this order — never skip steps", "create_todo_list and verify_component calls are mandatory". This forces the model to always create a todo list even for simple single-file edits, wasting tokens and time.

**Fix**: Soften the workflow language. Make it advisory: "Recommended workflow" instead of "MUST". Remove "mandatory" from create_todo_list and verify_component. Remove "NEVER stop after create_todo_list" anti-pattern rule.

---

## Files to Modify

### 1. `server/routes/libraryAgent.ts`

#### a. Pass `componentId` to `buildLibraryTools()`
- Change `buildLibraryTools()` signature to accept `componentId?: string`
- In `read_component` execute, fall back to the passed `componentId` when `id` is empty:
  ```ts
  execute: async ({ id }) => {
    const effectiveId = id || componentId;
    if (!effectiveId) return 'Error: Missing required field: id. Provide the component ID.';
    // ... rest unchanged, using effectiveId
  }
  ```
- Call site at line 467: `const tools = buildLibraryTools(componentId);`

#### b. Make `create_todo_list` Zod schema permissive + defensive execute
- Change `tasks` parameter from `z.array(z.object({...}))` to `z.any()`
- Inside execute, add:
  ```ts
  let parsedTasks = tasks;
  if (typeof parsedTasks === 'string') {
    try { parsedTasks = JSON.parse(parsedTasks); } catch { return 'Error: tasks must be a JSON array.'; }
  }
  if (!Array.isArray(parsedTasks) || parsedTasks.length === 0) return 'Error: Provide a non-empty tasks array.';
  ```
- Keep the rest of the mapping logic unchanged

#### c. Make `verify_component` non-blocking
- Remove the `waitForVerifyResult` call from execute
- Replace with immediate return:
  ```ts
  execute: async ({ componentId }) => {
    if (!componentId) return 'Error: Missing componentId.';
    const comp = library.getComponent(componentId);
    if (!comp) return `Component not found: ${componentId}`;
    return 'Verification triggered. The preview will render the component and check for errors.';
  }
  ```
- The verify event is already emitted at line 505 (in the `toolCalls` loop). The client already handles it. No other changes needed.

#### d. Soften system prompt workflow language
- Line 118: Change `## Workflow (MUST follow in this order — never skip steps)` to `## Recommended Workflow`
- Line 130-131: Change to `### Step 3: Create To-Do List (optional)` and add "Use create_todo_list for complex multi-step tasks. Skip for simple single-file changes."
- Line 139-144: Change to `### Step 5: Verify (optional)` and add "Use verify_component when you want to confirm the component renders correctly."
- Lines 154-156: Remove references to deleted tools (`create_component`, `create_folder`)
- Lines 163-170: Soften anti-pattern rules:
  - Remove "NEVER call create_todo_list after write_component_file. Workflow order is mandatory."
  - Remove "NEVER stop after create_todo_list. You MUST call write_component_file in the SAME response."

### 2. `server/services/libraryAgentTools.ts` (mirrors)
Apply the same Zod/permissive changes to the `LIBRARY_TOOLS` array and `executeLibraryTool` switch cases to keep both tool systems in sync:
- `create_todo_list`: add string-to-array parsing in the switch case
- `verify_component`: remove `waitForVerifyResult`, return immediate confirmation

### 3. `lib/agentConfig.ts` (no changes needed)
The tool list in `AGENT_TOOL_INFO.library` already doesn't include `create_component`, `update_component`, `create_folder`, or `move_to_folder`.

---

## Verification
- `npm run build` — no type errors
- Manual test: Library agent should:
  - Successfully read_component using the editing component's ID as fallback
  - Handle create_todo_list without validation errors even when model sends stringified tasks
  - Trigger verify without 15-second timeout (immediate response)
  - Skip todo list and verify for simple tasks (e.g., "fix the typo in line 5")
