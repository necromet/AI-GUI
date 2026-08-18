# AGENTS.md

## Project

**edward:labs** — AI chat web app (React 19 + Vite) with Express 5 + PostgreSQL backend, using Xiaomi MiMo, DeepSeek, and OpenAI APIs.

## Commands

```bash
npm run dev          # Vite dev server on localhost:5173
npm run dev:server   # Express API server on localhost:3001
npm run dev:all      # Run both server + Vite concurrently
npm run build        # Production build → dist/
npm run preview      # Preview production build
```

No lint, typecheck, test, or formatter scripts exist. The only verification is `npm run build`.

## Architecture

Frontend is a single-page React app. Backend is Express 5 with PostgreSQL (`pg`). Client talks to backend via REST + SSE streaming — there is no direct DB access from the browser.

| Layer | Files | Notes |
|-------|-------|-------|
| Entry | `index.tsx` → `App.tsx` | Single monolithic React root with React Router |
| Components | `components/*.tsx` | ~21 files; no index barrel |
| Library sub-components | `components/library/` | `ComponentEditor`, `ComponentCard`, `FolderCard`, `AgentSidebar`, dialogs |
| Chat sub-components | `components/chat/` | `MarkdownRenderer.tsx`, `ThinkingIndicator.tsx`, `SearchCitations.tsx`, `MessageActions.tsx` |
| Client DB adapter | `services/apiDatabaseAdapter.ts` | REST calls to Express backend (`/api/*`) — replaces old IndexedDB |
| Client API | `services/apiService.ts` | SSE streaming to `/api/chat/*` |
| Client services | `services/ragService.ts`, `skemaService.ts`, `agentService.ts`, `opencodeAgentService.ts` | Feature-specific client logic |
| Types | `types.ts` | Shared interfaces and enums |
| Constants | `constants.tsx` | Default model list, logo SVG, neon presets |
| Utilities | `lib/utils.ts` | `cn()` helper (clsx + tailwind-merge) |
| **Express server** | `server/index.ts` | Express 5 API backend on port 3001 |
| Server DB | `server/db/index.ts` | PostgreSQL via `pg` pool. Connection via `PG_HOST`, `PG_PORT`, `PG_DATABASE`, `PG_USER`, `PG_PASSWORD` env vars |
| Server DB schema | `server/db/schema.ts` | `SCHEMA_SQL` + `SEED_SQL` constants, run on every startup |
| Chat routes | `server/routes/chat.ts` | `/api/chat/*` — completions, title, TTS, ASR |
| Skema routes | `server/routes/skema.ts` | `/api/skema/*` — image gen (OpenAI), HTML gen (MiMo) |
| Skema agent routes | `server/routes/skemaAgent.ts` | `/api/skema-agent/*` — skema agent via Vercel AI SDK + session CRUD |
| RAG routes | `server/routes/rag.ts` | `/api/rag/*` — document upload, retrieval, RAG chat |
| Agent routes | `server/routes/agent.ts` | `/api/agent/*` — agent chat with tool execution loop |
| OpenCode agent routes | `server/routes/opencodeAgent.ts` | `/api/agent/opencode/*` — OpenCode sidecar proxy |
| Library agent routes | `server/routes/libraryAgent.ts` | `/api/library-agent/*` — library agent via Vercel AI SDK |
| Library routes | `server/routes/library.ts` | `/api/library/*` — CRUD for library components/folders |
| Database routes | `server/routes/database.ts` | `/api/database/*` — connection CRUD, test, schema introspection, query execution |
| Server MiMo | `server/services/mimoService.ts` | Server-side MiMo API + language detection |
| Server RAG | `server/services/ragService.ts` + `embeddingService.ts` | In-memory vector store + embeddings |
| Server Agent | `server/services/agentService.ts` | Tool definitions + execution for agent loop |
| OpenCode sidecar | `server/services/opencodeSidecar.ts` | Manages OpenCode subprocess |

## Critical Quirks

### Tailwind CSS v4 via npm + shadcn/ui

Tailwind CSS v4 is installed as an npm package (`tailwindcss` + `@tailwindcss/vite` plugin). The Vite plugin is configured in `vite.config.ts`. All Tailwind customization (theme, animations, CSS variables) lives in `src/globals.css` using the `@theme` directive. The `tailwindcss-animate` plugin provides shadcn/ui animation utilities.

### shadcn/ui components

All UI components follow the shadcn/ui pattern in `components/ui/`. They use `cn()` from `lib/utils.ts`, `forwardRef`, and Radix UI primitives. Buttons have `cursor-pointer` by default.

### `Role.Assistant` = `'model'`, not `'assistant'`

In `types.ts`, `Role.Assistant` is the string `'model'` (for MiMo API compatibility). The App component handles conversion: it passes literal `'user'`/`'assistant'` strings to `saveMessageToDb`, and converts `'assistant'` back to `Role.Assistant` (`'model'`) when loading from the database.

