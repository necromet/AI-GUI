# Plan: Fix Canvas Grid Selection Alignment

## Problem

The `gridPos` function in `CanvasGrid.tsx:50-62` converts mouse coordinates to grid positions but doesn't account for the 26px sticky column ruler at the top of the canvas. All rendering code adds `+ 26` to compensate for the ruler:

- Hover cell: `top: gy(hoverPos.row) + 26` (line 244)
- Selection rectangle: `top: gy(selBounds.r1) + 26` (line 265)  
- Components: `top: gy(comp.rs) + 26` (line 306)

But `gridPos` calculates `y = e.clientY - r.top + scrollTop` without subtracting the ruler height. This causes every grid row to be offset by 26px — the hover highlight, drawn selection, and placed components all appear ~1 row lower than where the mouse actually clicked.

## Fix

**File:** `components/canvas/CanvasGrid.tsx`, line 55

Change:
```ts
const y = e.clientY - r.top + (scrollRef.current?.scrollTop || 0);
```

To:
```ts
const y = e.clientY - r.top + (scrollRef.current?.scrollTop || 0) - 26;
```

The `26` matches the ruler height used everywhere else. Extracting it as a constant (`const RULER_H = 26`) would be cleaner, but the value is already hardcoded in 4+ other places in this file, so keeping it consistent with the existing style is fine for now.

## Verification

1. `npm run build` — must pass
2. Hover cell highlight appears directly under the cursor on all rows (including row 1)
3. Draw-to-select creates a selection rectangle aligned with the grid cells
4. Placed components appear in the exact grid cells that were selected
5. Behavior is correct at scrollTop = 0 (ruler not sticky) and scrollTop > 0 (ruler sticky)
