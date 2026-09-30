# Route bug fix implementation plan

## Scope and baseline

This plan addresses the route and UI failures found in the September 2026 review. It covers Chat, Skema, Python, Notes, and Database. The other inspected routes have no confirmed defect in this review; they still need live smoke checks before claiming full route coverage.

Baseline: `npm run build` passes and `npm run test:agent-builder` passes (27 tests). `npx tsc --noEmit` fails on existing errors across the repository, including several listed below. No PostgreSQL or external AI integration checks were run during the review.

## 1. Restore Python project file operations (high)

**Files:** `server/routes/python.ts` and a focused Python file route test.

- Replace the undefined `path.sep` reference in `resolveFilePath` with a correctly imported path utility. Resolve the candidate path and check that it stays inside the resolved project directory. Reject empty filenames, directory targets, and path traversal.
- Apply the same filename validation to uploads before disk storage writes the file. Keep the existing 50 MB and 20 file limits.
- Verify upload, list, view, download, and delete using a file in a real project directory. Confirm missing files return 404 and traversal attempts cannot access files outside the project directory.

**Done when:** The three existing file actions stop returning 500 for valid files, and invalid paths cannot escape the project directory.

## 2. Make Skema JSON limits effective (high)

**Files:** `server/index.ts`, `server/routes/skema.ts`, and API request tests.

- Register route specific JSON parsers before the global 1 MB parser, or configure one global limit that accommodates the largest supported Skema request. Avoid parsing the same body twice.
- Preserve the intended 10 MB limit for project saves and 5 MB limit for HTML generation. Check other Skema and agent payloads against the chosen limit so they do not inherit an accidental restriction.
- Send payloads just below and above each limit. Confirm an allowed project save reaches persistence and an oversized request returns a clear 413 response.

**Done when:** A project payload between 1 MB and 10 MB saves, and an HTML generation payload between 1 MB and 5 MB reaches its route.

## 3. Repair Chat attachment viewing and recording controls (high)

**Files:** `components/ChatMessage.tsx`, `components/PromptInputBox.tsx`, `App.tsx` if needed, and focused component tests.

- Add `onViewAttachment` to `ChatMessageProps` and the component argument. Keep the existing callback from `App.tsx` so document clicks open `FloatingFilePanel`.
- Remove the stale `./chat/FileViewer` import and unused local document viewer state if neither is used. Keep one attachment viewer path.
- Import `StopCircle` or use an already imported icon for the recording state.
- Check document click, viewer close, and the start/stop recording render path.

**Done when:** Document attachments open without a runtime error and the recording control renders in both states.

## 4. Fix Notes image alt text editing (high)

**File:** `components/notes/tiptap-extensions/ImagePopover.tsx`, with an editor interaction test.

- Read the image node from `editor.view.state.doc.nodeAt(state.pos)`, validate that the position still points to an image, then update that node's `alt` attribute while preserving its other attributes.
- Exercise both button and Enter key save paths. Check that moving or deleting the image before saving does not throw.

**Done when:** Editing alt text updates the selected image and never calls `nodeAt` on `EditorState`.

## 5. Align Database UI and API behavior (medium)

**Files:** `components/DatabasePanel.tsx`, `services/apiDatabaseAdapter.ts`, `server/routes/database.ts`, and relevant query tests.

- Keep the explorer read only. Remove the unreachable destructive query dialog, its confirmation handler, and the `force` request/response contract. The server must continue to reject mutations regardless of client input.
- Pass the active `AbortSignal` from `DatabasePanel` through `executeDbQuery` and `apiFetch`. Treat cancellation separately from query failure and ignore a late result from a canceled request.
- Determine whether server side query cancellation is feasible with the current `pg` use. If implemented, propagate disconnect or abort to the running query. If the server cannot cancel it, make the UI explicitly describe that Cancel stops waiting for the response while the server query may continue until its timeout.
- Verify SELECT results, mutation rejection, cancellation, timeout, and connection switching during an in flight query.

