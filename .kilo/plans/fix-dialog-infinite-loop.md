# Fix: Maximum update depth exceeded in Dialog

## Root Cause

The `Dialog` wrapper in `dialog.tsx` (line 9-19) creates `handleOpenChange` as a plain function on every render. This new reference is passed to `DialogPrimitive.Root` as `onOpenChange`. When Radix detects a prop change on its internal `onOpenChange`, it can re-trigger its state reconciliation, which calls `onOpenChange(false)` on the parent, which calls `setViewingFile(null)`, which re-renders, which creates a new `handleOpenChange` — infinite loop.

The error is triggered specifically in the PythonExecutorPanel's fullscreen file viewer because:
1. `open={!!viewingFile}` — controlled open state
2. `onOpenChange={(open) => { if (!open) setViewingFile(null); }}` — inline arrow (new ref every render)
3. Combined with `Dialog` wrapper's own unstable `handleOpenChange` → double instability

The `fullscreen` prop with `inset-0` + `animate-modal-fs-out` may also cause Radix's animation-end detection to re-fire `onOpenChange`.

## Fix

### 1. Memoize `handleOpenChange` in `dialog.tsx`

Wrap with `useCallback` so the function reference is stable across renders:

```tsx
const Dialog = ({ onOpenChange, ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) => {
  const handleOpenChange = React.useCallback((open: boolean) => {
    onOpenChange?.(open);
    if (!open) {
      requestAnimationFrame(() => {
        document.body.style.pointerEvents = '';
      });
    }
  }, [onOpenChange]);
  return <DialogPrimitive.Root onOpenChange={handleOpenChange} {...props} />;
}
```

### 2. Memoize `onOpenChange` in `PythonExecutorPanel.tsx`

Replace the inline arrow with a `useCallback`:

```tsx
const handleViewerClose = useCallback((open: boolean) => {
  if (!open) setViewingFile(null);
}, []);

// Usage:
<Dialog open={!!viewingFile} onOpenChange={handleViewerClose}>
```

### 3. Remove `forwards` from exit animation in `globals.css`

The `forwards` fill-mode on `modal-fs-out` keeps the final animation state (opacity: 0, scale: 0.97) applied even after the animation ends. This can confuse Radix's portal unmount timing. Remove `forwards` from exit animations:

```
--animate-modal-fs-out: modal-fs-out 0.2s ease-in;  /* no forwards */
```

## Files to modify

| File | Change |
|------|--------|
| `components/ui/dialog.tsx` | `useCallback` on `handleOpenChange` |
| `components/PythonExecutorPanel.tsx` | `useCallback` on viewer close handler |
| `src/globals.css` | Remove `forwards` from exit animations (`modal-fs-out`, `slide-out-down`, `expand-out`) |
