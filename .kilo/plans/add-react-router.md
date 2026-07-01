# Plan: Add React Router for Chat and Experiments Routes

## Goal

Replace the `currentMode` state-based navigation with proper URL routing using React Router v6. Each page (selector, chat, experiments) gets its own route, and individual conversations are linkable via `/chat/:conversationId`.

## Route Structure

| Route | Description |
|-------|-------------|
| `/` | Mode selector (landing page) |
| `/chat` | Chat mode — empty state / new chat |
| `/chat/:conversationId` | Specific conversation |
| `/experiments` | Redirects to `/experiments/rag` |
| `/experiments/rag` | RAG tool |
| `/experiments/plugin-agent` | Plugin Agent tool |
| `/experiments/stitch` | Stitch tool |

## Steps

### 1. Install react-router-dom

```bash
npm install react-router-dom
```

Add `@types/react-router-dom` if needed (v6 includes types).

### 2. Update `vite.config.ts` — change `base` from `'./'` to `'/'`

BrowserRouter requires absolute asset paths. With `base: './'`, assets break when navigating to nested routes like `/chat/123` (browser looks for `/chat/assets/...`). The nginx config already serves from root.

### 3. Update `index.tsx` — wrap App with BrowserRouter

```tsx
import { BrowserRouter } from 'react-router-dom';

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

### 4. Refactor `App.tsx` — replace state-based mode/view with routes

**Remove these state variables:**
- `currentMode` (line 52) — derive from `useLocation()`
- `activeView` (line 97) — derive from `useLocation()`

**Remove these effects:**
- `useEffect` that syncs `activeView` on mode change (lines 184-190)
- `useEffect` that closes sidebar on stitch view (lines 192-196) — move to StitchPanel or handle via route

**Add route-aware hooks:**
- `useLocation()` to derive current mode/view from URL
- `useNavigate()` to replace `setCurrentMode()` / `setActiveView()` calls
- `useParams()` to read `conversationId`

**Derived state helper:**
```ts
const location = useLocation();
const isChatMode = location.pathname.startsWith('/chat');
const isExperimentsMode = location.pathname.startsWith('/experiments');
const isSelector = location.pathname === '/';
```

**Render structure:**
```tsx
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';

// Inside App:
if (isSelector) {
  return <ModeSelector ... />;  // or wrap in a Route element
}

// Main layout with sidebar + content
<Routes>
  <Route path="/chat" element={<ChatView />} />
  <Route path="/chat/:conversationId" element={<ChatView />} />
  <Route path="/experiments" element={<Navigate to="/experiments/rag" replace />} />
  <Route path="/experiments/rag" element={<RAGPanel />} />
  <Route path="/experiments/plugin-agent" element={<PluginAgentPanel />} />
  <Route path="/experiments/stitch" element={<StitchPanel />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

Note: The `<ChatView />` and experiment routes are **not** separate extracted components — they reuse the existing inline JSX from App.tsx, just wrapped in route elements. This avoids a massive refactor while gaining URL routing.

**Key changes to functions:**
- `handleNewChat()` → navigate to `/chat` after resetting state
- `loadConversation(id)` → navigate to `/chat/${id}` after loading messages
- `onBackToSelector` → navigate to `/`
- `onNavigate(view)` → navigate to `/experiments/${view}`

**Auth guards:**
Create a small inline guard or wrapper:
```tsx
const RequireAuth = ({ isAuth, children }: { isAuth: boolean; children: React.ReactNode }) => {
  if (!isAuth) return <Navigate to="/" replace />;
  return <>{children}</>;
};
```

Wrap `/chat/*` routes with `<RequireAuth isAuth={isChatAuthenticated}>` and `/experiments/*` with `<RequireAuth isAuth={isExperimentsAuthenticated}>`.

### 5. Update `ModeSelector.tsx` — navigate on success

Change `onSelectChat` / `onSelectExperiments` callbacks to use `useNavigate`:
- `onSelectChat` → `navigate('/chat')`
- `onSelectExperiments` → `navigate('/experiments')`

Or keep callbacks as props and have App.tsx pass navigate-based callbacks.

### 6. Update `Sidebar.tsx` — use router navigation

- Import `useNavigate` from react-router-dom
- `onBackToSelector` → `navigate('/')`
- `onNavigate('rag')` → `navigate('/experiments/rag')`
- `onNavigate('plugin-agent')` → `navigate('/experiments/plugin-agent')`
- `onNavigate('stitch')` → `navigate('/experiments/stitch')`
- Conversation clicks → `navigate('/chat/${id}')`

The Sidebar can use `useNavigate` directly since it's always rendered inside `<BrowserRouter>`.

Remove `onBackToSelector` and `onNavigate` props — replace with direct `useNavigate` calls. Keep `onSelectConversation` as a prop since it also needs to load messages from DB.

### 7. Update `types.ts` — Mode type can stay for now

The `Mode` type is still useful for the sidebar badge and other UI that needs to know the high-level mode. It can be derived from the URL rather than stored in state.

### 8. Handle browser back/forward

Since state like `messages`, `currentConversationId` is managed in React state (not URL), we need to handle `popstate` events. When the user navigates back to `/chat/5`, we need to load conversation 5.

Solution: Add a `useEffect` that watches `location.pathname` and loads the appropriate conversation when navigating via browser back/forward:

```tsx
useEffect(() => {
  const match = location.pathname.match(/^\/chat\/(\d+)$/);
  if (match) {
    const convId = parseInt(match[1], 10);
    if (convId !== currentConversationId) {
      loadConversation(convId);
    }
  } else if (location.pathname === '/chat') {
    if (currentConversationId !== null) {
      handleNewChat();
    }
  }
}, [location.pathname]);
```

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `react-router-dom` dependency |
| `vite.config.ts` | Change `base: './'` → `base: '/'` |
| `index.tsx` | Wrap with `<BrowserRouter>` |
| `App.tsx` | Replace state-based routing with React Router; add `<Routes>`, auth guards, URL-synced effects |
| `ModeSelector.tsx` | Navigate via router on mode selection |
| `Sidebar.tsx` | Use `useNavigate` for navigation; remove `onNavigate`/`onBackToSelector` props |
| `types.ts` | No changes needed (Mode type still useful) |
| `nginx/default.conf` | No changes needed (already has SPA fallback) |

## Risks / Considerations

- **`base: './'` → `base: '/'`**: If the app is deployed to a subdirectory (not root), this breaks asset loading. The nginx config serves from root, so this is fine for Docker deployment. If subdirectory deployment is needed later, use `<BrowserRouter basename="/subdir">`.
- **State persistence across navigation**: Messages and conversations are loaded from IndexedDB, so navigating back to a conversation will re-fetch from DB. This is correct behavior.
- **HMR / dev server**: Vite's dev server handles SPA routing automatically, no changes needed.
