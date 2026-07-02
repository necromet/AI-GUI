# Plan: Add Deep-Link Routes for Stitch, RAG, and Plugin Agent

## Problem

Currently the experiment panels lack URL-based routing for specific conversations/projects:

- **RAG** only has `/experiments/rag` — no way to link to a specific conversation
- **Plugin Agent** only has `/experiments/plugin-agent` — same issue
- **Stitch** only has `/experiments/stitch` — no way to link to a specific project

Chat mode already has `/chat/:conversationId` with a `useEffect` that parses the URL and loads the conversation. The experiment panels need the same pattern.

When a user clicks a conversation in the sidebar, the URL should update to include the ID so that:
1. The URL is shareable/bookmarkable
2. Browser back/forward works
3. Page refresh restores the correct state

## Route Design

| Route | Purpose |
|-------|---------|
| `/experiments/rag` | New RAG conversation (empty state) |
| `/experiments/rag/:conversationId` | Load specific RAG conversation |
| `/experiments/plugin-agent` | New Agent conversation (empty state) |
| `/experiments/plugin-agent/:conversationId` | Load specific Agent conversation |
| `/experiments/stitch` | Stitch project list |
| `/experiments/stitch/:projectId` | Open specific Stitch project editor |

## Implementation

### Step 1: Add `:conversationId` routes for RAG and Agent in `App.tsx`

Add new `<Route>` entries alongside the existing base routes:

```tsx
<Route path="/experiments/rag/:conversationId" element={
  <RequireAuth isAuth={isExperimentsAuthenticated}>
    <div className="h-full relative">
      <RAGChatPanel ... conversationId={experimentConversationId} ... />
    </div>
  </RequireAuth>
} />
<Route path="/experiments/plugin-agent/:conversationId" element={
  <RequireAuth isAuth={isExperimentsAuthenticated}>
    <div className="h-full relative">
      <AgentChatPanel ... conversationId={experimentConversationId} ... />
    </div>
  </RequireAuth>
} />
```

### Step 2: Add `:projectId` route for Stitch in `App.tsx`

```tsx
<Route path="/experiments/stitch/:projectId" element={
  <RequireAuth isAuth={isExperimentsAuthenticated}>
    <div className="h-full overflow-auto p-0">
      <StitchPanel
        key={stitchResetKey}
        ...
        initialProjectId={/* from URL param */}
      />
    </div>
  </RequireAuth>
} />
```

### Step 3: Add URL-parsing `useEffect` for experiment conversations in `App.tsx`

Currently there's a `useEffect` (line ~758) that parses `/chat/:conversationId`. Add parallel logic for experiment routes:

```tsx
useEffect(() => {
  // Existing chat route handling...
  
  // RAG conversation route
  const ragMatch = location.pathname.match(/^\/experiments\/rag\/(\d+)$/);
  if (ragMatch) {
    const convId = parseInt(ragMatch[1], 10);
    if (convId !== experimentConversationId) {
      setExperimentConversationId(convId);
    }
  }
  
  // Agent conversation route
  const agentMatch = location.pathname.match(/^\/experiments\/plugin-agent\/(\d+)$/);
  if (agentMatch) {
    const convId = parseInt(agentMatch[1], 10);
    if (convId !== experimentConversationId) {
      setExperimentConversationId(convId);
    }
  }
  
  // Reset when on base experiment routes (no ID)
  if (location.pathname === '/experiments/rag' || location.pathname === '/experiments/plugin-agent') {
    if (experimentConversationId !== null) {
      setExperimentConversationId(null);
    }
  }
}, [location.pathname]);
```

**Critical fix**: The current effect at line 215 resets `experimentConversationId` to `null` on ANY `/experiments/` navigation. This must be changed to only reset when on the base routes (without an ID), otherwise direct links would lose their state.

### Step 4: Update sidebar `onSelectConversation` to navigate with ID

Currently (App.tsx ~813):
```tsx
onSelectConversation={async (id) => {
  await loadConversation(id);
  const conv = conversations.find(c => c.dbConversationId === id);
  if (conv?.type && conv.type !== 'chat') {
    setExperimentConversationId(id);
    navigate(`/experiments/${conv.type}`);
  } else {
    navigate(`/chat/${id}`);
  }
}}
```

Change to include the conversation ID in the URL:
```tsx
navigate(`/experiments/${conv.type}/${id}`);
```

### Step 5: Update `handleNewChat` for experiment mode

When creating a new chat in experiments mode, navigate to the base route (without ID):
```tsx
const handleNewChat = () => {
  setMessages([]);
  setInput('');
  setIsStreaming(false);
  setCurrentConversationId(null);
  if (isExperimentsMode) {
    navigate(`/experiments/${activeView}`);
    setExperimentConversationId(null);
  } else {
    navigate('/chat');
  }
};
```

### Step 6: Add `initialProjectId` prop to `StitchPanel`

StitchPanel currently manages its own `activeProject` state internally. To support deep-linking:

1. Add `initialProjectId?: string` prop to `StitchPanel`
2. On mount (or when `initialProjectId` changes), if set, find and activate that project
3. When a project is opened, update the URL to `/experiments/stitch/:projectId`

In `App.tsx`, extract the `:projectId` from the URL and pass it:
```tsx
const stitchProjectId = (() => {
  const match = location.pathname.match(/^\/experiments\/stitch\/([^/]+)$/);
  return match ? match[1] : undefined;
})();
```

In `StitchPanel.tsx`:
```tsx
useEffect(() => {
  if (initialProjectId && projects.length > 0 && !activeProject) {
    const project = projects.find(p => p.id === initialProjectId);
    if (project) {
      setActiveProject(project);
      onProjectChange?.(project);
    }
  }
}, [initialProjectId, projects]);
```

When opening a project from the grid, also update the URL via a callback:
```tsx
onClick={() => {
  setActiveProject(project);
  onProjectChange?.(project);
  onNavigate?.(`/experiments/stitch/${project.id}`);
}}
```

### Step 7: Update StitchEditor "Back" to navigate correctly

The StitchEditor `onBack` callback currently just clears state. It should also navigate back to `/experiments/stitch`:

In App.tsx, update the StitchPanel's onProjectChange to handle navigation:
```tsx
onProjectChange={(project) => {
  setStitchActiveProject(project);
  if (project) {
    navigate(`/experiments/stitch/${project.id}`, { replace: true });
  } else {
    navigate('/experiments/stitch', { replace: true });
  }
}}
```

## Files Changed

| File | Change |
|------|--------|
| `App.tsx` | Add `:conversationId` routes for RAG/Agent, `:projectId` route for Stitch, URL-parsing effects, update sidebar navigation, fix experiment ID reset logic |
| `components/StitchPanel.tsx` | Add `initialProjectId` prop, auto-open project on mount, `onNavigate` callback for URL updates |

## Edge Cases

- **Invalid conversation ID in URL**: The `loadConversation` function will simply load no messages. The panel shows empty state — acceptable.
- **Invalid project ID in URL**: StitchPanel won't find the project, stays on list view — acceptable.
- **Browser back/forward**: The `useEffect` on `location.pathname` handles re-syncing state.
- **Direct URL access**: Works because the URL-parsing effects run on mount.
- **The current `experimentConversationId` reset bug** (line 215-217): Must be fixed or all deep links break immediately.
