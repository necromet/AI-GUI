# Vercel Deployment Plan — edward:labs

## Summary

Deploy the edward:labs frontend (React SPA) to **Vercel** at `app.edwardrenaldi.xyz`. The Express 5 backend and PostgreSQL database **cannot** run on Vercel (serverless platform) — they must be hosted separately. This plan covers architecture, DNS, environment variables, backend hosting options, and the subdomain question.

---

## Can You Deploy to `app.edwardrenaldi.xyz` If Other Instances Run on `edwardrenaldi.xyz`?

**Yes.** Vercel supports multiple projects under the same apex domain using subdomains. Each Vercel project gets its own domain assignment:

| Domain | Vercel Project | Serves |
|--------|---------------|--------|
| `edwardrenaldi.xyz` | Existing project(s) | Whatever is currently deployed |
| `app.edwardrenaldi.xyz` | **edward:labs (this project)** | AI chat app |

Once `edwardrenaldi.xyz` is added to your Vercel account (Settings → Domains), any subdomain (`app.*`, `api.*`, `staging.*`) can be assigned to any project within that same team/account. Multiple subdomains across multiple projects is a standard Vercel pattern.

**Prerequisite:** The apex domain `edwardrenaldi.xyz` must be added to your Vercel dashboard. If another team/person owns it on Vercel, you'll need them to add the subdomain or transfer domain ownership.

---

## Why Not Full-Stack on Vercel?

The Express backend is fundamentally incompatible with Vercel's serverless model:

| Requirement | Vercel Serverless | Verdict |
|-------------|-------------------|---------|
| Express 5 middleware chain | Requires rewrite to Vercel Functions | Too much work |
| SSE streaming (chat, agent loops) | 10s timeout on Hobby, 300s on Pro | Risky for long agent loops |
| Persistent `pg.Pool` connections | Serverless can't hold connections | Won't work |
| File uploads via `multer` | No persistent filesystem | Won't work |
| `vm.runInNewContext` (execute_code) | Blocked on Vercel | Won't work |
| `tsx` runtime with top-level `await` | Vercel uses its own Node runtime | Needs rewrite |
| Background processes (OpenCode sidecar) | Not supported | Won't work |

