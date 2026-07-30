# Codebase Cleanup Plan

## Summary
Comprehensive dead code removal, unused import cleanup, and dependency pruning across the edward:labs codebase.

---

## 1. Delete Dead UI Components (never imported anywhere)

These shadcn/ui wrapper files exist in `components/ui/` but are never imported by any file in the codebase:

| File | Status |
|------|--------|
| `components/ui/sheet.tsx` | **Dead** — zero imports |
| `components/ui/toggle.tsx` | **Dead** — zero imports |
| `components/ui/tabs.tsx` | **Dead** — zero imports |
| `components/ui/chat-input.tsx` | **Dead** — zero imports |

**Action:** Delete all 4 files.

---

## 2. Delete Dead Application Components (never imported anywhere)

| File | Status |
|------|--------|
| `components/ToolCallCard.tsx` | **Dead** — zero imports (only defines + exports, never consumed) |
| `components/StitchPromptBar.tsx` | **Dead** — zero imports |

**Action:** Delete both files.

---

## 3. Delete Dead Hook

| File | Status |
|------|--------|
| `hooks/use-textarea-resize.ts` | **Dead** — only imported by dead `chat-input.tsx` |

**Action:** Delete the file. (The `hooks/` directory will become empty — delete it too.)

---

## 4. Remove Unused npm Dependencies from `package.json`

These packages are listed in `dependencies` but never imported anywhere in client or server code:

| Package | Notes |
|---------|-------|
| `gsap` | Zero imports |
| `recharts` | Zero imports |
| `idb` | Zero imports (legacy IndexedDB, replaced by REST adapter) |
| `ace-builds` | Zero imports |
| `react-ace` | Zero imports |
| `xlsx` | Zero imports |

**Action:** Remove all 6 from `dependencies`. Run `npm install` to update lockfile.

---

## 5. Move Misplaced Dev Dependency

| Package | Current | Should Be |
|---------|---------|-----------|
| `@types/react-syntax-highlighter` | `dependencies` | `devDependencies` |

**Action:** Move from `dependencies` to `devDependencies`.

---

## 6. Remove Unused Radix Dependencies (only consumed by now-deleted dead UI files)

After deleting the dead UI components from step 1, these Radix packages become orphaned:

| Package | Only Consumer |
|---------|---------------|
| `@radix-ui/react-tabs` | `components/ui/tabs.tsx` (dead) |
| `@radix-ui/react-toggle` | `components/ui/toggle.tsx` (dead) |
| `@radix-ui/react-toggle-group` | **Already fully dead** — not even imported by any file today |

**Action:** Remove all 3 from `dependencies`.

---

## 7. Clean Up Unused Imports in `App.tsx`

**Line 3** — 6 unused lucide-react icon imports:
```
Code, Eye, Maximize2, Copy, Download, Check
```
None of these are used as JSX elements anywhere in App.tsx. `Check` only appears as English text in a string literal.

**Line 18** — Unused UI import:
```
import { Separator } from '@/components/ui/separator'
```
`<Separator>` is never rendered in App.tsx.

**Line 19** — Unused UI import:
```
import { Card } from '@/components/ui/card'
```
`<Card>` is never rendered in App.tsx.

**Action:** Remove `Code, Eye, Maximize2, Copy, Download, Check` from the lucide-react import. Remove the `Separator` and `Card` import lines.

---

## 8. Delete Dead Directories

| Directory | Status |
|-----------|--------|
| `banner/` | Contains only `Banner BG.png`. Never referenced in code (only a string comment in `server/services/agentService.ts` mentions the word "banner" in a different context). |
| `math-curve-loaders/` | Standalone subproject with its own `.git/`. Not referenced by any source code. The `math-curve-loader.tsx` UI component is a separate, **used** file — this directory is unrelated. |

**Action:** Delete both directories (confirm they are not git submodules first).

---

## 9. Summary of All Changes

### Files to DELETE (8 files + 2 directories):
1. `components/ui/sheet.tsx`
2. `components/ui/toggle.tsx`
3. `components/ui/tabs.tsx`
4. `components/ui/chat-input.tsx`
5. `components/ToolCallCard.tsx`
6. `components/StitchPromptBar.tsx`
7. `hooks/use-textarea-resize.ts`
8. `hooks/` (empty directory after above)
9. `banner/` (directory)
10. `math-curve-loaders/` (directory — verify not submodule first)

### Files to EDIT (2 files):
1. **`App.tsx`** — Remove 8 unused imports (`Code`, `Eye`, `Maximize2`, `Copy`, `Download`, `Check`, `Separator`, `Card`)
2. **`package.json`** — Remove 9 packages (`gsap`, `recharts`, `idb`, `ace-builds`, `react-ace`, `xlsx`, `@radix-ui/react-tabs`, `@radix-ui/react-toggle`, `@radix-ui/react-toggle-group`), move `@types/react-syntax-highlighter` to devDependencies

### Post-change verification:
- `npm run build` must succeed (the only verification script)
- `npm install` to regenerate lockfile after dependency changes

---

## 10. Out of Scope (noted for future)

These items were observed but are lower priority or riskier to change:
- `StitchEditor.tsx` and `StitchAgentSidebar.tsx` have duplicated message rendering patterns — could share a component but risky refactor
- `App.tsx` is 1533 lines — could be split into route-level components
- Several `console.log` / `console.error` calls in production code — could use a logger
- The `@ark-ui/react` package is used only for `<Splitter>` in App.tsx — heavy dependency for one component, but not dead code
