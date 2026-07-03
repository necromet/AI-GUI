# Stitch Chat Sidebar Redesign

## Goal
Full redesign of the 300px chat sidebar inside `StitchEditor.tsx` to match modern AI chat sidebar patterns (ChatGPT, Cursor, v0 style).

## Current State
The sidebar lives in `StitchEditor.tsx:652-1126` and contains:
- Slide selector (carousel only) — horizontal thumbnail strip
- Tab switcher: Chat | Library
- Chat tab: message list with user bubbles + assistant cards, thinking/tool/streaming indicators
- Library tab: StitchImageManager + StitchLibrary
- Model selector strip (bottom)
- Chat input (textarea + send/stop)

## Key Problems
1. **User messages** use neon-tinted background boxes — looks heavy, not like modern AI chat
2. **Assistant messages** are large cards with thinking/response/copy/reload stacked vertically — too much visual noise
3. **Generation progress** (dots, tool calls, streaming stats) is inline and cluttered
4. **Tab switcher** takes up space and adds cognitive load
5. **Model selector** is a plain row of buttons — not discoverable
6. **Input area** is a basic textarea — no visual prominence, no guidance
7. **Slide selector** is functional but disconnected from the chat flow
8. **No empty state** — blank chat with no guidance on what to do

## Design Direction
Modern AI chat sidebar with:
- Clean, minimal message layout
- User messages: right-aligned bubbles (small, compact)
- Assistant messages: left-aligned with subtle background, expandable thinking
- Smooth streaming indicator (typing animation, not dots)
- Sticky bottom input with integrated model picker and chip suggestions
- Collapsible sections (thinking, tool calls)
- Empty state with prompt suggestions

## Changes

### 1. Restyle user messages (StitchEditor.tsx:812-821)
- Change from full-width neon-tinted card to right-aligned compact bubble
- Smaller padding, rounded-2xl with bottom-right flat corner
- Background: subtle neon tint (lower opacity), no border

### 2. Restyle assistant messages (StitchEditor.tsx:823-891)
- Remove the heavy card wrapper
- Use a clean left-aligned layout with avatar/icon
- Thinking section: collapsible with smooth animation, subtle left border
- Response text: clean typography, no card background
- Copy/reload actions: appear on hover at bottom of message, icon-only

### 3. Redesign generation progress (StitchEditor.tsx:895-994)
- Replace dot animation with a single pulsing circle or gradient bar
- Tool calls: horizontal compact chips with status icons (spinner → check)
- Streaming stats: inline text, not a separate card
- Thinking stream: collapsible accordion with smooth height transition

### 4. Remove tab switcher, integrate library into chat flow
- Remove the Tabs component (StitchEditor.tsx:732-758)
- Add a toolbar row above the input with quick actions: image attach, library browse, style chips
- Library/image manager opens as a Sheet/overlay triggered from the toolbar

### 5. Redesign input area
- Replace basic textarea with a modern input container (rounded, shadow, border focus state)
- Add model selector as a small dropdown button inside the input row
- Style chips: horizontal scrollable row above the input, togglable
- Send button: circular, neon color, with arrow-up icon
- Stop button: red square, replaces send during generation

### 6. Redesign slide selector (carousel)
- Keep horizontal strip but make it more compact (smaller thumbnails)
- Add slide number labels
- Active slide: neon border glow
- Add slide button: subtle dashed outline

### 7. Add empty state
- When no messages and not generating, show a centered illustration/icon
- 2-3 quick prompt suggestions as clickable chips
- "Describe your design..." placeholder prominent in input

### 8. Polish animations
- Message entrance: slide-up + fade (use existing `animate-message-in`)
- Thinking expand: height transition with `grid-template-rows: 0fr → 1fr` trick
- Hover states: subtle background shifts on messages
- Input focus: border glow with neon color

## Files to Modify
1. **`components/StitchEditor.tsx`** — Main file. Restyle sidebar section (lines 652-1126): message list, progress, input, tabs, empty state
2. **`src/globals.css`** — Add new keyframe animations if needed (thinking expand, message slide)

## Files NOT Modified
- `StitchPanel.tsx` — Project list view (unchanged)
- `StitchPromptBar.tsx` — Used in empty state, keep as-is
- `StitchLibrary.tsx` — Will be triggered from toolbar instead of tab
- `StitchImageManager.tsx` — Will be triggered from toolbar instead of tab
- `StitchExportModal.tsx` — Unchanged
- `types.ts` — No type changes needed
- `stitchService.ts` — No service changes needed

## Implementation Order
1. Redesign message rendering (user + assistant)
2. Redesign generation progress indicators
3. Remove tabs, add toolbar with library/image triggers
4. Redesign input area with integrated model picker
5. Add empty state with prompt suggestions
6. Polish slide selector
7. Add/update CSS animations
8. Test all flows: empty → first message → generation → follow-up, carousel slides, library overlay
