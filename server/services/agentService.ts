import { runInNewContext } from 'vm';
import * as cheerio from 'cheerio';
import { chatCompletion, streamChatCompletion, readSSEStream, ChatMessage } from './mimoService';
import { buildSpecSystemPrompt, buildSpecEditSystemPrompt } from './stitchSpecPrompt';
import * as libraryService from './libraryService';

export async function analyzeImages(images: any[], model?: string, provider?: string): Promise<string> {
  if (!images || images.length === 0) return '';

  try {
    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: 'text', text: 'Describe these reference images in detail for use in an HTML design. For each image, note: dominant colors (with hex values), composition, subjects, any text visible, visual style, mood, and key layout elements. Be concise but precise — this will be used as design context.' },
    ];

    for (const img of images) {
      let imageUrl = img.url;

      if (!imageUrl.startsWith('data:')) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const resp = await fetch(imageUrl, { signal: controller.signal });
          clearTimeout(timeout);

          if (!resp.ok) continue;

          const buffer = Buffer.from(await resp.arrayBuffer());
          const mimeType = img.mimeType || resp.headers.get('content-type') || 'image/png';
          imageUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
        } catch {
          continue;
        }
      }

      contentParts.push({ type: 'image_url', image_url: { url: imageUrl } });
    }

    if (contentParts.length <= 1) return '';

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a visual design analyst. Describe images concisely for an HTML designer to reference. Focus on actionable design details: colors, typography, layout, imagery style.' },
      { role: 'user', content: contentParts },
    ];

    const data = await chatCompletion({
      model: model || 'mimo-v2.5',
      messages,
      stream: false,
    }, provider);

    const analysis = data.choices?.[0]?.message?.content?.trim() || '';
    console.log('[image-analysis] Generated analysis (%d chars) for %d images', analysis.length, images.length);
    return analysis;
  } catch (err: any) {
    console.error('[image-analysis] Failed:', err.message);
    return '';
  }
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string }>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  name: string;
  input: Record<string, any>;
  output: string;
  error?: string;
}

export interface EditOperation {
  selector: string;
  action: 'style' | 'set_attr' | 'remove_attr' | 'add_class' | 'remove_class' | 'replace_content' | 'insert_before' | 'insert_after' | 'remove' | 'replace';
  property?: string;
  value?: string;
  html?: string;
}

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    name: 'web_browse',
    description: 'Fetch and extract text content from a URL. Returns the readable text of the webpage.',
    parameters: {
      url: { type: 'string', description: 'The URL to fetch' },
    },
  },
  {
    name: 'execute_code',
    description: 'Execute JavaScript code in a sandboxed environment and return the output. Use console.log() to see results.',
    parameters: {
      code: { type: 'string', description: 'JavaScript code to execute' },
    },
  },
  {
    name: 'search_web',
    description: 'Search the web for information on a topic. Returns relevant search results.',
    parameters: {
      query: { type: 'string', description: 'Search query' },
    },
  },
  {
    name: 'edit_html',
    description: 'Apply surgical edits to an HTML document using CSS selectors. Use for incremental changes to existing HTML. Returns the full modified HTML. Always wrap edits in an array.',
    parameters: {
      edits: { type: 'array', description: 'Array of edit operations. Each: { "selector": "css", "action": "style|set_attr|remove_attr|add_class|remove_class|replace_content|insert_before|insert_after|remove|replace", "property"?: "prop", "value"?: "val", "html"?: "new html" }. Example: [{"selector": "h1", "action": "replace_content", "html": "New Title"}]' },
    },
  },
  {
    name: 'generate_html',
    description: 'Generate a complete HTML file from scratch. Pass a brief text description of what to create — the tool generates the HTML. If the user already provided full HTML, pass it directly and it will be used as-is.',
    parameters: {
      prompt: { type: 'string', description: 'Text description of the design to generate, OR the full HTML code if already written' },
    },
  },
  {
    name: 'generate_spec',
    description: 'Generate a JSON design spec for IG content (carousels, stories). Outputs structured JSON, not HTML. Use this for Instagram carousel and story projects.',
    parameters: {
      prompt: { type: 'string', description: 'Design description for the IG content' },
      slideCount: { type: 'number', description: 'Number of slides (for carousels)' },
    },
  },
  {
    name: 'edit_spec',
    description: 'Edit specific fields in an existing JSON design spec. Use JSON path notation (e.g. "slides[0].elements[0].text"). Returns the complete updated spec.',
    parameters: {
      edits: { type: 'array', description: 'Array of { "path": "json.path", "value": new_value } edits. Example: [{"path": "slides[0].elements[0].text", "value": "New Title"}]' },
    },
  },
  {
    name: 'search_library',
    description: 'Search the component library for reusable components, templates, snippets, patterns, and agent tools. Returns matching components with their content.',
    parameters: {
      query: { type: 'string', description: 'Natural language search query' },
      category: { type: 'string', description: 'Optional category filter: ui-widget, template, snippet, pattern, hook, util, agent-tool' },
    },
  },
];

