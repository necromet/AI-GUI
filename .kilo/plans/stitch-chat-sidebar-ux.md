# Plan: Stitch Editor — Chat Sidebar UX + Merged Header + HTML Viewer Fix

## Problem

The current Stitch editor has UX issues:
1. **Chip categories (Type/Style/Color/Layout) and model selection persist after initial generation** — they should only appear during the first prompt (initiation).
2. **The sidebar shows a chip-based prompt bar + flat history list** — it should become a chat-like interface (user/assistant message pairs) after the first generation.
3. **The HTML preview doesn't fit the viewport** — it uses a fixed `aspectRatio` CSS approach that clips content. Needs to scale to fit width while remaining vertically scrollable.
4. **Two separate header bars exist** — the App.tsx top bar (back + title + export) and the StitchEditor preview toolbar (source/preview + regenerate + stop + HTML + copy). These should be merged into one.

## Files Changed

| File | Change |
|------|--------|
| `components/StitchEditor.tsx` | Major rewrite of sidebar and preview area. Remove preview toolbar. Replace sidebar with chat UX. |
| `components/StitchPromptBar.tsx` | Add `compact` prop to hide chip categories and model selection (used for post-generation sidebar). |
| `App.tsx` | Expand `StitchControls` interface to include all toolbar actions. Merge preview toolbar buttons into top bar. |

## Implementation

### Step 1: Expand `StitchControls` interface (`StitchEditor.tsx`)

The App.tsx top bar currently receives `StitchControls` with only `onExport`, `isGenerating`, `hasHtml`, `projectTitle`. It needs all the toolbar actions so the top bar can render them.

```ts
export interface StitchControls {
  onExport: () => void;
  isGenerating: boolean;
  hasHtml: boolean;
  projectTitle: string;
  viewMode: 'preview' | 'source';
  onViewModeToggle: () => void;
  onRegenerate: () => void;
  onStopGeneration: () => void;
  onCopy: () => void;
  copied: boolean;
  hasLastPrompt: boolean;
}
```

Update the `React.useEffect` that pushes controls to `onControlsChange` to include all new fields.

### Step 2: Merge header in `App.tsx`

Replace the current Stitch top bar section with a merged version containing:
- **Left**: Back button (`ArrowLeft`) + project title
- **Center/Right**: View mode toggle (Source/Preview), Regenerate, Stop, HTML download, Copy, Export

Remove the separate "Export" button that was previously the only action — now all actions live in one bar.

```tsx
{location.pathname.startsWith('/experiments/stitch') && stitchControls ? (
  <>
    <button onClick={backHandler} ...><ArrowLeft size={18} /></button>
    <div className="flex items-center gap-2">
      <Layers size={16} style={{ color: 'var(--neon-color)' }} />
      <span className="text-sm font-semibold">{stitchControls.projectTitle}</span>
    </div>
    <div className="ml-auto flex items-center gap-2">
      {/* Source/Preview toggle */}
      {/* Regenerate (when hasLastPrompt && !isGenerating) */}
      {/* Stop (when isGenerating) */}
      {/* HTML download (when hasHtml && !isGenerating) */}
      {/* Copy (when hasHtml && !isGenerating) */}
      {/* Export (when hasHtml && !isGenerating) */}
    </div>
  </>
) : ( /* normal top bar */ )}
```

### Step 3: Remove preview toolbar from `StitchEditor.tsx`

Delete the entire `<div className="flex items-center gap-2 px-4 py-2">` block (lines ~449-520) that currently contains Source/Preview, Regenerate, Stop, HTML, Copy buttons. These are now in the App.tsx top bar via `StitchControls`.

### Step 4: Convert sidebar to chat UX (`StitchEditor.tsx`)

Replace the current sidebar (header + StitchPromptBar OR history list) with a chat-like interface.

**Sidebar structure (post-generation):**
```
┌─────────────────────────┐
│ Project Title    (info) │  ← slim header
├─────────────────────────┤
│                         │
│  [User message: prompt] │
│                         │
│  [AI message:           │
│   "Generated HTML"      │
│   mini preview/link]    │
│                         │
│  [User message: ...]    │
│  [AI message: ...]      │
│                         │
├─────────────────────────┤
│ [Type a prompt...] [➤]  │  ← bottom input (sticky)
└─────────────────────────┘
```

