# AGENTS.md

## Project

**edward:labs** — AI chat web app (React 19 + Vite) using Xiaomi MiMo API.

## Commands

```bash
npm run dev          # Vite dev server on localhost:5173
npm run dev:server   # Express API server on localhost:3001
npm run dev:all      # Run both server + Vite concurrently
npm run build        # Production build → dist/
npm run preview      # Preview production build
npm run docker:build # Build Docker images
npm run docker:up    # Start containers (frontend:80, backend:3001)
npm run docker:down  # Stop containers
npm run docker:logs  # Tail container logs
```

No lint, typecheck, test, or formatter scripts exist.

## Architecture

| Layer | Files | Notes |
|-------|-------|-------|
| Entry | `index.tsx` → `App.tsx` | Single monolithic React root |
| Components | `components/*.tsx` | 20 files; no index barrel |
| Client API | `services/apiService.ts` | Calls Express backend (`/api/*`) |
| Legacy service | `services/mimoService.ts` | Direct MiMo API (still used as fallback) |
| DB adapter | `services/databaseAdapter.ts` | Thin pass-through to IndexedDB |
| DB | `services/databaseService.ts` | IndexedDB via `idb` library |
| Types | `types.ts` | Shared interfaces and enums |
| Constants | `constants.tsx` | Default model list, logo SVG |
| **Express server** | `server/index.ts` | API backend on port 3001 |
| Chat routes | `server/routes/chat.ts` | `/api/chat/*` — completions, title, TTS, ASR |
| **Stitch routes** | `server/routes/stitch.ts` | `/api/stitch/*` — image gen (OpenAI), HTML gen (MiMo) |
| Model routes | `server/routes/models.ts` | `/api/models` — stub (client-side IndexedDB) |
| Conv routes | `server/routes/conversations.ts` | `/api/conversations` — stub |
| Server MiMo | `server/services/mimoService.ts` | Server-side MiMo API + language detection |

## Critical Quirks

### Tailwind is CDN-only — no npm package

`index.html` loads Tailwind via `<script src="https://cdn.tailwindcss.com">` with the full config inline. There is **no** `tailwindcss` npm package, no PostCSS config, no `tailwind.config.js`. All theme customization (colors, animations, fonts) lives in the `<script>` block in `index.html:12-97`. If you need to change Tailwind config, edit `index.html`.

### `Role.Assistant` = `'model'`, not `'assistant'`

In `types.ts:3`, `Role.Assistant` is the string `'model'` (for MiMo API compatibility). The database adapter in `databaseAdapter.ts` maps `'model'` → `'assistant'` before storing in IndexedDB.

### Environment variables via Vite `define`, not `import.meta.env`

`vite.config.ts:29-34` injects `process.env.MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_DIRECT_API_KEY`, `MIMO_DIRECT_BASE_URL` from `.env` via `define`. Services read `process.env.*` directly (string-replaced at build time). Requires `.env` with these 4 keys (see `.env.example`).

The Stitch image generation feature also requires `OPENAI_API_KEY` in `.env` (server-side only, not injected via Vite define).

### Vite dev server proxies

`vite.config.ts:14-23`:
- `/mimo-api` → `https://token-plan-sgp.xiaomimimo.com/v1` (token-plan endpoint)
- `/mimo-direct-api` → `https://api.xiaomimimo.com/v1` (direct API key endpoint)

### Model type determines UI mode

`types.ts:36-42` — `getModelType()` maps model ID prefixes to UI panels:
- `mimo-v2.5-tts` → TTS panel
- `mimo-v2.5-tts-voicedesign` → Voice design panel
- `mimo-v2.5-tts-voiceclone` → Voice clone panel
- `mimo-v2.5-asr` → ASR (speech recognition) panel
- Everything else → chat

### TypeScript config

- Path alias `@/*` maps to project root (`tsconfig.json:22` and `vite.config.ts:36`)
- Target: ES2022, module: ESNext, moduleResolution: bundler

### localStorage key naming is inconsistent

Some keys use `edward:labs_` prefix (`edward:labs_fontSize`, `edward:labs_defaultModel`, `edward:labs_session`), others don't (`neonColor`, `maxOutputTokens`). Be careful when adding new keys.

### Dual lock passwords

- **Chat**: password `thelordismyshepherd` — session key `edward:labs_chat_session`
- **Experiments**: password `ilacknothing` — session key `edward:labs_experiments_session`

Both are checked in `components/ModeSelector.tsx` (InlinePasswordModal).

### Language detection

The Express server auto-detects the user's language from the last message and prepends a system instruction forcing the AI to respond in that language (fallback: English). Detection uses Unicode range heuristics for CJK, Arabic, Cyrillic, Thai, Hindi, etc.

### Stitch agent (visual design boards)

The Stitch feature is a Google Stitch-inspired visual design editor accessible from Experiments mode. Key architecture:

- **Canvas**: Uses Fabric.js (`fabric@6`) for interactive drag/drop/resize/rotate canvas
- **Layouts**: Supports `16:9` (landscape), `1:1` (square), `9:16` (Instagram/portrait)
- **Elements**: Shapes (rect, circle, triangle, line, star), text, images, raw HTML blocks
- **AI Generation**: Two modes — HTML generation (via MiMo) and image generation (via OpenAI `gpt-image-2`)
- **Persistence**: IndexedDB `stitch_projects` store (DB version 5), boards serialized as JSON
- **Export**: HTML file download, PNG export (via Fabric.js `toDataURL`), copy to clipboard
- **Components**: `StitchPanel` (project grid), `StitchEditor` (workspace), `StitchCanvas` (Fabric.js wrapper), `StitchToolbar`, `StitchPromptBar`, `StitchImagePicker`, `StitchExportModal`
- **Canvas scale**: Elements stored at real resolution but rendered at 0.5x scale for display

## Build Artifacts (all gitignored)

- `dist/` — Vite web build output
- `generated_images/` — AI-generated image output
