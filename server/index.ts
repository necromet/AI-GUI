import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { randomBytes } from 'crypto';

const envPath = resolve(process.cwd(), '.env');
const envLocalPath = resolve(process.cwd(), '.env.local');
for (const file of [envPath, envLocalPath]) {
  if (existsSync(file)) {
    const lines = readFileSync(file, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

if (!process.env.SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[server] FATAL: SESSION_SECRET must be set in production');
    process.exit(1);
  }
  console.warn('[server] SESSION_SECRET not set — using random secret (sessions will not persist across restarts)');
}

const sessionSecret = process.env.SESSION_SECRET || randomBytes(64).toString('hex');

const { default: express } = await import('express');
const { default: cors } = await import('cors');
const { default: session } = await import('express-session');
const { default: rateLimit } = await import('express-rate-limit');
const { default: helmet } = await import('helmet');
const { default: chatRoutes } = await import('./routes/chat');
const { default: skemaRoutes } = await import('./routes/skema');
const { default: ragRoutes } = await import('./routes/rag');
const { default: skemaAgentRoutes } = await import('./routes/skemaAgent');
const { default: opencodeAgentRoutes } = await import('./routes/opencodeAgent');
const { default: libraryAgentRoutes } = await import('./routes/libraryAgent');
const { default: libraryRoutes } = await import('./routes/library');
const { default: modelRoutes } = await import('./routes/models');
const { default: conversationRoutes } = await import('./routes/conversations');
const { default: messageRoutes } = await import('./routes/messages');
const { default: statsRoutes } = await import('./routes/stats');
const { default: pythonRoutes } = await import('./routes/python');
const { default: databaseRoutes } = await import('./routes/database');
const { default: agentBuilderRoutes } = await import('./routes/agentBuilder');
const { default: workflowRoutes } = await import('./routes/workflows');
const { default: workflowMCPRoutes } = await import('./routes/workflowMCP');
const { default: workflowApprovalRoutes } = await import('./routes/workflowApprovals');
const { default: workflowKeyRoutes } = await import('./routes/workflowKeys');
const { default: workflowNodeRoutes } = await import('./routes/workflowNodes');
const { default: workflowExecutionRoutes } = await import('./routes/workflowExecution');
const { default: notesRoutes } = await import('./routes/notes');
const { default: authRoutes } = await import('./routes/auth');
const { requireModeAuth } = await import('./middleware/auth');
const { initializeDatabaseWithRetry } = await import('./db');

if (!process.env.DB_ENCRYPTION_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[server] FATAL: DB_ENCRYPTION_KEY must be set in production');
    process.exit(1);
  }
  console.warn('[server] DB_ENCRYPTION_KEY not set — database connection passwords stored as base64 (insecure)');
}

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

app.set('trust proxy', 1);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim());

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https://token-plan-sgp.xiaomimimo.com", "https://api.xiaomimimo.com", "https://api.openai.com", "https://api.deepseek.com"],
      frameSrc: ["'self'", "blob:", "data:"],
      fontSrc: ["'self'", "data:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  maxAge: 86400,
}));
app.use(express.json({ limit: '1mb' }));

app.use(session({
  secret: sessionSecret,
  name: 'edward.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use((req, res, next) => {
  const start = Date.now();
  const originalEnd = res.end.bind(res);

  res.end = function (...args: any[]) {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const method = req.method;
    const url = req.originalUrl;

    const log = `[api] ${method} ${url} → ${status} (${duration}ms)`;

    if (status >= 400) {
      console.error(log);
    } else {
      console.log(log);
    }

    return originalEnd(...args);
  } as any;

  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authLimiter, authRoutes);

app.use('/api', apiLimiter, requireModeAuth);

app.use('/api/chat', chatRoutes);
app.use('/api/skema', skemaRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/agent/opencode', opencodeAgentRoutes);
app.use('/api/library-agent', libraryAgentRoutes);
app.use('/api/skema-agent', skemaAgentRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/db', messageRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/python', pythonRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/agent-builder', agentBuilderRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/workflows', workflowMCPRoutes);
app.use('/api/workflows', workflowApprovalRoutes);
app.use('/api/workflows', workflowKeyRoutes);
app.use('/api/workflows', workflowNodeRoutes);
app.use('/api/workflows', workflowExecutionRoutes);
app.use('/api/notes', notesRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (status >= 500 ? 'Internal server error' : err.message),
  });
});

app.listen(PORT, () => {
  console.log(`[server] API server running on http://localhost:${PORT}`);
});

initializeDatabaseWithRetry().then(async () => {
  try {
    const { seedBuiltinTemplates } = await import('./db/workflows');
    await seedBuiltinTemplates();
    console.log('[server] Built-in templates seeded');
  } catch (err) {
    console.warn('[server] Template seeding skipped:', (err as Error).message);
  }
});

export default app;
