# Plan: Stitch Agent — Incremental HTML Editing

## Problem

The Stitch feature currently regenerates the **full HTML** on every iteration. This wastes tokens, increases latency, risks drift on unrelated code, and doesn't leverage the existing agent tool-use loop.

## Goal

Wire Stitch into the existing agent architecture so the AI can make **surgical edits** to HTML using structured operations, with full regeneration as a fallback for major redesigns.

---

## Architecture Overview

```
StitchEditor
  └─ calls /api/agent/chat (reuses existing agent endpoint)
       ├─ tools: ["edit_html", "generate_html"]
       ├─ context: { currentHtml, layout, boardDescription }
       └─ agent loop (max 5 iterations):
            model reasons → calls edit_html → server applies via cheerio → result fed back → model decides if more edits needed
```

---

## Changes

### 1. Add `cheerio` dependency

```bash
npm install cheerio
```

Server-only dependency for DOM manipulation. No client bundle impact.

---

### 2. Extend tool registry — `server/services/agentService.ts`

Add two new tools to `AVAILABLE_TOOLS`:

**`edit_html`**
```typescript
{
  name: 'edit_html',
  description: 'Apply surgical edits to an HTML document using CSS selectors. Use for incremental changes to existing HTML. Returns the full modified HTML.',
  parameters: {
    edits: {
      type: 'array',
      description: 'JSON array of edit operations. Each edit has: { selector: string, action: "style"|"set_attr"|"remove_attr"|"add_class"|"remove_class"|"replace_content"|"insert_before"|"insert_after"|"remove"|"replace", property?: string, value?: string, html?: string }'
    }
  }
}
```

**`generate_html`**
```typescript
{
  name: 'generate_html',
  description: 'Generate a complete HTML file from scratch. Use for first-time generation or major redesigns that would require too many edits.',
  parameters: {
    prompt: { type: 'string', description: 'Description of the HTML to generate' }
  }
}
```

Modify `executeTool()` to accept an optional `context` parameter:
```typescript
export async function executeTool(call: ToolCall, context?: Record<string, any>): Promise<ToolResult>
```

Add cases for `edit_html` and `generate_html` in the switch statement.

---

### 3. Implement `toolEditHtml` — `server/services/agentService.ts`

Uses `cheerio` to apply structured edits to HTML:

```typescript
async function toolEditHtml(edits: EditOperation[], html: string): Promise<string>
```

Supported edit actions:
| Action | Args | Behavior |
|--------|------|----------|
| `style` | `selector, property, value` | Set inline CSS property |
| `set_attr` | `selector, property, value` | Set HTML attribute |
| `remove_attr` | `selector, property` | Remove HTML attribute |
| `add_class` | `selector, value` | Add CSS class |
| `remove_class` | `selector, value` | Remove CSS class |
| `replace_content` | `selector, html` | Replace innerHTML |
| `insert_before` | `selector, html` | Insert HTML before element |
| `insert_after` | `selector, html` | Insert HTML after element |
| `remove` | `selector` | Remove element |
| `replace` | `selector, html` | Replace outerHTML |

Returns the full modified HTML string after applying all edits in order.

---

### 4. Implement `toolGenerateHtml` — `server/services/agentService.ts`

Wraps the existing MiMo HTML generation logic (currently in `server/routes/stitch.ts:55-103`):

```typescript
async function toolGenerateHtml(prompt: string, layout: string, boardDescription?: string): Promise<string>
```

Extracts the system prompt construction and MiMo call from the stitch route into a reusable function. The tool makes a non-streaming `chatCompletion` call and returns the generated HTML.

---

### 5. Modify agent route — `server/routes/agent.ts`

Accept optional `context` in request body:
```typescript
const { messages, tools = [], model, provider, systemInstruction, stream = true, max_tokens, context } = req.body;
```

Pass `context` to `executeTool`:
```typescript
const result = await executeTool(call, context);
```

Inject the stitch system prompt when stitch tools are detected:
```typescript
if (tools.includes('edit_html') || tools.includes('generate_html')) {
  const stitchPrompt = buildStitchSystemPrompt(context);
  fullSystem = [stitchPrompt, systemInstruction, toolPrompt, langInstruction].filter(Boolean).join('\n\n');
}
```

---

### 6. Add `buildStitchSystemPrompt` — `server/services/agentService.ts`

```typescript
export function buildStitchSystemPrompt(context?: Record<string, any>): string
```

