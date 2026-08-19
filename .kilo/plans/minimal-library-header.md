# Minimalistic Library Header Redesign

## Problem

The `/library` header currently uses 3 stacked sections taking ~270px of vertical space:

1. **Hero Header** (~160px) — large icon box, title, subtitle, 3 action buttons, breadcrumb/stats row
2. **Search Bar** (~60px) — full-width standalone input with dedicated Search button
3. **Category Tabs** (~50px) — horizontal scrollable pills with ScrollArea

## Goal

Consolidate into **2 compact rows** (~80px total), saving ~190px of vertical space.

---

## Row 1: Toolbar (title + search + actions)

```
[Package 14px] [Library]  [🔍 Search...]  [Seed] [Folder+] [+ New]
```

- Left: `Package` icon at `size={14}` + "Library" as `text-sm font-semibold` (remove subtitle, remove large icon box)
- Center: Compact search input — `h-8 w-64 text-xs rounded-lg bg-[var(--bg-200)]`, no separate Search button (Enter key already triggers search). Keep the X clear button. Remove the divider + "Search" button.
- Right: Action buttons shrink to `h-7 px-2 text-[11px] rounded-lg`. Remove the gradient neon styling from "New Component" — use a simple filled button with `var(--neon-color)` bg.
- If inside a folder (breadcrumb active), show `ChevronRight + folder name` as a small inline chip between the title and search.
- Remove the radial gradient background overlay entirely.

## Row 2: Category tabs + inline stats

```
[All] [Widgets] [Templates] [Themes] [Python]     12 components · 3 folders
```

- Category tabs: keep as-is but with `py-1` (reduce from `py-1.5`)
- Stats (component count, folder count): moved to the right side of this row as `text-[11px]` muted text, separated by `·`
- Remove the `ScrollArea` wrapper (tabs rarely overflow; if they do, `overflow-x-auto` on the flex container is sufficient)
- Reduce bottom padding from `pb-5` to `pb-3`

## What stays unchanged

- All dialogs (Create/Edit/Delete Component/Folder)
- Content area (grid, empty states, load more button)
- All handlers and state logic
- Breadcrumb navigation functionality (just restyled inline)

## File to modify

- `components/LibraryPanel.tsx` — lines 348–607 (hero header + search bar + category tabs)
