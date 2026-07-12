# Plan: Library Agent Response — Parsing & Quality Analysis

## Context

The user provided the raw AI response from the Library Agent (component ID `3bqjdjn2gej`) when asked "what do you think needs to be revised". The response contains tool calls (`read_component`, `verify_component`, `write_component_file`, `create_todo_list`) embedded as `\`\`\`tool` / `\`\`\`json` fenced blocks. Two questions need answering:

1. How to parse these tool calls into the `AgentPlan` component (`<parser>` in `components/ui/agent-plan.tsx`)
2. Whether the AI response itself needs changes

---

## Question 1: Parsing Tool Calls into AgentPlan

### Current Architecture

| Layer | File | What it does |
|-------|------|-------------|
| Server: tool parser | `server/services/libraryAgentTools.ts:5` (`parseToolCalls` re-exported from `agentService.ts:878`) | Regex-extracts `\`\`\`tool {...}\`\`\`` / `\`\`\`json {...}\`\`\`` blocks from the AI's full text response |
| Server: tool executor | `server/services/libraryAgentTools.ts:145` (`executeLibraryTool`) | Executes each parsed tool call, returns `ToolResult` |
| Server: SSE emitter | `server/routes/library.ts:576-655` | After streaming finishes, parses tool calls → executes → emits `tool_call`, `tool_progress`, `tool_result`, `todo_list`, `component_updated`, `verify_component` SSE events |
| Client: SSE consumer | `components/library/AgentSidebar.tsx:254-347` | Consumes SSE events, builds `MessageBlock[]` (type: `tool_call` with name/args/result) |
| Client: AgentPlan | `components/ui/agent-plan.tsx` | Takes `AgentTask[]` props, renders expandable task tree with status icons |
| Client: plan parser | **Does not exist yet** | No code currently transforms `MessageBlock[]` or SSE events into `AgentTask[]` |

### The `create_todo_list` Tool is Already Special-Cased

The server already emits a `todo_list` SSE event when `create_todo_list` succeeds (`library.ts:623-630`):

```typescript
if (call.name === 'create_todo_list' && !result.error) {
  const parsed = JSON.parse(result.output);
  if (parsed.todo_list) {
    res.write(`data: ${JSON.stringify({ todo_list: parsed.tasks })}\n\n`);
  }
}
```

But the **client never handles this event**. The `AgentSidebar` SSE consumer (`AgentSidebar.tsx:254-347`) handles `content`, `tool_call`, `tool_progress`, `tool_result`, `ask_user`, `component_created`, `component_updated` — but **not** `todo_list`.

### What Needs to Be Built

#### Step 1: Add `todo_list` SSE handler in `AgentSidebar.tsx`

After the `parsed.component_updated` handler (~line 343), add:

```typescript
if (parsed.todo_list) {
  const tasks: AgentTask[] = parsed.todo_list.map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description || '',
    status: 'pending',
    priority: t.priority || 'medium',
    subtasks: [],
  }));
  setAgentPlanTasks(tasks);
  setMessages(prev => prev.map(m => {
    if (m.id !== aiMsgId) return m;
    const blocks = m.blocks ? [...m.blocks] : [];
    blocks.push({ type: 'agent_plan', tasks });
    return { ...m, blocks };
  }));
}
```

#### Step 2: Track tool call → task status mapping

After a `tool_result` is received, update the corresponding task status in `agentPlanTasks`:

- `read_component` → mark task "1" (Read Files) as `completed`
- `create_todo_list` → mark task "3" (Create To-Do List) as `completed` 
- `write_component_file` → mark the relevant write task as `completed`
- `verify_component` → mark task "5" (Verify) as `completed` or `failed`

The mapping logic needs to match tool names to task titles/descriptions.

#### Step 3: Add `agent_plan` MessageBlock type

Extend the `MessageBlock` union in `AgentSidebar.tsx:33-36`:

```typescript
type MessageBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, any>; result?: ...; collapsed?: boolean; progress?: string }
  | { type: 'ask_user'; question: string }
  | { type: 'agent_plan'; tasks: AgentTask[] };  // NEW
```

#### Step 4: Render `AgentPlan` in message blocks

In the message rendering loop (~line 608), add a case for `agent_plan`:

```typescript
if (block.type === 'agent_plan') {
  return <AgentPlan key={blockIdx} tasks={block.tasks} />;
}
```

#### Step 5: Real-time status updates via SSE

The server already emits `tool_call` and `tool_result` events. The client should:
1. When `tool_call` arrives → set matching task to `in-progress`
2. When `tool_result` arrives → set matching task to `completed` (or `failed` if `result.error`)

This requires maintaining a `taskStatuses: Record<string, string>` state that's passed to `AgentPlan` via the `taskStatuses` prop (which already exists but is unused).

### Parsing the Specific AI Response

The AI response contains these tool calls (in order):

1. `\`\`\`tool\n{"name": "read_component", "arguments": {"id": "3bqjdjn2gej"}}\n\`\`\`` — ×2 (repeated)
2. `\`\`\`json\n{"name": "read_component", "arguments": {"id": "3bqjdjn2gej"}}\n\`\`\`` — ×1
3. `\`\`\`json\n{"name": "verify_component", "arguments": {"id": "3bqjdjn2gej"}}\n\`\`\`` — ×3 (all fail due to wrong param name)
4. `\`\`\`json\n{"name": "write_component_file", "arguments": {"componentId": "3bqjdjn2gej", "filename": "components.tsx", "content": "..."}}\n\`\`\`` — ×3 (repeated)
5. `\`\`\`json\n{"name": "write_component_file", "arguments": {"componentId": "3bqjdjn2gej", "filename": "usage.tsx", "content": "..."}}\n\`\`\`` — ×3 (repeated)
6. `\`\`\`json\n{"name": "create_todo_list", "arguments": {"tasks": [...]}}\n\`\`\`` — ×1
7. `\`\`\`json\n{"name": "verify_component", "arguments": {"id": "3bqjdjn2gej"}}\n\`\`\`` — ×1 more

The server-side `parseToolCalls` function (`agentService.ts:878-910`) handles this correctly — it uses regex to extract all matching blocks and deduplicates by JSON parsing.

### Summary for Question 1

| What | Status |
|------|--------|
| Server-side parsing of tool calls from AI text | ✅ Already works (`parseToolCalls`) |
| Server-side execution of tool calls | ✅ Already works (`executeLibraryTool`) |
| Server-side SSE emission of `todo_list` event | ✅ Already works (`library.ts:623-630`) |
| Client-side handling of `todo_list` SSE event | ❌ **Missing** — needs to be added to `AgentSidebar.tsx` |
| Client-side rendering of AgentPlan in messages | ❌ **Missing** — needs `agent_plan` MessageBlock type + render case |
| Client-side real-time task status tracking | ❌ **Missing** — needs tool_call/tool_result → task status mapping |

---

## Question 2: Changes Needed to the AI Response

**Verdict: Yes, significant changes are needed.** The response has multiple structural, behavioral, and quality issues.

### Issue 1: Wrong `verify_component` Parameter (Critical — Causes Failures)

The AI calls `verify_component` with `{"id": "3bqjdjn2gej"}` but the tool expects `{"componentId": "3bqjdjn2gej"}` (see `libraryAgentTools.ts:87-91`). This causes every verify call to fail with "Missing componentId", which is why the AI retries 4+ times and gives up.

**Root cause**: The AI is confusing `read_component` (which uses `id`) with `verify_component` (which uses `componentId`).

**Fix**: The system prompt (`buildLibraryToolSystemPrompt`) already documents the correct parameter. The model is ignoring it. Options:
- Add a parameter mapping in `executeLibraryTool` to accept `id` as an alias for `componentId` on `verify_component`
- Add an explicit reminder in the system prompt: "verify_component uses `componentId`, NOT `id`"