### Environment variables via Vite `define`, not `import.meta.env`

`vite.config.ts` injects `process.env.MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_DIRECT_API_KEY`, `MIMO_DIRECT_BASE_URL` from `.env` via `define`. Services read `process.env.*` directly (string-replaced at build time). Requires `.env` with these keys (see `.env.example`).

Server-side only (not injected via Vite): `OPENAI_API_KEY` (Skema image gen), `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `SERVER_PORT`, `PG_HOST`, `PG_PORT`, `PG_DATABASE`, `PG_USER`, `PG_PASSWORD`.

### Vite dev server proxies

`vite.config.ts`:
- `/mimo-api` → `https://token-plan-sgp.xiaomimimo.com/v1` (token-plan endpoint)
- `/mimo-direct-api` → `https://api.xiaomimimo.com/v1` (direct API key endpoint)
- `/api` → `http://localhost:3001` (Express backend — must be running for chat/TTS/ASR)

### Model type determines UI mode

`types.ts` — `getModelType()` maps model ID prefixes to UI panels:
- `mimo-v2.5-tts-voicedesign` → Voice design panel (checked first)
- `mimo-v2.5-tts-voiceclone` → Voice clone panel
- `mimo-v2.5-tts` → TTS panel
- `mimo-v2.5-asr` → ASR (speech recognition) panel
- Everything else → chat

Order matters — `voicedesign` and `voiceclone` are checked before the broader `tts` prefix.

### TypeScript config

- Path alias `@/*` maps to project root (`tsconfig.json` and `vite.config.ts`)
- Target: ES2022, module: ESNext, moduleResolution: bundler

### localStorage key naming is inconsistent

Some keys use `edward:labs_` prefix (`edward:labs_fontSize`, `edward:labs_defaultModel`), others don't (`neonColor`, `maxOutputTokens`). When adding new keys, use the `edward:labs_` prefix.

### Triple lock passwords

Each mode has its own password and `sessionStorage` key, checked in `components/ModeSelector.tsx`:

| Mode | Password | Session key |
|------|----------|-------------|
| Chat | `thelordismyshepherd` | `edward:labs_chat_session` |
| RAG | `herestoresmysoul` | `edward:labs_rag_session` |
| Skema | `pathsofrighteousness` | `edward:labs_skema_session` |
| Python | `mycuprunnethover` | `edward:labs_python_session` |
| Library | `psalm23` | `edward:labs_library_session` |
| Database | `heleadsmebesidequietwater` | `edward:labs_database_session` |
| Agent Builder | `shepherdofmysoul` | `edward:labs_agent-builder_session` |

### Notifications via sonner

The app uses `sonner` for toast notifications (`toast.success()` / `toast.error()` from `sonner`). The `<Toaster />` component is rendered in `App.tsx`.

### Language detection

The Express server auto-detects the user's language from the last message and prepends a system instruction forcing the AI to respond in that language (fallback: English). Detection uses Unicode range heuristics for CJK, Arabic, Cyrillic, Thai, Hindi, etc.

### Server .env loading — no dotenv

`server/index.ts` manually parses `.env` via `readFileSync` + line splitting (no `dotenv` package). It only sets keys not already in `process.env`, so shell env vars take precedence. The `.env` is resolved from `process.cwd()`, so `npm run dev:server` must be run from the project root. The server uses top-level `await import(...)` — requires ESM (`"type": "module"` in package.json).

`SERVER_PORT` env var controls the backend port (default: 3001). PostgreSQL connection is configured via `PG_HOST`, `PG_PORT`, `PG_DATABASE`, `PG_USER`, `PG_PASSWORD` env vars.

### Docker: nginx + Express

`Dockerfile.frontend` builds Vite then serves via nginx. `nginx/default.conf` proxies `/api/` to `backend:3001` with SSE-specific settings (`proxy_buffering off`, 300s read timeout, 50m body limit) and SPA fallback (`try_files → /index.html`). Backend runs `npx tsx server/index.ts` directly (no compile step). Backend Dockerfile copies only `server/` and `.env.example` — not the frontend source.

### Skema agent (visual design boards)

The Skema feature is a Google Skema-inspired visual design editor accessible as a top-level mode. Key architecture:

- **Canvas**: Uses iframe `srcDoc` for HTML preview (not Fabric.js)
- **Layouts**: Supports `16:9`, `1:1`, `9:16`, `4:5`, `1.91:1`, `4:3`, `3:4`, `32:9`
- **AI Generation**: Two modes — HTML generation (via MiMo) and image generation (via OpenAI `gpt-image-2`)
- **Persistence**: PostgreSQL `skema_projects` table, boards serialized as JSON
- **Export**: HTML file download, PNG/JPEG export (via `html-to-image`), copy to clipboard
- **Components**: `SkemaPanel` (project grid), `SkemaEditor` (workspace), `SkemaAgentSidebar` (agent chat), `SkemaExportModal`, `SkemaLibrary`

