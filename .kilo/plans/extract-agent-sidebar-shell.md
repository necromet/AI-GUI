# Plan: Extract reusable AgentSidebarShell from Canvas Agent & Library Agent sidebars

## Analysis

The two sidebars (`SkemaAgentSidebar` and `AgentSidebar`) are ~90% identical:

### Identical (can be shared)
- **SessionTabs** — session tab bar with dropdown menu, new/delete buttons (100% identical)
- **MessageList** — message list with `MessageBubble`/`EmptyState` (100% identical)
- **InputBar** — textarea, model picker, send/abort button (~95% identical; Skema has an extra streaming progress bar)
- **Resize logic** — `useEffect` for mouse-based col-resize (identical)
- **Auto-scroll**, copy code, collapse toggle callbacks (identical)
- **Aside shell** — `fixed md:relative`, `translate-x-0`/`translate-x-full`, transition classes (identical)

### Different (injected per-sidebar)
- **Header** — Skema: "Canvas Agent" with Sparkles icon; Library: "Librarian" with BookOpen, category badge, file count, undo/redo
- **Stream hook** — `useSkemaAgentStream` vs `useAgentStream` (different tool sets & APIs)
- **Session hook** — `useSkemaAgentSessions` vs `useAgentSessions` (different persistence endpoints)
- **Resize handle** — Skema has a collapse button inside the resize bar; Library doesn't
- **InputBar** — Skema shows a streaming progress line (`skema-ai-line`); Library doesn't

## Approach

Create a single `AgentSidebarShell` component that owns the shared UI shell and accepts the domain-specific pieces via props (render header, stream/session state).

### New file: `components/shared/AgentSidebarShell.tsx`

**Props interface:**
```ts
interface AgentSidebarShellProps {
  // Shell
  isOpen: boolean;
  onToggle: () => void;

  // Header (render prop — each sidebar provides its own header)
  header: React.ReactNode;

  // Sessions
  sessions: Array<{ id: string; title: string | null; createdAt: string; updatedAt: string }>;
  activeSessionId: string | null;
  onSwitchSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;

  // Messages
  messages: any[];
  taskStatuses: Record<string, string>;
  messagesEndRef: React.RefObject<HTMLDivElement>;

  // Input
  input: string;
  setInput: (v: string) => void;
  isStreaming: boolean;
  pendingAskUser: string | null;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onAbort: () => void;
  placeholder?: string;

  // Model picker
  models?: Array<{ id: string; name: string }>;
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;

  // Optional streaming progress bar (Skema uses this, Library doesn't)
  showStreamingBar?: boolean;
  streamingBarClassName?: string;

  // Optional collapse button in resize handle (Skema uses this)
  showCollapseButton?: boolean;
}
```

**Sub-components moved into this file:**
- `SessionTabs` (copied from either sidebar — they're identical)
- `MessageList` (copied from either sidebar — they're identical)
- `InputBar` (with optional `showStreamingBar` prop)

**Internal hooks/state:**
- `width` / `isResizing` state + resize `useEffect` (moved here)
- `collapsedCodeBlocks` / `copiedCode` + `toggleCodeBlock` / `handleCopyCode` / `handleToggleCollapse` (moved here)

### Refactored: `components/skema/SkemaAgentSidebar.tsx`

Becomes a thin wrapper:
1. Calls `useSkemaAgentStream(...)` → gets `isStreaming`, `pendingAskUser`, `taskStatuses`, `handleSend: streamSend`, `handleAbort`, `resetAgentState`, `shouldAutoScrollRef`
2. Calls `useSkemaAgentSessions(...)` → gets `sessions`, `activeSessionId`, `handleSwitchSession`, `handleNewSession`, `handleDeleteSession`
3. Renders `<AgentSidebarShell>` with:
   - `header` = `<SkemaHeader isStreaming={isStreaming} onToggle={onToggle} />`
   - `showStreamingBar={true}`
   - `showCollapseButton={true}`
   - All other props wired from the hooks

### Refactored: `components/library/AgentSidebar.tsx`

Becomes a thin wrapper:
1. Calls `useAgentStream(...)` → gets stream state
2. Calls `useAgentSessions(...)` → gets session state
3. Renders `<AgentSidebarShell>` with:
   - `header` = `<LibraryHeader selectedComponent={...} categoryLabel={...} isStreaming={...} onToggle={...} onUndoAgent={...} ... />`
   - `showStreamingBar={false}`
   - `showCollapseButton={false}`
   - All other props wired from the hooks

## Files to create/modify

| File | Action |
|------|--------|
| `components/shared/AgentSidebarShell.tsx` | **Create** — shared shell with SessionTabs, MessageList, InputBar, resize logic |
| `components/skema/SkemaAgentSidebar.tsx` | **Rewrite** — thin wrapper using AgentSidebarShell + useSkemaAgentStream + useSkemaAgentSessions |
| `components/library/AgentSidebar.tsx` | **Rewrite** — thin wrapper using AgentSidebarShell + useAgentStream + useAgentSessions |

## Files NOT changed
- `components/library/agent/MessageBlocks.tsx` — already shared, stays as-is
- `components/library/agent/ModelPicker.tsx` — already shared, stays as-is
- `components/library/agent/AgentMarkdown.tsx` — already shared, stays as-is
- `components/skema/agent/useSkemaAgentStream.ts` — stays as-is
- `components/skema/agent/useSkemaAgentSessions.ts` — stays as-is
- `components/library/agent/useAgentStream.ts` — stays as-is
- `components/library/agent/useAgentSessions.ts` — stays as-is
- `components/skema/agent/types.ts` — stays as-is
- `components/library/agent/types.ts` — stays as-is

## Verification
- `npm run build` must pass
- Both sidebars render identically to before
