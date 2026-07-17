# Rename "Library Agent" → "Librarian" + Add Chat Message Animations

## Overview
1. Rename the UI label "Library Agent" to "Librarian" everywhere it appears
2. Add smooth entrance animations to chat messages in the AgentSidebar

## Files to Edit

### 1. `components/library/AgentSidebar.tsx`

**Rename (line 572):**
- Change `Library Agent` → `Librarian` in the header text

**Add message animations:**
The project already defines `animate-message-in` in `src/globals.css` (fade-in + translateY from 8px over 0.4s). Apply this class to message bubble containers:

- **User messages** (line 648): Add `animate-message-in` to the outer `<div key={msg.id} className="flex justify-end">` wrapper
- **Thinking indicator** (line 659): Add `animate-message-in` to the outer `<div key={msg.id} className="flex justify-start">` wrapper
- **Assistant text messages** (line 669): Add `animate-message-in` to the outer wrapper
- **Blocks container** (line 682): Add `animate-message-in` to the `<React.Fragment>` — wrap it in a `<div>` with `animate-message-in`, or apply to each block's outer `<div>`:
  - Text block (line 686): Add `animate-message-in`
  - Tool call block (line 700): Add `animate-message-in`
  - Agent plan block (line 737): Add `animate-message-in`
  - Ask user block (line 746): Add `animate-message-in`

### 2. `components/SettingsPage.tsx`

**Rename (line 404):**
- Change `library: 'Library Agent'` → `library: 'Librarian'`

## No Backend Changes
The name "Library Agent" only appears in UI labels. API routes (`/api/library-agent/*`) and backend code stay unchanged to avoid breaking existing integrations.

## Verification
- Run `npm run build` to verify no compile errors
- Open Library mode → select a component → verify sidebar header says "Librarian"
- Send a message in the sidebar → verify messages animate in smoothly
- Open Settings → Agents tab → verify "Librarian" label appears
