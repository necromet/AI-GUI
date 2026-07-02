# Fix: Stitch HTML Preview Not Showing

## Root Cause Analysis

After tracing the full generation → display flow, I identified **3 bugs** and **1 UX issue**:

---

### Bug 1: `hasGenerated` flips to sidebar layout too early, then `displayHtml` is empty

**Location**: `StitchEditor.tsx:47` and `StitchEditor.tsx:197`

```
const hasGenerated = !!generatedHtml || (!!streamingHtml && isGenerating);
```

When the first HTML chunk arrives during streaming:
- `hasGenerated` becomes `true` (because `streamingHtml` is non-empty and `isGenerating` is true)
- The full-screen layout exits → sidebar+preview layout renders
- But `displayHtml = generatedHtml || (isGenerating ? debouncedPreviewHtml : '')` — and `debouncedPreviewHtml` is **still empty** because it's on a 1.5s debounce timer
- Result: user sees the sidebar layout with an empty preview ("Generating HTML..." spinner)

This isn't a "never shows" bug — it's a confusing transition. Once `debouncedPreviewHtml` updates (after 1.5s) or once streaming completes, the HTML does appear. But if the generation is fast (completes in <1.5s), the user sees the spinner briefly then the final HTML.

**This is NOT the main bug.** The HTML eventually shows for successful generations.

---

### Bug 2 (MAIN BUG): No loading state in full-screen layout during generation

**Location**: `StitchEditor.tsx:196-248`

When the user clicks Generate on the **full-screen** config layout:
1. `handleGenerate` sets `isGenerating = true`, `streamingHtml = ''`
2. `hasGenerated = !!'' || (!!'' && true) = false` — **still full-screen layout**
3. The full-screen layout renders with NO loading indicator at all
4. The StitchPromptBar's button is disabled (greyed out), but that's subtle
5. If the API call fails silently (no server running, network error), the user sees nothing change — just a disabled button that eventually re-enables

**If the Express backend is not running** (`npm run dev:server` or `npm run dev:all` not started), the fetch to `/api/stitch/generate-html` fails with a connection error. The catch block shows a notification, but the user might miss it since there's no other visual feedback.

---

### Bug 3: `showThinking` shows empty thinking panel for non-reasoning models

**Location**: `StitchEditor.tsx:193`

```
const showThinking = (isGenerating || thinkingText) && (thinkingText || streamingHtml);
```

This simplifies to: `thinkingText || (isGenerating && streamingHtml)`

For non-reasoning models (e.g., MiMo V2.5 base):
- `thinkingText` is empty (no `reasoning_content` in stream)
- `isGenerating && streamingHtml` = `true` (once HTML chunks arrive)
- `showThinking = true` → thinking panel header shows with "Thinking" + spinner, but **no thinking content inside**

This is confusing — the user sees a "Thinking" panel with nothing in it.

---

### UX Issue: StitchPromptBar state lost on layout transition

When switching from full-screen to sidebar layout, the StitchPromptBar is **remounted** (different JSX tree). This means:
- The user's typed prompt is lost
- Selected chips are lost
- Model selection is preserved (it's in parent state)

---

## Plan

### Fix 1: Add loading indicator to full-screen layout

**File**: `components/StitchEditor.tsx`

In the full-screen layout return (line 196-248), add a loading state when `isGenerating` is true. After the StitchPromptBar div, show:
- A spinner with "Generating HTML..." text
- The thinking panel (collapsible) if thinking text is accumulating

This gives the user immediate feedback that something is happening after clicking Generate.

### Fix 2: Fix `showThinking` to only show when thinking content exists

**File**: `components/StitchEditor.tsx:193`

Change:
```js
const showThinking = (isGenerating || thinkingText) && (thinkingText || streamingHtml);
```
To:
```js
const showThinking = !!thinkingText;
```

The thinking panel should only appear when there is actual thinking/reasoning content to display. For non-reasoning models, it should never show.

### Fix 3: Add `flushSync` or use immediate preview during streaming

**File**: `components/StitchEditor.tsx`

Instead of the 1.5s debounce for `debouncedPreviewHtml`, update the preview immediately when streaming starts. Change the debounce logic to update `debouncedPreviewHtml` directly from `streamingHtml` on every chunk, but throttle iframe `srcDoc` updates to every 2s using a separate ref.

Alternatively, simplify: just use `streamingHtml` directly as `displayHtml` during streaming (removing the debounce entirely). The iframe `srcDoc` is already efficient enough for this use case.

### Fix 4: Persist StitchPromptBar state across layout transitions

**File**: `components/StitchEditor.tsx`

Lift the prompt and activeChips state from StitchPromptBar into StitchEditor, so it survives the layout transition. Add `initialPrompt` and `initialActiveChips` props to StitchPromptBar.

---

## Files to Modify

| File | Changes |
|------|---------|
| `components/StitchEditor.tsx` | Fix 1, 2, 3, 4 |
| `components/StitchPromptBar.tsx` | Fix 4: accept `initialPrompt` and `initialActiveChips` props |

---

## Verification

1. Start both servers: `npm run dev:all`
2. Create a new Stitch project
3. On full-screen config: type a prompt, select chips, click Generate
4. Verify: loading spinner appears immediately in the full-screen layout
5. Verify: layout transitions to sidebar+preview once HTML chunks arrive
6. Verify: HTML preview shows in the right-side iframe
7. Verify: no empty "Thinking" panel for non-reasoning models
8. Verify: prompt text is preserved if user navigates back to full config
