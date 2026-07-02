# Tidy Codebase Plan

## Summary

Clean up the edward:labs codebase by removing dead files, unused components, stale artifacts, and inconsistent patterns.

---

## 1. Remove Dead/Unused Components

These components exist in `components/` but are **never imported or rendered** anywhere:

| File | Reason |
|------|--------|
| `components/PasswordModal.tsx` | Superseded by `InlinePasswordModal` inside `ModeSelector.tsx` |
| `components/PasswordScreen.tsx` | Superseded by `ModeSelector.tsx` auth flow |
| `components/ResizableDivider.tsx` | Not imported anywhere |

**Action:** `git rm` all three files.

---

## 2. Remove Unused Import + Dead Component

`App.tsx:20` imports `RAGPanel` but **never renders it** (the experiments page uses `RAGChatPanel` instead).

- Remove `import RAGPanel from './components/RAGPanel';` from `App.tsx`
- Remove `components/RAGPanel.tsx` (dead component)

---

## 3. Remove Deprecated Client-Side Service

`services/mimoService.ts` is marked `@deprecated` (line 1-3) and has **zero imports** across the codebase. All API calls go through `services/apiService.ts` → Express backend.

**Action:** `git rm services/mimoService.ts`

---

## 4. Remove Stale Root-Level Files

| File | Reason |
|------|--------|
| `metadata.json` | References "GeminiGPT" / Google Gemini — completely stale. Not referenced anywhere. |
| `bot-message-square.png` | Duplicate of `assets/` version. Not referenced by any code. |
| `bot-message-square.svg` | Duplicate of `assets/bot-message-square.svg`. Not referenced by any code. |

**Action:** `git rm` all three files.

---

## 5. Remove Generated Images from Git Tracking

`generated_images/` has 10 AI-generated images tracked in git despite being listed in `.gitignore`. These were committed before the gitignore rule was added.

**Action:**
```bash
git rm -r --cached generated_images/
```

---

## 6. Remove Tracked Tool/Config Artifacts

### `.mimocode/plans/`
One plan file (`1782795416581-cosmic-rocket.md`) is tracked. This is a leftover from the MiMo Code tool.

**Action:** `git rm .mimocode/plans/1782795416581-cosmic-rocket.md`

### `docs/compose/`
Three files tracked from a compose workflow tool (plans, reports, specs). These are stale artifacts.

**Action:** `git rm -r docs/compose/`

### `.kilo/plans/`
28 plan files tracked in git. These are implementation planning artifacts and shouldn't be in the repo.

**Action:** `git rm -r .kilo/plans/`

---

## 7. Remove Stale Root-Level Favicons

11 favicon PNG files + `favicon.ico` at root. The app uses an **inline SVG favicon** in `index.html:6`. None of these files are referenced by any code.

**Action:** `git rm favicon-*.png favicon.ico`

---

## 8. Move Documentation Out of Source Directory

`services/databaseAdapter.md` is a documentation file mixed in with TypeScript source code.

**Action:** Move to `docs/databaseAdapter.md`

---

## 9. Deduplicate `cn()` Utility

The `cn()` function is defined in 3 places:

1. `lib/utils.ts` — canonical (uses `clsx` + `twMerge`)
2. `components/TokenUsageStats.tsx:9` — local copy (same implementation)
3. `components/PromptInputBox.tsx:8` — simpler version (just filters/joins)

**Action:**
- In `TokenUsageStats.tsx`: replace local `cn` with import from `@/lib/utils`
- In `PromptInputBox.tsx`: replace local `cn` with import from `../lib/utils` (note: simpler version doesn't use `twMerge`, so verify no behavioral change)

---

## 10. Update `.gitignore`

Add entries for cleaned-up paths and prevent future clutter:

```gitignore
# Remove self-reference (line 30 currently ignores .gitignore itself)

# Add:
output/
tmp/
.mimocode/
.compose/
docs/compose/
```

---

## 11. Rewrite README.md

The current README is completely stale — references Electron, Google Gemini, SQLite, `schema.sql`, `electron/` directory, and a project structure that no longer exists.

**Action:** Rewrite to accurately describe:
- **Project**: edward:labs — AI chat web app using Xiaomi MiMo API
- **Stack**: React 19 + Vite + TypeScript + Tailwind (CDN) + Express backend
- **Features**: Chat, TTS/ASR, RAG experiments, Agent plugin, Stitch visual design, IndexedDB persistence, Docker deployment
- **Setup**: `.env` with MIMO_API_KEY, MIMO_BASE_URL, MIMO_DIRECT_API_KEY, MIMO_DIRECT_BASE_URL, OPENAI_API_KEY
- **Commands**: `npm run dev`, `npm run dev:server`, `npm run dev:all`, `npm run build`, Docker commands
- **Architecture**: Client → Express API → MiMo API; IndexedDB for local storage
- **Docker**: `Dockerfile.frontend`, `Dockerfile.backend`, `docker-compose.yml`, nginx proxy

---

## Execution Order

1. Remove dead components (steps 1-3)
2. Remove stale files (steps 4-7)
3. Move documentation (step 8)
4. Deduplicate `cn()` (step 9)
5. Update `.gitignore` (step 10)
6. Rewrite README (step 11)
7. Verify build still works: `npm run build`

---

## Files Modified

| Action | Files |
|--------|-------|
| **Delete** | `components/PasswordModal.tsx`, `components/PasswordScreen.tsx`, `components/ResizableDivider.tsx`, `components/RAGPanel.tsx`, `services/mimoService.ts`, `metadata.json`, `bot-message-square.png`, `bot-message-square.svg`, `favicon-*.png` (11 files), `favicon.ico` |
| **Untrack** | `generated_images/*` (10 files), `.mimocode/plans/*`, `docs/compose/*`, `.kilo/plans/*` |
| **Move** | `services/databaseAdapter.md` → `docs/databaseAdapter.md` |
| **Edit** | `App.tsx` (remove unused import), `components/TokenUsageStats.tsx` (dedup `cn`), `components/PromptInputBox.tsx` (dedup `cn`), `.gitignore` (update entries), `README.md` (full rewrite) |

## Risk Assessment

- **Low risk**: All deleted components are provably unused (zero imports or JSX usage)
- **Low risk**: Generated images are already gitignored, just removing from tracking
- **Low risk**: README rewrite is documentation-only, no code impact
- **Medium risk**: `PromptInputBox.tsx` uses a simpler `cn()` that doesn't merge Tailwind classes — needs testing to ensure no visual regressions
