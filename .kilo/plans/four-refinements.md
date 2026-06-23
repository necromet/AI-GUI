# Plan: Four Refinements

## 1. Use mimo-v2.5 (not pro) for chat title generation

**File:** `services/mimoService.ts:172`

Change `model: 'mimo-v2.5-pro'` → `model: 'mimo-v2.5'` in `generateChatTitle`. The non-pro model is faster and cheaper for simple title generation.

---

## 2. Adjustable font size with smaller default

**Files:** `App.tsx`, `Settings.tsx`, `index.html`, `components/ChatMessage.tsx`

Current state: Font sizes are hardcoded (prose `text-lg`, code `1.05rem`, etc).

Approach:
- Add `fontSize` state in `App.tsx` (default: `'sm'`, stored in localStorage as `mimogpt_fontSize`)
- Define size map: `{ xs: 13, sm: 14, base: 16, lg: 18, xl: 20 }` (px values)
- Apply via CSS variable `--chat-font-size` on the root `<div>` wrapper
- In `ChatMessage.tsx`, change hardcoded `text-lg` prose to use `var(--chat-font-size)` via inline style
- In `index.html`, update `.prose` code block font-size from `1.05rem` to inherit
- Add a "Font Size" section in Settings > General with a slider or button group (xs / sm / base / lg / xl)
- Smaller default means `sm` (14px) as default

---

## 3. Dark/light mode switch more accessible

**Files:** `App.tsx`, `components/Sidebar.tsx`

Current state: Theme toggle only in Settings > General > Appearance. User wants a quick switch.

Approach:
- Add a small sun/moon toggle button in the sidebar footer (next to Settings button)
- Reuse existing `theme` + `onToggleTheme` from App.tsx
- Pass `theme` and `onToggleTheme` props to Sidebar
- Keep the existing Settings toggle as well (two access points)

---

## 4. Simplify password screen

**File:** `components/PasswordScreen.tsx`

The user's reference `KeyPrompt` component is minimal:
- Centered card with icon + title
- Single password input
- Error message
- Submit button

Replace the current elaborate PasswordScreen with a clean, minimal version:
- Remove: particles, orbiting dots, glow effects, eye toggle, confirm password field, success animation
- Keep: SHA-256 hashing logic, localStorage/sessionStorage auth flow
- Layout: `flex min-h-screen items-center justify-center` → centered `<Card>` (rounded-2xl, dark bg, border)
- Card content: Flame icon, "MiMoGPT" title, subtitle, password input (type=password, clean style), error text, submit button
- Simple, clean, no excessive decoration

---

## Files to Modify

| File | Changes |
|------|---------|
| `services/mimoService.ts` | Change title model from `mimo-v2.5-pro` to `mimo-v2.5` |
| `App.tsx` | Add `fontSize` state, pass to child components, pass `theme`/`onToggleTheme` to Sidebar |
| `components/PasswordScreen.tsx` | Rewrite to minimal card design |
| `components/Settings.tsx` | Add Font Size section in General tab |
| `components/Sidebar.tsx` | Add dark/light toggle in footer, accept new props |
| `components/ChatMessage.tsx` | Use CSS variable for font size instead of hardcoded `text-lg` |
