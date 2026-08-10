import { tool } from 'ai';
import { z } from 'zod';
import {
  toolExecuteCode,
  toolWebBrowse,
  toolSearchWeb,
  toolEditHtml,
  toolGenerateHtml,
  toolGenerateSpec,
  toolEditSpec,
  type EditOperation,
} from '../../../services/agentService';
import { buildCanvasTools } from '../../../services/canvasAgentTools';
import * as skemaLibrary from '../../../services/skemaLibraryService';

export interface SkemaToolContext {
  currentHtml?: string;
  layout?: string;
  boardDescription?: string;
  model?: string;
  provider?: string;
  projectType?: string;
  images?: any[];
  imageAnalysis?: string;
  currentSpec?: any;
  referenceSpec?: any;
  componentContext?: string;
  slideCount?: number;
  totalSlides?: number;
  gridState?: any;
  resolution?: any;
  availableComponents?: any[];
}

export function buildSkemaTools(context: SkemaToolContext) {
  const tools: Record<string, any> = {};

  if (context.projectType === 'canvas' && context.gridState && context.resolution) {
    Object.assign(tools, buildCanvasTools({
      gridState: context.gridState,
      resolution: context.resolution,
    }));
  }

  tools.generate_html = tool({
    description: 'Generate a complete HTML file from a text description. The tool returns the full HTML ready to render. If the user already provided full HTML, pass it directly.',
    parameters: z.object({
      prompt: z.string().describe('Text description of the design to generate, OR the full HTML code if already written'),
    }),
    execute: async ({ prompt }) => {
      if (!prompt) return 'Error: No prompt provided.';
      if (/<!doctype|<html/i.test(prompt)) return prompt;
      return await toolGenerateHtml(
        prompt,
        context.layout || '16:9',
        context.boardDescription,
        context.model,
        context.provider,
        context.projectType,
        context.images,
        context.imageAnalysis,
      );
    },
  });

  tools.edit_html = tool({
    description: 'Apply surgical edits to the current HTML using CSS selectors. Use for incremental changes. Returns the full modified HTML as JSON { html, summary }. Each edit needs: selector (CSS), action, and optionally property/value/html.',
    parameters: z.object({
      edits: z.array(z.object({
        selector: z.string().describe('CSS selector targeting elements to edit'),
        action: z.enum(['style', 'set_attr', 'remove_attr', 'add_class', 'remove_class', 'replace_content', 'insert_before', 'insert_after', 'remove', 'replace']),
        property: z.string().optional().describe('CSS property or attribute name'),
        value: z.string().optional().describe('Value for style/class/attribute'),
        html: z.string().optional().describe('HTML content for replace/insert actions'),
      })).describe('Array of edit operations'),
    }),
    execute: async ({ edits }) => {
      if (!edits || edits.length === 0) return 'Error: No edits provided.';
      if (!context.currentHtml) return 'Error: No current HTML to edit. Use generate_html instead.';
      return await toolEditHtml(edits as EditOperation[], context.currentHtml);
    },
  });

  tools.generate_spec = tool({
    description: 'Generate a JSON design spec for IG content (carousels, stories). Outputs structured JSON, not HTML. Use this for Instagram carousel and story projects.',
    parameters: z.object({
      prompt: z.string().describe('Design description for the IG content'),
      slideCount: z.number().optional().describe('Number of slides (for carousels)'),
    }),
    execute: async ({ prompt, slideCount }) => {
      if (!prompt) return 'Error: No prompt provided.';
      return await toolGenerateSpec(
        prompt,
        context.layout || '4:5',
        context.projectType || 'ig-carousel',
        slideCount || context.slideCount || context.totalSlides,
        context.model,
        context.provider,
        context.images,
        context.imageAnalysis,
        context.currentSpec,
        context.referenceSpec,
        context.componentContext,
      );
    },
  });

  tools.edit_spec = tool({
    description: 'Edit specific fields in an existing JSON design spec using JSON path notation (e.g. "slides[0].elements[0].text"). Returns the complete updated spec.',
    parameters: z.object({
      edits: z.array(z.object({
        path: z.string().describe('JSON path to the field (e.g. "slides[0].elements[0].text")'),
        value: z.any().describe('New value for the field'),
      })).describe('Array of path/value edits'),
    }),
    execute: async ({ edits }) => {
      if (!edits || edits.length === 0) return 'Error: No edits provided.';
      if (!context.currentSpec) return 'Error: No current spec to edit. Use generate_spec first.';
      return await toolEditSpec(
        context.currentSpec,
        edits,
        context.layout || '4:5',
        context.model,
        context.provider,
      );
    },
  });

  tools.search_library = tool({
    description: 'Search the skema component library for reusable components, templates, snippets, and design elements.',
    parameters: z.object({
      query: z.string().describe('Natural language search query'),
      category: z.string().optional().describe('Optional category filter'),
    }),
    execute: async ({ query, category }) => {
      if (!query) return 'Error: No search query provided.';
      const results = await skemaLibrary.searchComponents(query, context.projectType, 5);
      const filtered = category ? results.filter(r => r.category === category) : results;
      if (filtered.length === 0) return `No components found for "${query}".`;
      const summary = filtered.map(r => {
        const desc = r.description.length > 150 ? r.description.substring(0, 150) + '...' : r.description;
        return `[${r.id}] ${r.name} — ${r.category}, ${r.contentType}\n  ${desc}\n  Relevance: ${(r.score * 100).toFixed(0)}%`;
      }).join('\n\n');
      return `Found ${filtered.length} component(s):\n\n${summary}`;
    },
  });

  tools.web_browse = tool({
    description: 'Fetch and extract text content from a URL. Returns the readable text of the webpage.',
    parameters: z.object({
      url: z.string().describe('The URL to fetch'),
    }),
    execute: async ({ url }) => await toolWebBrowse(url),
  });

  tools.execute_code = tool({
    description: 'Execute JavaScript code in a sandboxed environment and return the output. Use console.log() to see results.',
    parameters: z.object({
      code: z.string().describe('JavaScript code to execute'),
    }),
    execute: async ({ code }) => await toolExecuteCode(code),
  });

  tools.search_web = tool({
    description: 'Search the web for information on a topic. Returns relevant search results.',
    parameters: z.object({
      query: z.string().describe('Search query'),
    }),
    execute: async ({ query }) => await toolSearchWeb(query),
  });

  return tools;
}
