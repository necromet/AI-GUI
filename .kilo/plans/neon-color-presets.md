# Plan: Theme-Aware Neon Color Presets with Auto-Darken

## Problem
The current neon colors are bright/saturated RGB values designed for dark mode. In light mode, these same bright colors look harsh on white backgrounds. The system uses a single accent color (`--neon-rgb`, `--neon-color`).

## Solution
1. Add **curated color presets** (e.g. "Cyber", "Ocean", "Sunset") each defining 2-3 accent colors (primary, secondary, accent)
2. Each preset has **separate dark-mode and light-mode RGB values** — light variants are darker/more muted
3. Auto-darken the existing individual color options for light mode as well
4. Update CSS variables to include secondary/accent colors
5. Redesign the Settings Theme tab to showcase presets

---

## Preset Definitions

| Preset | Primary (Dark → Light) | Secondary (Dark → Light) | Accent (Dark → Light) |
|--------|----------------------|--------------------------|----------------------|
| **Cyber** | `red` (248,113,113 → 180,40,40) | `cyan` (34,211,238 → 10,120,150) | `purple` (192,132,252 → 100,50,170) |
| **Ocean** | `blue` (96,165,250 → 30,80,170) | `teal` (45,212,191 → 15,120,105) | `cyan` (34,211,238 → 10,120,150) |
| **Sunset** | `orange` (251,146,60 → 190,80,15) | `pink` (244,114,182 → 170,40,100) | `yellow` (250,204,21 → 180,130,0) |
| **Forest** | `green` (74,222,128 → 22,120,60) | `lime` (163,230,53 → 100,150,10) | `teal` (45,212,191 → 15,120,105) |
| **Ember** | `rose` (251,113,133 → 180,40,55) | `orange` (251,146,60 → 190,80,15) | `yellow` (250,204,21 → 180,130,0) |

---

## Files to Modify

### 1. `App.tsx` — State & CSS variable logic (lines 106-126)

**Current**: Single `neonColor` string → single `colorMap` → sets `--neon-rgb` and `--neon-color`

**Changes**:
- Add `neonPreset` state (string, default `'cyber'`), persisted to `localStorage('neonPreset')`
- Keep `neonColor` state for individual color mode
- Add `PRESETS` constant with the 5 preset definitions (dark + light RGB values for each of 3 colors)
- Add `INDIVIDUAL_COLORS` constant (existing 12 colors + their auto-darkened light variants)
- Update the `useEffect` that sets CSS vars to:
  - Check current theme
  - If a preset is selected, set `--neon-rgb`, `--neon-secondary-rgb`, `--neon-accent-rgb` (and corresponding `--neon-color`, `--neon-secondary`, `--neon-accent`) using the theme-appropriate variant
  - If an individual color is selected, set primary only (secondary/accent fallback to primary)
- Re-run the effect when `theme` changes (add `theme` to dependency array)

### 2. `components/Settings.tsx` — Theme tab redesign (lines 298-352)

**Changes**:
- Accept new props: `neonPreset`, `onChangeNeonPreset`, `theme`
- Redesign Theme tab into two sections:
  - **"Color Presets"** section: Grid of 5 preset cards, each showing 2-3 color dots in a horizontal row. Active preset highlighted with glow. Shows preset name below.
  - **"Individual Colors"** section (collapsible): Existing 12-color grid, but using darkened light-mode RGB values when `theme === 'light'`
- Each preset card shows a mini preview of all its colors (small circles in a row)

### 3. `index.html` — CSS variables (lines 100-104)

**Changes**:
- Add default values for secondary/accent CSS variables:
  ```css
  --neon-secondary-rgb: 34, 211, 238;
  --neon-secondary: rgb(34, 211, 238);
  --neon-accent-rgb: 192, 132, 252;
  --neon-accent: rgb(192, 132, 252);
  ```

### 4. `components/Sidebar.tsx` — Pass neonColor prop for theme toggle

**No changes needed** — Sidebar doesn't use neon CSS vars directly beyond what's already inherited.

### 5. `components/ChatMessage.tsx` — Use secondary/accent vars where appropriate

**Changes** (optional enhancement):
- Code block headers: use `--neon-secondary` for language label
- Token stats badges: use `--neon-accent` for variety
- Search result highlights: use `--neon-secondary`

### 6. `components/PromptInputBox.tsx` — Use secondary color for send button glow

**Changes** (optional): Add subtle secondary color accent to the send button's glow effect.

---

## Auto-Darken Logic

For individual colors in light mode, darken each by ~30-40% on the RGB scale:

```
light_rgb = dark_rgb.map(c => Math.round(c * 0.65))
```

This produces muted but recognizable variants of each color. The preset light values will be hand-tuned for better aesthetics (the auto-darken is a fallback for individual color mode).

---

## localStorage Keys

| Key | Current | New |
|-----|---------|-----|
| `neonColor` | `'red'` | Keep (individual color selection) |
| `neonPreset` | — | New, default `'cyber'` |

When a preset is selected, `neonPreset` is set and `neonColor` is ignored. When user picks an individual color, `neonPreset` is cleared (set to `''`).

---

## Implementation Order

1. Add preset/color constants + auto-darken utility to `App.tsx`
2. Update CSS variable `useEffect` in `App.tsx` to handle presets + theme awareness
3. Update `index.html` with new CSS variable defaults
4. Redesign `Settings.tsx` Theme tab
5. Wire new props through `App.tsx` → `Settings.tsx`
6. (Optional) Use `--neon-secondary`/`--neon-accent` in `ChatMessage.tsx` and `PromptInputBox.tsx`
7. Test both themes with each preset

---

## Verification
- Switch between dark/light mode with each preset — colors should auto-adjust
- Individual color selection should still work with auto-darkened light variants
- No visual regressions in dark mode (existing bright colors preserved)
- Settings UI clearly shows which preset is active and previews all colors
