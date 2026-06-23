# Plan: EdwardLabs Rebrand + Hardcoded Password + Global Font Size

## 1. Hardcoded password (`thelordismyshepherd`)

**File:** `components/PasswordScreen.tsx`

Replace the SHA-256 hashing flow with a simple string comparison:
- Remove `hashPassword` function entirely
- Remove localStorage hash storage logic (no setup mode)
- `handleSubmit`: compare `password === 'thelordismyshepherd'` → on match, set `sessionStorage.setItem('edwardlabs_session', 'true')` and call `onSuccess()`; on mismatch, show "Incorrect password"
- Remove the `isSetup` branching, `confirmPassword` field, eye toggle, success animation state
- Keep: `sessionStorage` for session persistence (so page refresh doesn't re-prompt)

**File:** `App.tsx` (auth gate, line 25-30)

Update the `isAuthenticated` initializer:
- Change `localStorage.getItem('mimogpt_auth_hash')` → always treat as "password exists" (since it's hardcoded, no setup flow). The check becomes: `return !!sessionStorage.getItem('edwardlabs_session')`
- Remove the `hasPassword` / `hasSession` dual logic — just check session storage.

**File:** `components/Settings.tsx` (reset password, line 86-90)

Update `resetPassword`:
- Remove `localStorage.removeItem('mimogpt_auth_hash')` (no hash stored anymore)
- Keep `sessionStorage.removeItem('edwardlabs_session')` + reload

---

## 2. Password screen: TextGlitch header with "EdwardLabs"

**File:** `components/PasswordScreen.tsx` (full rewrite)

Add an inline `TextGlitch` component (no GSAP — pure CSS + JS scramble effect):
- On mount: CSS fade-in animation (no GSAP needed)
- On hover: scramble effect — random letters resolving to final text over ~300ms using `setInterval`
- Visual style from the reference: `text-[10vw]` is too large for a login card. Scale down to `text-4xl` or `text-5xl`. Use `font-bold tracking-tight`. The "glitch" overlay uses `clipPath: polygon(0 50%, 100% 50%, 100% 50%, 0 50%)` → on hover expands to full. Background color `#FFFF02` (yellow highlight).
- Dark mode adaptation: the yellow highlight works on both light and dark. Text gradient `from-neutral-700 to-neutral-500` for the base, black text on the yellow overlay.

Card layout (minimal):
```
flex min-h-screen items-center justify-center
  → centered card (rounded-2xl, border, shadow)
    → TextGlitch "EdwardLabs" as header
    → subtitle: "Enter your password"
    → password input
    → error text
    → submit button
```

---

## 3. Rename MiMoGPT → EdwardLabs everywhere

**All files with "MiMoGPT" or "mimogpt" references:**

| File | Line(s) | Change |
|------|---------|--------|
| `index.html` | 7 | `<title>MiMoGPT</title>` → `<title>EdwardLabs</title>` |
| `App.tsx` | 26-27 | `mimogpt_auth_hash` / `mimogpt_session` → `edwardlabs_session` (simplified auth) |
| `App.tsx` | 41 | `mimogpt_fontSize` → `edwardlabs_fontSize` |
| `App.tsx` | 112 | `mimogpt_fontSize` → `edwardlabs_fontSize` |
| `App.tsx` | 569 | `MiMoGPT` span → `EdwardLabs` |
| `components/PasswordScreen.tsx` | 4-5, 9 | Remove STORAGE_KEY, SESSION_KEY → use `edwardlabs_session` directly |
| `components/PasswordScreen.tsx` | 65 | `MiMoGPT` title → TextGlitch "EdwardLabs" |
| `components/Settings.tsx` | 91-92 | `mimogpt_auth_hash` / `mimogpt_session` → `edwardlabs_session` |
| `package.json` | 2, 10 | name `mimogpt` → `edwardlabs`, description update |

---

## 4. Font size affects ALL component fonts (global)

**Current state:** `--chat-font-size` CSS variable only applied to ChatMessage prose and code blocks. Sidebar, Settings, Input chrome all use hardcoded Tailwind classes (`text-sm`, `text-xs`) at the default 16px root.

**Approach:** Change the root `font-size` so all `rem`-based Tailwind classes scale automatically.

### Files to modify:

**`index.html`:**
- Rename `--chat-font-size` → `--app-font-size` in `:root`
- Add `html { font-size: var(--app-font-size, 16px); }` to the `<style>` block
- This makes ALL Tailwind `rem`-based text classes (`text-sm` = 0.875rem, `text-xs` = 0.75rem, etc.) scale with the setting

**`App.tsx`:**
- Rename `--chat-font-size` → `--app-font-size` in the root div's inline style
- Update the size map values to sensible root font sizes:
  - `{ xs: 14, sm: 15, base: 16, lg: 18, xl: 20 }` — confirmed by user
- Rename `mimogpt_fontSize` localStorage key → `edwardlabs_fontSize`

**`components/ChatMessage.tsx`:**
- Remove the explicit `style={{ fontSize: 'var(--chat-font-size, 14px)' }}` from the prose div (line 172) — it inherits from root now
- Update `catppuccinMocha` object: change `fontSize: 'var(--chat-font-size, 14px)'` → `fontSize: 'var(--app-font-size, 16px)'` (code blocks use inline styles, need explicit variable)
- Update `SyntaxHighlighter` `customStyle.fontSize` similarly

**`components/Settings.tsx`:**
- Update section title from "Chat Font Size" → "Font Size"
- Update description: "Adjust the font size across the application."
- Rename `onChangeFontSize` prop usage (no interface change needed, just semantics)

---

## Implementation Order

1. Rename `MiMoGPT` → `EdwardLabs` + localStorage keys (touches all files, do first)
2. Rewrite `PasswordScreen.tsx` with hardcoded password + TextGlitch header
3. Update `App.tsx` auth gate for hardcoded password
4. Convert font size from chat-only to global (root `font-size` approach)
5. Verify build passes

## Font Size Map (confirmed)

```
{ xs: 14, sm: 15, base: 16, lg: 18, xl: 20 }
```

Default: `'sm'` (15px root → `text-sm` = ~13.1px, `text-xs` = ~11.25px)
