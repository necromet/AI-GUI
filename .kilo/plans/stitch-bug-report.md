# Bug Report: Stitch IG JSON Spec Implementation

## Bug 1 (Critical): `theme` not persisted — lost on project reload

**Location**: `services/stitchService.ts:282-293` (`stitchProjectToDB`) and `:295-318` (`stitchDBToProject`)

**Problem**: `stitchProjectToDB` does NOT include `theme` in the serialized output. When a spec is generated, `StitchEditor.tsx:368` sets `theme: finalSpec.theme` on the project. This is passed to `onSave` → `handleSaveProject` → `stitchProjectToDB` → API `PUT /projects/:id`. The `theme` field is silently dropped.

When the user reloads and the project is loaded via `stitchDBToProject`, there is no `theme` field in the response — so `project.theme` is `undefined`. The `designSpec` initializer in `StitchEditor.tsx:52` falls back to a hardcoded default theme (`{ fonts: { heading: 'Inter', body: 'Inter' }, colors: {}, ... }`), which will NOT match the AI-generated theme. All slides will render with wrong colors/fonts after reload.

**Fix**: Add `theme` to `stitchProjectToDB` output. The `saveStitchProject` API adapter in `apiDatabaseAdapter.ts:218-228` needs to include it in the request body. The backend `PUT /projects/:id` route and `saveStitchProject` DB function will store it in `boards_json` (since `StitchProject` is serialized as a whole in `boards_json`). Actually — looking at `apiDatabaseAdapter.ts:224`, `boards_json` is `JSON.stringify(project.boards)` — it only stores the boards array, NOT the full project. So `theme` needs its own field or needs to be embedded in the boards JSON.

**Simplest fix**: Embed `theme` as metadata on board 0's `designSpec`, OR add a `_theme` field to the boards JSON wrapper, OR add a `theme_json` column to `stitch_projects`.

---

## Bug 2 (Critical): `designSpec` state not synced when switching carousel slides

**Location**: `components/StitchEditor.tsx:83-91`

**Problem**: When the user clicks a different slide number in the carousel navigator, the `useEffect` at line 83 only updates `generatedHtml`, `streamingHtml`, and `thinkingText`. It does NOT update `designSpec`. So after switching slides:
- `designSpec` still holds the spec from whichever slide was active when the component mounted or when the spec was generated
- If the user asks "change the background color" while on slide 3, the `context.currentSpec` sent to the backend will be the full design spec, which is correct. BUT the rendered preview may show stale HTML if `generatedHtml` was loaded from the board but `designSpec` is from a different state
- More critically: if the user generated slides 1-5, then switches to slide 3 and modifies it, the `designSpec` state contains ALL slides. When `edit_spec` returns the updated spec, `setDesignSpec(spec)` is called with the full spec. Then `renderSlide(spec.slides[activeBoardIdx], ...)` is called. If `activeBoardIdx` changed between generation and the edit response, the wrong slide gets rendered

**Fix**: Sync `designSpec` in the board-switch `useEffect` at line 83-91. When switching boards, reconstruct `designSpec` from the project's stored data.

---

## Bug 3 (High): Route collision — `POST /components/:id` catches `POST /components/search`

**Location**: `server/routes/stitch.ts:393` and `server/routes/stitch.ts:433`

**Problem**: Express route `POST /components` (line 393) and `POST /components/search` (line 433) and `POST /components/:id` — wait, there is no `POST /components/:id`. Let me re-check...

Actually the routes are:
- `GET /components` (line 367)
- `GET /components/:id` (line 379)
- `POST /components` (line 393) — create
- `DELETE /components/:id` (line 419)
- `POST /components/search` (line 433)
- `POST /components/reindex` (line 448)
- `POST /components/seed` (line 458)

Since `search`, `reindex`, and `seed` are POST routes registered BEFORE any `POST /:id` route, and there IS no `POST /:id` route, there is no collision. **This is NOT a bug.** Removing from report.

---

