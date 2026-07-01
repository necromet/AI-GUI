# edward:labs

AI chat web app powered by the Xiaomi MiMo API.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (CDN)
- **Backend**: Express (Node.js)
- **AI**: Xiaomi MiMo API
- **Storage**: IndexedDB (via `idb`)
- **Deployment**: Docker (nginx + Express containers)

## Features

- Chat with MiMo models (streaming completions)
- TTS / ASR / Voice design / Voice clone panels
- RAG experiments (embeddings + retrieval)
- Agent plugin system
- Stitch visual design editor (Fabric.js canvas, HTML + image generation)
- Persistent conversations in IndexedDB
- Token usage tracking and charts
- Neon theme customization

## Getting Started

### Prerequisites

- Node.js v18+
- A Xiaomi MiMo API key (or token-plan key)

### Environment Variables

Create a `.env` file in the project root:

```env
MIMO_API_KEY=your_token_plan_key
MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1
MIMO_DIRECT_API_KEY=your_direct_api_key
MIMO_DIRECT_BASE_URL=https://api.xiaomimimo.com/v1
OPENAI_API_KEY=your_openai_key          # optional, for Stitch image generation
```

### Install & Run

```bash
npm install
npm run dev          # Vite dev server → localhost:5173
npm run dev:server   # Express API server → localhost:3001
npm run dev:all      # Run both concurrently
```

### Build

```bash
npm run build        # Production build → dist/
npm run preview      # Preview the production build
```

## Docker

```bash
npm run docker:build   # Build images
npm run docker:up      # Start containers (frontend:80, backend:3001)
npm run docker:down    # Stop containers
npm run docker:logs    # Tail container logs
```

## Architecture

```
Client (React + Vite)
  → Express API server (port 3001)
    → Xiaomi MiMo API
    → OpenAI API (Stitch image gen)

IndexedDB (browser) ← databaseAdapter ← databaseService
```

### Key Directories

| Path | Description |
|------|-------------|
| `components/` | React UI components |
| `services/` | Client-side API and DB adapters |
| `server/` | Express backend (routes, services) |
| `lib/` | Shared utilities (`cn`, etc.) |
| `docs/` | Documentation |

### Model Routing

Model IDs are prefixed to determine the UI panel:

| Prefix | Panel |
|--------|-------|
| `mimo-v2.5-tts` | TTS |
| `mimo-v2.5-tts-voicedesign` | Voice Design |
| `mimo-v2.5-tts-voiceclone` | Voice Clone |
| `mimo-v2.5-asr` | ASR |
| Everything else | Chat |

## License

Private project.
