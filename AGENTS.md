# AGENTS.md

## Project

**edward:labs** — AI chat web app (React 19 + Vite) using Xiaomi MiMo API.

## Commands

```bash
npm run dev          # Vite dev server on localhost:5173
npm run build        # Production build → dist/
npm run preview      # Preview production build
```

No lint, typecheck, test, or formatter scripts exist.

## Architecture

| Layer | Files | Notes |
|-------|-------|-------|
| Entry | `index.tsx` → `App.tsx` | Single monolithic React root |
| Components | `components/*.tsx` | 13 files; no index barrel |
| Services | `services/mimoService.ts` | MiMo API (chat, TTS, ASR) |
| DB adapter | `services/databaseAdapter.ts` | Thin pass-through to IndexedDB |
| DB | `services/databaseService.ts` | IndexedDB via `idb` library |
| Types | `types.ts` | Shared interfaces and enums |
| Constants | `constants.tsx` | Default model list, logo SVG |

## Critical Quirks

### Tailwind is CDN-only — no npm package

`index.html` loads Tailwind via `<script src="https://cdn.tailwindcss.com">` with the full config inline. There is **no** `tailwindcss` npm package, no PostCSS config, no `tailwind.config.js`. All theme customization (colors, animations, fonts) lives in the `<script>` block in `index.html:12-97`. If you need to change Tailwind config, edit `index.html`.

### `Role.Assistant` = `'model'`, not `'assistant'`

In `types.ts:3`, `Role.Assistant` is the string `'model'` (for MiMo API compatibility). The database adapter in `databaseAdapter.ts` maps `'model'` → `'assistant'` before storing in IndexedDB.

### Environment variables via Vite `define`, not `import.meta.env`

`vite.config.ts:29-34` injects `process.env.MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_DIRECT_API_KEY`, `MIMO_DIRECT_BASE_URL` from `.env` via `define`. Services read `process.env.*` directly (string-replaced at build time). Requires `.env` with these 4 keys (see `.env.example`).

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

## Build Artifacts (all gitignored)

- `dist/` — Vite web build output
- `generated_images/` — AI-generated image output
