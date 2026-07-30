const SPEC_JSON_SCHEMA = `{
  "version": 1,
  "theme": {
    "fonts": { "heading": "string (font name)", "body": "string (font name)" },
    "colors": { "bg": "#hex", "text": "#hex", "accent": "#hex", "secondary": "#hex" },
    "borderRadius": "string (e.g. 12px)",
    "spacing": "string (e.g. 5%)"
  },
  "slides": [
    {
      "layout": "centered|split-left|split-right|top-bottom|hero|listicle|quote-card|full-image|grid-2x2|comparison|custom",
      "elements": [
        { "type": "heading", "text": "...", "size": "36px", "weight": "800", "color": "#hex" },
        { "type": "body", "text": "...", "size": "18px", "color": "#hex" },
        { "type": "image", "src": "url", "alt": "...", "fit": "cover", "width": "100%" },
        { "type": "icon", "name": "check|star|heart|arrow|lightning|fire|...", "size": "24px", "color": "#hex" },
        { "type": "shape", "shape": "circle|rect|triangle|line", "width": "100px", "height": "100px", "color": "#hex" },
        { "type": "spacer", "height": "32px" },
        { "type": "divider", "color": "#hex", "thickness": "1px" },
        { "type": "card", "elements": [...], "bg": "#hex", "padding": "20px" },
        { "type": "list", "items": ["item1", "item2"], "style": "check|bullet|number", "icon": "check" },
        { "type": "button", "text": "...", "bg": "#hex", "color": "#fff" },
        { "type": "badge", "text": "...", "bg": "#hex22", "color": "#hex" },
        { "type": "progress", "value": 75, "label": "...", "color": "#hex" },
        { "type": "quote", "text": "...", "author": "..." },
        { "type": "swipe-indicator", "direction": "right|left" },
        { "type": "cta", "text": "...", "subtitle": "...", "icon": "arrow" }
      ],
      "background": { "type": "solid|gradient|image|pattern", "color": "#hex" },
      "overlay": { "color": "#000", "opacity": 0.3 }
    }
  ],
  "metadata": { "title": "...", "projectType": "ig-carousel|ig-story", "slideCount": 5 }
}`;

export function buildSpecSystemPrompt(options: {
  layout: string;
  projectType: string;
  slideCount?: number;
  images?: any[];
  imageAnalysis?: string;
  referenceSpec?: any;
  currentSpec?: any;
  componentContext?: string;
}): string {
  const { layout, projectType, slideCount, images, imageAnalysis, referenceSpec, currentSpec, componentContext } = options;

  const dimsMap: Record<string, string> = {
    '4:5': '1080x1350',
    '9:16': '1080x1920',
    '1:1': '1080x1080',
    '16:9': '1920x1080',
  };
  const dims = dimsMap[layout] || '1080x1350';

  let imagePrompt = '';
  if (images && images.length > 0) {
    const imageLines = images.map((img: any) => `- "${img.label}" → ${img.url}`).join('\n');
    imagePrompt = `\n\nAvailable images:\n${imageLines}\n\nUse these image URLs in the "src" field of image elements. Do NOT use placeholder URLs when real images are provided.`;
  }
  if (imageAnalysis) {
    imagePrompt += `\n\nImage Analysis (from vision model):\n${imageAnalysis}`;
  }

  let igRules = '';
  if (projectType === 'ig-carousel') {
    igRules = `
INSTAGRAM CAROUSEL RULES:
- Mobile-first: large text (min 24px body, 32px+ headlines), high contrast, bold typography
- 5% safe margins on all edges (Instagram crops slightly)
- Vibrant, eye-catching colors for small thumbnail view
- Maintain consistent theme (fonts, colors, spacing) across ALL slides
- Aspect ratio: 4:5 (${dims}px)
- Slide structure:
  - Slide 1: Hook attention — bold headline, striking visual, no swipe indicator
  - Middle slides: One key point each, with swipe indicator
  - Last slide: Strong CTA (Follow, Save, Comment, Share), no swipe indicator
- Use "swipe-indicator" element on slides that are not the last`;
  } else if (projectType === 'ig-story') {
    igRules = `
INSTAGRAM STORY/REEL RULES:
- Full-screen vertical: 9:16 (${dims}px)
- Thumb-friendly mobile interaction
- Keep text in center 80% (safe zone)
- Min 28px body text, high contrast for outdoor viewing
- Top 15% and bottom 20% are IG UI overlays — no content there`;
  }

  let referencePrompt = '';
  if (referenceSpec) {
    referencePrompt = `\n\nREFERENCE SPEC (from slide 1 — match its theme for visual consistency):\n\`\`\`json\n${JSON.stringify(referenceSpec, null, 2).substring(0, 3000)}\n\`\`\`\nUse the same theme (fonts, colors, borderRadius, spacing) and similar layout patterns.`;
  }

  let editPrompt = '';
  if (currentSpec) {
    editPrompt = `\n\nCURRENT SPEC (user wants to modify this):\n\`\`\`json\n${JSON.stringify(currentSpec, null, 2)}\n\`\`\`\nModify the spec based on the user's request. Return the COMPLETE updated spec.`;
  }

  let componentPrompt = '';
  if (componentContext) {
    componentPrompt = `\n\nAVAILABLE COMPONENTS (use as building blocks, adapt to the design):\n${componentContext}`;
  }

  const slideCountRule = slideCount
    ? `\n- Generate exactly ${slideCount} slides in the "slides" array`
    : '';

  return `You are an expert visual designer for Instagram content. Output a JSON design spec (NOT HTML).

OUTPUT FORMAT: Valid JSON matching this schema:
${SPEC_JSON_SCHEMA}

RULES:
- Output ONLY valid JSON. No markdown fences, no explanation, no text before or after.
- The "theme" object MUST be consistent across all slides
- Use element types: heading, body, image, icon, svg, shape, spacer, divider, card, list, button, badge, progress, quote, swipe-indicator, cta
- Available layouts: centered, split-left, split-right, top-bottom, hero, listicle, quote-card, full-image, grid-2x2, comparison, custom
- Mobile-first: large text (min 24px body for IG), high contrast, bold typography
- 5% safe margins on all edges
- All color values must be valid hex (#RRGGBB) or rgba()
- Image "src" must be a valid URL${slideCountRule}${igRules}${imagePrompt}${referencePrompt}${editPrompt}${componentPrompt}`;
}

export function buildSpecEditSystemPrompt(currentSpec: any, layout: string): string {
  return `You are a JSON spec editor. You have a current design spec and need to apply the user's requested changes.

CURRENT SPEC:
\`\`\`json
${JSON.stringify(currentSpec, null, 2)}
\`\`\`

RULES:
- Output the COMPLETE updated JSON spec (not just the changed parts)
- Output ONLY valid JSON. No markdown fences, no explanation.
- Preserve all fields the user didn't ask to change
- Keep the theme consistent across all slides
- Layout: ${layout}

Available edit operations:
- Change text content of elements
- Change colors, sizes, fonts
- Replace or reorder elements
- Add or remove elements
- Change layouts
- Modify backgrounds`;
}
