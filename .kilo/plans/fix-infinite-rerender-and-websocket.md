# Fix: Infinite Re-render Loop + Vite WebSocket Failure

## Root Cause Analysis

### Issue 1: "Maximum update depth exceeded" (infinite re-render loop)

**Root cause:** `handleSaveProject` in `SkemaPanel.tsx` (line 104) is a plain `async` function — **not wrapped in `useCallback`**. This creates a new function reference on every render.

**The infinite cycle:**

1. `SkemaPanel` renders → passes new `handleSaveProject` ref as `onSave` to `CanvasEditor`
2. `CanvasEditor.saveState` (line 217, deps: `[board, project, onSave]`) gets a new reference
3. `handleComponentPlaced/Removed/Updated` (lines 230–253, deps: `[gridState, saveState]`) all get new references
4. The `useEffect` at line 626 (deps include all three handlers) re-runs → calls `onControlsChange(newObj)` → `setSkemaControls(newObj)` in App.tsx
5. App.tsx re-renders → SkemaPanel re-renders → back to step 1 → **infinite loop**

This is a **pre-existing bug**, not caused by the icon changes.

### Issue 2: Vite WebSocket failure

**Root cause:** `vite.config.ts` has `server.host: 'localhost'` but no explicit `hmr` config. On Windows, `localhost` can resolve to `::1` (IPv6 loopback) while Vite's HMR WebSocket tries `127.0.0.1` (IPv4), causing a mismatch. The browser connects via HTTP (which resolves fine) but the WebSocket upgrade fails.

---

## Changes

### 1. `components/SkemaPanel.tsx` — memoize `handleSaveProject`

Wrap `handleSaveProject` (line 104) in `useCallback` with an empty dependency array (it only uses state setters and `db`):

```tsx
const handleSaveProject = useCallback(async (updatedProject: SkemaProject) => {
  const projectToSave = { ...updatedProject, updatedAt: Date.now() };
  await db.saveSkemaProject(skemaDBToProject(projectToSave));
  setProjects(prev => prev.map(p => p.id === projectToSave.id ? projectToSave : p));
  setActiveProject(prev => prev?.id === projectToSave.id ? projectToSave : prev);
}, []);
```

This breaks the infinite cycle: `saveState` in CanvasEditor will now have a stable `onSave` reference, so `handleComponentPlaced/Removed/Updated` won't recreate unnecessarily, and the `useEffect` won't re-run on every App render.

### 2. `vite.config.ts` — add explicit HMR config

Add `hmr` block inside the existing `server` config to force IPv4 WebSocket:

```ts
server: {
  port: 5173,
  host: 'localhost',
  hmr: {
    host: 'localhost',
    port: 5173,
  },
  proxy: { ... }
}
```

---

## Files to edit

1. **`components/SkemaPanel.tsx`** — line 104: wrap `handleSaveProject` in `useCallback`
2. **`vite.config.ts`** — line 11–29: add `hmr` config inside `server`

## Verification

Run `npm run build` — must pass with no errors.