export function buildToolSystemPrompt(tools: string[]): string {
  const selectedTools = AVAILABLE_TOOLS.filter(t => tools.includes(t.name));
  if (selectedTools.length === 0) return '';

  const toolDescriptions = selectedTools.map(t => {
    const params = Object.entries(t.parameters)
      .map(([name, p]) => `  - ${name} (${p.type}): ${p.description}`)
      .join('\n');
    return `### ${t.name}\n${t.description}\nParameters:\n${params}`;
  }).join('\n\n');

  return `You have access to the following tools. To use a tool, respond with a JSON block in this exact format:

\`\`\`tool
{"name": "tool_name", "arguments": {"param": "value"}}
\`\`\`

You can use multiple tools in sequence. After using a tool, you will receive the result and can continue reasoning or provide a final answer.

Available tools:
${toolDescriptions}

Important: Only use tools when necessary. When you have enough information, provide a clear final answer without using more tools.`;
}

export async function executeTool(call: ToolCall, context?: Record<string, any>, onProgress?: (chunk: string) => void): Promise<ToolResult> {
  const result: ToolResult = { name: call.name, input: call.arguments, output: '' };

  try {
    switch (call.name) {
      case 'web_browse':
        result.output = await toolWebBrowse(call.arguments.url);
        break;
      case 'execute_code':
        result.output = await toolExecuteCode(call.arguments.code);
        break;
      case 'search_web':
        result.output = await toolSearchWeb(call.arguments.query);
        break;
      case 'edit_html': {
        let edits = call.arguments.edits;
        if (!Array.isArray(edits)) {
          if (call.arguments.selector && call.arguments.action) {
            const edit: Record<string, any> = {
              selector: call.arguments.selector,
              action: call.arguments.action,
            };
            if (call.arguments.property) edit.property = call.arguments.property;
            if (call.arguments.html || call.arguments.content) {
              edit.html = call.arguments.html || call.arguments.content;
            }
            if (call.arguments.value) edit.value = call.arguments.value;
            edits = [edit];
          } else {
            edits = [];
          }
        } else {
          edits = edits.map((e: Record<string, any>) => {
            if (e.content && !e.html) {
              return { ...e, html: e.content };
            }
            return e;
          });
        }
        result.output = await toolEditHtml(edits, context?.currentHtml || '');
        break;
      }
      case 'generate_html': {
        const promptOrHtml = call.arguments.prompt || call.arguments.content || call.arguments.html || '';
        if (/<!doctype|<html/i.test(promptOrHtml)) {
          result.output = promptOrHtml;
        } else {
          result.output = await toolGenerateHtml(
            promptOrHtml,
            context?.layout || '16:9',
            context?.boardDescription,
            context?.model,
            context?.provider,
            context?.projectType,
            context?.images,
            context?.imageAnalysis,
            onProgress,
          );
        }
        break;
      }
      case 'generate_spec': {
        const specPrompt = call.arguments.prompt || call.arguments.content || '';
        const specSlideCount = call.arguments.slideCount || context?.slideCount || context?.totalSlides;
        result.output = await toolGenerateSpec(
          specPrompt,
          context?.layout || '4:5',
          context?.projectType || 'ig-carousel',
          specSlideCount,
          context?.model,
          context?.provider,
          context?.images,
          context?.imageAnalysis,
          context?.currentSpec,
          context?.referenceSpec,
          context?.componentContext,
          onProgress,
        );
        break;
      }
      case 'edit_spec': {
        const edits = call.arguments.edits;
        if (!Array.isArray(edits) || edits.length === 0) {
          result.output = 'Error: No edits provided. Provide an array of { path, value } objects.';
          result.error = 'No edits';
        } else if (!context?.currentSpec) {
          result.output = 'Error: No current spec to edit. Use generate_spec first.';
          result.error = 'No current spec';
        } else {
          result.output = await toolEditSpec(
            context.currentSpec,
            edits,
            context?.layout || '4:5',
            context?.model,
            context?.provider,
            onProgress,
          );
        }
        break;
      }
      case 'search_library': {
        const query = call.arguments.query || call.arguments.description || '';
        const category = call.arguments.category;
        if (!query) {
          result.output = 'Error: No search query provided.';
          result.error = 'No query';
        } else {
          const results = await libraryService.searchComponents(query, 5);
          const filtered = category ? results.filter(r => r.category === category) : results;
          if (filtered.length === 0) {
            result.output = `No components found in the library for "${query}".`;
          } else {
            const summary = filtered.map(r =>
              `[${r.name}] (${r.category}, ${r.contentType}) — ${r.description}\nRelevance: ${(r.score * 100).toFixed(0)}%\nContent preview: ${r.content.substring(0, 200)}${r.content.length > 200 ? '...' : ''}`
            ).join('\n\n');
            result.output = `Found ${filtered.length} matching component(s):\n\n${summary}`;
          }
        }
        break;
      }
      default:
        result.output = `Unknown tool: ${call.name}`;
        result.error = 'Tool not found';
    }
  } catch (err: any) {
    result.output = '';
    result.error = err.message || 'Tool execution failed';
  }

  return result;
}

