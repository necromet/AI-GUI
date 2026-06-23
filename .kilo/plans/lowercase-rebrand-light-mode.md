# Plan: edwardlabs lowercase + TextGlitch theme colors + Light mode fix

## 1. EdwardLabs → edwardlabs (lowercase)

**Files:** `App.tsx`, `components/PasswordScreen.tsx`, `package.json`, `package-lock.json`, `index.html`

Simple string replacement — all occurrences of `EdwardLabs` become `edwardlabs`.

- `PasswordScreen.tsx:130` — `<TextGlitch text="EdwardLabs" />` → `<TextGlitch text="edwardlabs" />`
- `App.tsx:566` — header span text
- `App.tsx:629,673` — placeholder text "Message EdwardLabs..." → "Message edwardlabs..."
- `package.json:10` — description
- `package-lock.json` — name/description (cosmetic)
- `index.html:7` — `<title>` tag (already done for EdwardLabs, just lowercase)

---

## 2. TextGlitch: white text before hover, theme color on hover

**File:** `components/PasswordScreen.tsx`

### Current issues:
- Line 53: `text-neutral-600/20` — base text is nearly invisible (very faint gray)
- Line 87: `backgroundColor: '#FFFF02'` — overlay is hardcoded yellow
- Line 54: gradient `from-neutral-700 to-neutral-500` — hardcoded neutral colors

### Changes to `TextGlitch` component:

**Base text color (before hover):**
- Remove `text-neutral-600/20` from the className
- Add `color: '#ffffff'` to the inline style (white text, works on both dark/light since the password screen bg is dark in dark mode)

Wait — the password screen uses `bg-white dark:bg-[#0a0a0a]`. So in light mode, white text would be invisible on white bg. Need to handle both modes:
- Use `text-gray-900 dark:text-white` in Tailwind classes (dark text in light mode, white in dark mode)

**Gradient reveal on hover:**
- Change gradient from `from-neutral-700 to-neutral-500` to use `--neon-color` CSS variable
- Use inline style: `backgroundImage: 'linear-gradient(to right, var(--neon-color), var(--neon-color))'` — solid neon color reveal instead of neutral gradient

**Overlay on hover:**
- Change `backgroundColor: '#FFFF02'` → `backgroundColor: 'var(--neon-color)'` — uses the user's chosen theme color
- Change `text-black` in overlay span → keep black (works on most neon colors, especially light ones like yellow, lime, cyan)

### Updated TextGlitch render:
```jsx
<h1
  className={`
    text-5xl font-bold leading-none tracking-tight m-0
    text-gray-900 dark:text-white
    border-b border-gray-200 dark:border-neutral-600/20
    flex flex-col items-start justify-center relative
    transition-all duration-500 ease-out
    cursor-pointer overflow-hidden
    ${className}
  `}
  style={{
    backgroundSize: isHovered ? '100%' : '0%',
    backgroundImage: 'linear-gradient(to right, var(--neon-color), var(--neon-color))',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    ...
  }}
>
```

Overlay span:
```jsx
style={{
  ...
  backgroundColor: 'var(--neon-color)',
  ...
}}
```

---

## 3. Light mode font colors

**Problem:** Many components use hardcoded dark-mode colors without `dark:` variants. When switching to light mode, text becomes invisible (light text on light bg) or elements look wrong.

### Files and specific fixes:

**`index.html` (line 109-113):**
- `body { background-color: #050505; color: #ececec; }` — always dark
- Fix: `body { background-color: #ffffff; color: #1a1a1a; }` as default, with `.dark body { ... }` or let Tailwind handle it. Actually since `darkMode: 'class'` is configured, we should use CSS:
  ```css
  body {
    background-color: #ffffff;
    color: #1a1a1a;
  }
  html.dark body {
    background-color: #050505;
    color: #ececec;
  }
  ```

