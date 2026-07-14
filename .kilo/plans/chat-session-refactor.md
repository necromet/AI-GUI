# Plan: Extract ChatSessionPage for Per-Session Message Rendering

## Root Cause

The word-stream animation re-animates because **all chat messages share a single `messages` state at the App level** (`App.tsx:189`). During streaming:

1. `setMessages(prev => prev.map(msg => ...))` creates new object references for **every** message
2. `ChatMessageList` (`React.memo`) receives a new `messages` array → re-renders all children
3. Each `ChatMessage` (`React.memo`) gets a new `message` object → always re-renders
4. `MarkdownRenderer` gets a new `content` string → ReactMarkdown re-parses
5. The custom `p` renderer returns new `<motion.span>` React elements
6. Even with stable keys (`wb-0`), React sees **new element objects** inside a **new render function closure**, creating new fibers → Framer Motion loses animation state → re-plays

## Fix: Extract a ChatSessionPage Component

Create a standalone component scoped to a single session that owns its own `messages` and `isStreaming` state. This isolates the React fiber tree so streaming updates don't cascade through the App-level tree.

### Before (current):
```
App.tsx
  ├── messages state (shared across ALL chat routes)
  ├── isStreaming
  ├── ChatMessageList (React.memo)
  │   └── ChatMessage (React.memo) ← gets new message object each stream flush
  │       └── MarkdownRenderer
  │           └── motion.span ← new fiber each time → re-animates
  └── ChatMessageList (same state, different route)
```

### After:
```
App.tsx
  ├── <Route path="/chat" element={<ChatSession />} />
  └── <Route path="/chat/:conversationId" element={<ChatSession />} />

ChatSession
  ├── useParams().conversationId → load/save messages
  ├── messages state (scoped to this session)
  ├── isStreaming state
  └── ChatMessageList
      └── ChatMessage (React.memo) ← stable identity across stream flushes
          └── MarkdownRenderer
              └── motion.span ← same fiber → Framer Motion preserves animation state
```

### Architecture Changes

#### New file: `components/ChatSession.tsx`

Extracts from App.tsx:
- `messages`, `setMessages` state
- `isStreaming`, `setIsStreaming` state
- `currentConversationId` ← from `useParams`
- `chatRouteElement` logic (TTS/ASR panels when non-chat model)
- `loadConversation` → loads from IndexedDB on mount
- `handleSendMessage` → streaming logic
- `handleRegenerate` → regeneration logic
- `handleFeedback` → feedback logic
- `handleReattach` → reattach logic
- `processStreamResponse` → moved inline or imported
- `ChatMessageList` component → moved inside or imported
- `<PromptInputBox>` → input area
- Conversations list from sidebar remains in App.tsx

**Props**:
```ts
interface ChatSessionProps {
  modelConfig: ModelConfig;
  models: ModelConfig[];
  theme: 'dark' | 'light';
  maxOutputTokens?: number;
  onConversationChange?: (id: number | null) => void;
}
```

#### App.tsx changes:

Replace the current chat route content with `<ChatSession />`:

```tsx
<Route path="/chat" element={
  <RequireAuth isAuth={isChatAuthenticated}>
    {chatRouteElement || <ChatSession ... />}
  </RequireAuth>
} />
<Route path="/chat/:conversationId" element={
  <RequireAuth isAuth={isChatAuthenticated}>
    {chatRouteElement || <ChatSession ... />}
  </RequireAuth>
} />
```

The `chatRouteElement` (TTS/ASR panels) stays because those are non-chat-model panels that don't use messages.

## Migration Strategy

1. **Create `components/ChatSession.tsx`** — Extract message state, streaming, loadConversation, handleSendMessage, handleRegenerate, ChatMessageList, PromptInputBox
2. **Update `App.tsx`** — Replace inline chat route content with `<ChatSession />`
3. **Remove `messages`, `isStreaming`, `currentConversationId` from App.tsx** — No longer needed there
4. **Verify build** — Ensure all imports resolve, types match

## What Stays in App.tsx

- `experimentConversationId` + `experimentConversationId` state (RAG/Agent routes already have per-panel state)
- `conversations` + `loadConversations` (sidebar needs it)
- `handleNewChat` (sets `currentConversationId` to null — now done inside ChatSession)
- Authentication state
- Sidebar rendering
- All experiment panel routes (RAG, Agent, Stitch, Library)
- `useParams` for stitch routes (already handled in StitchPanel)
