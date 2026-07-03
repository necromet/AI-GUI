import { getDatabase } from './index';

export interface DBStitchProject {
  id: string;
  title: string;
  description: string | null;
  project_type: string;
  boards_json: string;
  images_json: string | null;
  theme_json: string | null;
  full_design_spec_json: string | null;
  created_at: string;
  updated_at: string;
}

export function getStitchProjects(): DBStitchProject[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM stitch_projects ORDER BY updated_at DESC').all() as DBStitchProject[];
}

export function getStitchProject(id: string): DBStitchProject | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM stitch_projects WHERE id = ?').get(id) as DBStitchProject | undefined;
}

export function saveStitchProject(project: {
  id: string;
  title: string;
  description?: string;
  project_type?: string;
  boards_json: string;
  theme_json?: string | null;
  full_design_spec_json?: string | null;
  created_at: string;
  updated_at: string;
}): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO stitch_projects (id, title, description, project_type, boards_json, images_json, theme_json, full_design_spec_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       project_type = excluded.project_type,
       boards_json = excluded.boards_json,
       images_json = NULL,
       theme_json = excluded.theme_json,
       full_design_spec_json = excluded.full_design_spec_json,
       updated_at = excluded.updated_at`
  ).run(
    project.id,
    project.title,
    project.description || null,
    project.project_type || 'website',
    project.boards_json,
    project.theme_json || null,
    project.full_design_spec_json || null,
    project.created_at,
    project.updated_at
  );
}

export function deleteStitchProject(id: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM stitch_projects WHERE id = ?').run(id);
}
