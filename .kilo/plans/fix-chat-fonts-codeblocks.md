# Fix: Chat Font Size, Light Mode Code Blocks, and Directory Code Block Formatting

## Issue 1: Chat fonts don't follow the font size setting

**Root cause:** `ChatMessage.tsx:103` has `text-xl` on the message wrapper div. Since Tailwind uses `rem` and the root `html` font-size is `var(--app-font-size)`, `text-xl` = `1.25rem` = always 25% larger than the setting. Other components use `text-sm` or inherit from root.

**Fix in `ChatMessage.tsx`:**
- Line 103: Remove `text-xl` from the wrapper div so the chat message text inherits the base `font-size` from `html` (which is `var(--app-font-size)`).
- Line 164 (thinking content): Already uses `text-base` (1rem) — change to inherit or remove to stay consistent.
- Line 190 (reasoning expanded): Same — already `text-base`, remove for consistency.
- The heading sizes in the prose (`text-3xl`, `text-2xl`, `text-xl` for h1/h2/h3) are fine — those are intentional relative sizes for headings.

## Issue 2: Code blocks in light mode still have black background

**Root cause:** Multiple hardcoded dark backgrounds:
- `catppuccinMocha` theme object (lines 9-61) — dark colors
- `SyntaxHighlighter` `customStyle` — `background: '#1e1e2e'`
- Code header bar — `bg-[#000000]/95`
- `index.html` CSS: `.prose pre` has `background-color: #000000 !important`
- `index.html` CSS: `.prose .neon-code-block-container` has `background: #000000 !important`

**Fix:**

### In `ChatMessage.tsx`:
1. Define a `catppuccinLatte` light theme object (Catppuccin Latte palette) alongside the existing `catppuccinMocha`.
2. Add a helper to detect current theme: read `document.documentElement.classList.contains('dark')` at render time (or use a `useEffect` + state).
3. In the `code` renderer:
   - Switch between `catppuccinMocha` / `catppuccinLatte` based on theme
   - Switch `SyntaxHighlighter` `customStyle.background` between `#1e1e2e` and `#eff1f5`
   - Switch the header bar `bg-[#000000]/95` to a light variant using conditional classes

### In `index.html`:
4. Add light mode overrides for `.prose pre` and `.prose .neon-code-block-container`:
   ```css
   html:not(.dark) .prose pre {
     background-color: #eff1f5 !important;
   }
   html:not(.dark) .prose .neon-code-block-container {
     background: #eff1f5 !important;
   }
   ```

## Issue 3: Code blocks without language (directory listings) are not formatted

**Root cause:** In the `code` renderer (`ChatMessage.tsx:216-273`), the logic is:
```
match = /language-(\w+)/.exec(className || '');
inline = !match;
if (!inline && language) { /* styled block */ }
return <code ...>{children}</code>;  // bare inline code
```

Fenced code blocks without a language identifier (e.g., directory trees, plain output) have no `language-*` class, so `match` is null, `inline = true`, and they render as bare `<code>` without any styling — no header bar, no copy button, no background.

**Fix in `ChatMessage.tsx`:**
1. Detect block vs inline by checking if the content contains newlines:
   ```ts
   const isBlock = !inline && language || String(children).replace(/\n$/, '').includes('\n');
   ```
2. For block code **with** language: keep existing SyntaxHighlighter logic (already working).
3. For block code **without** language: render the same styled wrapper (header bar with "text" or "plaintext" label, copy button, dark/light background, monospace font) but use a plain `<pre><code>` instead of SyntaxHighlighter.
4. Only the truly inline code (single-line, no language class) falls through to the bare `<code>` element.

## Files to modify

| File | Changes |
|------|---------|
| `components/ChatMessage.tsx` | Remove `text-xl`, add light theme object, add theme detection, fix code block rendering logic for no-language blocks |
| `index.html` | Add light mode CSS overrides for `.prose pre` and `.prose .neon-code-block-container` |

## Verification
- Toggle dark/light mode in Settings and verify:
  - Code blocks with language have appropriate theme colors in both modes
  - Code blocks without language (fenced blocks, directory trees) render with header bar, copy button, correct background
  - Chat message text font size changes when font size setting is adjusted
