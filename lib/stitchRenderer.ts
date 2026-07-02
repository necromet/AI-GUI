import type {
  StitchDesignSpec,
  StitchSlideSpec,
  StitchTheme,
  StitchElement,
  StitchBackground,
  StitchSlideLayout,
} from '../types/stitchSpec';
import type { StitchLayout } from '../types';
import { getLayoutDimensions } from './layoutUtils';

const ICON_SVGS: Record<string, string> = {
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  comment: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  lightning: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  fire: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  chevron_right: '<polyline points="9 18 15 12 9 6"/>',
  chevron_left: '<polyline points="15 18 9 12 15 6"/>',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderIcon(name: string, size: string = '24px', color: string = 'currentColor'): string {
  const pathData = ICON_SVGS[name] || ICON_SVGS.check;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathData}</svg>`;
}

function renderBackground(bg: StitchBackground): string {
  switch (bg.type) {
    case 'solid':
      return `background-color: ${bg.color};`;
    case 'gradient':
      return `background: linear-gradient(${bg.direction || '180deg'}, ${bg.from}, ${bg.to});`;
    case 'image':
      return `background-image: url('${bg.src}'); background-size: cover; background-position: center;${bg.blur ? ` filter: blur(${bg.blur});` : ''}`;
    case 'pattern':
      return `background-color: ${bg.bg || '#fff'};`;
    default:
      return '';
  }
}

function renderPatternOverlay(bg: Extract<StitchBackground, { type: 'pattern' }>, w: number, h: number): string {
  const c = bg.color;
  switch (bg.pattern) {
    case 'dots': {
      let dots = '';
      const spacing = 40;
      for (let x = spacing; x < w; x += spacing) {
        for (let y = spacing; y < h; y += spacing) {
          dots += `<circle cx="${x}" cy="${y}" r="2" fill="${c}" opacity="0.3"/>`;
        }
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">${dots}</svg>`;
    }
    case 'grid': {
      let lines = '';
      const spacing = 60;
      for (let x = 0; x < w; x += spacing) {
        lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${c}" stroke-width="0.5" opacity="0.15"/>`;
      }
      for (let y = 0; y < h; y += spacing) {
        lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${c}" stroke-width="0.5" opacity="0.15"/>`;
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">${lines}</svg>`;
    }
    case 'waves': {
      let waves = '';
      for (let i = 0; i < 6; i++) {
        const y = (h / 6) * i + 60;
        waves += `<path d="M0 ${y} Q ${w * 0.25} ${y - 30} ${w * 0.5} ${y} T ${w} ${y}" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.15"/>`;
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">${waves}</svg>`;
    }
    default:
      return '';
  }
}