export async function toolWebBrowse(url: string): Promise<string> {
  if (!url) return 'Error: No URL provided';

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EdwardLabs/1.0)',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return `Error: HTTP ${response.status} ${response.statusText}`;
    }

    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000);

    return text || 'No readable content found';
  } catch (err: any) {
    return `Error fetching URL: ${err.message}`;
  }
}

export async function toolExecuteCode(code: string): Promise<string> {
  if (!code) return 'Error: No code provided';

  const logs: string[] = [];
  const context = {
    console: {
      log: (...args: any[]) => {
        logs.push(args.map(a => {
          if (typeof a === 'object') {
            try { return JSON.stringify(a, null, 2); } catch { return String(a); }
          }
          return String(a);
        }).join(' '));
      },
      error: (...args: any[]) => {
        logs.push('[error] ' + args.map(String).join(' '));
      },
      warn: (...args: any[]) => {
        logs.push('[warn] ' + args.map(String).join(' '));
      },
    },
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
  };

  try {
    runInNewContext(code, context, { timeout: 5000 });
    return logs.length > 0 ? logs.join('\n') : '(no output)';
  } catch (err: any) {
    const errorMsg = err.message || 'Execution error';
    return logs.length > 0
      ? logs.join('\n') + `\n[error] ${errorMsg}`
      : `Error: ${errorMsg}`;
  }
}

export async function toolSearchWeb(query: string): Promise<string> {
  if (!query) return 'Error: No search query provided';

  try {
    const encoded = encodeURIComponent(query);
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EdwardLabs/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return `Search error: HTTP ${response.status}`;
    }

    const html = await response.text();
    const results: string[] = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = resultRegex.exec(html)) !== null && count < 5) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      if (title && url) {
        results.push(`${count + 1}. ${title}\n   ${url}`);
        count++;
      }
    }

    return results.length > 0
      ? `Search results for "${query}":\n\n${results.join('\n\n')}`
      : `No search results found for "${query}"`;
  } catch (err: any) {
    return `Search error: ${err.message}`;
  }
}

export const LAYOUT_DIMS: Record<string, string> = {
  '16:9': '1920x1080',
  '1:1': '1080x1080',
  '9:16': '1080x1920',
  '4:5': '1080x1350',
  '1.91:1': '1200x628',
  '4:3': '1440x1080',
  '3:4': '1080x1440',
  '32:9': '2560x1080',
};

