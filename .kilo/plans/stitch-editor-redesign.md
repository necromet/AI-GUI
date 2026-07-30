# Stitch Editor Redesign — Seamless UX, Fullscreen, Tool Call Visibility

## Current Problems

1. **Jarring layout shift**: Sidebar is hidden on fresh projects, then pops in after first generation
2. **Dual input locations**: Centered `StitchPromptBar` disappears, replaced by narrow sidebar input
3. **No fullscreen/immersive preview**: Preview is always constrained and scaled
4. **Tool calls are invisible**: Small chips with just a name — no inputs, outputs, or progress
5. **Header controls are disconnected**: 6-8 buttons pushed up via callback, bidirectional data flow
6. **Source editor has no live preview**: Must toggle between source and preview
7. **Cramped carousel slide selector**: 48x56px thumbnails with hover-delete

## Design Vision

A **single unified layout** where the preview is the hero, the chat sidebar is always visible (collapsible), and the AI agent's work is transparent with expandable tool call details.

---

## New Layout

```
+---------------------------------------------------------------+
|  HEADER: Back | Title | [Layout] |         [controls...]      |
+--------+------------------------------------------+-----------+
| SIDEBAR|          PREVIEW (hero)                  |  LIBRARY  |
| (chat) |                                          |  (toggle) |
|        |     iframe / source / fullscreen         |           |
| always |                                          |           |
| visible|                                          |           |
|        |                                          |           |
|--------|                                          |           |
| INPUT  |                                          |           |
+--------+------------------------------------------+-----------+
```

Key changes:
- Sidebar **always visible** (collapsible to icon rail), even on fresh projects
- Preview area is the **hero** — takes remaining space
- Fullscreen mode hides sidebar + header, preview fills viewport
- Tool calls render as **expandable cards** inline in the chat stream

---

## Changes by File

### 1. `components/StitchEditor.tsx` — Major Rewrite

#### A. Sidebar always visible

**Current**: `showSidebar = !!displayHtml || chatMessages.length > 0 || isGenerating` (line 644)
**New**: Sidebar is always rendered. When collapsed, show a 48px icon rail with:
- Chat bubble icon (expand)
- Plus icon (new prompt)
- Slide thumbnails (carousel)

```
showSidebar → always true
sidebarCollapsed → toggle state (default: false on fresh projects, true)
```

Remove the `StitchPromptBar` from the preview empty state entirely. The sidebar input is the **single input location**.

#### B. Fullscreen mode

Add state: `const [isFullscreen, setIsFullscreen] = useState(false)`

When fullscreen:
- Header hides
- Sidebar hides
- Library hides
- Preview fills 100vw × 100vh
- Floating close button (top-right corner, semi-transparent)
- Floating tool call overlay (bottom, collapsible)

Wire into `StitchControls` interface:
```ts
isFullscreen: boolean;
onFullscreenToggle: () => void;
```

Add fullscreen button to header (next to Source/Preview toggle):
```tsx
<Button onClick={() => setIsFullscreen(true)}>
  <Maximize2 size={12} /> Fullscreen
</Button>
```

Keyboard shortcut: `Escape` exits fullscreen.

#### C. Tool call cards (replacing chips)

Replace the current inline chips (lines 940-957) with **expandable tool call cards**:

```tsx
{activeToolCalls.map((tc, i) => (
  <ToolCallCard key={i} toolCall={tc} />
))}
```

**`ToolCallCard` component** (inline in StitchEditor or extracted):
```
┌─────────────────────────────────────┐
│ ⚡ generate_html        ✓ 2.3s     │  ← collapsed header
├─────────────────────────────────────┤
│ Input:                               │
│   prompt: "Modern SaaS landing..."   │  ← expandable
│ Output:                              │
│   <!DOCTYPE html>... (12,847 chars)  │  ← truncated, click to expand
│   [Copy] [View Full]                 │
└─────────────────────────────────────┘
```

States:
- **Pending**: Spinner + tool name, no expand
- **Running**: Spinner + tool name + elapsed time, expandable to show input
- **Complete**: Check icon + tool name + duration, expandable to show input + output
- **Error**: Red X + error message, always expanded

The output for `generate_html`/`edit_html` shows a **mini preview thumbnail** (scaled iframe, same technique as slide selector).

#### D. Streaming preview in main area

**Current**: During generation, the preview area shows a `MathCurveLoader` spinner.
**New**: During generation, the preview area shows the **streaming HTML** in real-time (the iframe updates as HTML streams in).

```tsx
{isGenerating && streamingHtml ? (
  <iframe srcDoc={streamingHtml} ... />  // live preview
) : isGenerating ? (
  <MathCurveLoader />  // waiting for first HTML
) : displayHtml ? (
  <iframe srcDoc={displayHtml} ... />  // final preview
) : (
  <EmptyState />
)}
```

This gives instant visual feedback as the AI generates.

#### E. Consolidate header controls into editor

Move the stitch-specific header buttons from `App.tsx` INTO `StitchEditor.tsx`. The editor renders its own toolbar **above the preview area** (not in the app header). App.tsx only provides: back button + title.

New structure:
```
┌──────────────────────────────────────────────┐
│  ← Back  |  Title  |  Layout badge           │  ← App header (minimal)
├──────────────────────────────────────────────┤
│  [Source] [Fullscreen] | [Library] [Export]  │  ← Editor toolbar
├────────┬─────────────────────────────┬───────┤
│ Sidebar│     Preview                 │Library│
```

This eliminates the `onControlsChange` callback pattern entirely. The editor manages its own controls.

#### F. Version history

