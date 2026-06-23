# Plan: Password Screen + Token Stats Redesign + UI/UX Polish

## Overview
Three changes:
1. Add a password gate screen before the main chat UI
2. Redesign the Token Usage Stats "By Model" tab to use radial bar charts (Stats07 style)
3. Polish all components for award-winning UI/UX

---

## Step 1: Install Dependencies

Install `recharts`, `clsx`, and `tailwind-merge` (required by the Stats07-style chart component).

```bash
npm install recharts clsx tailwind-merge
```

---

## Step 2: Create Password Screen Component

**New file:** `components/PasswordScreen.tsx`

- Full-screen neon-themed login page with:
  - Centered card with glass-morphism effect
  - App logo (Flame icon) with neon glow animation
  - "MiMoGPT" title with gradient text
  - Password input field with neon focus ring
  - "Enter" button with neon glow
  - Shake animation on wrong password
  - Fade-out transition on successful login
- Password stored as SHA-256 hash in `localStorage` (key: `mimogpt_password_hash`)
  - On first visit: show "Set Password" mode (confirm password field)
  - On subsequent visits: show "Enter Password" mode
  - Default password: `mimogpt2024` (hash stored on first setup)
- State: `isAuthenticated` boolean in App.tsx
- On success, render the existing `<App />` chat UI
- On failure, show shake + error message

---

## Step 3: Integrate Password Screen into App

**Modify:** `App.tsx`

- Add `isAuthenticated` state (default `false`)
- On mount, check if password hash exists in localStorage
  - If not, skip auth (first-time setup handled in PasswordScreen)
- Wrap entire return in: `isAuthenticated ? <MainApp /> : <PasswordScreen onSuccess={() => setIsAuthenticated(true)} />`
- Alternatively, extract the current render into a `ChatApp` component and conditionally render

---

## Step 4: Redesign TokenUsageStats "By Model" Tab

**Modify:** `components/TokenUsageStats.tsx`

Replace the "By Model" tab content with Stats07-style radial bar chart cards:

- Each model gets a card with:
  - A `RadialBarChart` (80x80px) showing usage percentage
  - Model name
  - "X of Y tokens used" subtitle (current total vs max across models as capacity)
  - The percentage in the center of the radial chart
- Use `recharts` `RadialBarChart`, `PolarAngleAxis`, `RadialBar`
- Create a `ChartContainer` wrapper using the provided Stats07 code pattern
- Grid layout: 1 col on mobile, 2 on md, 4 on lg

**Data mapping:**
- For each model in `modelStats`, calculate `capacity` as `(model.totalTokens / maxModelTokens) * 100`
- Display: `{model.totalTokens} tokens` as subtitle
- Keep other tabs (Overview, Timeline, Conversations) as-is with minor visual polish

---

## Step 5: UI/UX Polish Across All Components

### PasswordScreen (already polished in step 2)

### Sidebar (`components/Sidebar.tsx`)
- Add subtle hover animations on conversation items
- Add smooth collapse/expand transition
- Add active conversation indicator with neon glow bar on left edge

### ChatMessage (`components/ChatMessage.tsx`)
- Add subtle entrance animation for new messages (fade-in + slide-up)
- Improve the thinking indicator with a pulsing neon glow

### ModelSelect (`components/ModelSelect.tsx`)
- Add backdrop blur to dropdown
- Add smooth scale animation on open

### Settings (`components/Settings.tsx`)
- Add tab transition animations
- Polish the model cards with hover glow effects
- Add subtle gradient backgrounds to section headers

### Input Area (in App.tsx)
- Add subtle glow animation on the input border when focused
- Improve the send button with a scale-up animation on hover

### Notification (`components/Notification.tsx`)
- Add progress bar that counts down the auto-dismiss timer
- Add slide-in + scale animation

### TTSPanel / VoiceDesignPanel / VoiceClonePanel / ASRPanel
- Polish button states with neon glow
- Add loading skeleton animations
- Improve file upload areas with drag-over highlight

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `components/PasswordScreen.tsx` | **CREATE** - Password gate screen |
| `components/TokenUsageStats.tsx` | **MODIFY** - Radial bar chart redesign for Models tab |
| `App.tsx` | **MODIFY** - Add auth state, integrate PasswordScreen |
| `components/Sidebar.tsx` | **MODIFY** - UI polish |
| `components/ChatMessage.tsx` | **MODIFY** - Entrance animations |
| `components/ModelSelect.tsx` | **MODIFY** - Dropdown polish |
| `components/Settings.tsx` | **MODIFY** - Tab animations, polish |
| `components/Notification.tsx` | **MODIFY** - Progress bar, animations |
| `components/TTSPanel.tsx` | **MODIFY** - Button/input polish |
| `components/VoiceDesignPanel.tsx` | **MODIFY** - Button/input polish |
| `components/VoiceClonePanel.tsx` | **MODIFY** - Button/input polish |
| `components/ASRPanel.tsx` | **MODIFY** - Button/input polish |
| `index.html` | **MODIFY** - Add CSS animations (keyframes for shake, slide-in, etc.) |
| `package.json` | **MODIFY** - Add recharts, clsx, tailwind-merge deps |

---

## Implementation Order

1. Install deps
2. Create PasswordScreen + integrate into App
3. Redesign TokenUsageStats Models tab
4. Polish remaining components
5. Test build
