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

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
