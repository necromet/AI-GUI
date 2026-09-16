# Implementation Plan: Agent Builder Fixes

## Overview

Three issues to address:
1. **401 Authentication Error** during database initialization on app load
2. **Header overlap** in WorkflowToolbar — icons/text crowding together
3. **Missing fade animations** on agent-builder popups/overlays

---

## Issue 1: Database Initialization 401 Error

### Root Cause

`App.tsx:289` — `initDb()` runs unconditionally on mount (`useEffect([], [])`). It calls:
- `loadConversations()` → `GET /api/conversations` — auth-gated to `'chat'` mode
- `loadModels()` → `GET /api/models` — auth-gated to `'chat'` mode

The `requireModeAuth` middleware (`server/middleware/auth.ts:22`) maps these routes to the `'chat'` mode and checks `req.session.unlockedModes`. On first load, no modes are unlocked → 401.

The `RequireAuth` wrapper only guards route *rendering*, not the root-level `initDb` side effect.

### Fix: Guard `initDb` with authentication state

**File:** `App.tsx`

#### Step 1 — Split `initDb` into auth-aware effects

Change the `useEffect` at line 289 to wait until the chat mode is authenticated before calling auth-gated endpoints:

```tsx
// Current (broken):
useEffect(() => {
  const initDb = async () => {
    try {
      await db.getDatabase();                                    // /api/health — OK (no auth)
      await Promise.all([loadConversations(), loadModels()]);     // 401 if not authenticated
    } catch (error) {
      console.error('Database initialization error:', error);
    }
    Promise.allSettled([...]).catch(() => {});
  };
  initDb();
  fetch('/api/health')...
}, []);
```

```tsx
// Fixed:
// Effect 1: Health check only — no auth required
useEffect(() => {
  fetch('/api/health').then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  }).catch(() => {
    toast.error('Backend server is not reachable. Chat, TTS, and ASR will not work.');
  });
}, []);

// Effect 2: Chat data — only after chat is unlocked
useEffect(() => {
  if (!isChatAuthenticated) return;

  const loadChatData = async () => {
    try {
      await Promise.all([loadConversations(), loadModels()]);
    } catch (error) {
      console.error('Failed to load chat data:', error);
    }

    Promise.allSettled([
      db.getOverallTokenStats(),
      db.getTokenStatsByModel(),
      db.getTokenStatsByConversation(20),
      db.getAvailableToolsCached(),
    ]).catch(() => {});
  };
  loadChatData();
}, [isChatAuthenticated]);

// Effect 3: Mode-specific data — only after respective mode is unlocked
useEffect(() => {
  if (!isSkemaAuthenticated) return;
  db.getSkemaProjects().catch(() => {});
}, [isSkemaAuthenticated]);

useEffect(() => {
  if (!isPythonAuthenticated) return;
  db.getPythonProjects().catch(() => {});
}, [isPythonAuthenticated]);

useEffect(() => {
  if (!isLibraryAuthenticated) return;
  Promise.allSettled([db.getLibraryFolders(), db.getLibraryComponents()]).catch(() => {});
}, [isLibraryAuthenticated]);
```

All variables (`isChatAuthenticated`, `isSkemaAuthenticated`, etc.) are already available in App.tsx scope via `useModeAuth()` at line 202-203.

---

## Issue 2: WorkflowToolbar Header Overlap

### Root Cause

`WorkflowToolbar.tsx:99` — The toolbar is a single `flex` row with no grouping/separator logic. All 10+ elements compete for space in a `gap-2 px-3 py-1.5` container with `overflow-hidden`. On narrow viewports, elements overlap.

Current element order (left to right):
```
[name input] [undo] [redo] [fit] [shortcuts] [divider] [validation badge] [save] [export JSON] [export code] [templates]
```

### Fix: Restructure toolbar with logical groups and spacer

**File:** `components/agent-builder/WorkflowToolbar.tsx`

#### Step 1 — Group elements into logical sections with a flex-1 spacer