**Done when:** The UI makes only supported query actions available, and Cancel has the behavior it promises.

## Verification and release order

1. Fix Python and Skema backend failures; run focused route tests.
2. Fix Chat and Notes runtime errors; run focused interaction checks.
3. Align Database behavior and verify cancellation against a deliberately slow query.
4. Run `npm run build` and `npm run test:agent-builder`.
5. Run `npx tsc --noEmit`. Resolve errors in touched files. Record remaining pre-existing errors separately; a passing Vite build does not establish type safety.
6. With PostgreSQL and configured AI providers available, smoke check the route families: Chat/TTS/ASR, RAG, Skema, Python, Library, Database, Agent Builder/shared workflows, Notes, and authentication. Include a deep link and an unauthorized request for each protected mode. Record external-service failures distinctly from local route failures.

## Out of scope for this repair batch

The broad TypeScript error backlog and the unused legacy agent route code need a separate cleanup plan. Do not silently expand these fixes into a repository wide refactor.

## Implementation record (September 2026)

- Python: added a shared filename/path guard, applied it to uploads and file actions, and removed double decoding of route filenames. HTTP tests cover upload, list, view, download, delete, missing files, traversal, and percent characters.
- Skema: route specific JSON parsers now run before the 1 MB default parser. The project save and HTML limits are 10 MB and 5 MB; Skema agent chat accepts 10 MB. Removed logging of full board content. A 1.4 MB project was saved, read back, and deleted on the configured PostgreSQL server.
- Chat and Notes: wired document attachment viewing to `FloatingFilePanel`, fixed the recording icon import, and corrected the Notes image node lookup with a stale image guard.
- Database: removed unsupported mutation templates, the unreachable destructive confirmation, and the `force` contract. Fetch now receives an abort signal, canceled responses are ignored, and Cancel explains that server execution may continue until the 30 second limit. Live checks confirmed `SELECT 1`, mutation rejection, and statement timeout; the temporary connection was deleted.
- Verification: `npm run build`, all 31 Agent Builder tests, and all 4 focused route tests pass. Eight protected API families returned 401 without a session; mode unlocks and representative read routes returned 200. Eight frontend deep links served the SPA entry point. `npx tsc --noEmit` still reports 609 repository errors, with none in the files changed for this repair batch.
- Remaining verification: browser interaction checks for attachment viewing, recording, Notes alt text, and Database Cancel require a browser test harness or manual session. No external AI generation calls were made. Server side cancellation is not implemented; PostgreSQL statement timeout remains the execution bound.

### Agent Builder follow-up

- Fixed the workflow route mounting order so `/api/workflows/config`, `/keys`, and `/mcp-servers` reach their specific routers before the generic `/:id` handler.
- Let an Agent Builder-only session use the Database connection list, connection creation/test/ping, and RAG document list required by its Database node editor. Database schema and query endpoints still require the Database mode unlock.
- Published request examples and the modal's test action now use the configured Start input names. Added tests for named input examples and the limited resource authorization.
- Live checks with an Agent Builder-only session returned 200 for settings, keys, MCP servers, connection list, and RAG documents; unauthorized Database query/schema requests returned 401. A temporary Start-to-End workflow validated, executed, streamed, published, executed through bearer authorization, and served a public shared chat; it was deleted afterward.
- Published workflow validation now accepts bearer authorization and checks the key in the validation route. Live checks returned 200 with the matching key and 401 with the wrong key. The temporary validation workflow was deleted afterward.
- Workflow deletion and unpublishing now report failure when their API request fails. Provider keys newly saved through Agent Builder use AES-256-GCM; existing base64 keys remain readable and are migrated on the next server startup. The encryption round trip and tamper check pass in the Agent Builder suite. This migration has not been run against the configured PostgreSQL database during this audit.
