# Plan: Adjust Canvas to Fit Between Sidebars

## Problem

The canvas grid (`CanvasGrid.tsx:166`) has a fixed width (e.g. 960px for desktop 1080p) and uses `p-6 flex justify-center items-start` on its scroll container. When the left sidebar (270px) and right agent sidebar (380px) are both open, the available space shrinks. The current `justify-center` + `overflow-auto` combination on the same element can cause centering issues when content overflows — the canvas may be clipped on the left side because the scroll position starts at 0 but centered content extends into negative offset territory.

## Fix

**File:** `components/canvas/CanvasGrid.tsx:166`

Split the scroll container into two layers:

```tsx
// BEFORE (single element handles both scroll + centering):
<div ref={scrollRef} className="flex-1 overflow-auto p-6 flex justify-center items-start relative isolate" style={{ background: 'var(--bg-100)' }}>
  <div ref={canvasRef} ... />
</div>

// AFTER (outer = scroll, inner = centering):
<div ref={scrollRef} className="flex-1 overflow-auto relative isolate" style={{ background: 'var(--bg-100)' }}>
  <div className="p-6 flex justify-center items-start min-h-full">
    <div ref={canvasRef} ... />
  </div>
</div>
```

This ensures:
- **Outer div** owns `overflow-auto` — handles both horizontal and vertical scrollbars
- **Inner div** owns `p-6 flex justify-center items-start min-h-full` — centers the canvas and ensures the inner div is at least as tall as the viewport (so the canvas top is reachable via scroll)
- When the canvas (960px) + padding (48px) exceeds available width, horizontal scrollbar appears and you can scroll to see the full canvas
- Vertical scrolling works normally for the canvas height (1600px)
- No part of the canvas is clipped — it's always scrollable to

## Verification

1. `npm run build` — must pass
2. Visual: open both sidebars, verify canvas is fully scrollable in both directions
3. Visual: close both sidebars, verify canvas is centered as before
