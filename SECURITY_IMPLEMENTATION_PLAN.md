# Security Implementation Plan — Route & API Protection

## Executive Summary

The application has **zero backend authentication**. All `/api/*` endpoints are completely open — anyone can bypass the frontend password system by calling the backend directly. Passwords are also embedded in plaintext in the client JavaScript bundle via Vite `define`. This plan addresses all identified loopholes, bugs, and security concerns.

---

## Current State — Identified Vulnerabilities

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | **CRITICAL** | Backend API has no authentication middleware | `server/index.ts:44-103` |
| 2 | **CRITICAL** | Passwords hardcoded in client JS bundle via Vite `define` | `vite.config.ts:101-108`, `components/ModeSelector.tsx:8-15` |
| 3 | **CRITICAL** | `sessionStorage` manipulation bypasses all route guards | `hooks/useModeAuth.ts:15,27` |
| 4 | **HIGH** | Wide-open CORS (`cors()` with no origin restriction) | `server/index.ts:44` |
| 5 | **HIGH** | Database explorer is an open SQL proxy without auth | `server/routes/database.ts` |
| 6 | **MEDIUM** | No rate limiting on any endpoint | `server/index.ts` |
| 7 | **MEDIUM** | Database passwords stored as base64 (not encrypted) when `DB_ENCRYPTION_KEY` is unset | `server/routes/database.ts` |
| 8 | **MEDIUM** | No input validation middleware on backend routes | All `server/routes/*.ts` |
| 9 | **LOW** | Error handler leaks internal `err.message` | `server/index.ts:107` |
| 10 | **LOW** | No CSRF protection on mutation endpoints | All POST/PUT/DELETE routes |
| 11 | **LOW** | Password comparison is not constant-time | `components/ModeSelector.tsx:59` |
| 12 | **LOW** | API keys (`MIMO_API_KEY`, `MIMO_DIRECT_API_KEY`) exposed in client bundle | `vite.config.ts:97-100` |

---

## Implementation Plan

### Phase 1: Server-Side Session Authentication (Fixes #1, #3, #4)

**Goal**: Move authentication to the backend. The server issues HTTP-only cookies on successful password verification. All `/api/*` routes check for a valid session.

#### 1.1 Install dependencies

```bash
npm install express-session @types/express-session
```

#### 1.2 Create `server/middleware/auth.ts`

```ts
import { Request, Response, NextFunction } from 'express';

// Mode-to-password mapping (read from process.env on server side)
const MODE_PASSWORDS: Record<string, string | undefined> = {
  chat: process.env.CHAT_PASSWORD,
  rag: process.env.RAG_PASSWORD,
  skema: process.env.SKEMA_PASSWORD,
  python: process.env.PYTHON_PASSWORD,
  library: process.env.LIBRARY_PASSWORD,
  database: process.env.DATABASE_PASSWORD,
  'agent-builder': process.env.AGENT_BUILDER_PASSWORD,
  notes: process.env.NOTES_PASSWORD,
};

// Route prefix → required mode mapping
const ROUTE_MODE_MAP: Record<string, string> = {
  '/api/chat': 'chat',
  '/api/conversations': 'chat',
  '/api/db': 'chat',
  '/api/models': 'chat',
  '/api/stats': 'chat',
  '/api/rag': 'rag',
  '/api/skema': 'skema',
  '/api/skema-agent': 'skema',
  '/api/python': 'python',
  '/api/library': 'library',
  '/api/library-agent': 'library',
  '/api/agent/opencode': 'agent-builder',
  '/api/agent-builder': 'agent-builder',
  '/api/workflows': 'agent-builder',
  '/api/database': 'database',
  '/api/notes': 'notes',
};

export function requireModeAuth(req: Request, res: Response, next: NextFunction) {
  // Find which mode this route belongs to
  const mode = Object.entries(ROUTE_MODE_MAP).find(([prefix]) =>
    req.path.startsWith(prefix) || req.originalUrl.startsWith(prefix)
  )?.[1];

  if (!mode) return next(); // Public route (e.g., /api/health)

  const unlockedModes: string[] = req.session?.unlockedModes ?? [];
  if (unlockedModes.includes(mode)) return next();

  return res.status(401).json({ error: 'Authentication required', mode });
}
```

