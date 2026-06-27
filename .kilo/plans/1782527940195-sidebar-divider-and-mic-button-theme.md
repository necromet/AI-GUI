# Sidebar Divider + Microphone Button Theme Fix

## Context

The sidebar currently shows all conversations in a flat list grouped by date. The user wants to visually separate "general chat" conversations from an "Experiment" section containing placeholder items (RAG, Plug-in Agent). Additionally, the microphone button in the chat input box lacks visual distinction between dark and light modes.

---

## Task 1: Sidebar Experiment Section with Divider

**File:** `components/Sidebar.tsx`

### Current structure
1. Header (New chat + toggle)
2. Divider line
3. Conversation history (Today / Yesterday / Last 7 Days / Older)
4. Footer (Token Stats, Settings, Theme, User)

### Proposed structure
1. Header (New chat + toggle)
2. Divider line
3. **Experiment section** — new
   - Section label: `"EXPERIMENT"` (uppercase, same style as date group labels)
   - Items: `RAG` (icon: `Database`), `Plug-in Agent` (icon: `Puzzle`)
   - Each item styled identically to conversation items but non-functional (no click handler beyond visual feedback)
   - Items use `text-gray-500 dark:text-gray-400` + hover states matching existing patterns
4. **Visual divider** between experiment section and conversation history (`mx-3 h-px bg-gray-300 dark:bg-white/[0.04]`)
5. Conversation history (Today / Yesterday / Last 7 Days / Older)
6. Footer

### Changes
- Add `Database` and `Puzzle` to the lucide-react import (line 2)
- Insert experiment section after the first divider (after line 111), before the history scrollable area
- Add a divider after the experiment section

---

## Task 2: Microphone Button Dark/Light Mode Distinction

**File:** `components/PromptInputBox.tsx`

### Current state (lines 619–661)
The mic button (when `!hasContent && !isRecording && !isLoading`) uses:
```
bg-transparent hover:bg-gray-200 dark:hover:bg-gray-600/30
text-gray-400 dark:text-[#9CA3AF]
```

Problem: In light mode, the transparent button on the light input background (`rgba(245,245,245,0.9)`) is nearly invisible — gray-400 on near-white.

### Fix
Change the idle mic button styling to:
```
bg-gray-100 dark:bg-transparent
hover:bg-gray-200 dark:hover:bg-gray-600/30
text-gray-500 dark:text-[#9CA3AF]
hover:text-gray-700 dark:hover:text-[#D1D5DB]
```

This gives the button a subtle visible background (`bg-gray-100`) in light mode while keeping it transparent in dark mode. The text color is also bumped from `gray-400` to `gray-500` for better contrast in light mode.

Same treatment applied to the `<Mic>` icon className inside the button.

### Specific edits
Line 628 (button classes when idle):
```tsx
// FROM:
"bg-transparent hover:bg-gray-200 dark:hover:bg-gray-600/30 text-gray-400 dark:text-[#9CA3AF] hover:text-gray-600 dark:hover:text-[#D1D5DB]"
// TO:
"bg-gray-100 dark:bg-transparent hover:bg-gray-200 dark:hover:bg-gray-600/30 text-gray-500 dark:text-[#9CA3AF] hover:text-gray-700 dark:hover:text-[#D1D5DB]"
```

Line 659 (Mic icon):
```tsx
// FROM:
<Mic className="h-5 w-5 text-gray-400 dark:text-[#9CA3AF] transition-colors" />
// TO:
<Mic className="h-5 w-5 text-gray-500 dark:text-[#9CA3AF] transition-colors" />
```

---

## Validation

1. Run `npm run build` — no compile errors
2. Visual check in browser:
   - Sidebar: Experiment section with RAG and Plug-in Agent items appears between header and conversation history, separated by dividers
   - Light mode: Mic button has visible `bg-gray-100` background, distinguishable from the input area
   - Dark mode: Mic button remains transparent (unchanged behavior)