```tsx
<div className="flex items-center gap-1 px-2 py-1.5 border-b"
     style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100)' }}>

  {/* Group 1: Workflow name — constrained width */}
  <input
    type="text"
    value={name}
    onChange={(e) => onNameChange(e.target.value)}
    className="text-sm font-semibold bg-transparent border-none outline-none min-w-0 w-[160px] max-w-[200px]"
    style={{ color: 'var(--text-100)' }}
    placeholder="Workflow name"
  />

  <div className="w-px h-4 mx-1 flex-shrink-0" style={{ backgroundColor: 'var(--border-300)' }} />

  {/* Group 2: Canvas controls */}
  <div className="flex items-center gap-0.5 flex-shrink-0">
    <button ...undo (Undo2 size={13})... />
    <button ...redo (Redo2 size={13})... />
    <button ...fit view (Maximize2 size={13})... />
    <ShortcutButton ... />
  </div>

  <div className="w-px h-4 mx-1 flex-shrink-0" style={{ backgroundColor: 'var(--border-300)' }} />

  {/* Group 3: Validation status */}
  {validationIssues.length > 0 ? <ValidationBadge /> : nodes.length > 0 ? <CheckCircle2 size={13} /> : null}

  {/* Spacer — pushes remaining items right */}
  <div className="flex-1" />

  {/* Group 4: Actions (right-aligned) */}
  <div className="flex items-center gap-1 flex-shrink-0">
    <button ...templates (FileCode size={12})... />
    <button ...export JSON (Download size={13})... />
    {workflowId && <button ...export code (Code size={13})... />}
    <button ...save (Save size={12})... />
  </div>
</div>
```

#### Step 2 — Reduce sizes for compactness

- Icon-only buttons: `p-1.5` → `p-1`, icon size `14` → `13`
- Labeled buttons (Save, Templates): `text-xs` → `text-[11px]`, `px-2.5` → `px-2`
- Name input: fixed `w-[160px]` instead of `flex-1 min-w-[120px]`
- Gap: `gap-2` → `gap-1` between groups

#### Lucide icons confirmation

Yes — `lucide-react` is already imported at `WorkflowToolbar.tsx:2`:
```tsx
import { Save, Download, Code, Undo2, Redo2, Maximize2, FileCode, AlertTriangle, CheckCircle2 } from 'lucide-react';
```
No icon library change needed. The overlap is purely a layout issue.

---

## Issue 3: Fade In/Out Animations for Agent Builder Popups

### Current State

| Component | Has Animation? | Method |
|-----------|---------------|--------|
| `OnboardingOverlay.tsx` | Yes | Manual opacity via `animState` |
| `NodeContextMenu.tsx` | Enter only | CSS class `ctx-menu-enter` |
| `CanvasContextMenu.tsx` | Enter only | CSS class `ctx-menu-enter` |
| `TemplateGallery.tsx` | **No** | Instant mount/unmount |
| `ShortcutOverlay.tsx` | **No** | `if (!isOpen) return null` |
| `CommandPalette.tsx` | **No** | `if (!isOpen) return null` |
| `NodeSettingsPanel.tsx` | **No** | Has transition but no enter animation |
| `ExecutionPanel.tsx` | **No** | No mount animation |

### Available Animation Infrastructure

The project already has:
- `tailwindcss-animate` with `animate-in`/`animate-out` + `fade-in-0`/`fade-out-0`/`zoom-in-95`/`zoom-out-95`
- Custom `@theme` tokens: `--animate-fade-in`, `--animate-modal-fs-in`, `--animate-modal-fs-out`, `--animate-slide-in-up`, `--animate-slide-out-down`
- `framer-motion` (`^12.41.0`) — used in `PromptInputBox.tsx` and `agent-plan.tsx`
- Context menus use `ctx-menu-enter` CSS class (keyframe: `ctx-menu-in`)

### Approach

Use the state-based pattern already established in `OnboardingOverlay.tsx` — track `animState` (`'enter' | 'visible' | 'exit'`), use `requestAnimationFrame` for enter, `setTimeout` for exit with matching durations. Apply existing `@theme` keyframe easing curves via inline styles.

### Fix per component

#### 3a. `TemplateGallery.tsx`

Add backdrop + content fade/scale animation:

```tsx
const [animState, setAnimState] = useState<'enter' | 'visible' | 'exit'>('enter');

useEffect(() => {
  requestAnimationFrame(() => setAnimState('visible'));
}, []);

const handleClose = () => {
  setAnimState('exit');
  setTimeout(() => onClose(), 200);
};
```

Backdrop: `transition-opacity duration-200`, `opacity: animState === 'visible' ? 1 : 0`
Content: `transition-all duration-200`, `opacity` + `transform: scale(0.97) translateY(8px)` → `scale(1) translateY(0)`

#### 3b. `ShortcutOverlay.tsx`

Same pattern. Replace `if (!isOpen) return null` with mounted-during-exit approach:

