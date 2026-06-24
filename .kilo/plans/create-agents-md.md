# Plan: Create AGENTS.md

## Goal
Create a compact `AGENTS.md` at the project root with high-signal, repo-specific guidance for future agent sessions.

## Approach
Write `AGENTS.md` directly at `C:\Users\OSVALDO-SOFTENG\Documents\edward-portfolio\GIT\AI-GUI\AGENTS.md`.

No existing AGENTS.md or other instruction files exist. The content will be synthesized from reading `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `App.tsx`, `types.ts`, `constants.tsx`, `services/`, `electron/`, and `.env.example`.

## Planned content (sections)

1. **Project overview** — one-liner: edward:labs, React 19 + Vite + Electron AI chat app using Xiaomi MiMo API.

2. **Commands** — only the 3 scripts that exist (`dev`, `build`, `preview`). No lint/typecheck/test scripts exist.

3. **Architecture** — key file map and the dual-database pattern (SQLite via Electron IPC vs IndexedDB via idb).

4. **Critical quirks** (the bulk of the file):
   - Tailwind is loaded via CDN `<script>` in `index.html`, NOT via npm — no tailwindcss package, no PostCSS. All config is inline in `index.html`.
   - `Role.Assistant` = `'model'` (not `'assistant'`) in `types.ts`; the adapter maps it to `'assistant'` for IndexedDB storage.
   - API keys are injected via Vite `define` (`process.env.MIMO_*`), not `import.meta.env`.
   - Vite proxies: `/mimo-api` → token-plan endpoint, `/mimo-direct-api` → direct endpoint.
   - `getModelType()` in `types.ts` determines UI mode (chat/tts/asr) from model ID string prefix.
   - `tsconfig.json` excludes `electron/` and `dist-electron/`.
   - `@/*` path alias maps to project root.
   - No test framework, no linter, no formatter, no CI configured.
   - localStorage keys: mixed naming — some `edward:labs_*`, some bare names.

5. **Environment** — the 4 `.env` variables from `.env.example`.

6. **Gotchas** — `electron/database.ts` uses `better-sqlite3` (native module); `electron/` is excluded from the web tsconfig; `chat.db` in root is a dev artifact (gitignored).

## Verification
After writing, read the file back to confirm it's correct and concise.