Generates a system prompt that:
- Tells the model it's a Stitch design agent
- Includes the current HTML (if any) so the model knows what it's editing
- Includes layout dimensions
- Instructs when to use `edit_html` vs `generate_html`:
  - `generate_html`: first-time generation, major redesigns, user says "redesign" or "start over"
  - `edit_html`: incremental changes, "make the header blue", "add a section", "remove the footer"
- Explains the edit operation format with examples

---

### 7. Wire StitchEditor — `components/StitchEditor.tsx`

Replace `generateHTMLStream` calls with `sendAgentMessage` from `services/agentService.ts`:

**Current flow:**
```
handleGenerate(prompt) → generateHTMLStream() → stream HTML chunks → setGeneratedHtml
```

**New flow:**
```
handleGenerate(prompt) → sendAgentMessage(messages, ["edit_html", "generate_html"], ..., context) →
  stream: text/reasoning → show in thinking panel
  stream: tool_call → show "Editing HTML..." or "Generating HTML..."
  stream: tool_result → extract HTML, update preview
  stream: tool_summary → finalize
```

Key changes to `handleGenerate`:
1. Build `context` object: `{ currentHtml: generatedHtml, layout, boardDescription: project.title }`
2. Call `sendAgentMessage` instead of `generateHTMLStream`
3. Listen for `toolResult` chunks — when `result.name === 'edit_html'` or `'generate_html'`, extract `result.output` as the new HTML
4. Update `generatedHtml` with the extracted HTML
5. Save to conversation history with the new envelope format

Update the chat history format:
```typescript
const history = chatMessages.map(m => ({
  role: m.role,
  content: m.role === 'user' ? m.content : `Applied design changes for: ${m.content}`,
}));
```

---

### 8. Update client service — `services/agentService.ts`

No changes needed to `sendAgentMessage` — it already handles `tool_call`, `tool_result`, and `tool_summary` events. The StitchEditor will consume these events directly.

---

### 9. Update `server/routes/stitch.ts`

Keep the existing `/api/stitch/generate-html` and `/api/stitch/generate-image` endpoints unchanged for backward compatibility. The StitchEditor will switch to using `/api/agent/chat` for the agent mode.

---

## File Changes Summary

| File | Action | What |
|------|--------|------|
| `package.json` | Edit | Add `cheerio` dependency |
| `server/services/agentService.ts` | Edit | Add `edit_html` + `generate_html` tools, `toolEditHtml`, `toolGenerateHtml`, `buildStitchSystemPrompt`, extend `executeTool` with context |
| `server/routes/agent.ts` | Edit | Accept `context` in request body, pass to `executeTool`, inject stitch system prompt |
| `components/StitchEditor.tsx` | Edit | Replace `generateHTMLStream` with `sendAgentMessage`, handle tool results, extract HTML |

---

## Edit Operation Format (what the model emits)

The model calls `edit_html` with structured JSON:

```json
{
  "edits": [
    { "selector": "header h1", "action": "style", "property": "color", "value": "#3b82f6" },
    { "selector": ".hero-section", "action": "replace_content", "html": "<h2>New Hero</h2><p>Updated content</p>" },
    { "selector": ".old-footer", "action": "remove" },
    { "selector": ".main-content", "action": "insert_after", "html": "<section class='cta'>Call to action</section>" }
  ]
}
```

The server applies these in order using cheerio and returns the full modified HTML.

---

## Model Behavior (system prompt guidance)

The stitch system prompt instructs the model:

1. **First generation** (no `currentHtml` in context): Use `generate_html` tool
2. **Incremental edits** (has `currentHtml`): Use `edit_html` tool with targeted selectors
3. **Major redesigns** (user says "redesign", "start over", "completely change"): Use `generate_html` tool
4. **Multiple edits**: Call `edit_html` once with an array of edits (preferred) or call multiple times if edits depend on each other
5. **After tool result**: The model sees the modified HTML and can decide if more edits are needed (up to 5 iterations)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Model emits invalid CSS selectors | `toolEditHtml` wraps each edit in try/catch, returns partial success with error details |
| Model chooses `generate_html` when it should edit | System prompt provides clear guidance; model sees current HTML in context |
| Large HTML makes context expensive | Truncate HTML in system prompt if > 50k chars; rely on tool result for full state |
| Cheerio modifies HTML structure (e.g., normalizes self-closing tags) | Acceptable — HTML is rendered in iframe, visual output is what matters |
| Agent loop adds latency for simple edits | Single tool call → single iteration, comparable to current full regeneration |

---

## Implementation Order

1. `npm install cheerio`
2. `server/services/agentService.ts` — add tools, implementations, stitch system prompt
3. `server/routes/agent.ts` — accept context, inject stitch prompt
4. `components/StitchEditor.tsx` — switch to agent endpoint
