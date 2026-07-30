import { tool } from 'ai';
import { z } from 'zod';

export type SectionType =
  | 'navbar'
  | 'hero'
  | 'features'
  | 'testimonials'
  | 'pricing'
  | 'cta'
  | 'footer'
  | 'form'
  | 'text'
  | 'image'
  | 'generic';

export interface GridComponent {
  id: string;
  type: SectionType;
  cs: number;
  ce: number;
  rs: number;
  re: number;
  prompt: string;
  generating: boolean;
  generated: boolean;
  referenceComponentId?: string;
  generatedHtml?: string;
}

export interface GridState {
  version: '1.0';
  template: string;
  components: GridComponent[];
  pageTitle: string;
  selectedId: string | null;
}

export const SECTION_TYPES: Record<SectionType, { label: string; rows: number }> = {
  navbar:       { label: 'Navbar',       rows: 1 },
  hero:         { label: 'Hero',         rows: 2 },
  features:     { label: 'Features',     rows: 2 },
  testimonials: { label: 'Testimonials', rows: 2 },
  pricing:      { label: 'Pricing',      rows: 2 },
  cta:          { label: 'CTA Banner',   rows: 1 },
  footer:       { label: 'Footer',       rows: 1 },
  form:         { label: 'Form',         rows: 2 },
  text:         { label: 'Text Block',   rows: 1 },
  image:        { label: 'Image',        rows: 2 },
  generic:      { label: 'Generic',      rows: 1 },
};

export const ROWS = 20;

interface CanvasToolContext {
  gridState: GridState;
  resolution: { cols: number; width: number; height: number; cellW: number; cellH: number };
}

export function buildCanvasTools(ctx: CanvasToolContext) {
  function overlap(c1: number, r1: number, c2: number, r2: number, exId?: string) {
    return ctx.gridState.components.some(c => {
      if (c.id === exId) return false;
      return !(c2 < c.cs || c1 > c.ce || r2 < c.rs || r1 > c.re);
    });
  }

  function findEmptyRow(needRows: number): number {
    for (let r = 1; r <= ROWS - needRows + 1; r++) {
      if (!overlap(1, r, ctx.resolution.cols, r + needRows - 1)) return r;
    }
    return -1;
  }

  return {
    place_component: tool({
      description: `Place a new section component on the canvas grid. Types: ${Object.keys(SECTION_TYPES).join(', ')}.`,
      parameters: z.object({
        type: z.enum([...Object.keys(SECTION_TYPES)] as [string, ...string[]]),
        prompt: z.string().optional().describe('Description of the section content'),
        row: z.number().optional().describe('Row to place at (omit for first empty)'),
        referenceComponentId: z.string().optional().describe('Library component ID to reference'),
      }),
      execute: async ({ type, prompt, row, referenceComponentId }) => {
        const rows = SECTION_TYPES[type as SectionType]?.rows || 1;
        const targetRow = row ?? findEmptyRow(rows);
        if (targetRow < 0) return JSON.stringify({ error: 'No space available on the grid' });
        if (overlap(1, targetRow, ctx.resolution.cols, targetRow + rows - 1)) {
          return JSON.stringify({ error: `Overlap at row ${targetRow}` });
        }
        const comp: GridComponent = {
          id: `c${Date.now()}`,
          type: type as SectionType,
          cs: 1, ce: ctx.resolution.cols,
          rs: targetRow, re: targetRow + rows - 1,
          prompt: prompt || type,
          generating: false, generated: true,
          referenceComponentId,
        };
        ctx.gridState.components.push(comp);
        return JSON.stringify(comp);
      },
    }),

    remove_component: tool({
      description: 'Remove a section component from the canvas grid by its ID.',
      parameters: z.object({ componentId: z.string() }),
      execute: async ({ componentId }) => {
        const idx = ctx.gridState.components.findIndex(c => c.id === componentId);
        if (idx < 0) return JSON.stringify({ error: `Component ${componentId} not found` });
        ctx.gridState.components.splice(idx, 1);
        return JSON.stringify({ success: true, componentId });
      },
    }),

    move_component: tool({
      description: 'Move a section component up or down on the canvas grid.',
      parameters: z.object({
        componentId: z.string(),
        deltaRow: z.number().describe('Rows to move (negative=up, positive=down)'),
      }),
      execute: async ({ componentId, deltaRow }) => {
        const comp = ctx.gridState.components.find(c => c.id === componentId);
        if (!comp) return JSON.stringify({ error: `Component ${componentId} not found` });
        const nr = comp.rs + deltaRow;
        const nre = comp.re + deltaRow;
        if (nr < 1 || nre > ROWS) return JSON.stringify({ error: 'Out of bounds' });
        if (overlap(comp.cs, nr, comp.ce, nre, componentId)) return JSON.stringify({ error: 'Overlap' });
        comp.rs = nr; comp.re = nre;
        return JSON.stringify(comp);
      },
    }),

    resize_component: tool({
      description: 'Change the height (row span) of a section component.',
      parameters: z.object({
        componentId: z.string(),
        newRowSpan: z.number().min(1).max(ROWS),
      }),
      execute: async ({ componentId, newRowSpan }) => {
        const comp = ctx.gridState.components.find(c => c.id === componentId);
        if (!comp) return JSON.stringify({ error: `Component ${componentId} not found` });
        const nre = comp.rs + newRowSpan - 1;
        if (nre > ROWS) return JSON.stringify({ error: 'Exceeds grid rows' });
        if (overlap(comp.cs, comp.rs, comp.ce, nre, componentId)) return JSON.stringify({ error: 'Overlap' });
        comp.re = nre;
        return JSON.stringify(comp);
      },
    }),

    update_component: tool({
      description: 'Update a section component\'s description or type.',
      parameters: z.object({
        componentId: z.string(),
        prompt: z.string().optional(),
        type: z.string().optional(),
      }),
      execute: async ({ componentId, prompt, type }) => {
        const comp = ctx.gridState.components.find(c => c.id === componentId);
        if (!comp) return JSON.stringify({ error: `Component ${componentId} not found` });
        if (prompt) comp.prompt = prompt;
        if (type && type in SECTION_TYPES) comp.type = type as SectionType;
        return JSON.stringify(comp);
      },
    }),

    regenerate_component: tool({
      description: 'Regenerate a section component\'s content. Optionally with a new description.',
      parameters: z.object({
        componentId: z.string(),
        prompt: z.string().optional(),
      }),
      execute: async ({ componentId, prompt }) => {
        const comp = ctx.gridState.components.find(c => c.id === componentId);
        if (!comp) return JSON.stringify({ error: `Component ${componentId} not found` });
        if (prompt) comp.prompt = prompt;
        comp.generating = true;
        return JSON.stringify(comp);
      },
    }),
  };
}

