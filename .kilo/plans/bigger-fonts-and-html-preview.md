# Plan: Bigger Fonts + HTML Code Block Live Preview

## 1. Increase Font Sizes (Moderate Bump)

### 1a. Update base font size in `index.html`
- Change `--app-font-size: 15px` → `--app-font-size: 17px` (line 99)

### 1b. Update `FONT_SIZE_MAP` in `App.tsx` (line 44)
- `{ xs: 14, sm: 15, base: 16, lg: 18, xl: 20 }` → `{ xs: 16, sm: 17, base: 18, lg: 20, xl: 22 }`

### 1c. Change default font size in `App.tsx` useState (line 93)
- Default from `'sm'` → `'base'` so the app starts at 18px

### 1d. Bump hardcoded small font sizes across components

All components using tiny pixel-based or tailwind text-xs/text-[Npx] classes need bumping:

| Old Class | New Class | Files |
|-----------|-----------|-------|
| `text-[10px]` | `text-xs` | ChatMessage.tsx, Sidebar.tsx, ModelSelect.tsx, App.tsx, StitchEditor.tsx |
| `text-[11px]` | `text-xs` | ChatMessage.tsx, Sidebar.tsx, App.tsx, Notification.tsx |
| `text-[13px]` | `text-sm` | ChatMessage.tsx |
| `text-xs` (where used for labels/badges) | `text-sm` | Multiple files — see detailed list below |

**Files to update (font sizes):**

#### `components/ChatMessage.tsx`
- Line 217: `text-[13px]` → `text-sm` (sender name)
- Line 266: `text-[10px]` → `text-xs` (attachment filename)
- Line 423: `text-xs` → `text-sm` (code language label)
- Line 428: `text-xs` → `text-sm` (copy button)
- Line 472: `text-xs` → `text-sm` (text code label)
- Line 477: `text-xs` → `text-sm` (copy button)
- Line 529: `text-xs` → `text-sm` (table th uppercase)
- Line 626: `text-xs` → `text-sm` (sources found badge)
- Line 643: `text-[8px]` → `text-[10px]` (overflow count badge)
- Line 687: `text-[11px]` → `text-xs` (citation icon letter)
- Line 702: `text-[11px]` → `text-xs` (site name)
- Line 707: `text-[11px]` → `text-xs` (middle dot)
- Line 708: `text-[11px]` → `text-xs` (publish time)
- Line 715: `text-xs` → `text-sm` (annotation summary)
- Line 731: `text-[11px]` → `text-xs` (token usage)

#### `components/Sidebar.tsx`
- Line 105: `text-[10px]` → `text-xs` (section labels)
- Line 113: `text-[10px]` → `text-xs` (mode badge)
- Line 318: `text-[11px]` → `text-xs` (keyboard shortcut hint)
- Line 434: `text-[11px]` → `text-xs` (model name under user)

#### `components/ModelSelect.tsx`
- Line 74: `text-xs` → `text-sm` (model name)
- Line 80: `text-[8px]` → `text-[10px]` (CUSTOM badge)

#### `components/App.tsx`
- Line 893: `text-[10px]` → `text-xs` (stitch layout badge)
- Line 907: `text-[11px]` → `text-xs` (stitch toolbar buttons)
- Line 921: `text-[11px]` → `text-xs` (stitch regenerate button)
- Line 935: `text-[11px]` → `text-xs` (stitch stop button)
- Line 949: `text-[11px]` → `text-xs` (stitch HTML export button)
- Line 961: `text-[11px]` → `text-xs` (stitch copy button)
- Line 1044: `text-sm` → `text-base` (suggestion card text)
- Line 1105: `text-sm` → `text-base` (suggestion card text duplicate)
- Line 1258: `text-[11px]` → `text-xs` (MiMo disclaimer)

#### `components/ModeSelector.tsx`
- Line 77: `text-xs` → `text-sm` (subtitle in password modal)
- Line 205: `text-sm` → `text-base` (tagline under title)
- Line 252: `text-xs` → `text-sm` (card description)

#### `components/Notification.tsx`
- Line 64: `text-sm` → `text-base` (notification message)

#### `components/PromptInputBox.tsx`
- Line 37: `text-sm` → `text-base` (tooltip text)
- Line 588: `text-xs` → `text-sm` (Search toggle label)
- Line 625: `text-xs` → `text-sm` (Think toggle label)

#### `components/Settings.tsx`
- Review and bump any `text-[10px]`, `text-[11px]`, `text-xs` occurrences

---

## 2. HTML Code Block Toggle Source/Preview

### 2a. Add `isStreaming` prop to `ChatMessage`

