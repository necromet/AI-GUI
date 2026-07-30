# Plan: Stitch Agent via Vercel AI SDK

## Goal
Replace the current manual SSE + regex-based stitch agent (`server/routes/agent.ts`) with a new dedicated route using the Vercel AI SDK (`streamText` + `tool()` + Zod), matching the pattern of the library agent (`server/routes/libraryAgent.ts`). Tools are adjusted for carousel/stitch capabilities.

## Architecture Comparison

| Aspect | Current (agent.ts) | New (stitchAgent.ts) |
|--------|-------------------|---------------------|
| AI SDK | Raw MiMo SSE + manual parsing | Vercel AI SDK `streamText` |
| Tool definitions | Plain objects + `executeTool()` switch | `tool()` + Zod schemas |
| Tool call parsing | Regex on text output (`` ```tool ``) | Native (AI SDK handles) |
| Agent loop | Manual while loop, max 5 iterations | `maxSteps` parameter |
| Provider | `streamChatCompletion` (MiMo) | `createOpenAICompatible` (same provider) |
| Endpoint | `/api/agent/chat` (shared with plugin) | `/api/stitch-agent/chat` (dedicated) |

## Files to Create/Modify

### 1. CREATE `server/routes/stitchAgent.ts`

New Express route using Vercel AI SDK. Pattern follows `libraryAgent.ts`.

**Imports:**
```ts
import { Router } from 'express';
import { streamText, tool, type CoreMessage } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';
import { getProviderConfig, detectLanguage, buildLanguageInstruction } from '../services/mimoService';
import { buildStitchSystemPrompt, analyzeImages, toolExecuteCode } from '../services/agentService';
import * as stitchSpecPrompt from '../services/stitchSpecPrompt';
import * as libraryService from '../services/libraryService';
```

**Tools (8 total) — all using `tool()` + Zod:**

1. **`generate_html`** — Generate complete HTML. Calls `streamChatCompletion` internally (reuses logic from `agentService.ts:toolGenerateHtml`). Accepts `prompt` (string) + context from request.
2. **`edit_html`** — Surgical HTML edits via CSS selectors. Uses cheerio (reuses `toolEditHtml` logic). Accepts `edits` array.
3. **`generate_spec`** — Generate JSON design spec for IG carousels/stories. Calls `streamChatCompletion` with spec system prompt (reuses `toolGenerateSpec` logic). Accepts `prompt`, `slideCount`.
4. **`edit_spec`** — Edit existing JSON spec fields. Accepts `edits` array of `{path, value}`.
5. **`search_library`** — Search stitch component library. Delegates to `libraryService.searchComponents`.
6. **`web_browse`** — Fetch URL content. Simple fetch + strip HTML.
7. **`execute_code`** — Sandboxed JS execution. Delegates to `toolExecuteCode`.
8. **`search_web`** — DuckDuckGo search. Reuses existing implementation.

**Key design decisions:**
- Tool implementations delegate to existing functions in `agentService.ts` where possible (no duplication of logic)
- `generate_html` and `generate_spec` are async tools that make their own LLM sub-calls — they stream internally and return the final result
- Context (layout, projectType, images, currentHtml, currentSpec, etc.) is passed via request body and injected into tool closures
- System prompt built by `buildStitchSystemPrompt()` from `agentService.ts` (existing, unchanged)
- Image analysis done upfront (before streaming) when images are present, same as current behavior

**Route: `POST /chat`**
```ts
router.post('/chat', async (req, res) => {
  const { messages, model, provider, context, max_tokens, systemPromptAppend } = req.body;
  
  // 1. Detect language
  // 2. Analyze images if present (before streaming)
  // 3. Build system prompt via buildStitchSystemPrompt(context)
  // 4. Convert messages to CoreMessage[]
  // 5. Build tools with context closure
  // 6. Stream with streamText({ model, system, messages, tools, maxSteps: 6 })
  // 7. Emit SSE events: content chunks, tool_call, tool_result, done
});
```

**SSE event format** (matches existing client expectations):
- `{ content: string }` — text chunk
- `{ tool_call: { id, name, arguments } }` — tool invocation
- `{ tool_result: { toolCallId, name, output } }` — tool result
- `{ done: true }` — stream complete
- `{ error: string }` — error

### 2. MODIFY `server/index.ts`

Add import and mount:
```ts
const { default: stitchAgentRoutes } = await import('./routes/stitchAgent');
// ...
app.use('/api/stitch-agent', stitchAgentRoutes);
```

### 3. MODIFY `services/agentService.ts` (client-side)

Add `sendStitchAgentMessage()` function that hits `/api/stitch-agent/chat` instead of `/api/agent/chat`. Same generator pattern as `sendAgentMessage` but different endpoint.

Alternatively, add an `endpoint` parameter to `sendAgentMessage`:
```ts
export async function* sendAgentMessage(
  messages, tools, model, provider, signal, context, systemPromptAppend,
  endpoint = '/api/agent/chat',  // new optional param
)
```

### 4. MODIFY `components/StitchEditor.tsx`

Change the `sendAgentMessage` call to use the new stitch agent endpoint:
```ts
const stream = sendAgentMessage(
  [...history, { role: 'user', content: prompt }],
  tools,
  activeModel?.apiModelId || activeModel?.id,
  activeModel?.provider,
  abortController.signal,
  context,
  getStitchSystemPromptAppend('stitch'),
  '/api/stitch-agent/chat',  // new: dedicated endpoint
);
```

### 5. MODIFY `lib/agentConfig.ts`

No changes needed — the existing `stitch` agent type already lists the correct tools. The tool names stay the same.

## Tool ↔ Carousel Mapping

| Tool | Website mode | Carousel/Story mode |
|------|-------------|-------------------|
| `generate_html` | Primary generation | Not used |
| `edit_html` | Primary editing | Not used |
| `generate_spec` | Not used | Primary generation |
| `edit_spec` | Not used | Primary editing |
| `search_library` | Reference components | Reference components |
| `web_browse` | Research | Research |
| `execute_code` | Utility | Utility |
| `search_web` | Research | Research |

The system prompt (`buildStitchSystemPrompt`) already handles routing the AI to use the correct tools based on `projectType`.

## Additional: Remove old agent endpoint

The old `/api/agent/chat` endpoint (`server/routes/agent.ts`) will be fully removed. All agents (stitch, library) use the new Vercel AI SDK pattern. The plugin agent tools (web_browse, execute_code, search_web) are included in the new stitch agent.

### Files to DELETE:
- `server/routes/agent.ts`

### Files to MODIFY (remove old agent references):
- `server/index.ts` — remove `agentRoutes` import and `app.use('/api/agent', agentRoutes)`
- `services/agentService.ts` (client) — remove old `sendAgentMessage` function, replace with `sendStitchAgentMessage` pointing to `/api/stitch-agent/chat`
- Any other client code importing from `services/agentService.ts` — update imports

## Implementation Order

1. Create `server/routes/stitchAgent.ts` with all 8 tools
2. Register route in `server/index.ts`
3. Remove old `server/routes/agent.ts` and its registration
4. Update client `services/agentService.ts` — point to `/api/stitch-agent/chat`
5. Update `StitchEditor.tsx` to use new client function
6. Run `npm run build` to verify

## Verification

- `npm run build` passes
- Stitch editor in website mode: generate_html / edit_html tools work
- Stitch editor in carousel mode: generate_spec / edit_spec tools work
- Tool calls and results stream correctly to the client
- Image analysis still works for reference images