**`components/Sidebar.tsx`:**
- Line 88: `bg-sidebar` = `#000000` always. Fix: `bg-white dark:bg-sidebar` or `bg-gray-50 dark:bg-sidebar`
- Line 99: `text-gray-200` — always light text. Fix: `text-gray-800 dark:text-gray-200`
- Line 99: `hover:bg-white/[0.06]` — invisible on white. Fix: `hover:bg-gray-100 dark:hover:bg-white/[0.06]`
- Line 99: `border-white/[0.06]` — invisible on white. Fix: `border-gray-200 dark:border-white/[0.06]`
- Line 106: `text-gray-500 hover:text-gray-300 hover:bg-white/[0.06]` — fix similarly
- Line 113: `bg-white/[0.04]` divider — fix: `bg-gray-200 dark:bg-white/[0.04]`
- Lines 119, 128, 137, 146: section headers `text-gray-500` — fine for both modes
- Lines 52-55: conversation items — `hover:bg-white/[0.04]` → `hover:bg-gray-100 dark:hover:bg-white/[0.04]`
- Lines 165, 175, 184, 192, 204: footer buttons — `text-gray-400 hover:text-gray-200` → `text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200`
- Line 202: divider — `bg-white/[0.04]` → `bg-gray-200 dark:bg-white/[0.04]`

**`App.tsx`:**
- Line 536: Root div `bg-main dark:bg-main` — `bg-main` is `#050505`, always dark. Fix: `bg-white dark:bg-main`
  Actually this is already `text-gray-900 dark:text-white` so the text is fine, but the bg needs light variant.
- Line 558: `<main>` — already has `bg-white dark:bg-main` ✓
- Line 559: header bar — already has `bg-white/80 dark:bg-main/80` ✓
- Line 584: greeting gradient — `from-white via-gray-200 to-gray-400` — hard to read on white bg in light mode. Fix: `from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-gray-200 dark:to-gray-400`
- Line 592: suggestion cards `border-white/[0.06]` → `border-gray-200 dark:border-white/[0.06]`
- Line 592: `hover:bg-white/[0.03]` → `hover:bg-gray-50 dark:hover:bg-white/[0.03]`
- Line 594: suggestion text `text-gray-500 group-hover:text-gray-300` → `text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300`
- Lines 614-620: Input area — hardcoded `rgba(18, 18, 18, 0.8)` dark bg. Fix: needs light variant background.
- Lines 631, 677: textarea `text-gray-100 placeholder-gray-600` — always light text on dark input. Fix: needs light mode variant.

**`components/ChatMessage.tsx`:**
- Line 102: `text-gray-100` — always light. Fix: `text-gray-900 dark:text-gray-100`
- Line 109, 121: `bg-black` on avatars — could be `bg-white dark:bg-black` or `bg-gray-100 dark:bg-black`
- Line 284: token usage `text-white` — fix: `text-gray-600 dark:text-white`

**`components/Settings.tsx`:**
- Already has proper `dark:` variants on most elements ✓
- Line 96: overlay `background: 'rgba(0,0,0,0.6)'` — dark overlay on light mode is fine (modal backdrop)

---

## Implementation Order

1. Rename EdwardLabs → edwardlabs (string replacements)
2. Update TextGlitch to use white base text + neon theme colors
3. Pass `neonColor` to PasswordScreen (needs new prop + App.tsx wiring)
4. Fix light mode colors across Sidebar, ChatMessage, App.tsx, index.html
5. Build + verify

## Notes

- **TextGlitch + neonColor**: The PasswordScreen currently doesn't receive `neonColor` as a prop. The `--neon-color` CSS variable is set on `document.documentElement` in App.tsx's useEffect. Since PasswordScreen renders *before* the main app (it's the auth gate), the CSS variable will already be set from the previous session's localStorage value, OR it'll be the default red. This means `var(--neon-color)` will work in TextGlitch without needing to pass it as a prop — it reads from the CSS variable directly.

- **Light mode sidebar**: The sidebar uses `bg-sidebar` which is `#000000`. For light mode it should be a light gray/white. Using `bg-gray-50 dark:bg-sidebar` keeps the dark mode look unchanged.

- **Input area in light mode**: The input container has hardcoded dark rgba background. Need a light variant. Can use conditional style based on a `dark` class check, or just use Tailwind classes with `dark:` variants. Since the input uses inline `style` for the background, we'd need to change the approach slightly — perhaps use Tailwind classes instead.
