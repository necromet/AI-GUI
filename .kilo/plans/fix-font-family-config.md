# Plan: Align Tailwind fontFamily config with font switcher

## Problem
The Tailwind `fontFamily.sans` config still uses the old default stack (`'Arial Rounded MT Bold', 'Söhne', ...`), while the actual font switching happens via `--app-font-family` CSS variable. The Tailwind config needs to reflect the 3 Google Fonts (Fredoka, Comfortaa, Google Sans) so Tailwind's base styles and the font switcher are in sync.

## Changes

### 1. `index.html` — Update Tailwind `fontFamily.sans`
**Current** (line 31):
```js
fontFamily: {
  sans: ['Arial Rounded MT Bold', 'Söhne', 'ui-sans-serif', ...],
},
```

**New**: Change `sans` to a stack that starts with the 3 Google Fonts, falling back to system fonts:
```js
fontFamily: {
  sans: ['Fredoka', 'Comfortaa', 'Google Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Ubuntu', 'Cantarell', 'Noto Sans', 'sans-serif'],
},
```

This way Tailwind's base styles will use Fredoka first, Comfortaa second, Google Sans third, then system fallbacks. The CSS variable `--app-font-family` (controlled by the font switcher) will override this on `body`.

### 2. `App.tsx` — Update `FONT_FAMILY_MAP` to match
**Current** (lines 39-44):
```ts
default: "'Arial Rounded MT Bold', 'Söhne', ..."
```

**New**: Make `default` match the Tailwind config:
```ts
default: "'Fredoka', 'Comfortaa', 'Google Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Noto Sans', sans-serif",
```

### 3. `components/Settings.tsx` — Update the "Default" font preview
Update the inline `fontFamily` style for the `default` option in the font picker to match the new default stack (line ~264).

## Files
- `index.html:30-32` — Tailwind fontFamily config
- `App.tsx:39-44` — FONT_FAMILY_MAP
- `components/Settings.tsx:~263-264` — Default font preview style

## Verification
- `npm run build` passes
- Font switcher shows all 4 options (Default, Fredoka, Comfortaa, Google Sans)
- "Default" option uses Fredoka first, then Comfortaa, then Google Sans as fallbacks
