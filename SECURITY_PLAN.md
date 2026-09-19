# Cybersecurity Improvement Plan — edward:labs

**Date:** 2026-09-14
**Scope:** Full codebase (React/Vite frontend + Express 5/PostgreSQL backend)
**Methodology:** Manual code audit of server routes, middleware, services, config, and infrastructure

---

## Executive Summary

This plan addresses **31 security findings** across 5 severity levels. The most critical issues involve server-side request forgery (SSRF), insecure code execution sandboxing, path traversal vulnerabilities, API key exposure in the client bundle, and missing security headers. Implementing all items below will bring the application to a production-hardened state.

---

## Severity Legend

| Level | Count | Description |
|-------|-------|-------------|
| **P0 — Critical** | 6 | Remote code execution, credential theft, data exfiltration |
| **P1 — High** | 8 | XSS, missing auth controls, information leakage |
| **P2 — Medium** | 9 | Weak cryptography, missing hardening, DoS vectors |
| **P3 — Low** | 5 | Verbose logging, missing best practices |
| **P4 — Info** | 3 | Observability, dependency hygiene |

---

## P0 — Critical

### C1. Server-Side Request Forgery (SSRF) in `web_browse` tool

**File:** `server/services/tools/webTools.ts:1-29`
**Issue:** The `toolWebBrowse` function fetches arbitrary user-supplied URLs with no validation. An attacker (via prompt injection or direct API call) can make the server fetch internal network addresses (`http://169.254.169.254/latest/meta-data/` for cloud metadata, `http://localhost:5432/` for internal services, `file:///etc/passwd`).

**Fix:**
```typescript
function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const hostname = url.hostname;
    // Block private/internal IPs
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname)) return false;
    return true;
  } catch { return false; }
}
```
- Validate URL before every fetch in `toolWebBrowse` and `analyzeImages`
- Add DNS resolution check to prevent DNS rebinding
- Block redirects to internal IPs (use `redirect: 'error'` or manual redirect handling)

### C2. Insecure Code Execution Sandbox

**File:** `server/services/tools/codeTools.ts:1-51`
**Issue:** Uses Node.js `vm.runInNewContext()` which the Node.js docs explicitly state is **not a security mechanism**. The sandbox can be escaped via prototype chain access (`this.constructor.constructor('return process')()`) to achieve arbitrary RCE on the host.

**Fix:**
- Replace `vm` with a proper sandbox: use `isolated-vm` npm package or run code in a Docker container with resource limits
- If using Docker: spawn a container per execution with `--network none --memory 64m --cpus 0.5 --read-only` and a 5s timeout
- If using `isolated-vm`: create an `Isolate` with `memoryLimit: 64` and compile/run with a timeout
- Remove all references to `vm` module

### C3. Path Traversal in Python File Routes

**File:** `server/routes/python.ts:30-35`
**Issue:** `resolveFilePath` uses `path.join(projectDir, filename)` without verifying the result stays within `projectDir`. A filename like `../../etc/passwd` would resolve outside the intended directory, allowing arbitrary file read/delete.

**Fix:**
```typescript
function resolveFilePath(projectId: string, filename: string): string | null {
  const projectDir = getProjectDir(projectId);
  const filePath = join(projectDir, filename);
  // CRITICAL: verify resolved path is inside projectDir
  if (!filePath.startsWith(projectDir + path.sep) && filePath !== projectDir) {
    return null;
  }
  if (!existsSync(filePath)) return null;
  return filePath;
}
```
- Apply the same fix to all file-serving routes (view, download, delete)
- Sanitize `filename` to reject `..`, absolute paths, and null bytes

### C4. Frontend API Key Exposure

**File:** `vite.config.ts:96-101`
**Issue:** `MIMO_API_KEY` and `MIMO_DIRECT_API_KEY` are injected into the client JavaScript bundle via Vite's `define`. Anyone can view these keys in browser DevTools or the built JS files.

**Fix:**
- Move all API calls that require these keys to server-side routes
- Create a proxy endpoint (`/api/proxy/mimo`) on the Express server that adds the API key server-side
- Remove the `define` entries from `vite.config.ts`
- Frontend should call `/api/proxy/mimo/*` instead of the MiMo API directly

### C5. Fallback Session Secret

**File:** `server/index.ts:73`
**Issue:** If `SESSION_SECRET` is not set, the server uses `'edward-labs-fallback-secret-change-me'` — a publicly known string. This makes session cookies forgeable, allowing authentication bypass for all modes.

