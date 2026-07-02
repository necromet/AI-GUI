export interface StitchTheme {
  fonts: { heading: string; body: string };
  colors: Record<string, string>;
  borderRadius: string;
  spacing: string;
}

export type StitchElement =
  | { type: 'heading'; text: string; size?: string; weight?: string; color?: string; align?: string }
  | { type: 'body'; text: string; size?: string; color?: string; opacity?: number }
  | { type: 'image'; src: string; alt?: string; fit?: string; radius?: string; width?: string; height?: string }
  | { type: 'icon'; name: string; size?: string; color?: string; library?: 'lucide' | 'heroicons' }
  | { type: 'svg'; content: string; width?: string; height?: string }
  | { type: 'shape'; shape: 'circle' | 'rect' | 'triangle' | 'line'; x?: string; y?: string; width?: string; height?: string; color?: string; opacity?: number }
  | { type: 'spacer'; height: string }
  | { type: 'divider'; color?: string; thickness?: string }
  | { type: 'card'; elements: StitchElement[]; bg?: string; border?: string; radius?: string; padding?: string }
  | { type: 'list'; items: string[]; icon?: string; style?: 'bullet' | 'number' | 'check' }
  | { type: 'button'; text: string; bg?: string; color?: string; radius?: string; size?: string }
  | { type: 'badge'; text: string; bg?: string; color?: string }
  | { type: 'progress'; value: number; label?: string; color?: string }
  | { type: 'quote'; text: string; author?: string }
  | { type: 'swipe-indicator'; direction?: 'left' | 'right' }
  | { type: 'cta'; text: string; subtitle?: string; icon?: string };

export type StitchBackground =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; from: string; to: string; direction?: string }
  | { type: 'image'; src: string; overlay?: string; blur?: string }
  | { type: 'pattern'; pattern: 'dots' | 'grid' | 'waves'; color: string; bg?: string };

export type StitchSlideLayout =
  | 'centered'
  | 'split-left'
  | 'split-right'
  | 'top-bottom'
  | 'hero'
  | 'listicle'
  | 'quote-card'
  | 'full-image'
  | 'grid-2x2'
  | 'comparison'
  | 'custom';

export interface StitchSlideSpec {
  layout: StitchSlideLayout;
  elements: StitchElement[];
  background?: StitchBackground;
  overlay?: { color: string; opacity: number };
  padding?: string;
}

export interface StitchDesignSpec {
  version: 1;
  theme: StitchTheme;
  slides: StitchSlideSpec[];
  metadata?: {
    title: string;
    projectType: 'ig-carousel' | 'ig-story';
    slideCount: number;
  };
}

export interface StitchComponent {
  id: string;
  name: string;
  category: 'section' | 'component' | 'icon' | 'svg' | 'template' | 'widget';
  contentType: 'html' | 'svg' | 'json' | 'js';
  projectType: 'website' | 'ig-carousel' | 'ig-story' | 'all';
  description: string;
  tags: string[];
  content: string;
  specSnippet?: string;
  thumbnail?: string;
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StitchComponentWithScore extends StitchComponent {
  score: number;
}

export interface SpecEditOperation {
  path: string;
  value: any;
}
