# Fix: Monaco Editor Height Collapse (5px)

## Root Cause

The editor area container (`flex-1 min-h-0 relative`) is a flex **child** but NOT a flex **container**. The `CodeEditor` component renders a wrapper with `flex-1`, which is only effective inside a flex container. Since the editor area lacks `flex`, the `flex-1` on the CodeEditor wrapper is ignored, giving it no explicit height. Monaco's internal `height: 100%` then resolves against this near-zero height, producing the5px result.

## Fix (2 changes)

### 1. `components/DatabasePanel.tsx` — line ~736

Change the editor area div from:
```tsx
<div className="flex-1 min-h-0 relative">
```
to:
```tsx
<div className="flex-1 min-h-0 relative flex flex-col">
```

This makes it a flex column container, so the CodeEditor's `flex-1` resolves correctly.

### 2. `components/ui/code-editor-sheet.tsx` — `handleMount` callback

Add an explicit `editor.layout()` call after mount as a safety net for flex layout timing:

```tsx
requestAnimationFrame(() => editor.layout());
```

This handles edge cases where Monaco measures before the browser completes flex layout resolution.