#### Skema Agent Frontend

The Skema Agent uses the same Vercel AI SDK architecture as the Library Agent. The frontend agent lives in `components/skema/`:

| File | Purpose |
|------|---------|
| `components/skema/SkemaAgentSidebar.tsx` | Main sidebar container — resizable, composes hooks + message list + input |
| `components/skema/agent/types.ts` | `MessageBlock`, `AgentMessage`, `SkemaAgentSidebarProps` |
| `components/skema/agent/useSkemaAgentStream.ts` | SSE streaming hook — multi-round loop (max 10 rounds), tool call handling, `html_generated`/`spec_generated` event processing |
| `components/skema/agent/useSkemaAgentSessions.ts` | Session CRUD — per-project, per-board-idx, max 3 sessions, auto-save after streaming |

The sidebar reuses `MessageBubble`, `EmptyState`, `AgentMarkdown`, and `ModelPicker` from `components/library/agent/` (shared rendering components).

#### Skema Agent Backend

`server/routes/skemaAgent.ts` exposes:
- `POST /api/skema-agent/chat` — SSE streaming agent endpoint (Vercel AI SDK `streamText` with 8 tools, `maxSteps: 6`)
- `GET /api/skema-agent/session/:id` — get single session
- `GET /api/skema-agent/sessions/:projectId?boardIdx=N` — list sessions for project/board
- `POST /api/skema-agent/sessions` — create session (max 20/project, FIFO eviction)
- `PUT /api/skema-agent/sessions/:id` — update messages/title
- `DELETE /api/skema-agent/sessions/:id` — delete session

Tools: `generate_html`, `edit_html`, `generate_spec`, `edit_spec`, `search_library`, `web_browse`, `execute_code`, `search_web`.

Session data stored in PostgreSQL `skema_agent_sessions` table (references `skema_projects(id)`).

### Library agent (Vercel AI SDK)

The Library feature uses Vercel AI SDK (`ai` package) for its agent chat. Tool definitions are in `lib/agent/tools/library.ts`, provider adapter in `lib/agent/provider.ts`. The entry point `lib/agent/agent.ts` uses `ToolLoopAgent`. Do not confuse with the MiMo-based agent in `server/services/agentService.ts`.

Frontend agent components live in `components/library/agent/` — `useAgentStream.ts` (SSE multi-round loop), `useAgentSessions.ts` (session CRUD), `MessageBlocks.tsx` (rendering), `AgentMarkdown.tsx`, `ModelPicker.tsx`. The main sidebar is `components/library/AgentSidebar.tsx`. These are reused by the Skema Agent. See `docs/LIBRARY_AGENT.md` for full architecture documentation.

### Database explorer

The Database mode is a top-level mode (alongside Chat, RAG, Skema, Python, Library) that lets developers connect to external PostgreSQL databases and explore them with SQL.

- **Frontend**: `components/DatabasePanel.tsx` (main), `DatabaseConnectForm.tsx` (connection dialog), `DatabaseSchemaBrowser.tsx` (schema tree), `DatabaseResultsTable.tsx` (results grid)
- **Backend**: `server/routes/database.ts` — connection CRUD, test, schema introspection, query execution
- **DB schema**: `database_connections` table stores connection configs (passwords base64-encoded)
- **SQL editor**: Monaco editor with SQL language mode, Ctrl+Enter to run
- **Pool caching**: Server caches `pg.Pool` per connection ID, auto-cleanup after 5 min idle
- **Row limit**: 1000 rows max per query (configurable)
- **Query history**: Last 50 queries stored in `localStorage` key `edward:labs_dbQueryHistory`

#### Database UI layout — no separate sidebar

The Database mode does NOT create its own left sidebar. It reuses the **main sidebar** and **main header** in `App.tsx` via callback props:

- `onSidebarControls` — `DatabasePanel` passes a `DatabaseSidebarControls` object to `App.tsx`, which renders the schema browser inside the main sidebar (the same sidebar used by Chat/RAG/Library).
- `onHeaderControls` — `DatabasePanel` passes a `DatabaseHeaderControls` object to `App.tsx`, which renders toolbar actions (connection picker, run query, format, history, word wrap, font size, shortcuts) in the main header area.

Both interfaces are exported from `components/DatabasePanel.tsx`. When implementing database UI features, add controls to these callback objects rather than creating new sidebar or header elements inside `DatabasePanel` itself.

The scroll container in `App.tsx` (`#scroll-container`) uses `overflow-hidden` on `/database` routes (instead of `overflow-y-auto`) so the editor fills the viewport exactly. The route wrapper divs use `h-full flex flex-col` to ensure the flex height chain resolves properly down to Monaco.

## Build Artifacts (all gitignored)

- `dist/` — Vite web build output
- `generated_images/` — AI-generated image output
- `data/` — Runtime data (python files, tmp)
