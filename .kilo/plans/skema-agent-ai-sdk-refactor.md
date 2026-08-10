# Plan: Refactor Skema Agent to use shared Vercel AI SDK infrastructure

## Problem

The Skema agent already uses Vercel AI SDK (`streamText`, `tool`, `createOpenAICompatible`) in `server/routes/skemaAgent.ts`, but:

1. **Duplicated utilities** — `createProvider()` and `convertToCoreMessages()` are copy-pasted between `skemaAgent.ts` and `libraryAgent.ts`
2. **Scattered tools** — Canvas tools live in `canvasAgentTools.ts`, utility tools (`web_browse`, `execute_code`, `search_web`) are plain functions in `agentService.ts`, and `search_library` is defined inline in the route
3. **Legacy system prompt** — `buildSkemaSystemPrompt()` in `agentService.ts` was written for the old text-based tool parser (```tool code blocks), NOT for AI SDK's native `tool()` calling. It tells the model to output fenced JSON blocks instead of using function calls
4. **Inline session CRUD** — Session management is embedded in the route file (120 lines) instead of extracted to a service
5. **No skema-specific tool file** — Library agent has its tools consolidated; skema agent does not

## Goal

Refactor the Skema agent to share the same AI SDK infrastructure patterns as the Library agent:
- Shared provider + message conversion utilities
- Dedicated tool definitions file using `tool()` + Zod
- New system prompt designed for AI SDK native tool calling
- Extracted session service
- Cleaner route file

## Architecture

### Shared utilities → `server/lib/aiSdk.ts` (new file)

Extract from both routes:
- `createProvider(providerName?: string)` — wraps `createOpenAICompatible`
- `convertToCoreMessages(messages: any[]): CoreMessage[]` — converts app message format to AI SDK format

Both `libraryAgent.ts` and `skemaAgent.ts` will import from here instead of defining their own copies.

### Skema tools → `server/lib/agent/tools/skemaTools.ts` (new file)

Consolidate all skema tools into one file using `tool()` + Zod, following the library agent pattern:

| Tool | Source | Notes |
|------|--------|-------|
| `generate_html` | `agentService.toolGenerateHtml()` | Wrap existing function as AI SDK tool |
| `edit_html` | `agentService.toolEditHtml()` | Wrap existing function |
| `generate_spec` | `agentService.toolGenerateSpec()` | Wrap existing function |
| `edit_spec` | `agentService.toolEditSpec()` | Wrap existing function |
| `search_library` | Inline in route | Move here, use `skemaLibraryService` |
| `web_browse` | `agentService.toolWebBrowse()` | Wrap existing function |
| `execute_code` | `agentService.toolExecuteCode()` | Wrap existing function |
| `search_web` | `agentService.toolSearchWeb()` | Wrap existing function |
| `place_component` | `canvasAgentTools.ts` | Keep delegation to `buildCanvasTools()` |
| `remove_component` | `canvasAgentTools.ts` | Keep delegation |
| `move_component` | `canvasAgentTools.ts` | Keep delegation |
| `resize_component` | `canvasAgentTools.ts` | Keep delegation |
| `update_component` | `canvasAgentTools.ts` | Keep delegation |
| `regenerate_component` | `canvasAgentTools.ts` | Keep delegation |

Export a `buildSkemaTools(context)` function that assembles the tool set based on context (canvas mode vs HTML mode).

### System prompt → `server/lib/agent/prompts/skemaPrompt.ts` (new file)

Write a NEW system prompt designed for AI SDK native tool calling (not text-based ```tool blocks). Structure:

- **Role**: Expert visual designer + HTML/CSS engineer
- **Tool usage rules**: Announce intent before every tool call, reason after every result (same pattern as library agent)
- **Canvas mode section**: Grid model, section types, layout rules (from `buildCanvasSystemPrompt`)
- **HTML mode section**: Generate/edit HTML workflow (from `buildSkemaSystemPrompt` but rewritten for native tool calling)
- **IG content section**: Carousel/story spec rules (from existing prompt)
- **Image handling**: How to use reference images and image analysis
- **Error diagnosis**: Sandbox error patterns (from library agent prompt, adapted)
- **Anti-pattern rules**: Same structure as library agent

Two exported functions:
- `buildSkemaSystemPrompt(context)` — main prompt builder (replaces both `buildSkemaSystemPrompt` and `buildCanvasSystemPrompt`)
- `buildCanvasSystemPrompt(context)` — delegates to main with canvas-specific additions

### Session service → `server/services/skemaAgentService.ts` (new file)

Extract session CRUD from `skemaAgent.ts` (lines 297–417):
- `SkemaAgentSession` interface
- `rowToSkemaSession()` mapper
- `getSession(id)` / `getSessionsByProject(projectId, boardIdx?)` / `createSession(projectId, boardIdx)` / `updateSession(id, { messages?, title? })` / `deleteSession(id)`
- `MAX_SKEMA_SESSIONS` constant (20)

### Refactored route → `server/routes/skemaAgent.ts`

After extraction, the route file becomes a thin controller:
- Import shared utilities from `server/lib/aiSdk.ts`
- Import tools from `server/lib/agent/tools/skemaTools.ts`
- Import prompt from `server/lib/agent/prompts/skemaPrompt.ts`
- Import session CRUD from `server/services/skemaAgentService.ts`
- `POST /chat` endpoint: build context → build system prompt → build tools → `streamText()` → emit SSE events
- Session CRUD routes: thin wrappers around service functions

### Frontend — no changes needed

The frontend hooks (`useSkemaAgentStream.ts`, `useSkemaAgentSessions.ts`) and sidebar (`SkemaAgentSidebar.tsx`) remain unchanged. They already consume the same SSE event format. The refactoring is backend-only.

## Files to create

1. `server/lib/aiSdk.ts` — shared `createProvider()` + `convertToCoreMessages()`
2. `server/lib/agent/tools/skemaTools.ts` — all skema tool definitions
3. `server/lib/agent/prompts/skemaPrompt.ts` — new system prompt for AI SDK tool calling
4. `server/services/skemaAgentService.ts` — session CRUD service

## Files to edit

1. `server/routes/skemaAgent.ts` — refactor to use shared modules (major reduction)
2. `server/routes/libraryAgent.ts` — import shared utilities from `server/lib/aiSdk.ts` instead of local copies

## Files NOT changed

- `components/skema/*` — frontend stays the same
- `server/services/agentService.ts` — keep existing functions (`toolGenerateHtml`, etc.) as-is; the new tools file wraps them
- `server/services/canvasAgentTools.ts` — keep as-is; skema tools delegate to `buildCanvasTools()`
- `lib/agentConfig.ts` — client-side config stays the same

## Verification

1. `npm run build` — frontend build must pass
2. Manual test: Open skema editor → start agent session → send a message → verify streaming works, tools execute, canvas operations work
3. Verify session CRUD: create, switch, delete sessions
