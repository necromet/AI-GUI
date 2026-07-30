import { Router, Request, Response } from 'express';
import { executePython, autoDetectImports } from '../services/pythonExecutor';
import { getAll, getOne, run, runReturning } from '../db/pg';
import { randomBytes } from 'crypto';
import multer from 'multer';
import { join, resolve } from 'path';
import { mkdirSync, existsSync, readdirSync, unlinkSync, statSync, rmdirSync, readFileSync } from 'fs';
import { safeJsonParse } from '../lib/safeJsonParse';

const router = Router();

const SAFE_PACKAGE_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

const FILES_DIR = resolve(process.cwd(), 'data', 'python-files');

function ensureFilesDir() {
  if (!existsSync(FILES_DIR)) mkdirSync(FILES_DIR, { recursive: true });
}

function getProjectDir(projectId: string): string {
  return join(FILES_DIR, projectId);
}

function ensureProjectDir(projectId: string): string {
  const dir = getProjectDir(projectId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveFilePath(projectId: string, filename: string): string | null {
  const projectDir = getProjectDir(projectId);
  const filePath = join(projectDir, filename);
  if (!existsSync(filePath)) return null;
  return filePath;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, file, cb) => {
      const projectId = (_req as any).params?.id || 'misc';
      const dir = ensureProjectDir(projectId);
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, file.originalname);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { code, requirements, projectId } = req.body;
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing required field: code' });
      return;
    }

    const autoDetected = autoDetectImports(code);

    let safeReqs: string[] = [];
    if (requirements && Array.isArray(requirements)) {
      safeReqs = requirements.filter((r: any) => typeof r === 'string' && SAFE_PACKAGE_RE.test(r));
    }

    const merged = Array.from(new Set([...autoDetected, ...safeReqs]));

    let cwd: string | undefined;
    if (projectId) {
      const projectDir = getProjectDir(projectId);
      if (existsSync(projectDir)) cwd = projectDir;
    }

    const beforeSet = cwd && existsSync(cwd) ? new Set(readdirSync(cwd)) : new Set<string>();

    const result = await executePython(code, merged.length > 0 ? merged : undefined, cwd);

    let generatedFiles: { filename: string; size: number }[] = [];
    if (cwd && existsSync(cwd)) {
      try {
        const after = readdirSync(cwd);
        generatedFiles = after
          .filter(name => !beforeSet.has(name))
          .map(name => {
            try {
              const stat = statSync(join(cwd!, name));
              return { filename: name, size: stat.size };
            } catch { return null; }
          })
          .filter((f): f is { filename: string; size: number } => f !== null);
      } catch {}
    }

    res.json({ ...result, autoDetected, generatedFiles });
  } catch (error: any) {
    console.error('[python/execute POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/detect-imports', (req: Request, res: Response) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      res.json({ packages: [] });
      return;
    }
    const packages = autoDetectImports(code);
    res.json({ packages });
  } catch (error: any) {
    console.error('[python/detect-imports GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== Project CRUD =====

router.get('/projects', async (_req: Request, res: Response) => {
  try {
    const rows = await getAll('SELECT * FROM python_projects ORDER BY updated_at DESC');
    const projects = rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description || '',
      files: safeJsonParse(r.files_json, []),
      settings: safeJsonParse(r.settings_json, null),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    res.json({ projects });
  } catch (error: any) {
    console.error('[python/projects GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const row = await getOne('SELECT * FROM python_projects WHERE id = $1', [req.params.id]) as any;
    if (!row) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({
      project: {
        id: row.id,
        title: row.title,
        description: row.description || '',
        files: safeJsonParse(row.files_json, []),
        settings: safeJsonParse(row.settings_json, null),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[python/projects/:id GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/projects', async (req: Request, res: Response) => {
  try {
    const { title, description, files, settings } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Missing required field: title' });
      return;
    }
    const id = randomBytes(8).toString('hex');
    const filesJson = JSON.stringify(files || [{ filename: 'main.py', content: '', isEntry: true }]);
    const settingsJson = settings ? JSON.stringify(settings) : null;
    const row = await runReturning(
      'INSERT INTO python_projects (id, title, description, files_json, settings_json) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, title, description || '', filesJson, settingsJson]
    ) as any;
    res.json({
      project: {
        id: row.id,
        title: row.title,
        description: row.description || '',
        files: safeJsonParse(row.files_json, []),
        settings: safeJsonParse(row.settings_json, null),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[python/projects POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/projects/:id', async (req: Request, res: Response) => {
  try {
    const existing = await getOne('SELECT * FROM python_projects WHERE id = $1', [req.params.id]) as any;
    if (!existing) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const { title, description, files, settings } = req.body;
    const newTitle = title !== undefined ? title : existing.title;
    const newDesc = description !== undefined ? description : existing.description;
    const newFilesJson = files !== undefined ? JSON.stringify(files) : existing.files_json;
    const newSettingsJson = settings !== undefined ? JSON.stringify(settings) : existing.settings_json;
    await run(
      'UPDATE python_projects SET title = $1, description = $2, files_json = $3, settings_json = $4, updated_at = NOW() WHERE id = $5',
      [newTitle, newDesc, newFilesJson, newSettingsJson, req.params.id]
    );
    const row = await getOne('SELECT * FROM python_projects WHERE id = $1', [req.params.id]) as any;
    res.json({
      project: {
        id: row.id,
        title: row.title,
        description: row.description || '',
        files: safeJsonParse(row.files_json, []),
        settings: safeJsonParse(row.settings_json, null),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[python/projects/:id PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/projects/:id', async (req: Request, res: Response) => {
  try {
    const result = await run('DELETE FROM python_projects WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const projectDir = getProjectDir(req.params.id);
    if (existsSync(projectDir)) {
      try {
        const files = readdirSync(projectDir);
        for (const f of files) unlinkSync(join(projectDir, f));
        rmdirSync(projectDir);
      } catch {}
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[python/projects/:id DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== Uploaded Files =====

router.get('/projects/:id/files', (req: Request, res: Response) => {
  try {
    const projectDir = getProjectDir(req.params.id);
    if (!existsSync(projectDir)) {
      res.json({ files: [] });
      return;
    }
    const entries = readdirSync(projectDir);
    const files = entries
      .map(name => {
        const stat = statSync(join(projectDir, name));
        return {
          filename: name,
          size: stat.size,
          uploadedAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    res.json({ files });
  } catch (error: any) {
    console.error('[python/projects/:id/files GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/projects/:id/files', (req: Request, res: Response) => {
  upload.array('files', 20)(req, res, (err) => {
    if (err) {
      console.error('[python/projects/:id/files POST] Upload error:', err.message);
      res.status(400).json({ error: err.message });
      return;
    }
    const uploaded = (req.files as Express.Multer.File[] || []).map(f => ({
      filename: f.filename,
      size: f.size,
      path: f.path,
    }));
    res.json({ files: uploaded });
  });
});

router.delete('/projects/:id/files/:filename', (req: Request, res: Response) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = resolveFilePath(req.params.id, filename);
    if (!filePath) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    unlinkSync(filePath);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[python/projects/:id/files/:filename DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const TEXT_EXTENSIONS = new Set(['txt', 'csv', 'json', 'xml', 'yaml', 'yml', 'md', 'log', 'py', 'js', 'ts', 'html', 'css', 'toml', 'ini', 'cfg', 'conf', 'sh', 'bat', 'sql', 'r', 'rb', 'java', 'c', 'cpp', 'h', 'hpp']);

function isTextFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return TEXT_EXTENSIONS.has(ext);
}

router.get('/projects/:id/files/:filename/view', (req: Request, res: Response) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = resolveFilePath(req.params.id, filename);
    if (!filePath) {
      console.error(`[python/view] File not found: ${join(getProjectDir(req.params.id), filename)}`);
      res.status(404).json({ error: 'File not found', filename, projectId: req.params.id });
      return;
    }
    const stat = statSync(filePath);
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (isTextFile(filename)) {
      const MAX_VIEW_SIZE = 500 * 1024;
      if (stat.size > MAX_VIEW_SIZE) {
        const fd = readFileSync(filePath, 'utf-8').slice(0, MAX_VIEW_SIZE);
        res.json({ type: 'text', content: fd, truncated: true, size: stat.size, extension: ext });
      } else {
        const content = readFileSync(filePath, 'utf-8');
        res.json({ type: 'text', content, truncated: false, size: stat.size, extension: ext });
      }
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
      res.json({ type: 'image', extension: ext, size: stat.size, url: `/api/python/projects/${req.params.id}/files/${encodeURIComponent(filename)}/download` });
    } else if (['pdf'].includes(ext)) {
      res.json({ type: 'pdf', extension: ext, size: stat.size, url: `/api/python/projects/${req.params.id}/files/${encodeURIComponent(filename)}/download` });
    } else {
      res.json({ type: 'binary', extension: ext, size: stat.size, message: 'Binary file — download to view.' });
    }
  } catch (error: any) {
    console.error('[python/projects/:id/files/:filename/view GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/projects/:id/files/:filename/download', (req: Request, res: Response) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = resolveFilePath(req.params.id, filename);
    if (!filePath) {
      console.error(`[python/download] File not found: ${join(getProjectDir(req.params.id), filename)}`);
      res.status(404).json({ error: 'File not found', filename, projectId: req.params.id });
      return;
    }
    res.download(filePath, filename);
  } catch (error: any) {
    console.error('[python/projects/:id/files/:filename/download GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
