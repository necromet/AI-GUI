# Stitch UI Fixes

## Issue 1: Sidebar hidden before first generation

**Problem:** The 288px chat sidebar in `StitchEditor` is always visible, even when no HTML has been generated. Before the first generation, the sidebar is empty (no messages) and wastes space.

**Fix:** In `components/StitchEditor.tsx`, conditionally render the sidebar only when `generatedHtml` is non-empty (indicating at least one generation has happened). When the sidebar is hidden, render a full-width centered prompt interface.

**Changes:**
- `components/StitchEditor.tsx` (lines 267-430): Wrap the sidebar `<div>` (the 288px chat panel) in a condition: `{generatedHtml && <div className="flex flex-col ...">...</div>}`
- When sidebar is hidden, the preview area (`flex-1`) takes full width automatically
- The "Create your design" + `StitchPromptBar` view (lines 476-498) is already rendered when there's no HTML, so it will naturally center in the full-width area
- Update `max-w-xl` to `max-w-2xl` on the prompt container (line 476) to give the chips more horizontal space when the sidebar is hidden

---

## Issue 2: StitchPromptBar chip selections cut off / arrows invisible

**Problem:** The Type/Style/Color/Layout/Model chip rows in `StitchPromptBar` use `overflow-x-auto scrollbar-hidden` which hides overflowing chips. The scroll arrows are nearly invisible due to `opacity-60` + `var(--text-500)` color.

**Fix:** In `components/StitchPromptBar.tsx`:

1. **Make arrows visible**: Change arrow buttons from `opacity-60` to `opacity-100` and use `var(--neon-color)` for the color instead of `var(--text-500)`. This makes the scroll indicators clearly visible.

2. **Detect overflow to show/hide arrows**: Add overflow detection logic — only show arrows when the chip container actually has scrollable content. Use a `useEffect` + `ResizeObserver` or `scrollWidth > clientWidth` check to determine if each category has overflow.

3. **Increase arrow hit area**: Change arrow padding from `p-0.5` to `p-1.5` for easier clicking.

**Changes:**
- `components/StitchPromptBar.tsx` (lines 106-151): Update arrow button styling and add overflow detection for each chip category row

---

## Issue 3: Header back button not navigating to /experiments/stitch

**Problem:** The header back button navigates to `/experiments/stitch/` (with trailing slash). React Router v7 (`react-router-dom@^7.18.1`) with `<BrowserRouter>` does NOT automatically strip trailing slashes. The route `path="/experiments/stitch"` does NOT match `/experiments/stitch/`, so it falls through to the catch-all `<Route path="*">` which redirects to `/` (home). This is why the back button "doesn't work."

**Root cause:** Trailing slash mismatch in `navigate('/experiments/stitch/')`.

**Fix:** Remove the trailing slash from all stitch navigation calls in `App.tsx`:

1. `App.tsx:881` — Header back button: `navigate('/experiments/stitch/')` → `navigate('/experiments/stitch')`
2. `App.tsx:1204` — `onProjectChange` null handler (route 1): `navigate('/experiments/stitch/', { replace: true })` → `navigate('/experiments/stitch', { replace: true })`
3. `App.tsx:1227` — `onProjectChange` null handler (route 2): `navigate('/experiments/stitch/', { replace: true })` → `navigate('/experiments/stitch', { replace: true })`

---

## Files to modify

| File | Changes |
|------|---------|
| `components/StitchEditor.tsx` | Conditionally render sidebar; widen prompt container |
| `components/StitchPromptBar.tsx` | Fix arrow visibility; add overflow detection |
| `App.tsx` | Remove trailing slashes from 3 `navigate()` calls |