export function buildCanvasSystemPrompt(context: Record<string, any>): string {
  const { gridState, resolution, availableComponents } = context;

  let prompt = `You are a senior web layout engineer specializing in grid-based page composition.

## Grid Model
- Fixed-resolution template with a column/row grid
- Components are **full-width sections** stacked vertically (website wireframe)
- Resolution: ${resolution.width}×${resolution.height}, ${resolution.cols} columns
- Maximum ${ROWS} rows

## Section Types
${Object.entries(SECTION_TYPES).map(([k, v]) => `- ${k} (${v.rows} row${v.rows > 1 ? 's' : ''}) — ${v.label}`).join('\n')}

## Available Tools
- place_component — Add a section to the grid
- remove_component — Remove a section
- move_component — Reorder sections vertically
- resize_component — Change section height
- update_component — Update section description or type
- regenerate_component — Regenerate section content
- search_library — Find reusable components from the library

## Workflow
1. Understand the user's layout request
2. Search library for relevant components (optional)
3. Place components on the grid with descriptive prompts
4. Report what was placed and where

## Rules
- NEVER place overlapping components — check grid positions before placing
- NEVER modify the grid resolution or template
- Use descriptive prompts for each component
- Place components in logical order (navbar at top, footer at bottom)
- When referencing a library component, always search_library first`;

  if (gridState) {
    const componentSummary = gridState.components.map((c: any) => {
      const rows = SECTION_TYPES[c.type as SectionType]?.rows || 1;
      return `- ${c.id}: ${c.type} at rows ${c.rs}–${c.re} — "${c.prompt}"`;
    }).join('\n');

    prompt += `\n\n## Current Grid State
- Template: ${gridState.template} (${resolution.cols} columns)
- Components (${gridState.components.length}):
${componentSummary || '(empty canvas)'}`;
  }

  if (availableComponents?.length > 0) {
    const grouped: Record<string, any[]> = {};
    for (const c of availableComponents) {
      (grouped[c.category] ??= []).push(c);
    }
    prompt += `\n\n## Library Components\n${Object.entries(grouped).map(([cat, comps]) =>
      `### ${cat} (${comps.length})\n${comps.slice(0, 10).map((c: any) => `- ${c.id}: ${c.name}`).join('\n')}`
    ).join('\n\n')}`;
  }

  return prompt;
}