In `ChatMessage.tsx`:
- Add `isStreaming?: boolean` to `ChatMessageProps` interface (line 121)
- This tells the component whether this message is currently being streamed

In `App.tsx`:
- Pass `isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id}` to the last ChatMessage
- This way only the actively streaming message gets the flag

### 2b. Add HTML preview state + toggle to ChatMessage

Add to the ChatMessage component state:
```tsx
const [htmlPreviewMap, setHtmlPreviewMap] = useState<Record<string, boolean>>({});
```

This tracks per-code-block whether to show preview (true) or source (false).

### 2c. Modify the `code` component in ReactMarkdown components

When `language === 'html'` and the code block is a block-level block:

1. Extract the HTML string from the code block children
2. Render a toggle bar with "Preview" / "Source" buttons (like Stitch editor's Code/Eye toggle)
3. In preview mode: render an `<iframe srcDoc={htmlString} sandbox="allow-scripts" />`
4. In source mode: render the existing syntax-highlighted code view
5. Default to preview mode after streaming completes (`!isStreaming`)
6. During streaming: default to source mode so users see HTML being generated in real-time, but allow toggling to preview at any time

### 2d. Implementation detail for the `code` component

The existing `code` component in ChatMessage.tsx (line 404) handles block code with language detection. Modify the `isBlock && language` branch (line 419):

```tsx
if (isBlock && language === 'html') {
  const showPreview = htmlPreviewMap[codeString.hashCode()] ?? !isStreaming;
  return (
    <div className="my-4 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-300)' }}>
      {/* Toggle bar */}
      <div className={`flex items-center justify-between px-4 py-2 ${headerBg} backdrop-blur-sm`}>
        <span className="text-sm font-mono uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>html</span>
        <div className="flex items-center gap-2">
          <button onClick={() => togglePreview(key)} className={...}>
            {showPreview ? <Code size={12} /> : <Eye size={12} />}
            {showPreview ? 'Source' : 'Preview'}
          </button>
          <button onClick={() => handleCopyCode(codeString, 'html')} className={...}>
            {isCopied ? <Check .../> : <Copy .../>}
            {isCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {/* Content area */}
      {showPreview ? (
        <iframe
          srcDoc={codeString}
          sandbox="allow-scripts"
          className="w-full border-0"
          style={{ minHeight: '300px', backgroundColor: '#fff' }}
          title="HTML Preview"
        />
      ) : (
        <SyntaxHighlighter ...>{codeString}</SyntaxHighlighter>
      )}
    </div>
  );
}
```

### 2e. Use a stable key for the preview map

Since `codeString` can change during streaming, use an index-based key or the block's position in the message. A simple approach: use a counter ref that increments for each code block rendered, or use the language+index as a key.

Better approach: use a `Map<number, boolean>` where the number is the block index (incrementing counter). Reset the counter on each render. This is simpler and stable.

### 2f. Real-time preview during streaming

During streaming (`isStreaming` is true):
- Default to source view so users see the HTML being typed out
- Users can click "Preview" to see the partially rendered HTML at any time
- The iframe will auto-update as `srcDoc` changes with each chunk

After streaming completes (`isStreaming` flips to false):
- Auto-switch to preview mode so users immediately see the rendered HTML
- Users can click "Source" to see the code

To implement the auto-switch: when `isStreaming` changes from true to false, set all html blocks to preview mode.

---

## Files Changed (Summary)

| File | Changes |
|------|---------|
| `index.html` | `--app-font-size: 15px` → `17px` |
| `App.tsx` | FONT_SIZE_MAP values, default fontSize, pass `isStreaming` to ChatMessage, bump hardcoded font sizes |
| `components/ChatMessage.tsx` | Add `isStreaming` prop, HTML preview toggle in code component, bump font sizes |
| `components/Sidebar.tsx` | Bump hardcoded font sizes |
| `components/ModelSelect.tsx` | Bump hardcoded font sizes |
| `components/ModeSelector.tsx` | Bump hardcoded font sizes |
| `components/Notification.tsx` | Bump hardcoded font sizes |
| `components/PromptInputBox.tsx` | Bump hardcoded font sizes |
| `components/Settings.tsx` | Bump hardcoded font sizes (if any) |

## Verification

1. Run `npm run dev` and check that all text appears noticeably larger
2. Send a prompt asking the AI to generate an HTML page (e.g., "Create a landing page in HTML")
3. Verify that during streaming, the user sees the HTML code being generated (source view)
4. Verify that after streaming completes, the view auto-switches to preview (rendered iframe)
5. Verify the Source/Preview toggle works at any time
6. Check badges, buttons, sidebar text, model selector, notifications all appear larger
