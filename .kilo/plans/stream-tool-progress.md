# Plan: Show Generation Progress for Spec & HTML Tools

## Problem

When the agent uses `generate_spec`, `edit_spec`, or `generate_html` tools, the server calls `chatCompletion` (non-streaming) internally. During this 10-30s window, the client receives zero SSE events — the user sees only a static spinner ("Composing design..." / "Generating HTML...") with no indication of progress. The user stopped the process because they thought it was stuck.

For HTML/web creation, the streaming HTML is also rendered in an iframe during generation, showing broken/partial content.

## Solution

Two-part fix:
1. **Stream tool execution progress**: Switch `toolGenerateSpec`, `toolEditSpec`, `toolGenerateHtml` from `chatCompletion` → `streamChatCompletion`, and forward each chunk to the client via a new `tool_progress` SSE event.
2. **Collapsible streaming preview**: During generation, don't render partial HTML in the iframe. Show a collapsible progress indicator instead. Render final HTML only when complete.

---

## Part 1: Stream tool progress (server → client)

### 1a. Add `onProgress` callback to tool functions

**File: `server/services/agentService.ts`**

Add an optional `onProgress?: (chunk: string) => void` parameter to:
- `toolGenerateSpec` (line 567)
- `toolEditSpec` (line 618)
- `toolGenerateHtml` (line 511)

Switch each from `chatCompletion` (non-streaming) to `streamChatCompletion` (streaming). Read the SSE stream internally, accumulate the full response, and call `onProgress(content)` for each content chunk.

Example for `toolGenerateSpec`:
```typescript
async function toolGenerateSpec(
  prompt: string, layout: string, projectType: string, slideCount?: number,
  model?: string, provider?: string, images?: any[], imageAnalysis?: string,
  currentSpec?: any, referenceSpec?: any, componentContext?: string,
  onProgress?: (chunk: string) => void,  // NEW
): Promise<string> {
  // ... build systemPrompt and messages (unchanged) ...

  const response = await streamChatCompletion({
    model: model || 'mimo-v2.5',
    messages,
    stream: true,
    thinking: { type: 'disabled' },
  }, provider);

  // Read SSE stream, accumulate specText, call onProgress for each chunk
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let specText = '';
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      // parse SSE data, extract content delta
      // specText += content
      // onProgress?.(content)
    }
  }
  // ... parse JSON, return (unchanged) ...
}
```

Same pattern for `toolEditSpec` and `toolGenerateHtml`.

### 1b. Thread `onProgress` through `executeTool`

**File: `server/services/agentService.ts`**

Add `onProgress?: (chunk: string) => void` to `executeTool` signature (line 163). Pass it to the tool functions:

```typescript
export async function executeTool(
  call: ToolCall,
  context?: Record<string, any>,
  onProgress?: (chunk: string) => void,  // NEW
): Promise<ToolResult> {
  // ...
  case 'generate_spec':
    result.output = await toolGenerateSpec(...args, onProgress);
    break;
  case 'edit_spec':
    result.output = await toolEditSpec(...args, onProgress);
    break;
  case 'generate_html':
    result.output = await toolGenerateHtml(...args, onProgress);
    break;
}
```

### 1c. Forward progress as SSE events in agent route

**File: `server/routes/agent.ts`**

In the tool execution loop (line 161-193), create an `onProgress` callback that writes `tool_progress` SSE events:

```typescript
for (const call of toolCalls) {
  res.write(`data: ${JSON.stringify({ tool_call: { name: call.name, arguments: call.arguments } })}\n\n`);

  const onProgress = (chunk: string) => {
    res.write(`data: ${JSON.stringify({ tool_progress: { name: call.name, chunk } })}\n\n`);
  };

  const result = await executeTool(call, context, onProgress);
  // ... rest unchanged ...
}
```

Do this for BOTH the streaming path (line 161) and the non-streaming path (line 225).

### 1d. Parse `tool_progress` on the client

**File: `services/agentService.ts` (client)**

Add `toolProgress` to `AgentStreamChunk`:
```typescript
export interface AgentStreamChunk {
  text: string;
  thinkingText?: string;
  toolCall?: { name: string; arguments: Record<string, any> };
  toolResult?: ToolResult;
  toolSummary?: ToolResult[];
  toolProgress?: { name: string; chunk: string };  // NEW
}
```

In `sendAgentMessage`, parse the new event:
```typescript
if (parsed.tool_progress) {
  yield { text: '', toolProgress: parsed.tool_progress };
  continue;
}
```

