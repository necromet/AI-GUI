# Claude-Style UI Redesign Plan

## Goal
Redesign the edward:labs main page to match Claude's clean, minimal dark UI aesthetic while preserving all existing functionality.

## Design Decisions (Confirmed)
- **Color system**: CSS custom properties (e.g., `--bg-100`, `--text-100`) in index.html `<style>`, used alongside Tailwind
- **Neon accents**: Keep neon color preset system for accent highlights (active states, links, send button) but remove all neon glow/shadow/box-shadow effects
- **Sidebar**: 18rem (288px) fixed on desktop, slide-in overlay with dark backdrop on mobile
- **Sidebar nav**: Keep RAG + Plug-in Agent + conversation history, styled like Claude nav items
- **Messages**: Remove avatar circles, use sender name only above message
- **Empty state**: Logo (no glow) + greeting + 4 suggestion cards, cleaner styling
- **Input box**: Claude-style clean rounded-2xl box, subtle border, no glow. Send button uses neon accent when active
- **Mobile**: Slide-in sidebar with backdrop overlay (not collapse animation)

## Files to Modify (6 files)

### 1. `index.html` — Color tokens + CSS overhaul

**Add CSS custom properties (in `<style>` block):**
```css
:root {
  /* Claude-inspired neutral palette */
  --bg-100: #0e0e0e;       /* Main background (near-black) */
  --bg-200: #1a1a1a;       /* Elevated surfaces */
  --bg-300: #252525;       /* Active/hover states */
  --bg-400: #303030;       /* Higher elevation */
  --text-100: #ececec;     /* Primary text */
  --text-300: #b4b4b4;     /* Secondary text */
  --text-500: #7a7a7a;     /* Muted text */
  --border-300: rgba(255,255,255,0.08); /* Standard borders */
  --border-200: rgba(255,255,255,0.04); /* Subtle borders */
  
  /* Keep existing neon vars for accents */
  --neon-rgb: 248, 113, 113;
  --neon-color: rgb(248, 113, 113);
  /* ... existing neon-secondary, neon-accent vars ... */
}
```

**Update Tailwind config colors:**
```js
colors: {
  sidebar: '#0e0e0e',
  main: '#0e0e0e',
  input: '#1a1a1a',
  hover: '#252525',
  user: '#1a1a1a',
  // Keep existing neon colors
}
```

**CSS cleanup:**
- Remove `.neon-shadow`, `.neon-glow` heavy glow styles
- Simplify `.prose pre` to `border: 1px solid rgba(255,255,255,0.06)`, no glow
- Update scrollbar: subtle gray, no neon hover glow
- Keep `--neon-rgb`, `--neon-color` CSS vars for accent usage
- Update code block hover: remove glow, use subtle border color change
- Update `body` bg from `#050505` to `#0e0e0e`
- Update `html.dark body` bg to `#0e0e0e`

### 2. `Sidebar.tsx` — Claude-style sidebar

**Layout:**
- Width: `w-[288px]` (18rem)
- Background: `bg-[#0e0e0e]` with subtle gradient from-bg-200/5 to-bg-200/30 (via inline style)
- Border: `border-r border-[rgba(255,255,255,0.08)]`
- Fixed position on desktop, slide-in on mobile

**Header:**
- Logo (edward:labs icon, 20px) aligned left
- "New chat" button: full-width, rounded-lg, ghost style with Plus icon, `hover:bg-[#252525]`
- Close sidebar button (PanelLeftClose icon) in top-right corner

**Navigation section (replaces "Experiment"):**
- Section label: `text-[10px] font-bold uppercase tracking-wider text-[#7a7a7a]`
- RAG item: `Database` icon + "RAG" label, `rounded-lg`, `hover:bg-[#252525]`
- Plug-in Agent item: `Puzzle` icon + "Plug-in Agent" label, same styling
- Active state: `bg-[#252525]` (no neon indicator bar)

**Conversation history:**
- Section labels: Today, Yesterday, Last 7 Days, Older — same uppercase style
- Each item: `rounded-lg`, `hover:bg-[#252525]`, truncate title
- Active item: `bg-[#252525]`, text color white
- Delete button: visible on hover only, `hover:text-red-400`
- No neon-colored active text

