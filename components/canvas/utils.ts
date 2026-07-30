import type { SectionType } from './types';

export function detectType(prompt: string): SectionType {
  const p = prompt.toLowerCase();
  if (/nav|header|menu/.test(p)) return 'navbar';
  if (/hero|headline|landing|above.?fold/.test(p)) return 'hero';
  if (/feature|benefit|why/.test(p)) return 'features';
  if (/price|pricing|plan|tier/.test(p)) return 'pricing';
  if (/testimonial|review|quote|feedback/.test(p)) return 'testimonials';
  if (/cta|action|ready|start|sign.?up|get.?started/.test(p)) return 'cta';
  if (/footer|link|sitemap/.test(p)) return 'footer';
  if (/form|input|contact|email|subscribe/.test(p)) return 'form';
  if (/image|photo|visual|illustration|picture/.test(p)) return 'image';
  if (/text|paragraph|content|body|copy/.test(p)) return 'text';
  return 'generic';
}
