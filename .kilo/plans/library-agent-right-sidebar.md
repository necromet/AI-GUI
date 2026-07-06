# Library Agent: Right Sidebar Chat

## Goal
Move the library agent chat from an inline collapsible Card to a right sidebar panel (340px), matching the StitchEditor sidebar pattern.

## Current State
- Agent chat is an inline `<Card>` between header and search/filter (lines 916-985)
- Toggled by `showAgent` state via Agent button in header
- Contains: header, ScrollArea messages, input with send/abort
- Layout: single-column `flex flex-col` (line 877)

## Target State
- Agent chat becomes a right sidebar (340px, `flex-shrink-0`)
- Main content and sidebar sit side-by-side in a `flex row` container
- Sidebar has: header with close button, ScrollArea messages, input with send/abort
- Agent button still toggles visibility; sidebar state unchanged (`showAgent`)

## Changes — `components/LibraryPanel.tsx`

### 1. Restructure list view layout (line 876-877)
Change the outer wrapper from single-column to flex row:
```tsx
// Before
<div className="w-full max-w-5xl mx-auto flex flex-col gap-4 p-4">

// After
<div className="flex h-full w-full">
  <div className="flex-1 flex flex-col gap-4 p-4 overflow-y-auto max-w-5xl mx-auto">
    {/* existing header, search, grid content */}
  </div>
  {showAgent && (
    <div className="w-[340px] flex-shrink-0 flex flex-col h-full overflow-hidden"
         style={{ borderLeft: '1px solid var(--border-300)', backgroundColor: 'var(--bg-100)' }}>
      {/* agent sidebar */}
    </div>
  )}
</div>
```

### 2. Move agent chat Card into right sidebar
Remove the inline Card (lines 916-985) and place it in the right sidebar slot:

**Sidebar header:**
```tsx
<div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
     style={{ borderBottom: '1px solid var(--border-300)' }}>
  <Bot size={14} style={{ color: 'var(--neon-color)' }} />
  <span className="text-sm font-semibold flex-1" style={{ color: 'var(--text-100)' }}>
    Library Agent
  </span>
  <button onClick={() => setShowAgent(false)} className="..." style={{ color: 'var(--text-500)' }}>
    <X size={14} />
  </button>
</div>
```

**Messages area:** Same ScrollArea but with `flex-1` instead of `max-h-64` (fills available sidebar height).

**Input area:** Same input/send/abort, stays at bottom with `flex-shrink-0`.

### 3. No state changes needed
`showAgent`, `agentMessages`, `agentInput`, `isAgentStreaming`, `handleAgentSend`, `abortControllerRef` — all stay as-is. Only JSX structure moves.

## Files Modified
- `components/LibraryPanel.tsx` — restructure list view layout + move agent chat to sidebar

## No other files affected.