function renderElement(el: StitchElement, theme: StitchTheme): string {
  const fontHeading = theme.fonts.heading;
  const fontBody = theme.fonts.body;

  switch (el.type) {
    case 'heading': {
      const size = el.size || '36px';
      const weight = el.weight || '800';
      const color = el.color || theme.colors.text || '#111';
      const align = el.align || 'left';
      return `<h2 style="font-family:${fontHeading};font-size:${size};font-weight:${weight};color:${color};text-align:${align};margin:0;line-height:1.2;">${escapeHtml(el.text)}</h2>`;
    }
    case 'body': {
      const size = el.size || '18px';
      const color = el.color || theme.colors.text || '#333';
      const opacity = el.opacity ?? 1;
      return `<p style="font-family:${fontBody};font-size:${size};color:${color};opacity:${opacity};margin:0;line-height:1.6;">${escapeHtml(el.text)}</p>`;
    }
    case 'image': {
      const fit = el.fit || 'cover';
      const radius = el.radius || theme.borderRadius || '0';
      const w = el.width || '100%';
      const h = el.height || 'auto';
      return `<img src="${escapeHtml(el.src)}" alt="${escapeHtml(el.alt || '')}" style="width:${w};height:${h};object-fit:${fit};border-radius:${radius};display:block;" />`;
    }
    case 'icon': {
      const size = el.size || '24px';
      const color = el.color || theme.colors.accent || '#6366f1';
      return `<div style="display:inline-flex;align-items:center;justify-content:center;">${renderIcon(el.name, size, color)}</div>`;
    }
    case 'svg': {
      const w = el.width || '100px';
      const h = el.height || '100px';
      return `<div style="width:${w};height:${h};display:flex;align-items:center;justify-content:center;">${el.content}</div>`;
    }
    case 'shape': {
      const w = el.width || '100px';
      const h = el.height || '100px';
      const color = el.color || theme.colors.accent || '#6366f1';
      const opacity = el.opacity ?? 1;
      const pos = el.x && el.y
        ? `position:absolute;left:${el.x};top:${el.y};`
        : '';
      switch (el.shape) {
        case 'circle':
          return `<div style="${pos}width:${w};height:${h};border-radius:50%;background:${color};opacity:${opacity};"></div>`;
        case 'rect':
          return `<div style="${pos}width:${w};height:${h};background:${color};opacity:${opacity};border-radius:${theme.borderRadius};"></div>`;
        case 'triangle': {
          const wVal = parseFloat(w);
          const hVal = parseFloat(h);
          if (isNaN(wVal) || w.endsWith('%')) {
            return `<div style="${pos}width:0;height:0;border-left:50px solid transparent;border-right:50px solid transparent;border-bottom:${isNaN(hVal) ? '86' : hVal}px solid ${color};opacity:${opacity};"></div>`;
          }
          return `<div style="${pos}width:0;height:0;border-left:${wVal / 2}px solid transparent;border-right:${wVal / 2}px solid transparent;border-bottom:${isNaN(hVal) ? wVal * 0.866 : hVal}px solid ${color};opacity:${opacity};"></div>`;
        }
        case 'line':
          return `<div style="${pos}width:${w};height:2px;background:${color};opacity:${opacity};"></div>`;
    default:
      return `<div style="padding:8px 12px;background:#fef3c7;border:1px dashed #f59e0b;border-radius:6px;font-size:11px;color:#92400e;font-family:monospace;">Unknown element: ${(el as any).type || 'undefined'}</div>`;
      }
    }
    case 'spacer':
      return `<div style="height:${el.height};"></div>`;
    case 'divider': {
      const color = el.color || theme.colors.text || '#ddd';
      const thickness = el.thickness || '1px';
      return `<hr style="border:none;border-top:${thickness} solid ${color};margin:16px 0;opacity:0.3;" />`;
    }
    case 'card': {
      const inner = el.elements.map(e => renderElement(e, theme)).join('\n');
      const bg = el.bg || theme.colors.bg || '#fff';
      const border = el.border || 'none';
      const radius = el.radius || theme.borderRadius || '12px';
      const padding = el.padding || theme.spacing || '20px';
      return `<div style="background:${bg};border:${border};border-radius:${radius};padding:${padding};">${inner}</div>`;
    }
    case 'list': {
      const iconHtml = el.icon ? renderIcon(el.icon, '16px', theme.colors.accent || '#6366f1') : '';
      const items = el.items.map((item, i) => {
        let prefix = '';
        if (el.style === 'number') prefix = `<span style="font-weight:700;color:${theme.colors.accent || '#6366f1'};margin-right:8px;">${i + 1}.</span>`;
        else if (el.style === 'check' || el.icon) prefix = `<span style="margin-right:8px;display:inline-flex;align-items:center;">${iconHtml || renderIcon('check', '16px', theme.colors.accent || '#6366f1')}</span>`;
        else prefix = `<span style="color:${theme.colors.accent || '#6366f1'};margin-right:8px;">•</span>`;
        return `<li style="display:flex;align-items:flex-start;margin-bottom:8px;font-family:${theme.fonts.body};font-size:16px;color:${theme.colors.text || '#333'};">${prefix}<span>${escapeHtml(item)}</span></li>`;
      }).join('');
      return `<ul style="list-style:none;padding:0;margin:0;">${items}</ul>`;
    }
    case 'button': {
      const bg = el.bg || theme.colors.accent || '#6366f1';
      const color = el.color || '#fff';
      const radius = el.radius || theme.borderRadius || '12px';
      const size = el.size || '16px';
      return `<button style="background:${bg};color:${color};border:none;border-radius:${radius};padding:14px 32px;font-size:${size};font-weight:700;font-family:${theme.fonts.body};cursor:pointer;display:inline-block;text-align:center;">${escapeHtml(el.text)}</button>`;
    }
    case 'badge': {
      const bg = el.bg || `${theme.colors.accent || '#6366f1'}22`;
      const color = el.color || theme.colors.accent || '#6366f1';
      return `<span style="display:inline-block;background:${bg};color:${color};padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;font-family:${theme.fonts.body};">${escapeHtml(el.text)}</span>`;
    }
    case 'progress': {
      const color = el.color || theme.colors.accent || '#6366f1';
      const label = el.label ? `<span style="font-size:12px;color:${theme.colors.text || '#333'};margin-bottom:4px;display:block;font-family:${theme.fonts.body};">${escapeHtml(el.label)}</span>` : '';
      return `<div style="width:100%;">${label}<div style="width:100%;height:8px;background:${theme.colors.bg || '#eee'};border-radius:999px;overflow:hidden;"><div style="width:${el.value}%;height:100%;background:${color};border-radius:999px;"></div></div></div>`;
    }
    case 'quote':
      return `<blockquote style="border-left:4px solid ${theme.colors.accent || '#6366f1'};padding-left:16px;margin:0;font-family:${theme.fonts.body};font-size:20px;font-style:italic;color:${theme.colors.text || '#333'};line-height:1.6;">${escapeHtml(el.text)}${el.author ? `<footer style="font-size:14px;font-style:normal;margin-top:8px;opacity:0.7;">— ${escapeHtml(el.author)}</footer>` : ''}</blockquote>`;
    case 'swipe-indicator': {
      const dir = el.direction || 'right';
      const arrow = dir === 'right' ? '→' : '←';
      return `<div style="text-align:center;font-size:14px;color:${theme.colors.text || '#999'};opacity:0.6;padding:8px 0;animation:swipe-${dir} 1.5s ease-in-out infinite;">Swipe ${arrow}</div>`;
    }
    case 'cta': {
      const iconHtml = el.icon ? renderIcon(el.icon, '20px', theme.colors.accent || '#6366f1') : '';
      return `<div style="text-align:center;"><div style="font-size:28px;font-weight:800;font-family:${theme.fonts.heading};color:${theme.colors.text || '#111'};margin-bottom:8px;">${escapeHtml(el.text)}</div>${el.subtitle ? `<div style="font-size:16px;font-family:${theme.fonts.body};color:${theme.colors.text || '#333'};opacity:0.7;margin-bottom:12px;">${escapeHtml(el.subtitle)}</div>` : ''}${iconHtml ? `<div style="margin-top:8px;">${iconHtml}</div>` : ''}</div>`;
    }
    default:
      return '';
  }
}

