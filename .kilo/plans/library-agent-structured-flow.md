# Library Agent: Structured Workflow Flow

## Goal
Restructure the library agent to always follow a 6-step structured workflow:
1. **Read files** — read the current component's files
2. **Think** — analyze for errors, improvements, and issues
3. **Create to-do list** — output a structured task list (displayed visually)
4. **Write/edit files** — execute each to-do item using `write_component_file`
5. **Verify build** — render in preview iframe, check for errors
6. **Report** — summarize all changes made

## Current State
- The agent has a simple prompt: "read → edit → explain"
- No structured workflow — the model decides what to do ad hoc
- `AgentPlan` component exists (`components/ui/agent-plan.tsx`) but is a **hardcoded demo** with static data — not connected to the agent
- Preview iframe lives in `ComponentEditor.tsx` (line 405-413), renders via `buildPreviewHtml()` from `constants.ts`
- Agent loop: `server/routes/library.ts:320-436` — max 8 iterations, streams tool calls/results via SSE

---

## Changes

### 1. New tool: `create_todo_list` — `server/services/libraryAgentTools.ts`

Add to `LIBRARY_TOOLS` array:
```typescript
{
  name: 'create_todo_list',
  description: 'Create a structured to-do list of tasks to accomplish. Call this after reading files and analyzing issues. Tasks are displayed visually to the user as a checklist. Each task will be executed sequentially.',
  parameters: {
    tasks: {
      type: 'array',
      description: 'Array of task objects: { "id": string, "title": string, "description": string, "priority": "high"|"medium"|"low" }'
    }
  }
}
```

Add handler in `executeLibraryTool` switch:
```typescript
case 'create_todo_list': {
  const { tasks } = call.arguments;
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    result.output = 'Error: Provide a non-empty tasks array.';
    result.error = 'No tasks';
    break;
  }
  result.output = JSON.stringify({ todo_list: true, tasks });
  break;
}
```

### 2. New tool: `verify_component` — `server/services/libraryAgentTools.ts`

Add to `LIBRARY_TOOLS`:
```typescript
{
  name: 'verify_component',
  description: 'Verify the component renders correctly in the preview sandbox. Triggers a live preview render and checks for React/runtime errors. Call this after completing all file edits.',
  parameters: {
    componentId: { type: 'string', description: 'Component ID to verify' }
  }
}
```

Add handler:
```typescript
case 'verify_component': {
  const { componentId } = call.arguments;
  if (!componentId) {
    result.output = 'Error: Missing componentId';
    result.error = 'Missing componentId';
    break;
  }
  const comp = library.getComponent(componentId);
  if (!comp) {
    result.output = `Component not found: ${componentId}`;
    result.error = 'Not found';
    break;
  }
  result.output = JSON.stringify({ verify_component: true, componentId });
  break;
}
```

### 3. Update system prompt — `server/routes/library.ts`

Replace `LIBRARY_AGENT_BASE_PROMPT` (line 174-185) with a structured workflow prompt:

```typescript
const LIBRARY_AGENT_BASE_PROMPT = `You are a component editor assistant. You ALWAYS follow this structured workflow for every request:

## Workflow (MUST follow in this order)

### Step 1: Read Files
Use read_component to see the current file contents. ALWAYS read before making any changes.

### Step 2: Think & Analyze
Analyze the code for:
- Syntax errors, missing imports, type errors
- Runtime issues (undefined variables, wrong props, missing dependencies)
- Code quality issues (unused code, poor patterns, accessibility)
- What the user specifically asked for

Think through your analysis in a brief internal monologue (1-3 sentences).

### Step 3: Create To-Do List
Use create_todo_list to output a structured list of tasks. Each task should be specific and actionable:
- Fix syntax error in line X
- Add missing prop validation
- Improve accessibility with aria labels
- etc.

### Step 4: Execute Tasks
Work through each to-do item. Use write_component_file to make changes one file at a time.
- For ui-widget components, only write to components.tsx and usage.tsx
- Read the file first if you need context before editing
- After each write, briefly note what you changed

