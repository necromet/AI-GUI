import { StitchBoard, StitchLayout, StitchProject, StitchProjectType, StitchImageRef } from '../types';
import type { StitchDesignSpec, StitchTheme } from '../types/stitchSpec';
import { renderSlide, validateDesignSpec, renderAllSlides } from '../lib/stitchRenderer';
import { getLayoutDimensions } from '../lib/layoutUtils';

export { getLayoutDimensions } from '../lib/layoutUtils';

const API_BASE = '/api';

export interface StitchStreamChunk {
  thinkingText?: string;
  htmlChunk?: string;
  done: boolean;
}

export async function generateHTML(
  boardDescription: string,
  layout: StitchLayout,
  prompt?: string,
  model?: string,
  provider?: string,
  currentHtml?: string,
  history?: Array<{ role: string; content: string }>,
): Promise<string> {
  const response = await fetch(`${API_BASE}/stitch/generate-html`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boardDescription, layout, prompt, model, provider, currentHtml, history }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTML generation error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.html;
}

export async function* generateHTMLStream(
  boardDescription: string,
  layout: StitchLayout,
  prompt?: string,
  model?: string,
  provider?: string,
  isReasoning?: boolean,
  signal?: AbortSignal,
  currentHtml?: string,
  history?: Array<{ role: string; content: string }>,
): AsyncGenerator<StitchStreamChunk> {
  const response = await fetch(`${API_BASE}/stitch/generate-html`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boardDescription, layout, prompt, model, provider, stream: true, isReasoning, currentHtml, history }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTML generation error ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  if (signal?.aborted) {
    reader.cancel();
    throw new DOMException('Aborted', 'AbortError');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const abortPromise = new Promise<never>((_, reject) => {
    signal?.addEventListener('abort', () => {
      reader.cancel();
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });

  while (true) {
    const { done, value } = await Promise.race([reader.read(), abortPromise]);
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') {
        yield { done: true };
        return;
      }

      try {
        const parsed = JSON.parse(data);
        const choice = parsed.choices?.[0];
        const delta = choice?.delta;

        if (!delta) continue;

        const content = delta.content;
        const reasoning = delta.reasoning_content;

        if (content || reasoning) {
          yield {
            thinkingText: reasoning || undefined,
            htmlChunk: content || undefined,
            done: false,
          };
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  yield { done: true };
}


export async function generateSpec(
  prompt: string,
  layout: StitchLayout,
  projectType: StitchProjectType,
  slideCount: number,
  images?: StitchImageRef[],
  model?: string,
  provider?: string,
  currentSpec?: StitchDesignSpec,
  referenceSpec?: StitchDesignSpec,
): Promise<StitchDesignSpec> {
  const response = await fetch(`${API_BASE}/stitch/generate-spec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, layout, projectType, slideCount, images, model, provider, currentSpec, referenceSpec }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spec generation error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.spec;
}

export interface SpecStreamChunk {
  thinkingText?: string;
  specChunk?: string;
  done: boolean;
}

export async function* generateSpecStream(
  prompt: string,
  layout: StitchLayout,
  projectType: StitchProjectType,
  slideCount: number,
  images?: StitchImageRef[],
  model?: string,
  provider?: string,
  currentSpec?: StitchDesignSpec,
  referenceSpec?: StitchDesignSpec,
  signal?: AbortSignal,
): AsyncGenerator<SpecStreamChunk> {
  const response = await fetch(`${API_BASE}/stitch/generate-spec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, layout, projectType, slideCount, images, model, provider, stream: true, currentSpec, referenceSpec }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spec generation error ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  if (signal?.aborted) {
    reader.cancel();
    throw new DOMException('Aborted', 'AbortError');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const abortPromise = new Promise<never>((_, reject) => {
    signal?.addEventListener('abort', () => {
      reader.cancel();
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });

  while (true) {
    const { done, value } = await Promise.race([reader.read(), abortPromise]);
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') {
        yield { done: true };
        return;
      }

      try {
        const parsed = JSON.parse(data);
        const choice = parsed.choices?.[0];
        const delta = choice?.delta;

        if (!delta) continue;

        const content = delta.content;
        const reasoning = delta.reasoning_content;

        if (content || reasoning) {
          yield {
            thinkingText: reasoning || undefined,
            specChunk: content || undefined,
            done: false,
          };
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  yield { done: true };
}

export { renderSlide, renderAllSlides, validateDesignSpec } from '../lib/stitchRenderer';

export function createNewProject(title: string, projectType: StitchProjectType = 'website'): StitchProject {
  const now = Date.now();
  return {
    id: Math.random().toString(36).substring(2, 15),
    title,
    projectType,
    boards: [],
    images: [],
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
    projectType: project.projectType,
    boards: project.boards,
    images: project.images,
    theme: project.theme,
    fullDesignSpec: project.fullDesignSpec,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function stitchDBToProject(dbProject: { id: string; title: string; description?: string; project_type?: string; boards_json: string; images_json?: string | null; theme_json?: string | null; full_design_spec_json?: string | null; created_at: string; updated_at: string }): StitchProject {
  let boards: StitchBoard[] = [];
  try {
    boards = JSON.parse(dbProject.boards_json);
  } catch {}

  let images: StitchImageRef[] = [];
  if (dbProject.images_json) {
    try {
      images = JSON.parse(dbProject.images_json);
    } catch {}
  }

  let theme: StitchTheme | undefined;
  if (dbProject.theme_json) {
    try {
      theme = JSON.parse(dbProject.theme_json);
    } catch {}
  }

  let fullDesignSpec: StitchDesignSpec | undefined;
  if (dbProject.full_design_spec_json) {
    try {
      fullDesignSpec = JSON.parse(dbProject.full_design_spec_json);
    } catch {}
  }

  return {
    id: dbProject.id,
    title: dbProject.title,
    description: dbProject.description,
    projectType: (dbProject.project_type as StitchProjectType) || 'website',
    boards,
    images,
    theme,
    fullDesignSpec,
    createdAt: new Date(dbProject.created_at).getTime(),
    updatedAt: new Date(dbProject.updated_at).getTime(),
  };
}
