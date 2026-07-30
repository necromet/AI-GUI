import { getAll, getOne, run } from './pg';

export interface DBSkemaProject {
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

export async function getSkemaProjects(): Promise<DBSkemaProject[]> {
  return getAll<DBSkemaProject>('SELECT * FROM skema_projects ORDER BY updated_at DESC');
}

export async function getSkemaProject(id: string): Promise<DBSkemaProject | undefined> {
  return getOne<DBSkemaProject>('SELECT * FROM skema_projects WHERE id = $1', [id]);
}

export async function saveSkemaProject(project: {
  id: string;
  title: string;
  description?: string;
  project_type?: string;
  boards_json: string;
  theme_json?: string | null;
  full_design_spec_json?: string | null;
  created_at: string;
  updated_at: string;
}): Promise<void> {
  await run(
    `INSERT INTO skema_projects (id, title, description, project_type, boards_json, images_json, theme_json, full_design_spec_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       project_type = excluded.project_type,
       boards_json = excluded.boards_json,
       images_json = NULL,
       theme_json = excluded.theme_json,
       full_design_spec_json = excluded.full_design_spec_json,
       updated_at = excluded.updated_at`,
    [
      project.id,
      project.title,
      project.description || null,
      project.project_type || 'canvas',
      project.boards_json,
      project.theme_json || null,
      project.full_design_spec_json || null,
      project.created_at,
      project.updated_at,
    ]
  );
}

export async function deleteSkemaProject(id: string): Promise<void> {
  await run('DELETE FROM skema_projects WHERE id = $1', [id]);
}