function getLayoutStyles(layout: StitchSlideLayout, theme: StitchTheme): string {
  const padding = theme.spacing || '5%';
  switch (layout) {
    case 'centered':
      return `display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${padding};text-align:center;gap:16px;`;
    case 'split-left':
      return `display:grid;grid-template-columns:1fr 1fr;align-items:center;padding:${padding};gap:32px;`;
    case 'split-right':
      return `display:grid;grid-template-columns:1fr 1fr;align-items:center;padding:${padding};gap:32px;direction:rtl;`;
    case 'top-bottom':
      return `display:flex;flex-direction:column;padding:${padding};gap:24px;`;
    case 'hero':
      return `display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:${padding};gap:16px;`;
    case 'listicle':
      return `display:flex;flex-direction:column;padding:${padding};gap:16px;`;
    case 'quote-card':
      return `display:flex;align-items:center;justify-content:center;padding:${padding};`;
    case 'full-image':
      return `position:relative;width:100%;height:100%;display:flex;align-items:flex-end;padding:${padding};`;
    case 'grid-2x2':
      return `display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;padding:${padding};gap:16px;`;
    case 'comparison':
      return `display:grid;grid-template-columns:1fr 1fr;padding:${padding};gap:24px;`;
    case 'custom':
      return `position:relative;width:100%;height:100%;padding:${padding};`;
    default:
      return `display:flex;flex-direction:column;padding:${padding};gap:16px;`;
  }
}

