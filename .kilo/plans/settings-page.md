# Dedicated Settings Page

## Overview

Replace the sidebar settings panel with a full-page `/settings` route that provides a fun, interactive experience for customizing font size, font family, AI response behavior, colors, and themes — with live previews.

## Architecture

### New Route: `/settings`

Add a new route in `App.tsx` alongside existing routes. The settings page will be a full-page view (replacing the main content area, same as other routes). It requires chat authentication.

### New Component: `components/SettingsPage.tsx`

A single new component that contains all settings with live interactive previews.

## Page Layout

The page will be organized into **tabbed sections** with a left navigation and right content area:

```
┌──────────────────────────────────────────────────┐
│  ← Back to Chat          Settings                │
├────────────┬─────────────────────────────────────┤
│            │                                     │
│  Theme     │   [Live preview area]               │
│  Colors    │                                     │
│  Fonts     │   Shows sample chat bubbles,        │
│  AI Model  │   text, and UI elements             │
│  Security  │   that update in real-time          │
│            │   as settings change                │
│            │                                     │
│            │   [Setting controls below]           │
│            │                                     │
└────────────┴─────────────────────────────────────┘
```

### Sections

#### 1. Theme
- Dark/Light toggle with animated transition
- Live preview: background color shifts smoothly

#### 2. Colors
- **Color Presets**: Visual cards with multi-dot color swatches (Cyber, Ocean, Sunset, Forest, Ember) — hover to see glow effect, click to apply
- **Individual Colors**: Grid of color circles with glow-on-select animation
- Live preview: neon accent on sample buttons/badges updates instantly

#### 3. Fonts
- **Font Family**: Each font shown in its own typeface as a selectable card, with a sample pangram "The quick brown fox..." rendered in that font
- **Font Size**: Slider or segmented control (XS → XL) with a live sample text that resizes
- Live preview: sample chat message pair (user + AI) rendered at the chosen font/size

#### 4. AI Model
- Default model selector (dropdown)
- Output token limit (number input)
- Shows model description/capabilities

#### 5. Security
- Lock screen button

### Live Preview Panel

A sticky preview area on the right side that shows:
- A mock user message bubble and AI response bubble
- Rendered with the current font family, font size, and neon color
- Updates instantly as the user changes settings (no save needed — CSS variables apply live)
- Includes a mock code block to show monospace rendering

## Files to Change

### 1. `components/SettingsPage.tsx` (NEW)

New component. Props interface matches the settings subset from `SidebarSettingsPanelProps` plus `theme`, `onToggleTheme`, and `onNavigateBack`:

```ts
interface SettingsPageProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  neonColor: string;
  onChangeNeonColor: (color: string) => void;
  neonPreset: string;
  onChangeNeonPreset: (preset: string) => void;
  models: ModelConfig[];
  defaultModelId: string;
  onChangeDefaultModel: (id: string) => void;
  maxOutputTokens: number | undefined;
  onChangeMaxOutputTokens: (value: number | undefined) => void;
  fontSize: string;
  onChangeFontSize: (size: string) => void;
  fontFamily: string;
  onChangeFontFamily: (family: string) => void;
  onNavigateBack: () => void;
}
```

Uses existing UI primitives: `Button`, `Card`, `Input`, `Select`, `Switch`, `ScrollArea`, `Separator`, `Badge` from `components/ui/`.

### 2. `App.tsx`

- Import `SettingsPage`
- Add route: `<Route path="/settings" element={<RequireAuth ...><SettingsPage ... /></RequireAuth>} />`
- The settings page receives all the same state props currently passed to `settingsProps`

### 3. `components/Sidebar.tsx`

- Change the Settings button in the footer to navigate to `/settings` instead of toggling the sidebar panel
- Remove the `sidebarPanel === 'settings'` branch (or keep it as fallback, but primary access is now via route)
- Remove the `SidebarSettingsPanel` import if the sidebar panel is fully replaced

### 4. `components/SidebarSettingsPanel.tsx`

- Can be kept for backward compatibility but won't be rendered from the sidebar anymore
- Or deleted entirely if we fully migrate to the page

## Implementation Notes

- All settings changes continue to apply via CSS custom properties (`--neon-color`, `--app-font-size`, `--app-font-family`) — the live preview works because these variables update instantly
- The settings page uses the same `NEON_PRESETS`, `INDIVIDUAL_COLORS`, `FONT_SIZE_MAP`, `FONT_FAMILY_MAP` constants already defined
- Navigation back uses `useNavigate()` to go to the previous route or `/chat`
- The page respects the current theme and applies dark/light variants
- Uses Tailwind CSS v4 classes consistent with the rest of the codebase
- No new dependencies needed

## Verification

- `npm run build` to ensure no type errors
- Manual test: navigate to `/settings` from sidebar, verify all settings apply live, navigate back to chat and confirm settings persisted