export async function toolEditHtml(edits: EditOperation[], html: string): Promise<string> {
  if (!html) return 'Error: No HTML provided to edit. Use generate_html instead.';
  if (!edits || !Array.isArray(edits) || edits.length === 0) return 'Error: No edits provided.';

  const $ = cheerio.load(html);
  const applied: string[] = [];
  const errors: string[] = [];

  for (const edit of edits) {
    try {
      const el = $(edit.selector);
      if (el.length === 0) {
        errors.push(`Selector "${edit.selector}" matched no elements`);
        continue;
      }

      switch (edit.action) {
        case 'style':
          if (edit.property && edit.value !== undefined) {
            el.each((_, e) => {
              const current = $(e).attr('style') || '';
              const propRegex = new RegExp(`${edit.property}\\s*:[^;]+;?`, 'i');
              const newStyle = current.replace(propRegex, '').trim();
              $(e).attr('style', `${newStyle}${newStyle ? '; ' : ''}${edit.property}: ${edit.value}`);
            });
            applied.push(`Set ${edit.property}="${edit.value}" on ${edit.selector}`);
          }
          break;

        case 'set_attr':
          if (edit.property && edit.value !== undefined) {
            el.attr(edit.property, edit.value);
            applied.push(`Set attr ${edit.property}="${edit.value}" on ${edit.selector}`);
          }
          break;

        case 'remove_attr':
          if (edit.property) {
            el.removeAttr(edit.property);
            applied.push(`Removed attr ${edit.property} from ${edit.selector}`);
          }
          break;

        case 'add_class':
          if (edit.value) {
            el.addClass(edit.value);
            applied.push(`Added class "${edit.value}" to ${edit.selector}`);
          }
          break;

        case 'remove_class':
          if (edit.value) {
            el.removeClass(edit.value);
            applied.push(`Removed class "${edit.value}" from ${edit.selector}`);
          }
          break;

        case 'replace_content':
          if (edit.html !== undefined) {
            el.html(edit.html);
            applied.push(`Replaced content of ${edit.selector}`);
          }
          break;

        case 'insert_before':
          if (edit.html) {
            el.before(edit.html);
            applied.push(`Inserted HTML before ${edit.selector}`);
          }
          break;

        case 'insert_after':
          if (edit.html) {
            el.after(edit.html);
            applied.push(`Inserted HTML after ${edit.selector}`);
          }
          break;

        case 'remove':
          el.remove();
          applied.push(`Removed ${edit.selector}`);
          break;

        case 'replace':
          if (edit.html) {
            el.replaceWith(edit.html);
            applied.push(`Replaced ${edit.selector}`);
          }
          break;

        default:
          errors.push(`Unknown action: ${edit.action}`);
      }
    } catch (err: any) {
      errors.push(`Error on ${edit.selector}: ${err.message}`);
    }
  }

  const result = $.html();
  const summary = [`Applied ${applied.length}/${edits.length} edits:`];
  summary.push(...applied.map(a => `  + ${a}`));
  if (errors.length > 0) {
    summary.push(`Errors (${errors.length}):`);
    summary.push(...errors.map(e => `  - ${e}`));
  }

  return JSON.stringify({ html: result, summary: summary.join('\n') });
}

export async function toolGenerateHtml(prompt: string, layout: string, boardDescription?: string, model?: string, provider?: string, projectType?: string, images?: any[], imageAnalysis?: string, onProgress?: (chunk: string) => void): Promise<string> {
  const dims = LAYOUT_DIMS[layout] || '1920x1080';

  let imagePrompt = '';
  if (images && images.length > 0) {
    const imageLines = images.map((img: any) => `- "${img.label}" \u2192 ${img.url}`).join('\n');
    imagePrompt = `\n\nAvailable images:\n${imageLines}\n\nUse these images with <img> tags. Use object-fit: cover for backgrounds. Do NOT use placeholder gradients when images are provided.`;
  }

  if (imageAnalysis) {
    imagePrompt += `\n\nImage Analysis (from vision model — use this to inform your design):\n${imageAnalysis}`;
  }

  let igPrompt = '';
  if (projectType === 'ig-carousel') {
    igPrompt = `\n\nINSTAGRAM CAROUSEL: Mobile-first design, large bold text (min 24px body), 5% safe margins, vibrant colors for thumbnails.`;
  } else if (projectType === 'ig-story') {
    igPrompt = `\n\nINSTAGRAM STORY: Full-screen 9:16, keep text in center 80%, large text (min 28px), high contrast.`;
  }

  const systemPrompt = `You are an expert HTML/CSS designer. Generate a single self-contained HTML file based on the user's description.

Output ONLY the raw HTML code. No markdown fences, no explanation. The HTML must be complete with inline CSS, ready to render in an iframe.

Layout: ${layout} (${dims}px)
${boardDescription ? `Description: ${boardDescription}` : ''}

Rules:
- The entire design must fit within the given layout dimensions
- Include a viewport meta tag
- Make it visually polished with modern CSS (flexbox, grid where appropriate)
- All images should use placeholder gradients or SVG patterns if no actual URLs are provided
- Ensure text is readable and well-sized
- Output ONLY valid HTML starting with <!DOCTYPE html>${imagePrompt}${igPrompt}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  const response = await streamChatCompletion({
    model: model || 'mimo-v2.5',
    messages,
    stream: true,
    thinking: { type: 'disabled' },
  }, provider);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiMo API error ${response.status}: ${errorText}`);
  }

  let html = '';
  await readSSEStream(response, (chunk) => {
    if (chunk.content) {
      html += chunk.content;
      onProgress?.(chunk.content);
    }
  });

  html = html.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '');

  if (!html || !/<!doctype/i.test(html)) {
    throw new Error('Failed to generate valid HTML');
  }

  return html;
}

