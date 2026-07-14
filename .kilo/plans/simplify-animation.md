# Simplify Animation Approach

## What

Remove the per-word `wrapWordsBlur` / `motion.span` complexity. The existing `.animate-message-in` class on each `ChatMessage` container already provides a `0.4s ease-out` fade-in for each new message. That's sufficient — no per-word blur-in needed.

## Changes

### `components/chat/MarkdownRenderer.tsx`

- Remove `import { motion } from 'framer-motion'`
- Remove `wrapWordsBlur` function entirely
- In `li` renderer: replace `{wrapWordsBlur(children, ...)}` with `{children}`
- In `p` renderer: replace `{wrapWordsBlur(children, ...)}` with `{children}`
- In the recursive inline element cloning: replace `wrapWordsBlur(...)` with passthrough

The `p` arrow-chain detection stays (that's a separate feature).

### `src/globals.css`

- Remove `.word-stream-capsule` class (no longer used)

### `docs/word-stream-animation.md`

- Update to reflect the simpler approach (message-level fade-in, not per-word)

### What stays

- `.animate-message-in` on `ChatMessage` container (already there)
- All ReactMarkdown custom renderers (code blocks, tables, etc.) — unchanged
- `preprocessMarkdown` — still used for Windows path escaping
- `catppuccin*` themes — still used for syntax highlighting
