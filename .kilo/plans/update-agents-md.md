# Plan: Update AGENTS.md

## Goal

Update the existing `AGENTS.md` to be accurate, compact, and high-signal for future agent sessions. The current file has several stale/incorrect claims that need fixing.

## Changes

### Corrections (stale/incorrect claims in current file)

1. **Architecture table — remove non-existent files**: `server/routes/models.ts` and `server/routes/conversations.ts` do NOT exist. Replace with the actual routes: `rag.ts`, `agent.ts`.

2. **Architecture table — add missing server routes and services**:
   - Routes: `chat.ts`, `stitch.ts`, `rag.ts`, `agent.ts` (plus inline `/api/health`)
   - Server services: `mimoService.ts`, `ragService.ts`, `embeddingService.ts`, `agentService.ts`
   - Client services: add `ragService.ts`, `stitchService.ts`, `agentService.ts`

3. **Component count**: 21 files, not 20.

4. **Role.Assistant description**: Current text says "The database adapter in `databaseAdapter.ts` maps `'model'` → `'assistant'`". This is inaccurate — the adapter doesn't do this. The App component passes literal `'assistant'`/`'user'` strings to `saveMessageToDb`, and converts back when loading. Clarify.

5. **IndexedDB version**: Current stitch section says "DB version 5" — actual version is 7 (`databaseService.ts:6`).

### Additions (high-signal facts not in current file)

6. **Express 5** (`^5.2.1`) — not Express 4. Behavior differences matter.

7. **Server .env loading**: Manual `readFileSync` parsing in `server/index.ts`, no dotenv package. Only sets keys not already in `process.env`.

8. **Server uses top-level await**: `server/index.ts` uses `await import(...)` — requires ESM (`"type": "module"` in package.json).

9. **Docker architecture**: Frontend is nginx serving static build + proxying `/api/` to backend with SSE support (`proxy_buffering off`, 300s timeout). Backend runs `npx tsx server/index.ts` directly (no compile step).

10. **API routes summary**: `/api/chat/*`, `/api/stitch/*`, `/api/rag/*`, `/api/agent/*`, `/api/health`.

### Removals (fluff or misleading)

11. Remove the "stub" labels on routes that don't exist. The actual model/conversation CRUD is client-side via IndexedDB — no server routes for those.

## File to edit

`AGENTS.md` at project root.

## Verification

- Read the updated file and confirm all file references actually exist in the repo.
- Confirm no stale references remain.