export async function toolGenerateSpec(
  prompt: string,
  layout: string,
  projectType: string,
  slideCount?: number,
  model?: string,
  provider?: string,
  images?: any[],
  imageAnalysis?: string,
  currentSpec?: any,
  referenceSpec?: any,
  componentContext?: string,
  onProgress?: (chunk: string) => void,
): Promise<string> {
  const systemPrompt = buildSpecSystemPrompt({
    layout,
    projectType,
    slideCount,
    images,
    imageAnalysis,
    currentSpec,
    referenceSpec,
    componentContext,
  });

  const userContent = currentSpec
    ? `Current spec:\n\`\`\`json\n${JSON.stringify(currentSpec, null, 2)}\n\`\`\`\n\nModification request: ${prompt}`
    : prompt;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const response = await streamChatCompletion({
    model: model || 'mimo-v2.5',
    messages,
    stream: true,
    thinking: { type: 'disabled' },
  }, provider);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiMo API error ${response.status}: ${errorText}`);
  }

  let specText = '';
  await readSSEStream(response, (chunk) => {
    if (chunk.content) {
      specText += chunk.content;
      onProgress?.(chunk.content);
    }
  });

  specText = specText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

  try {
    const parsed = JSON.parse(specText);
    return JSON.stringify(parsed);
  } catch {
    throw new Error('AI did not return valid JSON spec. Raw output: ' + specText.substring(0, 500));
  }
}

export async function toolEditSpec(
  currentSpec: any,
  edits: { path: string; value: any }[],
  layout: string,
  model?: string,
  provider?: string,
  onProgress?: (chunk: string) => void,
): Promise<string> {
  const systemPrompt = buildSpecEditSystemPrompt(currentSpec, layout);

  const editDescription = edits.map(e => `- Set "${e.path}" to ${JSON.stringify(e.value)}`).join('\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Apply these edits:\n${editDescription}` },
  ];

  const response = await streamChatCompletion({
    model: model || 'mimo-v2.5',
    messages,
    stream: true,
    thinking: { type: 'disabled' },
  }, provider);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiMo API error ${response.status}: ${errorText}`);
  }

  let specText = '';
  await readSSEStream(response, (chunk) => {
    if (chunk.content) {
      specText += chunk.content;
      onProgress?.(chunk.content);
    }
  });

  specText = specText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

  try {
    const parsed = JSON.parse(specText);
    return JSON.stringify(parsed);
  } catch {
    throw new Error('AI did not return valid JSON spec after edit. Raw output: ' + specText.substring(0, 500));
  }
}

export function buildStitchSystemPrompt(context?: Record<string, any>): string {
  const currentHtml = context?.currentHtml;
  const layout = context?.layout || '16:9';
  const dims = LAYOUT_DIMS[layout] || '1920x1080';
  const boardDescription = context?.boardDescription;
  const projectType = context?.projectType || 'website';
  const images = context?.images || [];
  const slideNumber = context?.slideNumber;
  const totalSlides = context?.totalSlides;
  const referenceSlideHtml = context?.referenceSlideHtml;

  const hasExistingHtml = !!currentHtml;
  const isIgContent = projectType === 'ig-carousel' || projectType === 'ig-story';

  let imagePrompt = '';
  if (images.length > 0) {
    const imageLines = images.map((img: any) => `- "${img.label}" \u2192 ${img.url}`).join('\n');
    imagePrompt = `\n\nAvailable images to use in the design:\n${imageLines}\n\nRules for images:\n- Use <img> tags with the provided URLs where appropriate\n- Use "object-fit: cover" for background-style images\n- Do NOT use placeholder gradients when actual images are provided\n- Reference images by their label in your design decisions`;
  }

  const imageAnalysis = context?.imageAnalysis;
  if (imageAnalysis) {
    imagePrompt += `\n\nImage Analysis (from vision model \u2014 use this to inform your design):\n${imageAnalysis}`;
  }

  if (isIgContent) {
    const currentSpec = context?.currentSpec;
    const referenceSpec = context?.referenceSpec;
    const componentContext = context?.componentContext;

    let specPrompt = '';
    if (currentSpec) {
      specPrompt = `\n\nCURRENT DESIGN SPEC:\n\`\`\`json\n${JSON.stringify(currentSpec, null, 2)}\n\`\`\`\nThe user wants to modify this spec. Use the edit_spec tool to make targeted changes, or generate_spec to create a completely new design.`;
    }

    let refPrompt = '';
    if (referenceSpec) {
      refPrompt = `\n\nREFERENCE SPEC (slide 1 \u2014 match its theme):\n\`\`\`json\n${JSON.stringify(referenceSpec, null, 2).substring(0, 2000)}\n\`\`\``;
    }

    let compPrompt = '';
    if (componentContext) {
      compPrompt = `\n\nAVAILABLE COMPONENTS:\n${componentContext}`;
    }

    let igRules = '';
    if (projectType === 'ig-carousel') {
      const slideCount = context?.slideCount || context?.totalSlides;
      igRules = `\n\nINSTAGRAM CAROUSEL DESIGN RULES:\n- Mobile-first: large text, high contrast, bold typography\n- Minimum 24px body text, 32px+ headlines\n- Leave 5% safe margin on all edges\n- Vibrant, eye-catching colors for thumbnail views\n- Consistent theme across all slides\n- 4:5 aspect ratio (1080\u00d71350px)`;
      if (slideCount) {
        igRules += `\n- Generate all ${slideCount} slides in a single spec`;
        igRules += `\n- First slide: hook attention with bold headline and striking visual`;
        igRules += `\n- Last slide: strong CTA (Follow, Save, Comment, Share)`;
        igRules += `\n- Middle slides: deliver one key point clearly each`;
      }
    } else if (projectType === 'ig-story') {
      igRules = `\n\nINSTAGRAM STORY DESIGN RULES:\n- Full-screen 9:16 (1080\u00d71920px)\n- Min 28px body text, high contrast\n- Text in center 80% (safe zone)\n- Top 15% and bottom 20% are IG UI overlays`;
    }

    const specToolNote = `You have access to tools for working with JSON design specs:

\`\`\`tool
{"name": "generate_spec", "arguments": {"prompt": "Design description", "slideCount": 5}}
\`\`\`

To edit an existing spec:
\`\`\`tool
{"name": "edit_spec", "arguments": {"edits": [{"path": "slides[0].elements[0].text", "value": "New Title"}]}}
\`\`\`

For IG content, ALWAYS use generate_spec (not generate_html). The spec will be rendered to HTML automatically.
After using a tool, respond with a brief summary of what you created/changed.`;

    return `You are an expert visual designer for Instagram content. You work with JSON design specs, not raw HTML.

CRITICAL RULES:
- For IG content (carousels, stories), ALWAYS use the generate_spec or edit_spec tools
- Do NOT output raw HTML. The spec is rendered to HTML by a deterministic renderer
- After the tool finishes, respond with a concise summary of the design${igRules}${imagePrompt}${specPrompt}${refPrompt}${compPrompt}

${specToolNote}`;
  }

  // Website mode — existing HTML-based flow
  let referencePrompt = '';
  if (referenceSlideHtml && !hasExistingHtml) {
    referencePrompt = `\n\nREFERENCE: Here is slide 1's HTML for visual consistency. Match its color scheme, typography, spacing, and layout style. This slide should feel like a natural continuation:\n\`\`\`html\n${referenceSlideHtml.substring(0, 6000)}\n\`\`\``;
  }

  const toolNote = `You have access to tools. To call a tool, output a fenced JSON block exactly like this:

For editing existing HTML:
\`\`\`tool
{"name": "edit_html", "arguments": {"edits": [{"selector": "h1", "action": "replace_content", "html": "New Title"}]}}
\`\`\`

For generating new HTML from scratch \u2014 pass the FULL HTML code directly:
\`\`\`tool
{"name": "generate_html", "arguments": {"prompt": "<!DOCTYPE html><html>...</html>"}}
\`\`\`

You may write the complete HTML yourself and pass it in the "prompt" field. The tool accepts either a text description or the full HTML code.

IMPORTANT: The "edits" field MUST be an array. Each edit needs "selector", "action", and "html" (not "content").
After using a tool the result is returned to you automatically.`;

  const rules = hasExistingHtml
    ? `You are an expert HTML/CSS editor. The user has an existing HTML design and wants modifications.

CRITICAL RULES:
- ALWAYS use the \`edit_html\` tool to make changes. Do NOT output raw HTML.
- Use surgical CSS selectors to target only the elements that need changing.
- NEVER rewrite the entire file. Only edit what the user asked for.
- You may chain multiple edit operations in a single tool call.
- If the user asks for a completely new design (not an edit), use \`generate_html\` instead.
- After the tool finishes and returns the generated HTML, ALWAYS respond with a concise natural language summary describing the design you created. Do not include raw HTML in your summary.

Good selector examples:
- "h1" \u2014 all h1 elements
- ".hero-title" \u2014 element with class hero-title
- "#main-banner" \u2014 element with id main-banner
- "section > .card:nth-child(2)" \u2014 second .card inside a section
- "header nav a" \u2014 anchor links inside nav inside header

Available edit actions: style, set_attr, remove_attr, add_class, remove_class, replace_content, insert_before, insert_after, remove, replace.

Current HTML:
\`\`\`html
${currentHtml}
\`\`\`

Layout: ${layout} (${dims}px)
${boardDescription ? `Project: ${boardDescription}` : ''}

${toolNote}`
    : `You are an expert HTML/CSS designer. Your job is to generate HTML designs using the \`generate_html\` tool.

CRITICAL RULES:
- ALWAYS use the \`generate_html\` tool to create the design. Do NOT output raw HTML directly.
- After the tool finishes and returns the generated HTML, ALWAYS respond with a concise natural language summary describing the design you created. Do not include raw HTML in your summary.

Layout: ${layout} (${dims}px)
${boardDescription ? `Description: ${boardDescription}` : ''}

Design guidelines:
- The entire design must fit within the given layout dimensions
- Make it visually polished with modern CSS (flexbox, grid where appropriate)
- All images should use placeholder gradients or SVG patterns if no actual URLs are provided
- Ensure text is readable and well-sized

${toolNote}`;

  return rules + imagePrompt + referencePrompt;
}