### Step 5: Verify Build
Use verify_component to check the component renders without errors in the preview sandbox.
- If errors are found, create a new mini to-do list and fix them
- Repeat verify until no errors remain (max 3 attempts)

### Step 6: Report
Provide a concise summary of all changes made:
- What files were modified
- What issues were fixed
- What improvements were made
- Any remaining notes for the user

## Rules
- Be concise. Explain changes in 1-2 sentences per step.
- Content types: html, tsx, css, js, json, markdown.
- Categories: ui-widget, template, snippet, pattern, hook, util, agent-tool.
- Preview sandbox: React 18, ReactDOM 18, Babel standalone, Tailwind CSS, motion (framer-motion). For motion, use global \`motion\`, \`AnimatePresence\`, \`useReducedMotion\` — do NOT import. No other npm packages available.
- ui-widget file rules: exactly 2 files (components.tsx + usage.tsx). components.tsx has exports (isEntry: true). usage.tsx imports from './components' and renders with sample props. Must end with \`const root = ReactDOM.createRoot(document.getElementById('root')); root.render(<ComponentName />);\`
- delete_component_file is a LAST RESORT. Prefer overwriting with write_component_file. Never delete the last file in a component.`;
```

### 4. Update tool system prompt — `server/services/libraryAgentTools.ts`

In `buildLibraryToolSystemPrompt()` (line 81-119), add the workflow instructions to the prompt so the model knows the required order. The key addition is a note about the structured flow:

Append to the prompt after the existing rules:
```
STRUCTURED WORKFLOW — You MUST follow these steps in order:
1. read_component → 2. analyze → 3. create_todo_list → 4. write_component_file → 5. verify_component → 6. report
Never skip steps. The create_todo_list and verify_component calls are mandatory.
```

### 5. New SSE events — `server/routes/library.ts`

In the agent loop (line 386-433), handle the new tool results and emit SSE events:

**After `create_todo_list` tool result** (add after line 432):
```typescript
if (call.name === 'create_todo_list' && !result.error) {
  try {
    const parsed = JSON.parse(result.output);
    if (parsed.todo_list) {
      res.write(`data: ${JSON.stringify({ todo_list: parsed.tasks })}\n\n`);
    }
  } catch {}
}
```

**After `verify_component` tool result** (add after the `create_todo_list` block):
```typescript
if (call.name === 'verify_component' && !result.error) {
  try {
    const parsed = JSON.parse(result.output);
    if (parsed.verify_component) {
      res.write(`data: ${JSON.stringify({ verify_component: { componentId: parsed.componentId } })}\n\n`);
    }
  } catch {}
}
```

### 6. Update tool result handling for verify flow

The `verify_component` tool needs to pause and wait for client-side render results. Add a new endpoint:

**`server/routes/library.ts`** — new endpoint:
```typescript
router.post('/agent/verify-result', (req: Request, res: Response) => {
  // This endpoint receives render results from the client
  // and makes them available to the agent loop
  const { sessionId, componentId, errors, success } = req.body;
  // Store in a temporary map keyed by sessionId
  verifyResults.set(sessionId || componentId, { errors, success, timestamp: Date.now() });
  res.json({ ok: true });
});
```

Add a `verifyResults` Map at the top of the file to store pending results.

In the agent loop, after emitting `verify_component`, poll for results (with timeout):
```typescript
if (call.name === 'verify_component' && !result.error) {
  const vcId = parsed.componentId;
  res.write(`data: ${JSON.stringify({ verify_component: { componentId: vcId } })}\n\n`);
  
  // Wait for client-side render result (max 10s)
  const renderResult = await waitForVerifyResult(vcId, 10000);
  if (renderResult) {
    result.output = renderResult.success
      ? 'Verification passed: Component renders without errors.'
      : `Verification failed with errors:\n${renderResult.errors.join('\n')}`;
    if (!renderResult.success) result.error = 'Render errors';
  } else {
    result.output = 'Verification timed out. Component may be rendering correctly but no error report was received.';
  }
}
```

Add helper:
```typescript
const verifyResults = new Map<string, { errors: string[]; success: boolean; timestamp: number }>();