**Message rendering:**
- User messages: show the prompt text, styled like chat user messages (right-aligned or full-width with accent background)
- AI messages: show "Generated HTML" text with a small timestamp. Clicking loads that generation in the viewer. The currently active generation is highlighted.
- Messages are loaded from the DB conversation via `db.getMessagesByConversation(conversationId)`.
- Filter to only show `stitch_generation` envelope messages as pairs.

**Bottom input:**
- Simple text input + send button (reuse `PromptInputBox` or a simpler custom input)
- On submit, calls `handleGenerate(prompt)` 
- No chip categories, no model selection (those were initiation-only)

**Chat message state:**
- Add a `chatMessages` state array: `Array<{ role: 'user' | 'assistant'; content: string; html?: string; timestamp: number }>`
- Populate from DB on mount / when `conversationId` changes
- Append new messages after each generation
- Auto-scroll to bottom on new messages

### Step 5: Add `compact` mode to `StitchPromptBar.tsx`

Add a `compact?: boolean` prop. When `true`:
- Hide all chip categories (Type, Style, Color, Layout)
- Hide model selection chips
- Show only the text input + send button

This is used in the sidebar post-generation for a cleaner look (though the plan in Step 4 uses a custom inline input instead — `compact` mode is an alternative if we want to reuse StitchPromptBar).

**Decision**: Since the sidebar post-generation just needs a simple input, we'll use a custom inline input in the sidebar rather than adding `compact` to StitchPromptBar. This keeps StitchPromptBar focused on the initiation experience.

### Step 6: Fix HTML viewer — fit to viewport with vertical scroll

Replace the current iframe container:

**Current (broken):**
```tsx
<div className="w-full h-full max-w-full overflow-hidden rounded-xl"
  style={{ aspectRatio: `${aspectRatio}`, maxHeight: '100%', maxWidth: `min(100%, ${100 * aspectRatio}vh)` }}>
  <iframe className="w-full h-full border-0" srcDoc={displayHtml} />
</div>
```

**New approach — CSS transform scale to fit width, natural height for scroll:**
```tsx
<div className="flex-1 overflow-auto flex justify-center p-4" style={{ backgroundColor: 'var(--bg-100)' }}>
  <div style={{
    width: `${dims.width}px`,
    minHeight: '100%',
    transform: `scale(var(--stitch-zoom, 1))`,
    transformOrigin: 'top center',
  }}>
    <iframe
      style={{ width: `${dims.width}px`, height: `${dims.height}px`, border: '0', backgroundColor: '#fff' }}
      sandbox="allow-scripts"
      srcDoc={displayHtml}
    />
  </div>
</div>
```

Add a `ResizeObserver` or use `useRef` + `useEffect` to measure the container width and compute a CSS variable `--stitch-zoom`:
```ts
const containerRef = useRef<HTMLDivElement>(null);
const [zoom, setZoom] = useState(1);

useEffect(() => {
  if (!containerRef.current) return;
  const ro = new ResizeObserver(entries => {
    const containerWidth = entries[0].contentRect.width - 32; // minus padding
    const z = Math.min(1, containerWidth / dims.width);
    setZoom(z);
  });
  ro.observe(containerRef.current);
  return () => ro.disconnect();
}, [dims.width]);
```

This makes the HTML preview scale down to fit the available width (zooming out for 1920px layouts on smaller screens) while the outer container remains vertically scrollable for tall content (especially 9:16 layouts).

### Step 7: Handle source view in the content area

Since the preview toolbar is removed, the source/preview toggle is now in the App.tsx top bar via `StitchControls.onViewModeToggle`. The content area in StitchEditor just needs to check `viewMode` state (which it already does).

No change needed for the source `<pre>` block — it already renders when `viewMode === 'source'`.

## Edge Cases

- **Empty conversation (no generations yet)**: Sidebar shows just the input. Chat messages area is empty.
- **Very long prompts**: Messages truncate with ellipsis or wrap naturally.
- **9:16 portrait layout**: The zoom will be more aggressive (width: 1080px scaled to fit). The outer container scrolls vertically for the full 1920px height.
- **Rapid generations**: Messages append sequentially. Auto-scroll keeps latest in view.
- **Loading history from DB**: On mount, load all `stitch_generation` messages from the conversation and render as chat pairs.