Add `htmlHistory: string[]` state. Push to it before each generation:
```ts
if (generatedHtml) {
  setHtmlHistory(prev => [...prev, generatedHtml]);
}
```

Show a "Versions" button in the toolbar that opens a popover with:
- List of previous HTML versions (timestamped)
- Click to preview in a modal
- "Restore" button to revert

### 2. `App.tsx` — Simplify Header

**Remove** the entire stitch controls block (lines 1106-1209). Replace with minimal header:

```tsx
{location.pathname.startsWith('/experiments/stitch') && stitchActiveProject ? (
  <>
    <div className="flex items-center gap-2 min-w-0">
      <Button variant="ghost" size="icon" onClick={handleBack}>
        <ArrowLeft size={18} />
      </Button>
      <span className="text-sm font-semibold truncate">{stitchActiveProject.title}</span>
    </div>
    <div className="ml-auto">{/* Editor handles its own controls */}</div>
  </>
) : (
  // normal header
)}
```

**Remove** `stitchControls` state and `onControlsChange` callback entirely. The editor is self-contained.

### 3. `components/ToolCallCard.tsx` — New Component

A standalone component for rendering tool call details in the stitch chat.

**Props**:
```ts
interface ToolCallCardProps {
  name: string;
  input: Record<string, any>;
  output?: string;
  error?: string;
  isRunning: boolean;
  startTime?: number;
}
```

**Features**:
- Collapsed by default (shows name + status icon + duration)
- Expandable to show input JSON and output
- For `generate_html`/`edit_html` outputs: mini iframe preview thumbnail
- For `generate_spec`/`edit_spec` outputs: rendered JSON with syntax highlighting
- Copy input/output buttons
- Duration timer (counts up while running, finalizes on complete)

### 4. `components/StitchFullscreen.tsx` — New Component

Fullscreen overlay for immersive preview.

**Props**:
```ts
interface StitchFullscreenProps {
  html: string;
  layout: StitchLayout;
  theme: 'dark' | 'light';
  onClose: () => void;
  isGenerating: boolean;
  streamingHtml: string;
  activeToolCalls: ToolResult[];
}
```

**Features**:
- Fixed position, 100vw × 100vh, z-index above everything
- Preview iframe fills the screen (scaled to fit)
- Floating close button (top-right, appears on hover)
- Floating tool call strip (bottom, shows active tool calls as compact pills)
- `Escape` key to close
- During generation: live streaming preview + tool call strip

### 5. `components/StitchEditor.tsx` — Sidebar Chat Redesign

#### A. Chat message rendering improvements

- **User messages**: Keep as-is (right-aligned, neon tint)
- **Assistant messages**: 
  - Show thinking/reasoning inline (collapsible, default collapsed)
  - Show tool calls as `ToolCallCard` components
  - Show response text below tool calls
  - Show "View in preview" button if the message generated HTML

#### B. Input area improvements

- Wider input (full sidebar width, not constrained)
- Model selector integrated into input (dropdown on the left)
- "Send" button with neon highlight
- Context chips above input (selected library components, palette)
- Drag-and-drop image upload

#### C. Slide selector improvements (carousel)

- Slightly larger thumbnails (56x68px)
- Slide number overlay on each thumbnail
- Drag-to-reorder slides
- "Add slide" button with neon outline
- Delete via right-click context menu (not hover button)

### 6. Service Changes — `services/agentService.ts`

Add `toolProgress` event handling. Currently `toolProgressText` is set but never rendered (line 383). Wire it into the tool call cards:

```ts
if (chunk.toolProgress) {
  // Update the matching tool call's progress
  const idx = toolCalls.findIndex(r => r.name === chunk.toolProgress!.name && !r.output);
  if (idx >= 0) {
    toolCalls[idx] = { ...toolCalls[idx], progress: chunk.toolProgress.chunk };
  }
}
```

---

## Implementation Order

### Phase 1: Sidebar Always Visible + Single Input
1. Remove `showSidebar` conditional — always render sidebar
2. Remove `StitchPromptBar` from preview empty state
3. Show simple empty state in preview when no HTML
4. Sidebar input is the only input

### Phase 2: Tool Call Cards
1. Create `ToolCallCard` component
2. Replace chips in generating bubble with `ToolCallCard`
3. Wire `toolProgress` events to cards
4. Add mini preview thumbnails for HTML-generating tools

### Phase 3: Fullscreen Mode
1. Create `StitchFullscreen` component
2. Add fullscreen state + toggle to StitchEditor
3. Add fullscreen button to editor toolbar
4. Wire Escape key to exit

### Phase 4: Consolidate Header
1. Move header controls into StitchEditor toolbar
2. Simplify App.tsx stitch header to back + title only
3. Remove `stitchControls` state and `onControlsChange`

### Phase 5: Streaming Preview
1. Show `streamingHtml` in preview iframe during generation
2. Smooth transition from streaming to final preview

### Phase 6: Polish
1. Version history state + popover
2. Sidebar collapse/expand animation
3. Slide selector improvements
4. Keyboard shortcuts (Escape fullscreen, Ctrl+Enter to send)

---

## Files Summary

| File | Action | Scope |
|------|--------|-------|
| `components/StitchEditor.tsx` | Major rewrite | Sidebar always visible, fullscreen, tool cards, consolidated controls |
| `App.tsx` | Simplify | Remove stitch controls from header |
| `components/ToolCallCard.tsx` | New | Expandable tool call detail component |
| `components/StitchFullscreen.tsx` | New | Fullscreen immersive preview overlay |
| `services/agentService.ts` | Minor | Wire toolProgress events |
