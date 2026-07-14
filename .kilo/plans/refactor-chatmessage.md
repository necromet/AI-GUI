# Plan: Refactor ChatMessage into Reusable Sub-Components

## Goal

Break the 902-line monolithic `ChatMessage.tsx` into focused, reusable components. The core markdown rendering pipeline becomes a standalone `MarkdownRenderer` that can be imported anywhere content needs to be displayed with full code highlighting, word-stream animation, tables, and search citations.

## Current State

- `components/ChatMessage.tsx` — 902 lines, one giant component
- Consumers: `App.tsx` (via `ChatMessageList` wrapper), `AgentChatPanel.tsx`, `RAGChatPanel.tsx`
- All three import the full component even though they could benefit from picking sub-pieces
- No other panel (LibraryPanel, PluginAgentPanel, stitch boards) can render markdown with the same rich styling

## New File Structure

```
components/
  chat/
    MarkdownRenderer.tsx    # Core markdown rendering pipeline (standalone)
    SearchCitations.tsx     # Expandable search annotation cards
    MessageActions.tsx      # Copy / feedback / regenerate / thumb buttons
    ThinkingIndicator.tsx   # "Thinking..." / "Searching..." with MathCurveLoader
  ChatMessage.tsx           # Thin wrapper composing sub-components + role layout + sender name
```

## Component Details

### 1. `components/chat/MarkdownRenderer.tsx` (~350 lines)

**Purpose**: Standalone markdown-to-React rendering with all custom renderers. No chat-specific chrome.

**Props**:
```ts
interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  wordAnimation?: boolean;     // enable per-word blur-in capsules (default: true)
  className?: string;           // additional classes on the wrapper div
  onReattach?: (data: string, name: string, mimeType: string) => void;
}
```

**Contains** (extracted from current ChatMessage):
- `preprocessMarkdown` function (line 134)
- `wrapWordsBlur` function (line 167)
- `catppuccinLatte` and `catppuccinMocha` theme objects (lines 18-124)
- `isDark` state + MutationObserver (line 229-235)
- `htmlPreviewMap` state + `htmlBlockCounterRef` (lines 211-212, 250)
- `copiedCode` state + `handleCopyCode` (lines 204, 252-260)
- All ReactMarkdown `components` renderers:
  - `pre` — code block container, WinPath detection, HTML block passthrough (lines 376-437)
  - `code` — syntax highlighting, copy button, HTML live preview toggle (lines 439-637)
  - `table`, `thead`, `tbody`, `tr`, `th`, `td` — styled tables (lines 618-639)
  - `li` — list item with `wrapWordsBlur` (line 640-642)
  - `p` — paragraph with arrow-chain detection + `wrapWordsBlur` (lines 643-699)
- Wrapper div with prose classes and `color: var(--text-100)` (line 349)

**Exports**: Both the component and the internal helpers (`wrapWordsBlur`, `preprocessMarkdown`, `catppuccin*` themes) for advanced use cases.

**Used by**: ChatMessage, AgentChatPanel, RAGChatPanel, LibraryPanel previews, future plugin agents.

### 2. `components/chat/SearchCitations.tsx` (~130 lines)

**Purpose**: Expandable card grid showing search result annotations.

**Props**:
```ts
interface SearchCitationsProps {
  annotations: SearchAnnotation[];
}
```

**Contains** (extracted from lines 706-833):
- Citation count button with ChevronDown toggle
- Colorful gradient avatars for sources
- Card grid with site logo, title, domain, publish time, summary
- Click-to-open in new tab

**State**: `isExpanded` toggle

### 3. `components/chat/MessageActions.tsx` (~50 lines)

**Purpose**: Row of action buttons (copy, thumbs up, thumbs down, regenerate).

**Props**:
```ts
interface MessageActionsProps {
  onCopy: () => void;
  onGood: () => void;
  onBad: () => void;
  onRegenerate?: () => void;
}
```