### Issue 2: `create_todo_list` Called AFTER Execution (Workflow Violation)

The system prompt (`libraryAgentTools.ts:140-142`) mandates:
```
STRUCTURED WORKFLOW — You MUST follow these steps in order:
1. read_component → 2. analyze → 3. create_todo_list → 4. write_component_file → 5. verify_component → 6. report
```

But the AI calls `create_todo_list` **after** already calling `write_component_file` 6 times and `verify_component` 3 times. The todo list appears at the end of the response, making it useless as a planning tool.

**Fix**: Strengthen the workflow enforcement in the system prompt. Add: "If you have already called write_component_file or verify_component before create_todo_list, you have violated the workflow. STOP and restart from step 1."

### Issue 3: Massive Tool Call Duplication (Wastes Tokens & Time)

The AI calls the same tools multiple times:
- `read_component`: 3 times (should be 1)
- `write_component_file` for components.tsx: 3 times with nearly identical content
- `write_component_file` for usage.tsx: 3 times with nearly identical content
- `verify_component`: 4 times (all fail)

This is ~15 tool calls when 5 would suffice. Each call consumes server resources, API tokens, and user time.

**Fix**: Add to system prompt: "NEVER call the same tool with the same arguments twice. If you already read a component, do not read it again. If you already wrote a file, do not write it again unless you need to fix an error."

### Issue 4: Excessive Verbosity (Poor UX)

The response is extremely long with repeated analysis sections, explanations of what went wrong with verification, and summaries of changes that haven't been made yet. The user asked "what do you think needs to be revised" — they wanted an analysis, not a 3000-word essay with 15 tool calls.

**Fix**: The system prompt says "Be concise. 1-2 sentences per step explanation" but the AI ignores this. Add: "Total response length should be under 500 words for analysis tasks. Do not repeat yourself."

### Issue 5: Unrequested Design Changes

The user asked "what do you think needs to be revised" about a Data Table component. The AI not only analyzed it but **completely rewrote it** with a dark theme, new typography, and new pagination — none of which were requested. The AI should have analyzed first, proposed changes, and waited for approval.

**Fix**: Add to system prompt: "When the user asks 'what needs to be revised' or 'review this', provide ANALYSIS ONLY. Do not call write_component_file unless the user explicitly asks you to make changes."

### Issue 6: Hallucinated Analysis Claims

The AI claims the original design "uses a very light gray/white theme which can appear washed out" and that a dark theme "provides better contrast and readability" — but this is subjective opinion presented as fact. The AI is making design decisions without user input.

### Recommended System Prompt Changes

Add these rules to `LIBRARY_AGENT_BASE_PROMPT` or `buildLibraryToolSystemPrompt`:

```
### Anti-Pattern Rules (NEVER violate)
1. NEVER call verify_component with {"id": ...}. Use {"componentId": ...}.
2. NEVER call the same tool with identical arguments more than once.
3. NEVER call create_todo_list after write_component_file. The workflow is: read → analyze → todo → write → verify → report.
4. NEVER rewrite files when the user only asks for review/analysis. Provide analysis text only.
5. NEVER change visual design (colors, layout, typography) unless explicitly requested.
6. Keep responses under 500 words for review/analysis tasks.
```

---

## Implementation Priority

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1 | Fix `verify_component` param alias in `executeLibraryTool` | 🔴 Critical | 5 min |
| 2 | Add anti-pattern rules to system prompt | 🔴 Critical | 10 min |
| 3 | Add `todo_list` SSE handler in `AgentSidebar.tsx` | 🟡 High | 30 min |
| 4 | Add `agent_plan` MessageBlock type + render | 🟡 High | 20 min |
| 5 | Add real-time task status tracking | 🟢 Medium | 45 min |
| 6 | Add "review-only mode" to system prompt | 🟢 Medium | 10 min |
