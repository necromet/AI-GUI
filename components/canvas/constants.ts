import type { SectionType, ResolutionTemplate, ResolutionConfig } from './types';

export const COLORS: Record<SectionType, string> = {
  navbar: '#818cf8',
  hero: '#fbbf24',
  features: '#34d399',
  testimonials: '#c084fc',
  pricing: '#f87171',
  cta: '#fb923c',
  footer: '#94a3b8',
  form: '#60a5fa',
  text: '#a78bfa',
  image: '#2dd4bf',
  generic: '#6b7280',
};

export const SECTION_TYPES: Record<SectionType, { label: string; rows: number; color: string }> = {
  navbar:       { label: 'Navbar',       rows: 1, color: COLORS.navbar },
  hero:         { label: 'Hero',         rows: 2, color: COLORS.hero },
  features:     { label: 'Features',     rows: 2, color: COLORS.features },
  testimonials: { label: 'Testimonials', rows: 2, color: COLORS.testimonials },
  pricing:      { label: 'Pricing',      rows: 2, color: COLORS.pricing },
  cta:          { label: 'CTA Banner',   rows: 1, color: COLORS.cta },
  footer:       { label: 'Footer',       rows: 1, color: COLORS.footer },
  form:         { label: 'Form',         rows: 2, color: COLORS.form },
  text:         { label: 'Text Block',   rows: 1, color: COLORS.text },
  image:        { label: 'Image',        rows: 2, color: COLORS.image },
  generic:      { label: 'Generic',      rows: 1, color: COLORS.generic },
};

export const RESOLUTIONS: Record<ResolutionTemplate, ResolutionConfig> = {
  'desktop-1080p': { label: 'Desktop 1080p',  width: 960,  height: 540, cols: 12, cellW: 80,  cellH: 80 },
  'desktop-1440p': { label: 'Desktop 1440p',  width: 720,  height: 450, cols: 12, cellW: 60,  cellH: 80 },
  'desktop-2k':    { label: 'Desktop 2K',     width: 1280, height: 720, cols: 16, cellW: 80,  cellH: 80 },
  'desktop-4k':    { label: 'Desktop 4K',     width: 1280, height: 720, cols: 16, cellW: 80,  cellH: 80 },
  'macbook-14':    { label: 'MacBook Pro 14"', width: 756, height: 491, cols: 12, cellW: 63,  cellH: 80 },
  'macbook-16':    { label: 'MacBook Pro 16"', width: 864, height: 559, cols: 12, cellW: 72,  cellH: 80 },
  'ultrawide':     { label: 'Ultrawide 21:9', width: 1200, height: 514, cols: 16, cellW: 75,  cellH: 80 },
  'tablet':        { label: 'Tablet',          width: 384,  height: 512, cols: 8,  cellW: 48,  cellH: 80 },
  'mobile':        { label: 'Mobile',          width: 188,  height: 406, cols: 4,  cellW: 47,  cellH: 80 },
};

export const DEFAULT_TEMPLATE: ResolutionTemplate = 'desktop-1080p';
export const ROWS = 20;