## Bug 3 (High): `StitchLibrary` component created but never rendered

**Location**: `components/StitchLibrary.tsx` (new file), `components/StitchEditor.tsx`

**Problem**: `StitchLibrary.tsx` was created with full UI (search, category filters, add/delete, selection) but it is never imported or rendered in `StitchEditor.tsx` or anywhere else. The plan called for "Add a library toggle button in the sidebar" in StitchEditor, but this was never implemented. The library is completely inaccessible from the UI.

**Fix**: Import and render `StitchLibrary` in `StitchEditor.tsx` sidebar. Add a toggle button. Wire `selectedLibraryComponents` to the generation context.

---

## Bug 4 (High): `edit_spec` tool result not persisted to individual board's `designSpec`

**Location**: `components/StitchEditor.tsx:303-326` (spec tool result handling) and `:348-396` (final spec handling)

**Problem**: When `generate_spec` or `edit_spec` tool returns a result at line 303-326:
1. `extractedSpec` is set to the full spec (all slides)
2. `setDesignSpec(spec)` updates the state
3. `renderSlide(spec.slides[0], spec.theme, layout)` renders slide 1 for preview

But the `designSpec` stored on the board (`updateBoard({ designSpec: slideSpec })`) only happens in the FINAL handling block at line 376. If the stream ends without reaching the final block (e.g., the AI produces tool results but no final summary text), the `designSpec` might not be saved to the board.

More critically: in the final handling block at line 357-377, for carousels it updates ALL boards with their respective slide specs. But for single-slide IG stories (line 372-377), it only updates `activeBoardIdx`. If the user is on slide 2 of a carousel and generates, the `activeBoardIdx` is used — but the spec contains ALL slides, so the code at line 360 correctly iterates all slides. This part seems correct for carousels.

However, the `designSpec` state is set to the FULL spec (all slides), but the board's `designSpec` field stores only the SINGLE slide spec. This asymmetry means: next time the user opens the project, `board.designSpec` has one slide, but `designSpec` state needs all slides. The initializer at line 50-55 tries to reconstruct it but only has one slide's spec — it can't reconstruct the full multi-slide spec.

**Fix**: Store the full `StitchDesignSpec` at the project level (not per-board), OR reconstruct it from all boards' specs on load.

---

## Bug 5 (Medium): Renderer `parseInt` on CSS values with units

**Location**: `lib/stitchRenderer.ts:154`

**Problem**: `parseInt(w) / 2` where `w` comes from `el.width || '100px'`. If the AI outputs `"width": "50%"` or `"width": "100"`, `parseInt("50%")` returns `50` which is then divided by 2 = `25px`. This is wrong — the triangle border-left would be `25px solid transparent` but the intent was 50% of something. Similarly, `parseInt("100")` = 100 works but `parseInt("100px")` = 100 also works. The real issue is percentage values.

**Fix**: Parse the numeric part properly, and handle `%` values differently (or skip triangle rendering for percentage widths).

---

## Bug 6 (Medium): Duplicate `getLayoutDimensions` functions

**Location**: `lib/stitchRenderer.ts:11-23` and `services/stitchService.ts:122-134`

**Problem**: Two identical `getLayoutDimensions` functions exist. If one is updated and the other isn't, they'll diverge. The renderer has its own copy to avoid circular imports, but this creates maintenance risk.

**Fix**: Extract to a shared utility file (e.g., `lib/layoutUtils.ts`) and import from both.

---

## Bug 7 (Medium): `buildStitchSystemPrompt` IG branch references `slideNumber`/`totalSlides` but these come from `context` which the agent route doesn't always populate

**Location**: `server/services/agentService.ts:699-704`