**Contains** (extracted from lines 852-890):
- Copy message button (with Check icon feedback)
- Thumbs up/down (with color feedback)
- Regenerate button

**State**: `copied` + `feedback` (managed internally)

### 4. `components/chat/ThinkingIndicator.tsx` (~40 lines)

**Purpose**: Loading state with math curve loader animation.

**Props**:
```ts
interface ThinkingIndicatorProps {
  isSearching?: boolean;
  thinkingContent?: string;
}
```

**Contains** (extracted from lines 287-303):
- MathCurveLoader spinner
- "Thinking..." / "Searching the web..." label
- Optional reasoning content panel

### 5. `components/ChatMessage.tsx` (~150 lines, refactored)

**Purpose**: Thin wrapper that composes the sub-components with chat-specific chrome.

**Props**: Same `ChatMessageProps` (unchanged public API).

**Composes**:
- `ThinkingIndicator` — when message is loading
- `MarkdownRenderer` — the main content
- `SearchCitations` — when annotations exist
- `MessageActions` — for assistant messages
- Sender name ("You" / "MiMo") label
- Token usage display
- Attachment thumbnails + preview dialog
- Outer layout container with group hover

**Still in ChatMessage** (not extracted):
- `handleCopyMessage` (wraps `navigator.clipboard` for full message copy)
- `handleFeedback` bridge (converts 'good'/'bad' to `onFeedback` callback)
- `selectedAttachment` state + `Dialog` preview
- Sender name label and outer container div
- Token usage display

## Consumer Migration

### `App.tsx` (via `ChatMessageList`)
- **No change** — `ChatMessageList` already wraps `ChatMessage`, keeps working

### `AgentChatPanel.tsx`
- Replace: `import ChatMessage from './ChatMessage'`
- With: `import ChatMessage from './ChatMessage'` + `import { MarkdownRenderer } from './chat/MarkdownRenderer'`
- If the panel has its own action bars or needs raw markdown rendering, use `MarkdownRenderer` directly
- Otherwise, keep `ChatMessage` (one import, full feature set)

### `RAGChatPanel.tsx`
- Same as AgentChatPanel

## Migration Strategy

1. Create `components/chat/` directory
2. Extract `ThinkingIndicator.tsx` first (smallest, no deps)
3. Extract `MessageActions.tsx` (small, no deps)
4. Extract `SearchCitations.tsx` (medium, depends on types + Card + Badge)
5. Extract `MarkdownRenderer.tsx` (largest, depends on all markdown plugins)
6. Refactor `ChatMessage.tsx` to import and compose sub-components
7. Verify build passes
8. Update consumers to use `MarkdownRenderer` where appropriate

## File-Change Summary

| File | Action | Lines |
|------|--------|-------|
| `components/chat/MarkdownRenderer.tsx` | **Create** | ~350 |
| `components/chat/SearchCitations.tsx` | **Create** | ~130 |
| `components/chat/MessageActions.tsx` | **Create** | ~50 |
| `components/chat/ThinkingIndicator.tsx` | **Create** | ~40 |
| `components/ChatMessage.tsx` | **Rewrite** | 902 → ~150 |
| `components/AgentChatPanel.tsx` | **Update import** | 1 line |
| `components/RAGChatPanel.tsx` | **Update import** | 1 line |

## Risks / Notes

- The `word-stream-blur` and `word-stream-capsule` CSS classes stay in `globals.css` — no CSS changes needed
- `catppuccinLatte`/`catppuccinMocha` currently exported as `const` in the module scope — they move to `MarkdownRenderer.tsx` and can be re-exported for external use
- The `isDark` state in MarkdownRenderer (MutationObserver on `<html>` class) duplicates the same pattern in ChatMessage — only one copy needed since MarkdownRenderer owns it
- `preprocessMarkdown` is a pure function — could go in `lib/utils.ts` but keeping it alongside the renderer makes more sense for now
- No TypeScript type changes needed — `MarkdownRendererProps` is new, `ChatMessageProps` stays identical
