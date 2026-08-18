# Plan: Promote Experiments Tools to Top-Level Modes

## Summary

Replace the single "Experiments" mode with three independent top-level modes: **RAG**, **Skema**, and **Python**. Drop the Plugin Agent tool entirely. Each new mode gets its own password-protected card in the ModeSelector and its own routing.

## Passwords (Psalm 23 themed)

| Mode   | Password                | Session Key                        |
|--------|-------------------------|------------------------------------|
| RAG    | `herestoresmysoul`      | `edward:labs_rag_session`          |
| Skema  | `pathsofrighteousness`  | `edward:labs_skema_session`        |
| Python | `mycuprunnethover`      | `edward:labs_python_session`       |

The old experiments password (`ilacknothing`) and session key (`edward:labs_experiments_session`) are removed.

---

## Files to Change

### 1. `types.ts`
- `Mode`: replace `'experiments'` with `'rag' | 'skema' | 'python'`
- `ConversationType`: remove `'plugin-agent'`
- `ChatSession.type`: remove `'plugin-agent'`

### 2. `components/ModeSelector.tsx`
- Remove `EXPERIMENTS_PASSWORD`, `isExperimentsAuthenticated`, `onSelectExperiments`, `onUnlockExperiments` props
- Add 3 new password constants: `RAG_PASSWORD`, `SKEMA_PASSWORD`, `PYTHON_PASSWORD`
- Add 3 new auth/select/unlock prop pairs for rag, skema, python
- Replace the single "Experiments" card with 3 cards: RAG (Database icon), Skema (Layers icon), Python (Terminal icon)
- Add 3 corresponding password modals
- Grid changes from `lg:grid-cols-5` to `lg:grid-cols-4` (7 cards = 4+3 layout)
- Icons: RAG = `FileSearch` or `BookOpen`, Skema = `Layers`, Python = `Terminal`

### 3. `App.tsx`
- **Auth state**: Remove `isExperimentsAuthenticated`. Add `isRagAuthenticated`, `isSkemaAuthenticated`, `isPythonAuthenticated` (each reading from its session key)
- **Mode detection**: Remove `isExperimentsMode`. Add `isRagMode` (`/rag`), `isSkemaMode` (`/skema`), `isPythonMode` (`/python`)
- **currentMode**: Update to use new modes instead of `'experiments'`
- **activeView**: Remove `'plugin-agent'` from the union. Simplify — each mode is now top-level, so activeView is derived from the mode itself
- **Routes**: 
  - Remove `/experiments` redirect and all `/experiments/*` routes
  - Remove `/experiments/plugin-agent` routes
  - Add `/rag`, `/rag/:conversationId`
  - Add `/skema`, `/skema/:projectId`
  - Add `/python`, `/python/:projectId`
- **skemaProjectId regex**: change `/experiments/skema/` → `/skema/`
- **pythonProjectId regex**: change `/experiments/python/` → `/python/`
- **filteredConversations**: Update to filter by `'rag'` type when in rag mode, `'skema'` type when in skema mode
- **handleNewChat**: Update navigation from `/experiments/${activeView}` to the appropriate top-level route
- **handleSkemaProjectChange**: Update navigate paths from `/experiments/skema/...` to `/skema/...`
- **ModeSelector props**: Pass new rag/skema/python auth/select/unlock handlers
- **Top bar**: Update conditionals from `/experiments/skema` to `/skema`
- **Conversation routing**: Update `onSelectConversation` to route rag/skema conversations to `/rag/...` and `/skema/...` instead of `/experiments/...`
- **Sidebar**: Remove `experiments`-related sidebar controls, update mode badge text

### 4. `components/Sidebar.tsx`
- **Imports**: Remove `Bot` icon (used for plugin-agent), keep others
- **TOOL_ITEMS / ToolGroup**: Remove entirely (no longer needed — each mode is top-level)
- **activeView**: Remove `'plugin-agent'` from union. Simplify to just detect rag/skema/python/chat
- **currentMode detection**: Replace `isExperimentsMode` with `isRagMode`, `isSkemaMode`, `isPythonMode`
- **Sidebar content for new modes**:
  - RAG mode: Show "New chat" button + conversation history (same as current experiments/rag)
  - Skema mode: Show canvas sidebar controls when a project is open, otherwise show a placeholder
  - Python mode: Show a placeholder (Python panel manages its own sidebar)
- **Badge text**: Update from 'Lab' to show mode-specific text ('RAG', 'Skema', 'Python')
- **AgentBuilderSidebarContent**: Remove entirely (was for plugin-agent only)

### 5. `services/apiDatabaseAdapter.ts`
- Remove `'plugin-agent'` from type unions in `getConversationsByType` and `createConversation`

### 6. `components/AgentChatPanel.tsx`
- Remove or update the `'plugin-agent'` conversation type reference (line 92). Since plugin-agent is being dropped, this component is no longer used in routes — leave the file but it won't be reachable.

---

## Verification

1. Run `npm run build` to confirm no TypeScript errors
2. Verify ModeSelector shows 7 cards: Chat, RAG, Skema, Python, Library, Database, Agent Builder
3. Verify each new mode requires its own password
4. Verify `/rag`, `/skema`, `/python` routes load their respective panels
5. Verify old `/experiments/*` routes no longer exist (404 → redirect to `/`)
6. Verify sidebar shows appropriate content for each new mode
7. Verify skema project URLs work: `/skema/:projectId`
8. Verify python project URLs work: `/python/:projectId`
