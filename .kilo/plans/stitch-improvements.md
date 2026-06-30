# Stitch Feature Improvements

## Overview
Five improvements to the Stitch (HTML generator) feature:
1. Model selection in Stitch UI
2. Visible AI thinking/building process (streaming)
3. User-defined project name
4. Fixed layout once picked
5. Sidebar layout for controls after first generation

---

## 1. Model Selection in Stitch UI

### Files to modify
- `components/StitchPromptBar.tsx` — Add a `Model` chip category alongside Type/Style/Color/Layout
- `components/StitchEditor.tsx` — Accept available models, manage selected model state
- `components/StitchPanel.tsx` — Pass models list down to StitchEditor

### Implementation
- Add a new `CHIP_CATEGORIES` entry for "Model" with chips derived from `DEFAULT_MODELS` (filtered to `modelType === 'chat'`). Chip labels = model display names (e.g. "MiMo V2.5", "MiMo V2.5 Pro").
- `StitchPromptBar` gains new props: `models: ModelConfig[]`, `selectedModel: string`, `onModelChange: (id: string) => void`.
- The model chips render as a 5th row. Selecting a model chip updates the parent's `selectedModel` state.
- `StitchEditor` holds `selectedModelId` state (default: `modelConfig.id`), passes it to `generateHTML()`.
- `StitchPanel` passes the full `models` list (from App) or a filtered subset. Since `StitchPanel` currently only receives `modelConfig` (single model), we need to also pass `models` and `onSelectModel` from `App.tsx`.

### Changes to `App.tsx`
- Pass `models` and `onSelectModel={handleSelectModel}` to `StitchPanel` so it can offer model selection within Stitch.

---

## 2. Visible AI Thinking / Building Process (Streaming)

### Files to modify
- `server/routes/stitch.ts` — Switch from `chatCompletion` (non-streaming) to `streamChatCompletion` with SSE
- `services/stitchService.ts` — Add `generateHTMLStream()` that returns an async generator
- `components/StitchEditor.tsx` — Consume stream, display thinking + HTML build progress
- `components/StitchPanel.tsx` — Minor prop threading

### Implementation

**Server (`server/routes/stitch.ts`)**:
- Enable `stream: true` and `thinking: { type: 'enabled' }` in the request body.
- Set SSE headers (`Content-Type: text/event-stream`, etc.) and proxy the upstream SSE stream to the client, same pattern as `chat.ts` line 79-102.
- Keep the existing non-streaming endpoint as fallback.

**Client service (`services/stitchService.ts`)**:
- Add `generateHTMLStream()` function that POSTs to `/api/stitch/generate-html-stream` (or same endpoint with `stream: true` in body) and returns an `AsyncGenerator<{ thinkingText?: string; htmlChunk?: string; done: boolean }>`.
- Reuse the `parseSSEStream` pattern from `apiService.ts`.

**UI (`StitchEditor.tsx`)**:
- Add state: `thinkingText: string`, `streamingHtml: string`.
- During generation, show a collapsible "Thinking" panel (similar to `ChatMessage` thinking display) with the AI's reasoning content.
- Show the HTML being built in real-time in the source view (or a progress indicator in preview).
- Once streaming completes, set the final `generatedHtml` and switch to preview mode.

---

## 3. Project Name from User Input

### Files to modify
- `components/StitchPanel.tsx` — Add text input in the creation flow

### Implementation
- In the `isCreating` block (line 109-150), add a text input field above the layout selector: "Project Name".
- Default value: empty string with placeholder "Enter project name...".
- On layout button click, use the entered name (fallback to auto-generated name if empty).
- Store `projectName` in local state within the creation form.

---

## 4. Fixed Layout Once Picked

### Files to modify
- `components/StitchEditor.tsx` — Remove the layout selector bar (lines 121-136), make layout read-only
- `components/StitchPanel.tsx` — Layout is set at creation time and stored on the board

### Implementation
- In `StitchEditor`, remove the layout selector buttons from the top bar. The layout is determined by `board.layout` which is set at project creation.
- Display the current layout as a read-only badge in the top bar (e.g. "16:9 Landscape").
- Remove `handleLayoutChange` and the `LAYOUT_OPTIONS` from `StitchEditor`.
- The layout selector remains only in `StitchPanel`'s creation flow.

---

## 5. Sidebar Layout After First Initiation

### Files to modify
- `components/StitchEditor.tsx` — Complete layout restructure

### Implementation

**Before first generation (full-screen layout)**:
- Show a centered, full-screen layout with:
  - Project name at top
  - Layout badge (read-only)
  - Chip categories (Type, Style, Color, Layout, Model) in a vertical stack
  - Prompt input + generate button at the bottom
- No sidebar, no preview area. Just the configuration form centered on screen.

**After first generation (sidebar + preview layout)**:
- Split into sidebar (left, ~280px) + preview area (right, flex-1).
- **Sidebar** contains:
  - Project title + layout badge at top
  - Chip categories (Type, Style, Color, Layout, Model) in scrollable vertical list
  - Prompt input + generate button at bottom
  - "Back to full config" button to clear HTML and return to full-screen mode
- **Preview area** contains:
  - View toggle (Preview/Source) in a mini toolbar
  - Thinking panel (collapsible, shown during generation)
  - iframe preview or source code view
  - Action buttons (Download HTML, Copy, Regenerate) in the toolbar

**State management**:
- `hasGenerated: boolean` — derived from `!!generatedHtml` or a separate flag set after first generation.
- When `hasGenerated` is false → full-screen layout.
- When `hasGenerated` is true → sidebar + preview layout.

---

## File Change Summary

| File | Changes |
|------|---------|
| `components/StitchPanel.tsx` | Add project name input; pass models list; remove layout change after creation |
| `components/StitchEditor.tsx` | Major restructure: full-screen → sidebar+preview; remove layout selector; add thinking display; add model selection |
| `components/StitchPromptBar.tsx` | Add Model chip category; accept model props |
| `services/stitchService.ts` | Add `generateHTMLStream()` for streaming |
| `server/routes/stitch.ts` | Add streaming endpoint with thinking enabled |
| `App.tsx` | Pass `models` to StitchPanel |
| `types.ts` | No changes needed |

---

## Implementation Order

1. **Project name input** (StitchPanel.tsx) — smallest, isolated change
2. **Fixed layout** (StitchEditor.tsx) — remove layout selector, make read-only
3. **Model selection** (StitchPromptBar.tsx, StitchEditor.tsx, StitchPanel.tsx, App.tsx)
4. **Streaming + thinking** (server/routes/stitch.ts, services/stitchService.ts, StitchEditor.tsx)
5. **Sidebar layout** (StitchEditor.tsx) — largest UI change, depends on 2-4