```tsx
const [mounted, setMounted] = useState(false);
const [animState, setAnimState] = useState<'enter' | 'visible' | 'exit'>('enter');

useEffect(() => {
  if (isOpen) {
    setMounted(true);
    requestAnimationFrame(() => setAnimState('visible'));
  } else if (mounted) {
    setAnimState('exit');
    const t = setTimeout(() => { setMounted(false); setAnimState('enter'); }, 200);
    return () => clearTimeout(t);
  }
}, [isOpen]);

if (!mounted) return null;
```

#### 3c. `CommandPalette.tsx`

Same pattern as ShortcutOverlay. Focus input after enter animation:

```tsx
useEffect(() => {
  if (animState === 'visible') {
    setTimeout(() => inputRef.current?.focus(), 50);
  }
}, [animState]);
```

#### 3d. `NodeSettingsPanel.tsx`

Add slide-in-from-right on mount:

```tsx
const [entered, setEntered] = useState(false);
useEffect(() => { requestAnimationFrame(() => setEntered(true)); }, []);
```

Apply to the panel div:
```tsx
style={{
  opacity: entered ? 1 : 0,
  transform: entered ? 'translateX(0)' : 'translateX(12px)',
  transition: 'opacity 200ms ease, transform 200ms ease',
}}
```

#### 3e. `ExecutionPanel.tsx`

Subtle fade-in on mount:

```tsx
const [entered, setEntered] = useState(false);
useEffect(() => { requestAnimationFrame(() => setEntered(true)); }, []);
```

Outer div: `opacity: entered ? 1 : 0`, `transform: entered ? 'translateY(0)' : 'translateY(4px)'`, `transition: 'all 150ms ease'`

#### 3f. Context Menus — add exit animation

`NodeContextMenu.tsx` and `CanvasContextMenu.tsx` use `ctx-menu-enter` for entrance. Add exit:

```tsx
const [exiting, setExiting] = useState(false);

const handleClose = useCallback(() => {
  setExiting(true);
  setTimeout(() => onClose(), 120);
}, [onClose]);
```

Apply `ctx-menu-exit` class when exiting:
```tsx
className={`... ${exiting ? 'ctx-menu-exit' : 'ctx-menu-enter'}`}
```

Replace all `onClose` calls in click/escape handlers with `handleClose`.

### Step 4 — Add `ctx-menu-out` keyframe to `globals.css`

```css
@keyframes ctx-menu-out {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.95); }
}
.ctx-menu-exit {
  animation: ctx-menu-out 0.12s ease-in forwards;
}
```

---

## Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `App.tsx` | Split `initDb` effect; guard auth-gated calls with `isChatAuthenticated` and mode-specific auth flags |
| 2 | `components/agent-builder/WorkflowToolbar.tsx` | Restructure layout: 4 groups + vertical separators + `flex-1` spacer; reduce icon/button sizes |
| 3 | `components/agent-builder/TemplateGallery.tsx` | Add fade/scale enter/exit animation via `animState` |
| 4 | `components/agent-builder/ShortcutOverlay.tsx` | Add fade/scale enter/exit; keep mounted during exit |
| 5 | `components/agent-builder/CommandPalette.tsx` | Add fade/scale enter/exit; focus after enter |
| 6 | `components/agent-builder/NodeSettingsPanel.tsx` | Add slide-in-from-right enter animation |
| 7 | `components/agent-builder/ExecutionPanel.tsx` | Add subtle fade-in on mount |
| 8 | `components/agent-builder/NodeContextMenu.tsx` | Add `ctx-menu-exit` on close with 120ms delay |
| 9 | `components/agent-builder/CanvasContextMenu.tsx` | Add `ctx-menu-exit` on close with 120ms delay |
| 10 | `src/globals.css` | Add `ctx-menu-out` keyframe + `.ctx-menu-exit` class |

## Execution Order

1. **Issue 1** (auth) — Fix first, functional bug causing console errors
2. **Issue 2** (header) — Fix second, visible UI defect
3. **Issue 3** (animations) — Fix last, polish/enhancement pass

## Verification

- **Issue 1:** Load app fresh (no session). Confirm no 401 in console. Unlock chat → confirm conversations load. Navigate to other modes → confirm their data loads after unlock.
- **Issue 2:** Resize browser to ~800px width. Confirm no overlapping elements. All buttons accessible and visually separated with clear group dividers.
- **Issue 3:** Open each popup (Template Gallery, Shortcuts, Command Palette, Node Settings, context menus). Confirm smooth fade-in on open and fade-out on close. No instant mount/unmount.
- **Final:** Run `npm run build` to verify no TypeScript or build errors.
