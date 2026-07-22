import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
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

const { default: express } = await import('express');
const { default: cors } = await import('cors');
const { default: chatRoutes } = await import('./routes/chat');
const { default: stitchRoutes } = await import('./routes/stitch');
const { default: ragRoutes } = await import('./routes/rag');
const { default: stitchAgentRoutes } = await import('./routes/stitchAgent');
const { default: opencodeAgentRoutes } = await import('./routes/opencodeAgent');
const { default: libraryAgentRoutes } = await import('./routes/libraryAgent');
const { default: libraryRoutes } = await import('./routes/library');
const { default: modelRoutes } = await import('./routes/models');
const { default: conversationRoutes } = await import('./routes/conversations');
const { default: messageRoutes } = await import('./routes/messages');
const { default: statsRoutes } = await import('./routes/stats');
const { default: pythonRoutes } = await import('./routes/python');
const { getDatabase } = await import('./db');

getDatabase();

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const originalJson = res.json.bind(res);
  const originalEnd = res.end.bind(res);
  let responseBody: any = null;

  res.json = function (body: any) {
    responseBody = body;
    return originalJson(body);
  };

  res.end = function (...args: any[]) {
    const duration = Date.now() - start;
    const isStream = res.getHeader('Content-Type') === 'text/event-stream';
    const status = res.statusCode;
    const method = req.method;
    const url = req.originalUrl;

    let log = `[api] ${method} ${url} → ${status} (${duration}ms)`;
    if (responseBody && !isStream) {
      const bodyStr = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
      const truncated = bodyStr.length > 200 ? bodyStr.slice(0, 200) + '…' : bodyStr;
      log += ` | ${truncated}`;
    }

    if (status >= 400) {
      console.error(log);
    } else {
      console.log(log);
    }

    return originalEnd(...args);
  } as any;

  next();
});

app.use('/api/chat', chatRoutes);
app.use('/api/stitch', stitchRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/agent/opencode', opencodeAgentRoutes);
app.use('/api/library-agent', libraryAgentRoutes);
app.use('/api/stitch-agent', stitchAgentRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/db', messageRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/python', pythonRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[server] API server running on http://localhost:${PORT}`);
});

export default app;