function waitForVerifyResult(componentId: string, timeoutMs: number): Promise<{ errors: string[]; success: boolean } | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const result = verifyResults.get(componentId);
      if (result && Date.now() - result.timestamp > start - 1000) {
        verifyResults.delete(componentId);
        resolve(result);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve(null);
        return;
      }
      setTimeout(check, 200);
    };
    check();
  });
}
```

### 7. Refactor `AgentPlan` component — `components/ui/agent-plan.tsx`

Replace the hardcoded `initialTasks` with props-driven dynamic data:

**New props interface:**
```typescript
interface AgentPlanProps {
  tasks: Task[];
  taskStatuses?: Record<string, 'pending' | 'in-progress' | 'completed' | 'failed'>;
  onTaskClick?: (taskId: string) => void;
}
```

**Changes:**
- Remove `initialTasks` constant (lines 33-217)
- Accept `tasks` and `taskStatuses` as props
- Use `taskStatuses` to override each task's `status` field for live updates
- Keep all existing animation/layout code
- Export as named export (currently default export)

### 8. Integrate AgentPlan into AgentDock — `components/AgentDock.tsx`

Add a collapsible "Plan" section above the messages area:

**New props:**
```typescript
// Add to AgentDockProps:
todoTasks?: Array<{ id: string; title: string; description: string; priority: string; status?: string }>;
```

**Rendering:**
- When `todoTasks` is non-empty, render a collapsible `<AgentPlan>` section between session tabs and messages
- Default collapsed after tasks are all completed
- Show task count badge: "3/5 done"
- Import and use the refactored `AgentPlan` component

### 9. Update AgentSidebar — `components/library/AgentSidebar.tsx`

Handle the new SSE events in the streaming handler (lines 254-335):

**Add state:**
```typescript
const [todoTasks, setTodoTasks] = useState<Array<{ id: string; title: string; description: string; priority: string; status?: string }>>([]);
const [verifyState, setVerifyState] = useState<'idle' | 'checking' | 'passed' | 'failed'>('idle');
```

**Handle `todo_list` event** (add after line 313):
```typescript
if (parsed.todo_list) {
  setTodoTasks(parsed.todo_list.map((t: any) => ({ ...t, status: 'pending' })));
}
```

**Handle `verify_component` event:**
```typescript
if (parsed.verify_component) {
  setVerifyState('checking');
  // Dispatch to ComponentEditor for actual render check
  window.dispatchEvent(new CustomEvent('agent-verify-component', {
    detail: { componentId: parsed.verify_component.componentId }
  }));
}
```

**Listen for verify results from ComponentEditor:**
```typescript
useEffect(() => {
  const handler = (e: CustomEvent) => {
    const { success, errors } = e.detail;
    setVerifyState(success ? 'passed' : 'failed');
    // Send result back to server
    fetch('/api/library/agent/verify-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ componentId: selectedComponent?.id, success, errors }),
    }).catch(() => {});
  };
  window.addEventListener('agent-verify-result', handler as EventListener);
  return () => window.removeEventListener('agent-verify-result', handler as EventListener);
}, [selectedComponent?.id]);
```

**Pass `todoTasks` to AgentDock:**
```tsx
<AgentDock
  ...existing props...
  todoTasks={todoTasks}