### 1e. Display tool progress in StitchEditor

**File: `components/StitchEditor.tsx`**

Add state:
```typescript
const [toolProgressText, setToolProgressText] = useState('');
```

In the streaming loop, handle `toolProgress`:
```typescript
if (chunk.toolProgress) {
  setToolProgressText(prev => prev + chunk.toolProgress!.chunk);
}
```

Reset on new generation start (alongside other resets):
```typescript
setToolProgressText('');
```

In the active tool call section (around line 821), add a collapsible progress view when `toolProgressText` is non-empty. This shows the streaming text from the tool's internal LLM call:

```tsx
{toolProgressText && activeToolCalls.some(tc => !tc.output) && (
  <div className="mt-2" style={{ borderTop: '1px solid var(--border-300)', paddingTop: '6px' }}>
    <button
      onClick={() => setExpandedToolProgress(prev => !prev)}
      className="flex items-center gap-1.5 w-full text-left"
    >
      <Eye size={10} style={{ color: 'var(--neon-color)' }} />
      <span className="text-[10px] font-semibold" style={{ color: 'var(--text-500)' }}>
        {activeToolCalls[activeToolCalls.length - 1]?.name === 'generate_html'
          ? `Generating HTML... ${toolProgressText.length.toLocaleString()} chars`
          : `Composing spec... ${toolProgressText.length.toLocaleString()} chars`}
      </span>
      {expandedToolProgress ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
    </button>
    {expandedToolProgress && (
      <div className="mt-1 max-h-32 overflow-y-auto text-[10px] font-mono leading-relaxed"
        style={{ color: 'var(--text-500)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {toolProgressText.slice(-2000)}
      </div>
    )}
  </div>
)}
```

Add state `expandedToolProgress` (boolean, default false).

---

## Part 2: Collapsible HTML preview during generation

### 2a. Don't render streaming HTML in iframe during generation

**File: `components/StitchEditor.tsx`**

Change `displayHtml` (line 601) to NOT use `streamingHtml` when generating:

```typescript
// Before:
const displayHtml = generatedHtml || (isGenerating ? streamingHtml : '');

// After:
const displayHtml = generatedHtml || '';
```

This means during generation, the iframe shows nothing (or the previous `generatedHtml`). The streaming HTML is only rendered when it becomes `generatedHtml` (after the tool completes and the result is processed).

### 2b. Show generation progress in preview area

When `isGenerating && !displayHtml`, the preview area already shows a loading state (line 1033-1040). Keep that. But also show it when `isGenerating && displayHtml` exists (i.e., regenerating an existing design):

```tsx
{isGenerating ? (
  <div className="text-center py-20">
    {/* existing loader */}
    <p>{isIgContent ? 'Composing design...' : 'Generating HTML...'}</p>
    {/* NEW: show elapsed time or progress */}
  </div>
) : displayHtml ? (
  /* iframe */
) : (
  /* empty state */
)}
```

When `isGenerating` is true, always show the loading state in the preview area instead of the iframe. The streaming progress text is visible in the sidebar's active tool call section (Part 1e).

### 2c. Keep sidebar streamingHtml character count

The existing sidebar section that shows "X characters generated" (line 855-863) remains as-is — it provides feedback during direct HTML streaming (non-agent path). For agent-based generation, the `toolProgressText` section (Part 1e) provides the feedback.

---

## Files to modify

| File | Changes |
|------|---------|
| `server/services/agentService.ts` | Add `onProgress` to `executeTool`, `toolGenerateSpec`, `toolEditSpec`, `toolGenerateHtml`; switch to `streamChatCompletion` |
| `server/routes/agent.ts` | Write `tool_progress` SSE events during tool execution |
| `services/agentService.ts` (client) | Add `toolProgress` to `AgentStreamChunk`; parse `tool_progress` events |
| `components/StitchEditor.tsx` | Add `toolProgressText`/`expandedToolProgress` state; handle `toolProgress` chunks; show progress in sidebar; don't render `streamingHtml` in iframe during generation |

## Notes

- The SSE stream-reading boilerplate in the tool functions is repetitive. Consider extracting a shared `readSSEStream(response, onChunk)` helper in `mimoService.ts`.
- The `edit_html` tool also uses non-streaming cheerio processing, but that's fast (<1s) — no need to stream progress for it.
- For the non-streaming agent path (line 201-258 in agent.ts), the same `onProgress` callback can be used, though it's less critical since that path is rarely used.
