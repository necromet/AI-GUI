import { runInNewContext } from 'vm';
import * as cheerio from 'cheerio';
import { chatCompletion, ChatMessage } from './mimoService';

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
    description: 'Apply surgical edits to an HTML document using CSS selectors. Use for incremental changes to existing HTML. Returns the full modified HTML.',
    parameters: {
      edits: { type: 'array', description: 'JSON array of edit operations. Each edit: { selector: string, action: "style"|"set_attr"|"remove_attr"|"add_class"|"remove_class"|"replace_content"|"insert_before"|"insert_after"|"remove"|"replace", property?: string, value?: string, html?: string }' },
    },
  },
  {
    name: 'generate_html',
    description: 'Generate a complete HTML file from scratch. Use for first-time generation or major redesigns that would require too many edits.',
    parameters: {
      prompt: { type: 'string', description: 'Description of the HTML to generate' },
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

export async function executeTool(call: ToolCall, context?: Record<string, any>): Promise<ToolResult> {
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
      case 'edit_html':
        result.output = await toolEditHtml(call.arguments.edits, context?.currentHtml || '');
        break;
      case 'generate_html':
        result.output = await toolGenerateHtml(
          call.arguments.prompt,
          context?.layout || '16:9',
          context?.boardDescription,
          context?.model,
          context?.provider,
        );
        break;
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

async function toolWebBrowse(url: string): Promise<string> {
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

async function toolExecuteCode(code: string): Promise<string> {
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

async function toolSearchWeb(query: string): Promise<string> {
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

const LAYOUT_DIMS: Record<string, string> = {
  '16:9': '1920x1080',
  '1:1': '1080x1080',
  '9:16': '1080x1920',
};

async function toolEditHtml(edits: EditOperation[], html: string): Promise<string> {
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

async function toolGenerateHtml(prompt: string, layout: string, boardDescription?: string, model?: string, provider?: string): Promise<string> {
  const dims = LAYOUT_DIMS[layout] || '1920x1080';

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
- Output ONLY valid HTML starting with <!DOCTYPE html>`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  const data = await chatCompletion({
    model: model || 'mimo-v2.5',
    messages,
    stream: false,
  }, provider);

  let html = data.choices?.[0]?.message?.content?.trim() || '';
  html = html.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '');

  if (!html || !/<!doctype/i.test(html)) {
    throw new Error('Failed to generate valid HTML');
  }

  return html;
}

export function buildStitchSystemPrompt(context?: Record<string, any>): string {
  const currentHtml = context?.currentHtml;
  const layout = context?.layout || '16:9';
  const dims = LAYOUT_DIMS[layout] || '1920x1080';
  const boardDescription = context?.boardDescription;

  const hasExistingHtml = !!currentHtml;

  const toolNote = `You also have access to tools (edit_html, generate_html) which you can use by outputting a JSON block like:
\`\`\`tool
{"name": "tool_name", "arguments": {...}}
\`\`\`
Using tools is optional. If you use a tool, the result will be returned to you automatically.`;

  const rules = hasExistingHtml
    ? `You are an expert HTML/CSS code editor. The user has an existing HTML file and wants modifications.
You will receive the current HTML and a modification request.
Apply ONLY the requested changes. Preserve all existing design, content, and structure that isn't affected.
Output the COMPLETE modified HTML file (not just the changed parts).
Output ONLY raw HTML starting with <!DOCTYPE html>.

Current HTML:
\`\`\`html
${currentHtml}
\`\`\`

Layout: ${layout} (${dims}px)
${boardDescription ? `Project: ${boardDescription}` : ''}

${toolNote}`
    : `You are an expert HTML/CSS designer. Generate a single self-contained HTML file based on the user's description.

Output ONLY the raw HTML code. No markdown fences, no explanation. The HTML must be complete with inline CSS, ready to render in an iframe.

Layout: ${layout} (${dims}px)
${boardDescription ? `Description: ${boardDescription}` : ''}

Rules:
- The entire design must fit within the given layout dimensions
- Include a viewport meta tag
- Make it visually polished with modern CSS (flexbox, grid where appropriate)
- All images should use placeholder gradients or SVG patterns if no actual URLs are provided
- Ensure text is readable and well-sized
- Output ONLY valid HTML starting with <!DOCTYPE html>

${toolNote}`;

  return rules;
}

export function parseToolCalls(response: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const regex = /```tool\s*\n?([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.name && parsed.arguments) {
        calls.push({ name: parsed.name, arguments: parsed.arguments });
      }
    } catch {
      // skip malformed tool calls
    }
  }

  return calls;
}
