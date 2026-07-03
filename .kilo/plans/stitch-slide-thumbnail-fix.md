# Plan: Fix Stitch Slide Selector Thumbnails

## Problem

The slide selector in the Stitch sidebar uses `dangerouslySetInnerHTML` to render full HTML documents inside tiny 48×56px button thumbnails at `scale(0.044)`. This renders raw HTML (including `<meta charset>`, `<meta viewport>`, `<title>`, `<style>` with `@import url(...)` etc.) directly in a `<div>` — which:

1. Doesn't execute `<style>` blocks properly in a div context
2. Shows `<meta>` and `<title>` tags as visible text nodes
3. Breaks `@import url(...)` (Google Fonts etc.) since they only work in document contexts
4. Looks like a broken mess of text and unstyled content

The main preview already uses `<iframe srcDoc={...}>` (line 1079) which handles all of this correctly — iframes render HTML documents natively.

## Fix

Replace `dangerouslySetInnerHTML` with `<iframe srcDoc={...}>` in the slide selector.

### File: `components/StitchEditor.tsx`

**Replace lines 648-659** (inside the slide button):

```tsx
// BEFORE (broken):
{b.generatedHtml ? (
  <div className="absolute inset-0 overflow-hidden" style={{ opacity: 0.6 }}>
    <div
      style={{
        width: '1080px',
        height: '1350px',
        transform: 'scale(0.044)',
        transformOrigin: 'top left',
      }}
      dangerouslySetInnerHTML={{ __html: b.generatedHtml }}
    />
  </div>
) : null}
```

**With:**

```tsx
// AFTER (correct):
{b.generatedHtml ? (
  <div className="absolute inset-0 overflow-hidden" style={{ opacity: 0.6 }}>
    <iframe
      srcDoc={b.generatedHtml}
      sandbox=""
      style={{
        width: `${getLayoutDimensions(b.layout).width}px`,
        height: `${getLayoutDimensions(b.layout).height}px`,
        border: '0',
        pointerEvents: 'none',
        transform: `scale(${48 / getLayoutDimensions(b.layout).width})`,
        transformOrigin: 'top left',
      }}
      title={`Slide ${idx + 1}`}
    />
  </div>
) : null}
```

### Key details:
- `sandbox=""` — no scripts, no same-origin (matches security posture; main preview uses `sandbox="allow-scripts"` but thumbnails don't need scripts)
- `pointerEvents: 'none'` — clicks pass through to the button underneath
- Scale calculated dynamically: `48 / layoutWidth` to always fit the 48px-wide button (`w-12`)
- Uses `getLayoutDimensions(b.layout)` per board (already imported) so each board's own layout is respected
- Height is clipped by the parent's `overflow-hidden` on the button

### Why `sandbox=""` instead of `sandbox="allow-scripts"`:
Thumbnails are purely visual — scripts would waste resources on invisible micro-iframes and could cause side effects. The main preview uses `allow-scripts` because users interact with it. Thumbnails just need to render.

## Testing

- Carousel slides with HTML should show a clean scaled preview in the thumbnail
- External fonts (`@import url(...)`) should load (or gracefully fail) without breaking layout
- No `<meta>`/`<title>` text should be visible in the thumbnail
- Clicking a slide button should still navigate to that slide (pointer-events: none on iframe)
- The active slide should still show neon border and glow
- The green status dot should still appear for generated slides
- Non-generated slides should show just the number
