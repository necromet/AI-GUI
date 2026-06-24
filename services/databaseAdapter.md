# Database Adapter

A thin pass-through layer over `databaseService.ts` (IndexedDB). All functions delegate directly to the IndexedDB service.

## Function Categories

### Model Operations
- `getModels()` — Fetch active models
- `getAllModels()` — Get all models (including inactive)
- `getModelById()` / `getModelByName()` — Search models
- `addModel()` — Create new model
- `updateModel()` — Not supported (throws)
- `deleteModel()` / `deactivateModel()` — Remove/deactivate models

### Conversation Operations
- `getConversations()` — Fetch all conversations
- `getConversationById()` — Get specific conversation
- `createConversation()` — Start new chat
- `updateConversationTitle()` — Rename conversation
- `deleteConversation()` — Remove conversation

### Message Operations
- `getMessagesByConversation()` — Get chat messages
- `addMessage()` — Save new message (maps `model` role → `assistant`)
- `deleteMessage()` — Remove single message
- `clearConversationMessages()` — Clear entire chat

### Token Stats
- `getOverallTokenStats()` / `getTokenStatsByModel()` / `getTokenStatsByDate()` / `getTokenStatsByConversation()`

### Helpers
- `getNextMessageOrder()` — Sequence number for next message
- `getDatabase()` — Raw IndexedDB handle