**Conclusion:** Deploy only the frontend to Vercel. Host the backend separately.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  app.edwardrenaldi.xyz (Vercel)                                      │
│                                                                      │
│  Static SPA (Vite build → dist/)                                     │
│  ├── index.html + JS/CSS chunks                                     │
│  ├── vercel.json → SPA fallback + API proxy                         │
│  └── /api/* → rewrites to backend host                              │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS rewrite (Vercel Edge)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Express Backend (Railway / Render / Fly.io / VPS)                   │
│  ├── Express 5 server on port 3001                                  │
│  ├── PostgreSQL at 13.140.162.178:5432 (edlab)                      │
│  └── SSE streaming, agent loops, file uploads, RAG, etc.            │
└─────────────────────────────────────────────────────────────────────┘
```

All client API calls use relative paths (`const API_BASE = '/api'`), so Vercel's rewrite rules transparently proxy them to the backend. **No client code changes required.**

---

## Step 1: Backend Hosting

Choose one of these options for the Express backend:

### Option A: Railway (Recommended)

- Native Node.js support, persistent processes, built-in PostgreSQL
- Dockerfile-based deployment (uses existing `Dockerfile.backend`)
- SSE streaming works out of the box
- ~$5/month for hobby tier

**Setup:**
1. Connect GitHub repo to Railway
2. Create new project → Deploy from `Dockerfile.backend`
3. Set environment variables (see Step 3)
4. Railway assigns a URL like `edward-labs-backend.up.railway.app`

### Option B: Render

- Free tier available (spins down after inactivity — bad for SSE)
- Persistent web service: ~$7/month
- Dockerfile deployment supported

### Option C: Fly.io

- Dockerfile-based, persistent processes
- Free tier includes 3 shared VMs
- Good SSE support

### Option D: VPS (DigitalOcean, Hetzner, AWS EC2)

- Full control, ~$4-6/month
- Run `docker compose up` with existing `docker-compose.yml`
- Requires manual SSL/reverse proxy setup

**For any option**, the backend runs:
```bash
npx tsx server/index.ts
```
Or via Docker using `Dockerfile.backend`.

---

## Step 2: Vercel Project Setup

### 2a. Create `vercel.json` (project root)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-BACKEND-HOST/api/:path*"
    },
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/api/:path*",
      "headers": [
        { "key": "X-Accel-Buffering", "value": "no" },
        { "key": "Cache-Control", "value": "no-cache, no-store" }
      ]
    }
  ]
}
```

**Replace `YOUR-BACKEND-HOST`** with the actual backend URL (e.g., `edward-labs-backend.up.railway.app`).

**Important notes:**
- `X-Accel-Buffering: no` is critical — it prevents Vercel from buffering SSE streams
- The second rewrite is the SPA fallback — all non-API routes serve `index.html`
- The `headers` block ensures streaming responses aren't cached

### 2b. Vercel Project Configuration

In the Vercel dashboard:
1. **Framework Preset:** Vite (auto-detected)
2. **Build Command:** `npm run build` (auto-detected from `package.json`)
3. **Output Directory:** `dist` (auto-detected)
4. **Node.js Version:** 22.x (matches `Dockerfile.backend` and `package.json` engines)
5. **Root Directory:** `/` (project root)

### 2c. Domain Configuration

In Vercel dashboard → Project → Settings → Domains:
1. Add `app.edwardrenaldi.xyz`
2. Vercel will show DNS records to add:
   - **CNAME record:** `app` → `cname.vercel-dns.com`
3. Add the CNAME record at your DNS provider (where `edwardrenaldi.xyz` is managed)
4. Vercel auto-provisions SSL (Let's Encrypt)

---

## Step 3: Environment Variables

### Vercel Environment Variables (Frontend Build)

These are injected at build time via Vite's `define` config. Set them in Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `MIMO_API_KEY` | Your MiMo API key | Injected via `vite.config.ts` define |
| `MIMO_BASE_URL` | `https://token-plan-sgp.xiaomimimo.com/v1` | Injected via Vite define |
| `MIMO_DIRECT_API_KEY` | Your MiMo Direct API key | Injected via Vite define |
| `MIMO_DIRECT_BASE_URL` | `https://api.xiaomimimo.com/v1` | Injected via Vite define |

**Important:** These are client-side variables embedded in the JS bundle. They are NOT secret — they're visible in the browser. The MiMo API keys in the `define` block are used by the frontend to call MiMo directly (for chat completions that bypass the backend). The backend has its own separate keys.

### Backend Environment Variables

Set these on the backend host (Railway/Render/Fly.io/VPS):

| Variable | Value |
|----------|-------|
| `MIMO_API_KEY` | Your MiMo API key |
| `MIMO_BASE_URL` | `https://token-plan-sgp.xiaomimimo.com/v1` |
| `MIMO_DIRECT_API_KEY` | Your MiMo Direct API key |
| `MIMO_DIRECT_BASE_URL` | `https://api.xiaomimimo.com/v1` |
| `OPENAI_API_KEY` | Your OpenAI API key (for image gen + embeddings) |
| `DEEPSEEK_API_KEY` | Your DeepSeek API key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` |
| `SERVER_PORT` | `3001` |
| `PG_HOST` | `13.140.162.178` |
| `PG_PORT` | `5432` |
| `PG_DATABASE` | `edlab` |
| `PG_USER` | `postgres` |
| `PG_PASSWORD` | Your PostgreSQL password |

---

## Step 4: CORS Configuration

The Express backend currently has `app.use(cors())` — wide open CORS. For production, consider restricting it:

```typescript
app.use(cors({
  origin: [
    'https://app.edwardrenaldi.xyz',
    'http://localhost:5173',  // dev
  ],
  credentials: true,
}));
```

This is optional since Vercel's rewrite proxy makes same-origin requests (the browser sees `app.edwardrenaldi.xyz/api/*`, not the backend host). But it's a good security practice.

---

## Step 5: SSE Streaming Through Vercel

Vercel's edge network can proxy SSE streams, but there are caveats:

| Plan | Timeout | Notes |
|------|---------|-------|
| Hobby (Free) | 10 seconds | Too short for agent loops (which can take 30-60s) |
| Pro ($20/month) | 300 seconds | Sufficient for all use cases |

**If on Hobby plan:** SSE streaming will be cut off after 10 seconds. This breaks:
- Chat completions (long responses)
- Agent loops (multi-step tool execution)
- RAG queries

**Solutions:**
1. Upgrade to Vercel Pro ($20/month) — 300s timeout
2. Use a direct connection to the backend (bypass Vercel proxy for SSE):
   - Add `VERCEL_API_URL` env var pointing to the backend
   - In services that need SSE, use the direct URL instead of `/api/*`
3. Use the backend's public URL directly for streaming endpoints

**Recommended:** Upgrade to Vercel Pro if you use agent features heavily. The Hobby plan's 10s timeout is insufficient.

### Option: Direct Backend URL for SSE

If staying on Hobby, modify the SSE-specific service calls to hit the backend directly:

```typescript
// services/apiService.ts (SSE streaming)
const SSE_BASE = import.meta.env.VITE_BACKEND_URL || '/api';
// Use SSE_BASE for streaming endpoints, API_BASE for everything else
```

Set `VITE_BACKEND_URL=https://YOUR-BACKEND-HOST` in Vercel env vars. This bypasses Vercel's proxy for streaming.

---

## Step 6: Deploy

### 6a. Push to GitHub

Ensure `vercel.json` is committed to the repo.

### 6b. Connect to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the GitHub repository
3. Vercel auto-detects Vite framework
4. Set environment variables (Step 3)
5. Deploy

### 6c. Assign Domain

1. Project → Settings → Domains
2. Add `app.edwardrenaldi.xyz`
3. Configure DNS CNAME at your registrar

### 6d. Verify

1. Visit `https://app.edwardrenaldi.xyz` — SPA loads
2. Check `/api/health` — returns `{ status: 'ok' }`
3. Send a chat message — SSE streaming works
4. Test agent features (Library, Skema)
5. Check browser console for CORS or proxy errors

---

## Step 7: Production Considerations

### Vercel Analytics

Enable Vercel Analytics (free tier) for performance monitoring:
- Project → Analytics → Enable
- Tracks Core Web Vitals, page views, etc.

### Preview Deployments

Vercel auto-creates preview deployments for every push to a non-production branch. Each preview gets a unique URL like `edward-labs-abc123.vercel.app`. Useful for testing before merging to main.

### Environment Variable Scopes

Vercel supports per-environment variables:
- **Production:** `app.edwardrenaldi.xyz`
- **Preview:** All preview deployments
- **Development:** `vercel dev` local

Set `MIMO_*` keys for all three scopes.

### Build & Deploy Hooks

Vercel auto-deploys on `git push` to the production branch (default: `main`). No CI/CD setup needed.

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `vercel.json` | **CREATE** | Vercel config: build settings, rewrites, headers |
| `vite.config.ts` | **NO CHANGE** | Already correct for Vercel |
| `package.json` | **NO CHANGE** | Build script already correct |
| `index.html` | **NO CHANGE** | SPA entry point |
| `services/*.ts` | **NO CHANGE** | All use relative `/api` paths |
| `server/index.ts` | **OPTIONAL** | Tighten CORS for production |

**Total new files: 1** (`vercel.json`)

---

## Cost Estimate

| Service | Tier | Cost |
|---------|------|------|
| Vercel (frontend) | Hobby (free) | $0/month |
| Vercel (frontend) | Pro (recommended for SSE) | $20/month |
| Railway (backend) | Hobby | ~$5/month |
| PostgreSQL | Existing (13.140.162.178) | Already running |
| Domain | Already owned | $0 |

**Total: $0-25/month** depending on Vercel tier.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSE timeout on Vercel Hobby | Agent loops break | Upgrade to Pro or use direct backend URL |
| Backend host downtime | Entire app down | Health check monitoring, auto-restart |
| Vercel rewrite latency | Slower API responses | Minimal — Vercel edge is fast |
| CORS misconfiguration | API calls fail | Test thoroughly, use relative paths |
| MiMo API key exposed in JS bundle | Low risk — keys are for public API | Use backend proxy for sensitive calls |
| PostgreSQL connection from new host | Backend can't connect | Whitelist backend host IP in PG firewall |

---

## Quick Start Checklist

- [ ] Choose backend host (Railway recommended)
- [ ] Deploy Express backend to chosen host
- [ ] Set backend environment variables
- [ ] Verify backend is accessible at its public URL
- [ ] Create `vercel.json` in project root
- [ ] Connect GitHub repo to Vercel
- [ ] Set Vercel environment variables (`MIMO_*` keys)
- [ ] Add `app.edwardrenaldi.xyz` domain in Vercel
- [ ] Add CNAME DNS record at registrar
- [ ] Verify SSL certificate auto-provisions
- [ ] Test: SPA loads, API proxied, SSE streams, agent works
- [ ] Tighten CORS in backend (optional)
- [ ] Enable Vercel Analytics (optional)
