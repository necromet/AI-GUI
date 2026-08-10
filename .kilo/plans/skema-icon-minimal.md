# Plan: Make Skema Editor UI More Minimal with Icons

## Goal
Replace text labels with icon-only buttons (with tooltips) across the Skema editor interface to make it cleaner and more minimal.

---

## Changes

### 1. Header bar — `App.tsx` (lines ~1111–1268)

| Current | Change |
|---------|--------|
| `<Code2 /> Canvas` button | Icon-only `<Code2 size={14} />` button with `title="Canvas"`, same active highlight style |
| `<Eye /> Preview` button | Icon-only `<Eye size={14} />` button with `title="Preview"`, same active highlight style |
| "Draw to place component" text + dot | Replace with `<MousePointer2 size={12} />` icon, tooltip "Draw to place component" |
| Cursor position `col X / row Y` | **Keep as-is** (text, useful for precision) |
| `X files · Y components` text | Replace with `<FileCode size={12} /> X · <LayoutGrid size={12} /> Y` (icon + count) |
| `Template` uppercase label | Remove — the Select dropdown is self-explanatory |
| `<RotateCcw /> Regenerate` button | Icon-only `<RotateCcw size={14} />` button with `title="Regenerate"` |
| `Stop` button text | Icon-only `<Square size={14} />` button with `title="Stop generation"` |

**Keep as-is:** project title, layout badge (`16:9`), cursor coordinates, column count badge, panel toggle buttons (already icon-only).

### 2. Agent sidebar header — `SkemaAgentSidebar.tsx` (lines ~213–229)

| Current | Change |
|---------|--------|
| `<Sparkles /> Canvas Agent` title + "Working..."/"Ready to assist" subtitle | Just `<Sparkles size={18} />` icon (no text title/subtitle). Add a small status dot: animated pulse when streaming, static green when idle. Keep close button. |

### 3. Source editor header — `SkemaEditor.tsx` (lines ~634–648)

| Current | Change |
|---------|--------|
| `HTML Source` text label | Replace with `<Code size={12} />` icon |
| `<X /> Cancel` button | Icon-only `<X size={10} />` button, tooltip "Discard edits" |

### 4. Empty state — `SkemaEditor.tsx` (lines ~674–691)

| Current | Change |
|---------|--------|
| "Create your design" heading | Keep (essential onboarding) |
| "Describe what you want in the AI Copilot and it will generate it" | Shorten to "Describe your design in the AI Copilot" |

---

## Files to edit

1. **`App.tsx`** — header bar for skema route (~lines 1111–1268)
2. **`components/skema/SkemaAgentSidebar.tsx`** — `Header` function (~lines 213–229)
3. **`components/SkemaEditor.tsx`** — source editor header (~lines 634–648), empty state (~lines 674–691)

## New icons needed (all from `lucide-react`, already available)

- `MousePointer2` — for "Draw to place" indicator
- `FileCode` — for file count
- `LayoutGrid` — for component count
- `Square` — for stop button (already imported in sidebar, need to add to App.tsx)
- `Code` — already imported in SkemaEditor

## Notes

- All icon-only buttons must have `title` attributes for accessibility/tooltips
- Use consistent sizing: `size={14}` for inline header icons, `size={12}` for small indicators
- Keep `cursor-pointer` and hover states on all interactive elements