export function renderSlide(spec: StitchSlideSpec, theme: StitchTheme, layout: StitchLayout): string {
  const dims = getLayoutDimensions(layout);
  const w = dims.width;
  const h = dims.height;

  const bgStyle = spec.background ? renderBackground(spec.background) : `background-color: ${theme.colors.bg || '#ffffff'};`;
  const layoutStyle = getLayoutStyles(spec.layout, theme);
  const overlayStyle = spec.overlay
    ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:${spec.overlay.color};opacity:${spec.overlay.opacity};pointer-events:none;"></div>`
    : '';

  let patternOverlay = '';
  if (spec.background?.type === 'pattern') {
    patternOverlay = renderPatternOverlay(spec.background, w, h);
  }

  const elementsHtml = spec.elements.map(el => renderElement(el, theme)).join('\n');

  const swipeAnim = `@keyframes swipe-right{0%,100%{transform:translateX(0);opacity:0.6}50%{transform:translateX(8px);opacity:1}}@keyframes swipe-left{0%,100%{transform:translateX(0);opacity:0.6}50%{transform:translateX(-8px);opacity:1}}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:${w}px;height:${h}px;overflow:hidden;}
body{${bgStyle}${layoutStyle}font-family:${theme.fonts.body};position:relative;}
${swipeAnim}
</style>
</head>
<body>
${patternOverlay}
${overlayStyle}
${elementsHtml}
</body>
</html>`;
}

export function renderAllSlides(spec: StitchDesignSpec, layout: StitchLayout): string[] {
  return spec.slides.map(slide => renderSlide(slide, spec.theme, layout));
}

export function validateDesignSpec(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Spec is not an object'] };
  }
  if (data.version !== 1) {
    errors.push('version must be 1');
  }
  if (!data.theme || typeof data.theme !== 'object') {
    errors.push('Missing theme object');
  } else {
    if (!data.theme.fonts?.heading) errors.push('Missing theme.fonts.heading');
    if (!data.theme.fonts?.body) errors.push('Missing theme.fonts.body');
    if (!data.theme.colors) errors.push('Missing theme.colors');
  }
  if (!Array.isArray(data.slides) || data.slides.length === 0) {
    errors.push('slides must be a non-empty array');
  } else {
    for (let i = 0; i < data.slides.length; i++) {
      const slide = data.slides[i];
      if (!slide.layout) errors.push(`slides[${i}]: missing layout`);
      if (!Array.isArray(slide.elements)) errors.push(`slides[${i}]: elements must be an array`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function applySpecEdits(spec: StitchDesignSpec, edits: { path: string; value: any }[]): StitchDesignSpec {
  const clone = JSON.parse(JSON.stringify(spec));

  for (const edit of edits) {
    const parts = edit.path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let target: any = clone;
    let valid = true;

    for (let i = 0; i < parts.length - 1; i++) {
      const key = isNaN(Number(parts[i])) ? parts[i] : Number(parts[i]);
      if (target == null || target[key] === undefined) {
        valid = false;
        break;
      }
      target = target[key];
    }

    if (!valid || target == null) continue;

    const lastKey = parts[parts.length - 1];
    const key = isNaN(Number(lastKey)) ? lastKey : Number(lastKey);
    if (typeof key === 'number' && Array.isArray(target)) {
      if (key >= 0 && key < target.length) {
        target[key] = edit.value;
      }
    } else if (typeof key === 'string' && typeof target === 'object' && target !== null) {
      target[key] = edit.value;
    }
  }

  return clone;
}