**Problem**: The IG carousel rules in `buildStitchSystemPrompt` reference `slideNumber` and `totalSlides` from context (lines 699-704). But in the agent flow (`server/routes/agent.ts`), the context is passed from the client. For carousels, the client sends `slideNumber` and `totalSlides` at `StitchEditor.tsx:232-233`. However, for the FIRST generation (when there's no existing HTML/spec), these are still sent. But the spec generation is supposed to generate ALL slides at once — so `slideNumber`/`totalSlides` are misleading in the spec generation context. The AI might think it should generate only one slide.

**Fix**: For spec generation, don't pass `slideNumber`/`totalSlides` — pass `slideCount` instead. The `slideNumber`/`totalSlides` fields make sense for per-slide HTML generation but not for the "generate all at once" spec approach.

---

## Bug 8 (Medium): Streaming spec JSON cannot be progressively rendered

**Location**: `components/StitchEditor.tsx:260-272`

**Problem**: When spec tools are used, the streaming text handler at line 260-272 still tries to detect `<!DOCTYPE` HTML in the streamed text. For spec generation, the streamed text is JSON (or the AI's natural language summary). The `htmlMatch` regex will never match, so `streamingHtml` won't be set during streaming. The user sees "Thinking..." then jumps to the final rendered result when the tool completes.

This is by design (the plan noted "Show a 'Composing design...' state instead of progressive preview") but the streaming handler at line 260-272 is wasteful — it runs regex checks on every streamed chunk even when spec tools are active.

**Fix**: Skip the HTML streaming detection when `isIgContent` is true and spec tools are being used.

---

## Bug 9 (Low): `renderElement` doesn't handle unknown element types gracefully

**Location**: `lib/stitchRenderer.ts:215-217`

**Problem**: The `default` case returns empty string `''`. If the AI outputs a typo in the element type (e.g., `"type": "headingg"`), the element silently disappears. No error, no fallback.

**Fix**: Return a visible placeholder or log a warning.

---

## Bug 10 (Low): `applySpecEdits` breaks on array indices in paths

**Location**: `lib/stitchRenderer.ts:323-343`

**Problem**: The path parser `edit.path.replace(/\[(\d+)\]/g, '.$1').split('.')` converts `slides[0].elements[0].text` to `['slides', '0', 'elements', '0', 'text']`. Then `isNaN(Number('0'))` returns `false`, so the key becomes `0` (number). But `target[0]` on the `slides` array works correctly. However, if the path references a non-existent index (e.g., `slides[5]` when there are only 3 slides), `target[5]` is `undefined`, and the `break` at line 331 stops traversal without setting the value. The edit silently fails.

Also, if the path is `theme.colors.bg`, `target` traverses `clone.theme` → `clone.theme.colors`, then sets `clone.theme.colors.bg = value`. This works. But if `theme.colors` doesn't exist (e.g., the AI output `"colors": null`), `target` becomes `null` and `target[key]` throws.

**Fix**: Add null checks and better error handling for invalid paths.

---

## Summary of fixes needed

| # | Severity | Bug | File(s) |
|---|----------|-----|---------|
| 1 | Critical | `theme` not persisted | `stitchService.ts`, `apiDatabaseAdapter.ts`, `stitch.ts` routes |
| 2 | Critical | `designSpec` not synced on board switch | `StitchEditor.tsx:83-91` |
| 3 | High | `StitchLibrary` never rendered | `StitchEditor.tsx` |
| 4 | High | Full `designSpec` vs per-board `designSpec` asymmetry | `StitchEditor.tsx`, `types.ts` |
| 5 | Medium | `parseInt` on CSS percentage values | `lib/stitchRenderer.ts:154` |
| 6 | Medium | Duplicate `getLayoutDimensions` | `lib/stitchRenderer.ts`, `stitchService.ts` |
| 7 | Medium | `slideNumber`/`totalSlides` misleading for spec gen | `agentService.ts`, `StitchEditor.tsx` |
| 8 | Medium | Wasteful HTML regex during spec streaming | `StitchEditor.tsx:260-272` |
| 9 | Low | Silent drop of unknown element types | `lib/stitchRenderer.ts:215` |
| 10 | Low | `applySpecEdits` silent failures on bad paths | `lib/stitchRenderer.ts:323-343` |
