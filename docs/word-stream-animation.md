# Word-by-Word Stream Animation — How It Works

## The Problem

General chat streams tokens from the AI. Previously the entire message would
blink/re-render on each token (cascade from `setMessages` per token, unmount/remount
of `ChatRouteContent` inline component, and `scrollToBottom` layout thrashing).

After fixing the cascade (stable `ChatMessageList` component, 32ms throttle, memoized
`ChatMessage`, throttled scroll), the words should **blur-in individually** — one word,
one blur animation, rendered. Not the whole block at once.

## Why "All at Once" Happened

### 1. No `animationDelay` — All words animate simultaneously

The CSS class `.word-stream-blur` applies `animation: word-stream-blur 0.35s ease-out both;`
to EVERY word span. Without an `animationDelay`, all spans start their animation at the
same moment (0s delay). They all blur-in together → looks like a single block animation.

### 2. How CSS animations work with React reconciliation

React uses `key` props to reconcile children. With stable keys (`wb-0`, `wb-1`, `wb-2`):

```
Render 1: spans for words [0,1]       → fresh DOM nodes → animation PLAYS
Render 2: spans for words [0,1,2,3]   → words [0,1] reuse DOM → animation STALE
                                       → words [2,3] fresh DOM → animation PLAYS
```

- **Existing words**: DOM nodes reused by React. CSS animation already completed
  (`animation-fill-mode: both` keeps final state: opacity=1, blur=0). No re-animation.
  ✅ This is correct.

- **New words at the end**: React creates fresh DOM nodes. CSS animation plays on
  the new nodes. ✅ This is correct.

The key insight: **CSS animations do NOT replay when React reuses a DOM node with
the same class**. The animation plays once on DOM creation and stays at the final
keyframe via `animation-fill-mode: both`. React's reconciliation preserves DOM nodes
for stable keys, so existing words never re-animate.

### 3. Why changing inline `animationDelay` style doesn't restart

Per the CSS Animations spec, changing `animation-delay` alone does NOT trigger an
animation restart. Only changes to `animation-name`, `animation-duration`, or
`animation-timing-function` restart. Since the delay is derived from the word's
consistent index (counter resets to 0 each render → same word → same index →
same delay), it never actually changes anyway.

## The Fix: Per-Word `animationDelay`

Each word span gets an inline `animationDelay` based on its sequential index:

```tsx
<span
  key={`wb-${wordIdx}`}
  className="word-stream-blur"
  style={{ animationDelay: `${wordIdx * 0.03}s` }}
>
  {word}
</span>
```

- Word 0: delay 0s (starts immediately)
- Word 1: delay 30ms
- Word 2: delay 60ms
- ...
- Word N: delay N×30ms

This creates a **cascading blur-in effect** where each subsequent word starts its
blur-in animation slightly after the previous one.

### Counter Consistency Across Renders

The `wordCounterRef` is reset to 0 at the start of each render. Since ReactMarkdown
processes the AST in a deterministic order, the same text content produces the same
word indices across renders:

```
Render 1: "Hello world"     → word indices 0,1
Render 2: "Hello world this" → word indices 0,1 (same), 2,3 (new)
```

The word indices for "Hello" and "world" are always 0 and 1. The delays are always
0s and 30ms. No delay change → no animation restart (even in strict browsers).

Words 2 and 3 ("this") are new → fresh DOM nodes → fresh animations with delays
60ms and 90ms.

## Re-render Cascade Fixes

In addition to the word-by-word animation, the following cascade fixes were applied:

| Issue | Fix | File |
|---|---|---|
| Inline `ChatRouteContent` recreated every `App` render → unmount/remount entire tree | Extracted `ChatMessageList` as stable component outside `App` | `App.tsx:69-88` |
| `scrollToBottom` fired on every messages change → layout thrashing | Throttled to 100ms via `setTimeout` ref | `App.tsx:333-345` |
| `setMessages` called per-token → scores of re-renders | Batched at 32ms (~30fps) in `processStreamResponse` | `App.tsx:80-124` |
| Unstable callback references break `React.memo` | `handleFeedback` via `useCallback`, `handleRegenerate` via ref | `App.tsx` |
| `ChatMessage` not memoized → re-renders on every parent update | Wrapped with `React.memo` | `ChatMessage.tsx:886` |

## CSS Animation Spec

```css
@keyframes word-stream-blur {
  0%   { opacity: 0; filter: blur(6px); }
  100% { opacity: 1; filter: blur(0); }
}

.word-stream-blur {
  display: inline;                  /* preserve inline flow */
  animation: word-stream-blur 0.35s ease-out both;
}
```

`animation-fill-mode: both` = `forwards` (keep end state) + `backwards` (apply
start state during delay). During the delay, the word is at opacity=0, blur=6px.
When the animation starts, it transitions over 0.35s to opacity=1, blur=0.
After completion, it stays at the end state.
