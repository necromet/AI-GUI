# edward:labs

AI chat web app powered by the Xiaomi MiMo API.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (CDN, configured in `index.html`)
- **Backend**: Express 5 (Node.js)
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

---

## Getting Started (After Pulling / Cloning)

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Your `.env` File

This file is **not committed** to the repo (it's in `.gitignore`). You must create it manually.

```bash
cp .env.example .env
```

Then edit `.env` and fill in your API keys:

```env
MIMO_API_KEY=your_token_plan_key           # required — token-plan MiMo key
MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1
MIMO_DIRECT_API_KEY=your_direct_api_key     # required — direct MiMo key
MIMO_DIRECT_BASE_URL=https://api.xiaomimimo.com/v1
OPENAI_API_KEY=your_openai_key              # optional — needed for Stitch image generation
SERVER_PORT=3001                            # optional — backend port (default: 3001)
```

> **Without a valid `.env`, the app will not connect to any AI backend.**

### 3. Run the App

The app has two servers — the Vite frontend and the Express API backend. For full functionality (chat, TTS, ASR, agent, stitch), **both must be running**.

```bash
# Option A: Run both concurrently (recommended)
npm run dev:all

# Option B: Run in separate terminals
npm run dev:server   # Terminal 1 — Express API on localhost:3001
npm run dev          # Terminal 2 — Vite frontend on localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. (Optional) Production Build

```bash
npm run build        # Output → dist/
npm run preview      # Preview the production build locally
```

### 5. (Optional) Docker

```bash
# Create .env first (same as step 2)
npm run docker:build   # Build images
npm run docker:up      # Start containers (frontend on :80, backend on :3001)
npm run docker:logs    # Tail logs
npm run docker:down    # Stop containers
```

> The Docker backend copies `.env.example` into the image — you still need a `.env` in the project root at build time.

---

## Architecture

```
Client (React + Vite, localhost:5173)
  → Express API server (localhost:3001)
    → Xiaomi MiMo API
    → OpenAI API (Stitch image gen)

IndexedDB (browser) ← databaseAdapter ← databaseService
```

### Key Directories

| Path | Description |
|------|-------------|
| `components/` | React UI components |
| `services/` | Client-side API and DB adapters |
| `server/` | Express backend (routes, services, DB) |
| `lib/` | Shared utilities (`cn`, layout, stitch renderer) |
| `types/` | TypeScript type definitions |

### Model Routing

Model IDs are prefixed to determine the UI panel:

| Prefix | Panel |
|--------|-------|
| `mimo-v2.5-tts-voicedesign` | Voice Design |
| `mimo-v2.5-tts-voiceclone` | Voice Clone |
| `mimo-v2.5-tts` | TTS |
| `mimo-v2.5-asr` | ASR |
| Everything else | Chat |

### Tailwind Configuration

Tailwind is loaded via CDN in `index.html` — there is **no** `tailwind.config.js` or PostCSS config. Theme customization (colors, animations, fonts) lives in the `<script>` tag in `index.html`.

### Environment Variables

Variables are injected at build time via Vite's `define` option (not `import.meta.env`). Services read `process.env.*` directly. The server loads `.env` manually (no `dotenv`).

---

## License

Private project.
