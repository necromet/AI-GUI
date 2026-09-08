import * as cheerio from 'cheerio';
import { streamChatCompletion, readSSEStream, type ChatMessage } from '../mimoService';
import { buildSpecSystemPrompt, buildSpecEditSystemPrompt } from '../skemaSpecPrompt';

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

export interface EditOperation {
  selector: string;
  action: 'style' | 'set_attr' | 'remove_attr' | 'add_class' | 'remove_class' | 'replace_content' | 'insert_before' | 'insert_after' | 'remove' | 'replace';
  property?: string;
  value?: string;
  html?: string;
}

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
