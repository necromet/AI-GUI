# edward:labs Mode Selector & UI Separation

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/mode-selector.md)

## [S1] Problem

The app currently gates everything behind a single password screen. RAG and experimental tools (Plugin Agent) are mixed into the sidebar as "Coming Soon" placeholders with no real separation from the chat. The user wants:

- A public chat experience (no password)
- A password-protected experimental workspace (RAG, Plugin Agent, future tools)
- A combined power-user mode (chat + experiments side by side)
- An award-winning landing selector as the entry point

## [S2] Solution Overview

Replace the current `PasswordScreen` gate with a **Mode Selector landing page**. Introduce a `currentMode` state that drives the entire app layout. Three modes: Chat (public), Experiments (password-protected), Combined (password-protected, chat + experiments split).

## [S3] Mode Definitions

### Chat Mode (`'chat'`)
- Identical to the current app experience
- Sidebar: conversation history, model selector, settings, theme toggle, token stats
- Main area: chat messages + PromptInputBox
- **No** RAG or Plugin Agent links in sidebar
- **No** password required
- Top bar shows a "Chat" mode badge

### Experiments Mode (`'experiments'`)
- A dedicated "lab bench" for experimental tools — **no chat interface**
- Sidebar transforms:
  - Logo + "Back to selector" button at top
  - Navigation list of experiment tools (RAG, Plugin Agent, future tools)
  - Conversation history section is **hidden**
  - Settings, theme toggle, token stats remain in footer
- Main area displays the selected experiment tool's full interface
- RAG panel: document upload, knowledge base browser, semantic search tester, source management
- Plugin Agent panel: tool registry, API configuration, function editor, test runner
- Password required (`edward:labs_experiments_session` in sessionStorage)

### Combined Mode (`'combined'`)
- Resizable side-by-side split layout
- **Left panel (60% default):** Full chat with conversation history, model selector, PromptInputBox. Additional controls: toggle RAG context, select active plugins. Chat messages can include RAG citations and plugin results inline.
- **Right panel (40% default):** Collapsible experiment drawer with tabbed navigation (RAG | Plugin Agent | future tools). Each tab shows a mini-interface for the tool.
- **Divider:** Draggable to resize. Double-click snaps 50/50. Collapse button hides experiment panel (chat goes full width).
- Sidebar: same as Chat mode — conversation history, model select, settings. "Back to selector" in footer. "Combined" mode badge in top bar.
- Password required (same session key as Experiments)

## [S4] Landing Selector

Full-viewport entry screen with three glassmorphism cards:

| Card | Icon | Behavior |
|------|------|----------|
| Chat | MessageSquare | Enters chat mode directly, no auth |
| Experiments | Flask | Lock icon. Click → password modal. On success → enters experiments mode |
| Combined | Layers | Lock icon. Click → password modal if not authenticated, else enters combined mode |

Layout:
- NeuralBackground animation (existing component) as full-viewport backdrop
- Three cards arranged horizontally (stacked on mobile)
- `edward:labs` title with TextGlitch effect (reuse from current PasswordScreen)
- Subtle tagline below title

Card styling:
- Glassmorphism: `backdrop-blur-xl`, `bg-white/[0.03]`, `border-white/[0.06]`
- Hover: `translateY(-4px)`, neon border glow, subtle box-shadow pulse
- Unlocked cards: lock icon transitions to checkmark with neon glow indicator

## [S5] Password Gate

Inline modal triggered from the card click:
1. Modal slides up from the card with glassmorphism backdrop
2. Single password input (same styling as current PasswordScreen)
3. Success: modal dissolves, card lock → checkmark, mode activates
4. Failure: shake animation + "Incorrect password" message
5. Session key: `edward:labs_experiments_session` in sessionStorage (separate from existing `edward:labs_session`)
6. Once unlocked, both Experiments and Combined cards stay unlocked for the session
7. No separate login page, no redirect

## [S6] Mode Routing & State

New state in App.tsx:
```typescript
const [currentMode, setCurrentMode] = useState<'selector' | 'chat' | 'experiments' | 'combined'>('selector');
const [isExperimentsAuthenticated, setIsExperimentsAuthenticated] = useState(() => {
  return !!sessionStorage.getItem('edward:labs_experiments_session');
});
```

State flow:
- Default: `'selector'` — shows landing screen
- Chat card → `setCurrentMode('chat')`
- Experiments card → if authenticated, `setCurrentMode('experiments')`. Else, show password modal.
- Combined card → if authenticated, `setCurrentMode('combined')`. Else, show password modal.
- "Back to selector" → `setCurrentMode('selector')` (auth persists for session)

The existing `isAuthenticated` state and `PasswordScreen` gate are **removed**. The old `edward:labs_session` sessionStorage key is no longer used.

## [S7] Sidebar Changes

The Sidebar component needs a `currentMode` prop to adapt its content:

**When `currentMode === 'chat'` or `'combined'`:**
- Standard sidebar: conversation history, model select, new chat, settings, theme toggle
- "Experiment" section removed
- "Back to selector" button added to footer

**When `currentMode === 'experiments'`:**
- Logo + "Back to selector" at top
- Tool navigation list (RAG, Plugin Agent) replaces conversation history
- No "New chat" button
- Settings, theme toggle, token stats remain in footer
- No conversation history section

## [S8] Visual Design

### Transitions
- Selector → mode: cards scale down and fade, main content slides in from bottom (300ms ease-out)
- Mode → selector: reverse animation
- Between modes: crossfade

### Combined Mode Divider
- Thin line with subtle neon glow on hover
- Drag handle: small grip indicator (3 vertical dots)
- Draggable to resize panels
- Double-click snaps to 50/50
- Collapse button hides experiment panel

### Existing Design System
- All CSS variables (`--neon-color`, `--bg-*`, `--text-*`, etc.) carry over
- Neon presets, dark/light mode, font size/font family settings unchanged
- NeuralBackground component reused for landing selector
- TextGlitch component reused for branding
- Glassmorphism card styles consistent with existing `glass-panel` CSS class

## [S9] Component Changes

### New Components
- `ModeSelector.tsx` — Landing selector screen with 3 cards
- `PasswordModal.tsx` — Inline password modal (extracted from PasswordScreen logic)
- `ExperimentSidebar.tsx` — Sidebar variant for experiments mode (or parameterize existing Sidebar)
- `ResizableDivider.tsx` — Draggable split panel divider for combined mode
- `ExperimentDrawer.tsx` — Right panel in combined mode with tabbed tool navigation

### Modified Components
- `App.tsx` — Add `currentMode` state, remove `PasswordScreen` gate, conditional rendering based on mode
- `Sidebar.tsx` — Accept `currentMode` prop, conditionally render content
- `RAGPanel.tsx` — Expand from placeholder to full tool interface
- `PluginAgentPanel.tsx` — Expand from placeholder to full tool interface

### Removed Components
- `PasswordScreen.tsx` — Replaced by ModeSelector + PasswordModal

## [S10] File Structure

```
components/
  ModeSelector.tsx        (NEW)
  PasswordModal.tsx       (NEW)
  ExperimentSidebar.tsx   (NEW — or Sidebar.tsx parameterized)
  ResizableDivider.tsx    (NEW)
  ExperimentDrawer.tsx    (NEW)
  Sidebar.tsx             (MODIFIED)
  RAGPanel.tsx            (MODIFIED — expand from placeholder)
  PluginAgentPanel.tsx    (MODIFIED — expand from placeholder)
  PasswordScreen.tsx      (REMOVED)
  ... (all other components unchanged)
App.tsx                   (MODIFIED)
types.ts                  (MODIFIED — add Mode type)
```