**Footer:**
- User profile: circular avatar with "E" initial (bg-[#252525], text-[#b4b4b4]), name "Edward", model name subtitle
- Settings button: `SettingsIcon` + "Settings" label
- Theme toggle: `Sun`/`Moon` icon + "Light Mode"/"Dark Mode" label
- Token Stats button: `BarChart3` icon + "Token Stats" label
- All items: `rounded-lg`, `hover:bg-[#252525]`, `text-[#7a7a7a] hover:text-[#ececec]`

**Mobile behavior:**
- Slide in from left with `transform: translateX`
- Dark backdrop overlay (`bg-black/80 backdrop-blur-sm`) behind sidebar
- Click backdrop to close

### 3. `ChatMessage.tsx` — Claude-style messages

**Remove avatars:**
- Delete the entire avatar div (the 32px circle with icon/logo)
- Adjust gap in container from `gap-4 md:gap-6` to `gap-0`

**Sender name:**
- Style: `text-[13px] font-medium text-[#7a7a7a]` (muted)
- No neon glow filter, no `drop-shadow`
- "You" for user, "MiMo" or model name for assistant

**Message container:**
- Max width: `max-w-3xl mx-auto` (centered like Claude)
- Remove left padding that was for avatar space
- Clean layout: name above, content below

**Code blocks:**
- Remove glow border: `boxShadow: '0 0 15px ...'` → `border: 1px solid rgba(255,255,255,0.06)`
- Remove hover glow effect
- Keep header bar (language + copy) with clean styling
- Keep catppuccin syntax themes

**Action buttons:**
- `opacity-0 group-hover:opacity-100` (appear on hover)
- Use `text-[#7a7a7a] hover:text-[#ececec]` (no neon colors)
- Keep: Copy, ThumbsUp, ThumbsDown, Regenerate

**Thinking/reasoning:**
- `border-l-2 border-[rgba(255,255,255,0.08)]` instead of neon border
- Label: `text-[#7a7a7a]` instead of neon-colored

**Search citations:**
- Cards: `bg-[#1a1a1a]`, `border border-[rgba(255,255,255,0.06)]`
- Remove neon accent glow from hover effects
- Keep the numbered badges but use subtle styling

**Token usage:**
- Keep but make more subtle: `text-[11px] text-[#7a7a7a]`

### 4. `PromptInputBox.tsx` — Clean input

**Container:**
- Background: `rgba(18, 18, 18, 0.8)` (dark, matching Claude)
- Border: `1px solid rgba(255,255,255,0.06)` (subtle, no glow)
- No `boxShadow` glow effect, use `0 4px 20px rgba(0,0,0,0.2)` (subtle depth)
- Border radius: `rounded-2xl` (keep)
- Focus state: `border: 1px solid rgba(var(--neon-rgb), 0.2)` (neon accent preserved)

**Action buttons:**
- Paperclip, Search, Think buttons: `text-[#7a7a7a] hover:text-[#ececec]`
- Search active: `bg-[#1EAEDB]/15 border-[#1EAEDB]` (keep existing active state)
- Think active: `bg-[#8B5CF6]/15 border-[#8B5CF6]` (keep existing active state)
- Send button: use neon accent color when content exists (preserve this accent)

**File previews:**
- Clean border: `border border-[rgba(255,255,255,0.06)]`
- Remove neon glow from preview containers

### 5. `App.tsx` — Layout adjustments

**Root container:**
- `bg-[#0e0e0e]` (update from `bg-main` which will be `#0e0e0e`)
- Remove `selection:bg-neon-purple` (use default selection or subtle accent)

**Top bar:**
- Background: `bg-[#0e0e0e]/80` (simpler, no backdrop-blur-md)
- Or keep backdrop-blur but with new bg color
- Model select stays in top bar

**Empty state:**
- Logo: keep TestTubeDiagonal icon, remove `scale-[2]`, remove `drop-shadow` glow
  - Display at normal size (scale-1) with subtle color
- Greeting: "How can I help you today?" — keep text, update gradient to use new text colors
- Suggestion cards: `bg-[#1a1a1a]`, `border border-[rgba(255,255,255,0.06)]`, `hover:bg-[#252525]`
  - Remove transparent/ghost style, use solid dark surfaces

**Input area:**
- Gradient: `from-[#0e0e0e] via-[#0e0e0e] to-transparent` (simpler)
- Max width: `max-w-3xl` (keep, matches Claude's content width)

**Sidebar integration:**
- Desktop: fixed sidebar 288px + main area fills remaining
- Mobile: sidebar overlay with backdrop (update from current collapse behavior)
- The backdrop div already exists in App.tsx, just needs the sidebar to be `fixed` on mobile

### 6. `ModelSelect.tsx` — Cleaner dropdown

**Trigger button:**
- Remove `drop-shadow` glow on model name
- Clean text: `text-[#ececec]`
- Icon: keep colored but remove glow

**Dropdown:**
- Background: `bg-[#1a1a1a]`
- Border: `border border-[rgba(255,255,255,0.06)]`
- Shadow: `0 20px 60px -15px rgba(0,0,0,0.8)` (clean shadow, no neon)
- Remove `boxShadow` with neon-rgb

**Model items:**
- Active: `bg-[#252525]` (not neon background)
- Hover: `hover:bg-[rgba(255,255,255,0.03)]`
- Remove neon gradient overlay on hover
- Remove neon dot indicator for active model, use text weight/color instead

## What NOT to Change
- All functionality (chat, TTS, ASR, RAG, Plugin Agent, settings, token stats)
- Neon color preset system (stored in localStorage, CSS vars, settings UI)
- Database adapter and services
- Password screen
- Markdown rendering (ReactMarkdown, syntax highlighting, KaTeX math)
- File upload, voice recording, search/think toggles
- AIVoiceInput component

## Implementation Order
1. `index.html` — Foundation: color tokens + CSS (must be first, other files depend on these)
2. `App.tsx` — Layout shell: background, top bar, empty state, sidebar integration
3. `Sidebar.tsx` — Sidebar redesign
4. `ChatMessage.tsx` — Message view redesign
5. `PromptInputBox.tsx` — Input box redesign
6. `ModelSelect.tsx` — Dropdown cleanup

## Validation
1. `npm run build` — no build errors
2. Dark mode: clean, near-black aesthetic matching Claude
3. All features work: chat, model switching, RAG, Plugin Agent, settings, token stats
4. File upload, voice recording, search/think toggles functional
5. Mobile: sidebar slides in with backdrop, closes on backdrop tap
6. Responsive: sidebar hidden on mobile, chat area fills width