export function parseToolCalls(response: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const seen = new Set<string>();

  const addCall = (name: string, arguments_: Record<string, any>) => {
    const key = `${name}:${JSON.stringify(arguments_)}`;
    if (seen.has(key)) return;
    seen.add(key);
    calls.push({ name, arguments: arguments_ });
  };

  // XML-like format: <tool_call> <tool_name>...</tool_name> <arguments>...</arguments> </tool_call>
  const xmlRegex = /<tool_call>\s*<tool_name>\s*([\s\S]*?)\s*<\/tool_name>\s*<arguments>\s*([\s\S]*?)\s*<\/arguments>\s*<\/tool_call>/g;
  let match;
  while ((match = xmlRegex.exec(response)) !== null) {
    const name = match[1].trim();
    try {
      const args = JSON.parse(match[2].trim());
      if (name) addCall(name, args);
    } catch {
      if (name) addCall(name, {});
    }
  }

  if (calls.length > 0) return calls;

  // ```tool or ```json code blocks
  const codeBlockRegex = /```(?:tool|json)\s*\n?([\s\S]*?)```/g;
  while ((match = codeBlockRegex.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.name && parsed.arguments) {
        addCall(parsed.name, parsed.arguments);
      } else if (parsed.prompt && !parsed.name) {
        addCall('generate_spec', parsed);
      }
    } catch {}
  }

  if (calls.length > 0) return calls;

  // Bare JSON fallback: {"name":"...","arguments":{...}}
  const jsonRegex = /\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[\s\S]*?\}\s*\}/g;
  while ((match = jsonRegex.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed.name && parsed.arguments) {
        addCall(parsed.name, parsed.arguments);
      }
    } catch {}
  }

  return calls;
}
