import { StitchBoard, StitchLayout, StitchProject } from '../types';

const API_BASE = '/api';

export async function generateHTML(
  boardDescription: string,
  layout: StitchLayout,
  prompt?: string,
  model?: string,
  provider?: string,
): Promise<string> {
  const response = await fetch(`${API_BASE}/stitch/generate-html`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boardDescription, layout, prompt, model, provider }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTML generation error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.html;
}

export function getLayoutDimensions(layout: StitchLayout): { width: number; height: number } {
  switch (layout) {
    case '16:9': return { width: 1920, height: 1080 };
    case '1:1': return { width: 1080, height: 1080 };
    case '9:16': return { width: 1080, height: 1920 };
    default: return { width: 1920, height: 1080 };
  }
}

export function createNewProject(title: string): StitchProject {
  const now = Date.now();
  return {
    id: Math.random().toString(36).substring(2, 15),
    title,
    boards: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createNewBoard(projectId: string, layout: StitchLayout = '16:9'): StitchBoard {
  const now = Date.now();
  return {
    id: Math.random().toString(36).substring(2, 15),
    projectId,
    title: `Board ${now.toString(36).slice(-4)}`,
    layout,
    bgColor: '#ffffff',
    createdAt: now,
    updatedAt: now,
  };
}

export function stitchProjectToDB(project: StitchProject) {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    boards: project.boards,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function stitchDBToProject(dbProject: { id: string; title: string; description?: string; boards_json: string; created_at: string; updated_at: string }): StitchProject {
  let boards: StitchBoard[] = [];
  try {
    boards = JSON.parse(dbProject.boards_json);
  } catch {}

  return {
    id: dbProject.id,
    title: dbProject.title,
    description: dbProject.description,
    boards,
    createdAt: new Date(dbProject.created_at).getTime(),
    updatedAt: new Date(dbProject.updated_at).getTime(),
  };
}
