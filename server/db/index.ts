import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { SCHEMA_SQL, SEED_SQL } from './schema';

const DB_PATH = process.env.DATABASE_PATH || resolve(process.cwd(), 'data', 'edwardlabs.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) return db;

  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(SCHEMA_SQL);
  db.exec(SEED_SQL);

  migrate(db);
  migrateLibraryFiles(db);

  console.log(`[db] SQLite database initialized at ${DB_PATH}`);
  return db;
}

function migrate(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(stitch_projects)").all() as { name: string }[];
  const colNames = new Set(columns.map(c => c.name));

  if (!colNames.has('project_type')) {
    db.exec("ALTER TABLE stitch_projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'website'");
    console.log('[db] Migration: added project_type to stitch_projects');
  }
  if (!colNames.has('images_json')) {
    db.exec('ALTER TABLE stitch_projects ADD COLUMN images_json TEXT');
    console.log('[db] Migration: added images_json to stitch_projects');
  }
  if (!colNames.has('theme_json')) {
    db.exec('ALTER TABLE stitch_projects ADD COLUMN theme_json TEXT');
    console.log('[db] Migration: added theme_json to stitch_projects');
  }
  if (!colNames.has('full_design_spec_json')) {
    db.exec('ALTER TABLE stitch_projects ADD COLUMN full_design_spec_json TEXT');
    console.log('[db] Migration: added full_design_spec_json to stitch_projects');
  }
}

const FILENAME_MAP: Record<string, string> = {
  html: 'index.html',
  tsx: 'Component.tsx',
  css: 'style.css',
  js: 'script.js',
  ts: 'script.ts',
  json: 'data.json',
  markdown: 'README.md',
};

function migrateLibraryFiles(db: Database.Database): void {
  const components = db.prepare('SELECT id, content_type FROM library_components').all() as { id: string; content_type: string }[];
  for (const comp of components) {
    const existing = db.prepare('SELECT id FROM library_component_files WHERE component_id = ?').get(comp.id) as any;
    if (!existing) {
      const filename = FILENAME_MAP[comp.content_type] || `file.${comp.content_type}`;
      const content = (db.prepare('SELECT content FROM library_components WHERE id = ?').get(comp.id) as any).content;
      const now = new Date().toISOString();
      const fileId = Math.random().toString(36).substring(2, 15);
      db.prepare(
        'INSERT INTO library_component_files (id, component_id, filename, content_type, content, sort_order, is_entry, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)'
      ).run(fileId, comp.id, filename, comp.content_type, content, now, now);
      console.log(`[db] Migration: created file ${filename} for component ${comp.id}`);
    }
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
