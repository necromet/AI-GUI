# Database Adapter - Summary & Explanation

## Overview
The **databaseAdapter.ts** is a bridge layer that enables the application to work with different database systems depending on the runtime environment. It acts as a smart router that automatically detects whether the app is running in Electron (desktop) or web mode, then directs database operations to the appropriate backend.

---

## Simple Explanation

Think of databaseAdapter as a **universal translator** for your app:
- **Electron mode** → Uses SQLite (real files on your computer)
- **Web mode** → Uses IndexedDB (browser storage)

The adapter automatically detects which environment you're in and sends database requests to the right place, so the rest of your app doesn't need to know which database system is being used.

---

## Key Features

### 1. **Environment Detection**
```typescript
const isElectron = () => typeof window !== 'undefined' && window.electron !== undefined;
```
- Checks if `window.electron` exists at runtime
- Returns `true` for Electron app, `false` for web browser

### 2. **Automatic Routing**
Every database function follows this pattern:
```
if (Electron) → use window.electron.method()
else → use IndexedDB method()
```

---

## Function Categories

### **Model Operations**
- `getModels()` - Fetch active models
- `getAllModels()` - Get all models (including inactive)
- `getModelById()` / `getModelByName()` - Search models
- `addModel()` - Create new model
- `updateModel()` - Modify model details
- `deleteModel()` / `deactivateModel()` - Remove models

### **Conversation Operations**
- `getConversations()` - Fetch all conversations
- `getConversationById()` - Get specific conversation
- `createConversation()` - Start new chat
- `updateConversationTitle()` - Rename conversation
- `deleteConversation()` - Remove conversation

### **Message Operations**
- `getMessagesByConversation()` - Get chat messages
- `addMessage()` - Save new message (with role: user/assistant/system)
- `deleteMessage()` - Remove single message
- `clearConversationMessages()` - Clear entire chat

### **Helper Functions**
- `getNextMessageOrder()` - Get sequence number for next message
- `getDatabase()` - Access database instance (web mode only)

---

## How It Works - Example Flow

**When you send a chat message:**

1. App calls `addMessage(conversationId, 'user', 'Hello', 1)`
2. Adapter checks: Is this Electron?
   - **YES** → Calls `window.electron.addMessage({...})` → Stored in SQLite
   - **NO** → Calls `idbService.addMessage(...)` → Stored in browser IndexedDB
3. Message is saved and returned to your app
4. App doesn't care which database was used - it just works!

---

## Why This Design?

| Aspect | Electron | Web |
|--------|----------|-----|
| **Database** | SQLite (file-based) | IndexedDB (browser storage) |
| **Persistence** | Permanent files on disk | Browser session/storage |
| **Access Method** | IPC (Inter-Process Communication) | Direct JavaScript API |
| **Use Case** | Desktop app | Browser/Progressive Web App |

The adapter lets one codebase support both!

---

## Note on Limitations

Some operations have limitations in web mode:
- `updateModel()` throws an error in web mode (not supported in IndexedDB)
- `clearConversationMessages()` must manually delete messages one-by-one in web mode

These are design constraints of IndexedDB compared to a full SQL database.
