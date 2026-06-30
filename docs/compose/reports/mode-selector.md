---
feature: mode-selector
status: delivered
specs:
  - docs/compose/specs/2026-06-30-mode-selector-design.md
plans:
  - docs/compose/plans/2026-06-30-mode-selector.md
---

# Mode Selector & UI Separation — Final Report

## What Was Built

A landing selector screen that replaces the single password gate, routing users into three distinct modes: **Chat** (public, no auth), **Experiments** (password-protected tool workspace), and **Combined** (chat + experiments side-by-side). The selector uses the existing NeuralBackground animation with glassmorphism cards, the TextGlitch branding effect, and an inline password modal for unlocking experimental features.

The Chat mode preserves the existing app experience exactly — conversation history, model selector, TTS/ASR panels, settings. Experiments mode transforms the sidebar into a tool navigation panel (RAG, Plugin Agent) with no chat interface. Combined mode presents a resizable split layout: chat on the left, a tabbed experiment drawer on the right that can be collapsed to full-width chat.

## Architecture

A `currentMode` state (`'selector' | 'chat' | 'experiments' | 'combined'`) in `App.tsx` drives all rendering. When `currentMode === 'selector'`, the `ModeSelector` component renders as a full-screen gate. Once a mode is selected, the main app shell renders with mode-conditional content.

**Key components:**
- `ModeSelector.tsx` — Landing page with 3 cards, NeuralBackground, TextGlitch, PasswordModal integration
- `PasswordModal.tsx` — Inline modal with password validation, extracted from the old PasswordScreen
- `ResizableDivider.tsx` — Draggable panel divider for combined mode split layout
- `Sidebar.tsx` — Mode-aware: shows conversation history in chat/combined, tool navigation in experiments

**Session management:**
- Chat mode: no authentication required (public)
- Experiments/Combined: `edward:labs_experiments_session` in sessionStorage (separate from the old `edward:labs_session`)
- Once unlocked, both Experiments and Combined stay accessible for the session

### Design Decisions

- **Mode state over routing** — Chose a single `currentMode` state in App.tsx over client-side routing. The app has no URL-based navigation today, and adding a router would be a larger refactor for little benefit.
- **Inline password modal over separate page** — The password prompt appears as a modal overlay on the selector card, keeping the user in context rather than redirecting to a login page.
- **Resizable split via mouse events** — Used vanilla `mousedown/mousemove/mouseup` drag handling instead of a library. No new dependencies needed.

## Usage

1. Visit the app — the landing selector appears with 3 cards
2. Click **Chat** — enters the standard chat experience (no password needed)
3. Click **Experiments** or **Combined** — if locked, a password modal appears. Enter the password to unlock.
4. In **Experiments** mode, use the sidebar to navigate between RAG and Plugin Agent tools
5. In **Combined** mode, chat on the left while experiments are in the right panel. Drag the divider to resize. Click the collapse button to hide the experiment panel.
6. Click **Back to selector** in the sidebar footer to return to the landing page

## Verification

- `npm run build` passes cleanly at each task checkpoint (11 tasks, all verified)
- All mode transitions functional: selector → chat, selector → experiments (with password), selector → combined, back to selector
- Dark/light mode, neon presets, font settings all carry over across modes
- Existing functionality (streaming, TTS/ASR, settings, token stats) unaffected

## Journey Log

- [lesson] The brainstorm visual companion server failed to start reliably on Windows (PowerShell). Text-only brainstorming with structured question tool worked well for UI/UX design discussions.
- [pivot] Combined mode originally planned as "experiments + chat merged" — clarified to "chat + experiments side-by-side split" after user feedback on the distinction between Experiments (tool workspace) and Combined (chat enhanced with tools).

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `docs/compose/specs/2026-06-30-mode-selector-design.md` | Design spec | 10 sections covering all mode definitions |
| `docs/compose/plans/2026-06-30-mode-selector.md` | Implementation plan | 11 tasks, all completed |