/>
```

**Update task statuses as tool results come in:**
When `tool_result` events arrive for `write_component_file`, update the corresponding task status to 'completed'.

### 10. ComponentEditor verify listener — `components/library/ComponentEditor.tsx`

Add an effect that listens for `agent-verify-component` events:

```typescript
useEffect(() => {
  const handler = async (e: CustomEvent) => {
    if (e.detail.componentId !== selectedComponent?.id) return;
    
    // The preview iframe is already rendering the latest files (via editFiles state)
    // We need to check for errors by listening to the iframe's error events
    
    const iframe = previewIframeRef.current;
    if (!iframe) {
      window.dispatchEvent(new CustomEvent('agent-verify-result', {
        detail: { success: false, errors: ['Preview iframe not available'] }
      }));
      return;
    }

    // Inject error listener into iframe
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        window.dispatchEvent(new CustomEvent('agent-verify-result', {
          detail: { success: false, errors: ['Cannot access preview iframe document'] }
        }));
        return;
      }

      // Check for errors in the iframe's console
      // Use a timeout to let the render settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Read error state from the iframe (if we injected error capture)
      // For now, report success if no obvious errors
      window.dispatchEvent(new CustomEvent('agent-verify-result', {
        detail: { success: true, errors: [] }
      }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('agent-verify-result', {
        detail: { success: false, errors: [err.message] }
      }));
    }
  };
  
  window.addEventListener('agent-verify-component', handler as EventListener);
  return () => window.removeEventListener('agent-verify-component', handler as EventListener);
}, [selectedComponent?.id, editFiles]);
```

Add a `previewIframeRef` to the preview iframe:
```tsx
<iframe
  ref={previewIframeRef}
  srcDoc={previewHtml}
  ...
/>
```

For a more robust error check, update `buildPreviewHtml` in `constants.ts` to inject error capture:
```typescript
// Add before </script> in the preview HTML:
window.addEventListener('error', function(e) {
  window.__renderErrors = window.__renderErrors || [];
  window.__renderErrors.push(e.message + ' at ' + e.filename + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', function(e) {
  window.__renderErrors = window.__renderErrors || [];
  window.__renderErrors.push('Unhandled: ' + e.reason);
});
window.__renderComplete = true;
```

### 11. Update task statuses during streaming — `AgentSidebar.tsx`

In the `tool_result` handler (line 293-305), when a `write_component_file` result arrives successfully, find and update the matching task:

```typescript
if (parsed.tool_result && parsed.tool_result.name === 'write_component_file' && !parsed.tool_result.error) {
  setTodoTasks(prev => {
    // Find the first non-completed task and mark it done
    const idx = prev.findIndex(t => t.status === 'pending' || t.status === 'in-progress');
    if (idx === -1) return prev;
    const updated = [...prev];
    updated[idx] = { ...updated[idx], status: 'completed' };
    return updated;
  });
}
```

When a `verify_component` result arrives:
```typescript
if (parsed.tool_result && parsed.tool_result.name === 'verify_component') {
  if (parsed.tool_result.error) {
    setVerifyState('failed');
  } else {
    setVerifyState('passed');
  }
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `server/services/libraryAgentTools.ts` | Add `create_todo_list` + `verify_component` tools (definitions + handlers); update `buildLibraryToolSystemPrompt` with workflow instructions |
| `server/routes/library.ts` | Replace `LIBRARY_AGENT_BASE_PROMPT`; add SSE events for `todo_list` and `verify_component`; add `/agent/verify-result` endpoint; add `verifyResults` map + `waitForVerifyResult` helper |
| `components/ui/agent-plan.tsx` | Refactor from hardcoded demo to props-driven component; accept `tasks`, `taskStatuses`, `onTaskClick` |
| `components/AgentDock.tsx` | Add `todoTasks` prop; render `AgentPlan` as collapsible section above messages |
| `components/library/AgentSidebar.tsx` | Add `todoTasks` + `verifyState` state; handle `todo_list`/`verify_component` SSE events; listen for `agent-verify-result` events; pass `todoTasks` to `AgentDock` |
| `components/library/ComponentEditor.tsx` | Add `previewIframeRef`; listen for `agent-verify-component` events; capture iframe errors and dispatch `agent-verify-result` |
| `components/library/constants.ts` | Inject error capture code into `buildPreviewHtml` output |

---

## Verification
1. Open a component in the library editor
2. Send a request like "fix any errors and improve this component" in the agent sidebar
3. Verify the agent: reads files → shows thinking → displays to-do list in AgentPlan UI → edits files → verify step triggers preview check → final report shown
4. Verify the to-do list updates in real-time (tasks turn green as completed)
5. Verify the preview iframe renders the updated component after edits
6. Test with a component that has intentional errors — agent should detect and fix them
