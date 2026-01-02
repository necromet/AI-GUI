<div align="center">
<img src="banner/Banner BG.png" alt="AIUI Banner" width="100%" />

# AI User Interface for future purposes

*AI chat application powered by Google's Gemini API*

[![Electron](https://img.shields.io/badge/Electron-33.2.0-47848F?style=flat&logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-61DAFB?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-646CFF?style=flat&logo=vite)](https://vitejs.dev/)

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Database](#database-persistence) • [Development](#development) • [Building](#building)

</div>

---

## 📋 Overview

This is a modern, cross-platform AI chat interface that brings the power of Google's Gemini AI models to your desktop and browser. Built with React, TypeScript, and Electron, it offers a seamless chat experience with persistent conversation history, multiple model support, and a beautiful user interface.

## ✨ Features

- 🤖 **Multiple Gemini Models** - Support for various Gemini models including `gemini-2.5-flash-preview`
- 💬 **Persistent Chat History** - All conversations are automatically saved and organized
- 🖥️ **Cross-Platform** - Available as both a desktop app (Electron) and web app
- 🗄️ **Dual Database Support** - SQLite for desktop, IndexedDB for web
- 🎨 **Modern UI** - Clean, responsive interface built with React
- 📊 **Token Usage Tracking** - Monitor your API usage
- 🖼️ **Image Generation** - Support for AI image generation
- 📁 **Database Viewer** - Built-in tool to explore your chat database
- 🔒 **Local Storage** - Your data stays on your machine
- ⚡ **Fast & Responsive** - Powered by Vite for lightning-fast development

## 🚀 Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [Google Gemini API key](https://ai.google.dev/)

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd AI\ GUI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API Key** (for web version)
   - Create a `.env.local` file in the root directory
   - Add your Gemini API key:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```

## 💻 Usage

### Web Version (Browser)

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Desktop App (Electron)

Run in development mode:
```bash
npm run electron:dev
```

Build for production:
```bash
npm run electron:build
```

The built application will be in the `release/` directory.

## 🗄️ Database Persistence

This application supports dual database backends for optimal performance across platforms:

| Platform | Database | Storage Location |
|----------|----------|------------------|
| **Desktop (Electron)** | SQLite (better-sqlite3) | `~/.config/aiui/chat.db` |
| **Web Browser** | IndexedDB | Browser storage (per-domain) |

The database is automatically created on first run and handles all conversation persistence.

### 📊 Database Schema

The application uses three main tables/stores:

<details>
<summary><strong>1. Models Store</strong> - AI model configurations</summary>

```typescript
interface DBModel {
  model_id?: number;
  name: string;
  description: string | null;
  context_window_size: number | null;
  active: boolean;
}
```

Stores available Gemini models (e.g., `gemini-2.5-flash-preview-09-2025`).
</details>

<details>
<summary><strong>2. Conversations Store</strong> - Chat session metadata</summary>

```typescript
interface DBConversation {
  conversation_id?: number;
  title: string | null;
  model_id: number;
  created_at: string;
  updated_at: string;
}
```

Tracks all conversations with automatic timestamp management.
</details>

<details>
<summary><strong>3. Messages Store</strong> - Chat message content</summary>

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

Stores individual messages with role tracking and token counting.
</details>

### 🎯 Key Features

- ✅ **Automatic Persistence** - All conversations saved in real-time
- 📅 **Smart Organization** - Conversations grouped by time (Today, Yesterday, Last 7 Days, Older)
- 🗑️ **Cascade Delete** - Removing a conversation deletes all associated messages
- 🏷️ **Model Tracking** - Each conversation remembers which AI model was used
- ⏰ **Timestamp Tracking** - Automatic creation and update time recording
- 🔍 **Database Viewer** - Built-in tool to inspect and manage your data

### 💾 Data Management

**Browser (IndexedDB)**
- Database name: `ChatGPT_DB`
- Inspect: Browser DevTools → Application → IndexedDB
- Clear: Browser settings → Clear site data

**Desktop (SQLite)**
- Location: `~/.config/aiui/chat.db`
- View: Use any SQLite browser or the built-in database viewer
- Backup: Simply copy the `.db` file

For the complete SQL schema reference, see [schema.sql](schema.sql).

## 🏗️ Project Structure

```
AI GUI/
├── components/          # React components
│   ├── ChatMessage.tsx
│   ├── DatabaseViewer.tsx
│   ├── ModelSelect.tsx
│   ├── Settings.tsx
│   └── Sidebar.tsx
├── electron/           # Electron main process
│   ├── database.ts
│   ├── main.ts
│   └── preload.ts
├── services/           # Business logic
│   ├── databaseService.ts
│   ├── geminiService.ts
│   └── databaseAdapter.ts
├── App.tsx            # Main React app
├── types.ts           # TypeScript definitions
└── schema.sql         # Database schema
```

## 🛠️ Development

### Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Desktop**: Electron 33
- **Database**: SQLite (desktop), IndexedDB (web)
- **AI**: Google Gemini API
- **UI**: Lucide React icons, React Markdown, Syntax Highlighting

### Scripts

```bash
npm run dev              # Start web dev server
npm run build            # Build web version
npm run preview          # Preview production build
npm run electron:dev     # Start Electron in dev mode
npm run electron:build   # Build Electron app for production
```

### Adding New Features

1. **New Components**: Add to `components/` directory
2. **Database Changes**: Update `schema.sql` and type definitions in `types.ts`
3. **Services**: Add business logic to `services/` directory
4. **Electron Features**: Modify `electron/main.ts` and `electron/preload.ts`

## 📦 Building

### Desktop Application

Build for your platform:

```bash
npm run electron:build
```

Outputs:
- **Linux**: AppImage and .deb in `release/`
- **Windows**: Portable .exe (configure in package.json)
- **macOS**: .dmg and .zip (configure in package.json)

### Web Application

Build for deployment:

```bash
npm run build
```

The built files will be in the `dist/` directory. Deploy to any static hosting service.

## 🔧 Configuration

### Electron Builder

Configure build targets in [package.json](package.json) under the `build` key:

```json
{
  "build": {
    "appId": "com.aiui.app",
    "productName": "AI UI",
    "linux": { "target": ["AppImage", "deb"] },
    "win": { "target": ["portable"] },
    "mac": { "target": ["dmg", "zip"] }
  }
}
```

### Vite Configuration

Customize build and dev settings in [vite.config.ts](vite.config.ts).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source. Please add your license information.

## 🙏 Acknowledgments

- [Google Gemini API](https://ai.google.dev/) - AI capabilities
- [Electron](https://www.electronjs.org/) - Desktop framework
- [React](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool

