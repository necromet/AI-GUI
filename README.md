<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1O9JV_9VX0xyHwLBW98bj2Dg2rOyIWOBX

## Run Locally

**Prerequisites:**  Node.js

### Web Version (Browser)

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

### Desktop App (Electron)

1. Install dependencies:
   `npm install`
2. Run the Electron app:
   `npm run electron:dev`
3. Build the desktop app:
   `npm run electron:build`

The Electron version uses **SQLite** for data persistence instead of IndexedDB, providing better performance and reliability for desktop usage.

## Database Persistence

This app supports two database backends:

- **Web Version**: Uses IndexedDB (browser-native database)
- **Electron Version**: Uses SQLite (better-sqlite3) with the database stored at `~/.config/geminigpt/chat.db`

The database is automatically created when you first run the app.

### Database Schema

The application uses three main object stores (tables):

#### 1. Models Store
Stores AI model configurations (e.g., `gemini-2.5-flash-preview-09-2025`).

```typescript
interface DBModel {
  model_id?: number;
  name: string;
  description: string | null;
  context_window_size: number | null;
  active: boolean;
}
```

#### 2. Conversations Store
Stores chat session metadata with automatic timestamp tracking.

```typescript
interface DBConversation {
  conversation_id?: number;
  title: string | null;
  model_id: number;
  created_at: string;
  updated_at: string;
}
```

#### 3. Messages Store
Stores message content with role-based tracking (`user`, `assistant`, `system`).

```typescript
interface DBMessage {
  message_id?: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_order: number;
  timestamp: string;
  token_count: number | null;
}
```

### Features

- **Automatic Persistence**: All conversations and messages are automatically saved to IndexedDB
- **Conversation History**: Browse past conversations grouped by time (Today, Yesterday, Last 7 Days, Older)
- **Delete Conversations**: Remove unwanted conversations (cascades to delete all associated messages)
- **Model Tracking**: Each conversation remembers which AI model was used
- **Timestamps**: Automatic tracking of creation and update times
- **Browser Storage**: Data persists in your browser's IndexedDB (per-domain storage)

### Database Location

The database is stored in your browser's IndexedDB under the name `ChatGPT_DB`. You can:
- Inspect it using browser DevTools (Application > IndexedDB)
- Clear it by clearing browser data for this site
- Export/backup conversations using browser tools

IndexedDB provides:
- ✅ **Fast performance** - Native browser API
- ✅ **Async operations** - Non-blocking database calls
- ✅ **Large storage** - Can store significant amounts of data
- ✅ **Indexed queries** - Fast lookups by conversation, date, etc.

For the original SQL schema reference, see [schema.sql](./schema.sql).