**Fix:**
```typescript
if (!process.env.SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[server] FATAL: SESSION_SECRET must be set in production');
    process.exit(1);
  }
  console.warn('[server] SESSION_SECRET not set — using random secret (sessions will not persist across restarts)');
}
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');
```

### C6. Base64 "Encryption" Fallback for Database Passwords

**File:** `server/routes/database.ts:13-17, 26-28`
**Issue:** When `DB_ENCRYPTION_KEY` is not set, database connection passwords are stored as base64 — which is trivially reversible, not encryption.

**Fix:**
- Require `DB_ENCRYPTION_KEY` in production (fail startup if missing)
- For development, generate a random key and log a warning
- Consider using the `SESSION_SECRET` as a key derivation source if `DB_ENCRYPTION_KEY` is absent
- Migrate existing base64-stored passwords to proper AES-256-GCM encryption on startup

---

## P1 — High

### H1. No Security Headers (Helmet)

**File:** `server/index.ts`
**Issue:** No `helmet` middleware. Missing headers: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection`, `Referrer-Policy`.

**Fix:**
```bash
npm install helmet
```
```typescript
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // needed for Vite HMR in dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://token-plan-sgp.xiaomimimo.com", "https://api.xiaomimimo.com"],
      frameSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false, // needed for SSE
}));
```

### H2. XSS via `dangerouslySetInnerHTML`

**Files:**
- `components/canvas/CanvasExportModal.tsx:158` — renders `highlightedCode` (could contain user HTML)
- `open-agent-builder/components/**/*.tsx` — 20+ instances of `dangerouslySetInnerHTML`

**Fix:**
- Use DOMPurify to sanitize all HTML before passing to `dangerouslySetInnerHTML`:
  ```typescript
  import DOMPurify from 'dompurify';
  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
  ```
- For code highlighting, use a safe renderer (e.g., `react-syntax-highlighter` with `createElement` instead of innerHTML)
- Audit all `ref.current.innerHTML = ...` assignments and replace with React state where possible

### H3. No Input Validation on API Routes

**Files:** All `server/routes/*.ts` except `auth.ts`
**Issue:** Most routes accept arbitrary JSON bodies without schema validation. This enables type confusion, unexpected field injection, and oversized payloads.

**Fix:**
- Add Zod schemas to every route handler:
  ```typescript
  const chatSchema = z.object({
    model: z.string().min(1).max(100),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system', 'model']),
      content: z.string().max(1000000),
    })).min(1).max(500),
    stream: z.boolean().optional(),
    max_tokens: z.number().int().min(1).max(100000).optional(),
  });
  ```
- Validate `req.body` against the schema and return 400 on failure
- Use `express.json({ limit: '5mb' })` per-route where smaller limits suffice (chat doesn't need 50MB)

### H4. SSRF in Image Analysis

**File:** `server/services/agentService.ts:21-36`
**Issue:** `analyzeImages()` fetches arbitrary image URLs with no SSRF protection — same class of vulnerability as C1.

**Fix:**
- Reuse the URL validation function from C1
- Add an allowlist for image URL domains if possible
- Set a strict timeout and maximum response size

### H5. Python Executor Runs on Host

**File:** `server/services/pythonExecutor.ts` (referenced from `server/routes/python.ts`)
**Issue:** Python code is executed directly on the host machine. If the sandbox is weak or escapeable, an attacker gains full host access.

**Fix:**
- Execute Python inside a Docker container with resource limits:
  ```bash
  docker run --rm --network none --memory 256m --cpus 1.0 \
    -v /tmp/python-work:/work -w /work \
    python:3.12-slim python -c "..."
  ```
- Set a hard timeout (10s) and kill the container if exceeded
- Never execute Python on the host in production

### H6. Hardcoded Passwords in AGENTS.md

**File:** `AGENTS.md` (project root)
**Issue:** Mode passwords are documented in plaintext (e.g., `thelordismyshepherd`, `herestoresmysoul`). Anyone with repo access has all passwords.

**Fix:**
- Remove all passwords from `AGENTS.md`
- Replace with references: `See .env for mode passwords`
- Rotate all compromised passwords
- If passwords must be documented, store them in a secrets manager (Vault, AWS SSM, etc.)

### H7. No HTTPS Enforcement

**Files:** `nginx/default.conf`, `server/index.ts`
**Issue:** nginx listens on port 80 only. No HTTP→HTTPS redirect. No HSTS header.

**Fix:**
- Add HTTPS listener with TLS certificates (Let's Encrypt / cert-manager)
- Add HTTP→HTTPS redirect:
  ```nginx
  server {
    listen 80;
    return 301 https://$host$request_uri;
  }
  ```
- Set `Strict-Transport-Security` header via helmet (covered in H1)

### H8. SSL Certificate Verification Disabled

**File:** `server/routes/database.ts:77`
**Issue:** `rejectUnauthorized: false` disables TLS certificate verification for database connections, enabling MITM attacks.

**Fix:**
- Default to `rejectUnauthorized: true`
- Only allow `false` when explicitly opted in via a per-connection `ssl_no_verify` flag with a warning
- Provide a field in the UI for custom CA certificates

---

## P2 — Medium

### M1. Weak ID Generation

**File:** `server/routes/database.ts:194`
**Issue:** `Math.random().toString(36).substring(2, 15)` is not cryptographically secure. Connection IDs are predictable.

**Fix:**
```typescript
import { randomBytes } from 'crypto';
const id = randomBytes(16).toString('hex');
```
- Apply to all ID generation across the codebase (check with `grep -r "Math.random" server/`)

### M2. Error Messages Leak Internal Details

**Files:** All route error handlers
**Issue:** Raw database error messages, stack traces, and internal paths are returned to the client (e.g., `res.status(500).json({ error: error.message })`).

**Fix:**
- Return generic error messages to the client
- Log full errors server-side only:
  ```typescript
  app.use((err, req, res, next) => {
    console.error('[server] Error:', err);
    res.status(err.status || 500).json({
      error: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
    });
  });
  ```

### M3. No Rate Limiting on File Upload Endpoints

**Files:** `server/routes/chat.ts:205`, `server/routes/rag.ts:15`, `server/routes/python.ts:275`
**Issue:** File upload endpoints have no per-route rate limiting. An attacker can flood the server with large file uploads.

**Fix:**
- Add a dedicated upload rate limiter:
  ```typescript
  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many uploads. Try again later.' },
  });
  router.post('/parse-document', uploadLimiter, docUpload.single('file'), ...);
  ```

### M4. Excessive JSON Body Size Limit

**File:** `server/index.ts:70`
**Issue:** `express.json({ limit: '50mb' })` allows 50MB JSON bodies globally. This enables memory exhaustion DoS.

**Fix:**
- Set a smaller global limit (e.g., 1mb) and override per-route where needed:
  ```typescript
  app.use(express.json({ limit: '1mb' }));
  // For specific routes that need larger payloads:
  router.post('/large-endpoint', express.json({ limit: '10mb' }), handler);
  ```

### M5. No Max Connections Per IP

**File:** `server/routes/database.ts:61-82`
**Issue:** The database pool cache has no per-IP limit. An attacker could create pools to many different hosts, exhausting server resources.

**Fix:**
- Limit the total number of cached pools (e.g., 50)
- Limit pools per session/IP (e.g., 5)
- Add a queue or reject new pool requests when the limit is reached

### M6. `web_browse` Follows Redirects to Internal IPs

**File:** `server/services/tools/webTools.ts:5-10`
**Issue:** Even with URL validation, a redirect from an allowed external URL to an internal URL would bypass SSRF protections.

**Fix:**
- Use `redirect: 'manual'` in fetch options
- Validate the `Location` header before following redirects
- Or use a library like `undici` with built-in SSRF protection

### M7. Session Cookie Configuration

**File:** `server/index.ts:72-83`
**Issue:** `secure: 'auto'` may not correctly set the `Secure` flag behind a reverse proxy. `sameSite: 'lax'` may be too permissive for API-only cookies.

**Fix:**
```typescript
cookie: {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,
  domain: process.env.COOKIE_DOMAIN || undefined,
},
```
- Add `trust proxy` setting if behind nginx:
  ```typescript
  app.set('trust proxy', 1);
  ```

### M8. No CORS Preflight Caching

**File:** `server/index.ts:66-69`
**Issue:** CORS is configured but without `maxAge`, causing browsers to send preflight OPTIONS requests on every cross-origin request.

**Fix:**
```typescript
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  maxAge: 86400, // 24 hours
}));
```

### M9. Nginx Missing Security Headers

**File:** `nginx/default.conf`
**Issue:** No security headers set at the nginx level (should be defense-in-depth alongside helmet).

**Fix:**
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

---

## P3 — Low

### L1. Verbose Response Logging

**File:** `server/index.ts:101-136`
**Issue:** Response bodies are logged up to 200 chars. This may include tokens, passwords, or PII.

**Fix:**
- Redact sensitive fields before logging
- Only log request method, URL, status, and duration
- Never log response bodies in production

### L2. `.env.example` Exposes Production Database Host

**File:** `.env.example:25`
**Issue:** `PG_HOST=13.140.162.178` exposes the actual production database IP address.

**Fix:**
- Replace with a placeholder: `PG_HOST=your-pg-host`
- Ensure `.env.example` never contains real infrastructure details

### L3. No Dependency Audit Pipeline

**File:** None (missing)
**Issue:** No `npm audit` or Snyk/Dependabot integration. Vulnerable dependencies may go undetected.

**Fix:**
- Add `npm audit --audit-level=high` to CI pipeline
- Enable GitHub Dependabot or Snyk integration
- Run `npm audit` before each deployment

### L4. No `Content-Type` Validation on Uploads

**Files:** `server/routes/chat.ts:13-14`, `server/routes/rag.ts:13`
**Issue:** Multer accepts any file type. Only the file extension is checked, not the actual MIME type or magic bytes.

**Fix:**
- Add a `fileFilter` to multer:
  ```typescript
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json'];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Unsupported file type'));
    },
  });
  ```
- Validate magic bytes for critical file types (PDF starts with `%PDF`)

### L5. Docker Containers Run as Root

**Files:** `Dockerfile.frontend`, `Dockerfile.backend`
**Issue:** Both Dockerfiles run processes as root (no `USER` directive).

**Fix:**
```dockerfile
# Dockerfile.backend
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001
USER appuser

# Dockerfile.frontend (nginx)
RUN chown -R nginx:nginx /usr/share/nginx/html
```

---

## P4 — Informational

### I1. Add Security Monitoring

- Add request logging to a structured format (JSON) for log aggregation
- Monitor for anomalous patterns: repeated 401s, large payloads, unusual tool usage
- Consider adding Sentry or similar for error tracking

### I2. Add `npm audit` to Pre-commit Hook

```json
// package.json
"scripts": {
  "precommit": "npm audit --audit-level=high"
}
```

### I3. Implement Subresource Integrity (SRI)

For any CDN-loaded scripts (Monaco editor, etc.), add integrity hashes:
```html
<script src="https://cdn.example.com/lib.js" integrity="sha384-..." crossorigin="anonymous"></script>
```

---

## Implementation Priority

| Phase | Items | Effort | Impact |
|-------|-------|--------|--------|
| **Phase 1 — Immediate** (Week 1) | C1, C2, C3, C4, C5, C6, H6 | 3-5 days | Eliminates RCE and credential theft |
| **Phase 2 — Short-term** (Week 2-3) | H1, H2, H3, H4, H7, H8 | 5-7 days | Blocks XSS, SSRF, and adds defense-in-depth |
| **Phase 3 — Medium-term** (Week 4-5) | M1-M9, L1-L5 | 5-7 days | Hardens all attack surfaces |
| **Phase 4 — Ongoing** | I1-I3, dependency updates | Continuous | Maintains security posture |

---

## Verification Checklist

After implementation, verify with:

- [ ] `npm audit` returns 0 high/critical vulnerabilities
- [ ] `npm run build` succeeds with no API keys in output bundle
- [ ] SSRF: `curl -X POST /api/agent/chat -d '{"tools":["web_browse"],"messages":[{"role":"user","content":"browse http://169.254.169.254"}]}'` returns blocked
- [ ] Path traversal: `GET /api/python/projects/test/files/../../etc/passwd/view` returns 400/404
- [ ] Security headers present: `curl -I http://localhost:3001/api/health` shows CSP, X-Content-Type-Options, etc.
- [ ] Session fixation: changing SESSION_SECRET invalidates all existing sessions
- [ ] Rate limiting: 101st request within 1 minute returns 429
- [ ] XSS: all `dangerouslySetInnerHTML` calls pass DOMPurify sanitization
- [ ] Docker: containers run as non-root user
- [ ] HTTPS: all HTTP requests redirect to HTTPS in production