#### 1.3 Create `server/routes/auth.ts`

New endpoint for password verification:

```ts
// POST /api/auth/verify   { mode: string, password: string }
// → 200 { success: true }  (sets session cookie)
// → 401 { error: 'Invalid password' }
```

- Password comparison uses `crypto.timingSafeEqual()` (fixes #11)
- On success, pushes `mode` into `req.session.unlockedModes[]`
- Session is stored in a signed, HTTP-only cookie

#### 1.4 Update `server/index.ts`

```ts
import session from 'express-session';
import { requireModeAuth } from './middleware/auth';
import authRoutes from './routes/auth';

// Session middleware (before routes)
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  name: 'edward.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: 'auto',        // true in production with HTTPS
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// CORS — restrict to known origins (fixes #4)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,  // Required for cookies
}));

// Auth routes (public — no middleware)
app.use('/api/auth', authRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// All other /api routes require auth
app.use('/api', requireModeAuth);
```

#### 1.5 Update `.env` / `.env.example`

```env
SESSION_SECRET=<random-64-char-hex>
ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.com
```

**Files to create/modify**:
- `server/middleware/auth.ts` (new)
- `server/routes/auth.ts` (new)
- `server/index.ts` (modify)
- `.env.example` (modify)

---

### Phase 2: Remove Passwords from Client Bundle (Fixes #2, #12)

**Goal**: Passwords are never sent to or stored on the client. The client sends the password to the server for verification; the server responds with a session cookie.

#### 2.1 Remove password `define` entries from `vite.config.ts`

Delete lines 101-108:
```ts
// DELETE these lines:
'process.env.CHAT_PASSWORD': JSON.stringify(env.CHAT_PASSWORD),
'process.env.RAG_PASSWORD': JSON.stringify(env.RAG_PASSWORD),
// ... etc
```

Keep the API key `define` entries for now (they're needed for client-side MiMo proxy calls), but move them to server-side proxying in a future phase.

#### 2.2 Update `components/ModeSelector.tsx`

- Remove the 8 `process.env.*_PASSWORD` constants (lines 8-15)
- Change `InlinePasswordModal` to call `POST /api/auth/verify` instead of client-side comparison
- On 200 response, call `onSuccess()`; on 401, show error

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setError('');

  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ mode: card.id, password }),
  });

  if (res.ok) {
    onSuccess();
  } else {
    setError('Incorrect password');
    setIsLoading(false);
  }
};
```

#### 2.3 Update `hooks/useModeAuth.ts`

Change `unlock()` to call the backend instead of setting `sessionStorage`:

```ts
const unlock = useCallback(async (modeId: string, password: string): Promise<boolean> => {
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ mode: modeId, password }),
  });
  if (res.ok) {
    setAuthStates(prev => ({ ...prev, [modeId]: true }));
    return true;
  }
  return false;
}, []);
```

On app load, call `GET /api/auth/status` to check which modes are already unlocked in the session (replaces `sessionStorage` read).

**Files to modify**:
- `vite.config.ts`
- `components/ModeSelector.tsx`
- `hooks/useModeAuth.ts`

---

### Phase 3: Additional Backend Hardening (Fixes #5-#10)

#### 3.1 Rate Limiting (#6)

```bash
npm install express-rate-limit
```

```ts
// server/index.ts
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window
  message: { error: 'Too many attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/verify', authLimiter);

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 100,                  // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);
```

#### 3.2 Input Validation (#8)

```bash
npm install zod
```

Add Zod schemas for critical endpoints:
- `POST /api/auth/verify` — `{ mode: enum([...]), password: string.min(1).max(128) }`
- `POST /api/database/connections` — connection config validation
- `POST /api/database/query` — `{ connectionId: uuid, query: string.max(10000) }`
- `POST /api/chat/completions` — `{ model: string, messages: array }`

Create `server/middleware/validate.ts`:
```ts
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.issues });
    }
    req.body = result.data;
    next();
  };
}
```

#### 3.3 Error Handler Sanitization (#9)

```ts
// server/index.ts — replace current error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
  });
});
```

#### 3.4 Database Connection Encryption (#7)

Add a startup check that warns loudly if `DB_ENCRYPTION_KEY` is not set. Consider refusing to start in production mode without it.

#### 3.5 CSRF Protection (#10)

Since we're using cookie-based sessions, add a CSRF token mechanism:
- Generate a CSRF token per session
- Frontend sends it as a header (`X-CSRF-Token`) on mutating requests
- Server validates it on POST/PUT/DELETE

Alternatively, use `SameSite=Strict` cookies as a simpler mitigation (already partially addressed with `sameSite: 'lax'`).

---

### Phase 4: Optional — Move API Keys to Server Proxy (Fixes #12)

The `MIMO_API_KEY` and `MIMO_DIRECT_API_KEY` are currently injected into the client bundle. These should be server-side only.

- Create `/api/proxy/mimo` and `/api/proxy/mimo-direct` endpoints on the Express server
- The client calls these proxy endpoints instead of hitting the MiMo API directly
- Remove the `MIMO_API_KEY` and `MIMO_DIRECT_API_KEY` entries from Vite `define`
- Update `vite.config.ts` proxy config to route through the Express server

This is lower priority and can be done as a follow-up.

---

## Implementation Order

| Phase | Effort | Impact | Priority |
|-------|--------|--------|----------|
| **Phase 1**: Server-side session auth | ~4 hours | Eliminates #1, #3, #4 | **Do first** |
| **Phase 2**: Remove client passwords | ~2 hours | Eliminates #2, #12 (passwords) | **Do second** |
| **Phase 3.1**: Rate limiting | ~30 min | Mitigates #6 | **Do with Phase 1** |
| **Phase 3.2**: Input validation | ~2 hours | Mitigates #8 | Do after Phase 2 |
| **Phase 3.3**: Error sanitization | ~15 min | Fixes #9 | Do with Phase 1 |
| **Phase 3.4**: DB encryption check | ~30 min | Mitigates #7 | Do after Phase 2 |
| **Phase 3.5**: CSRF protection | ~1 hour | Mitigates #10 | Do after Phase 2 |
| **Phase 4**: Server-side API key proxy | ~3 hours | Fixes #12 (API keys) | Future sprint |

---

## Verification Checklist

After implementation, verify:

- [ ] `curl http://localhost:3001/api/chat/completions` → returns `401`
- [ ] `curl -X POST http://localhost:3001/api/auth/verify -d '{"mode":"chat","password":"wrong"}'` → returns `401`
- [ ] `curl -X POST http://localhost:3001/api/auth/verify -d '{"mode":"chat","password":"correct"}'` → returns `200` + `Set-Cookie`
- [ ] Authenticated `curl` with cookie can access `/api/chat/*`
- [ ] `npm run build` succeeds (no `process.env.*_PASSWORD` in output)
- [ ] Browser DevTools → Application → sessionStorage has no auth-related keys
- [ ] `grep -r "CHAT_PASSWORD" dist/` returns no results
- [ ] Rate limiter blocks after 10 failed auth attempts
- [ ] CORS blocks requests from unknown origins

---

## Risk Notes

- **Session store**: `express-session` defaults to `MemoryStore` (not suitable for production). For production, use `connect-pg-simple` (PostgreSQL session store) since PostgreSQL is already in the stack.
- **Backward compatibility**: After deploying Phase 1-2, all existing `sessionStorage` auth states will be invalid. Users will need to re-authenticate once. This is expected and desirable.
- **Docker**: Update `nginx/default.conf` to forward `Cookie` headers and add `proxy_cookie_path` directive if needed.
