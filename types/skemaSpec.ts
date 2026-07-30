export interface SkemaTheme {
  fonts: { heading: string; body: string };
  colors: Record<string, string>;
  borderRadius: string;
  spacing: string;
}

export type SkemaElement =
  | { type: 'heading'; text: string; size?: string; weight?: string; color?: string; align?: string }
  | { type: 'body'; text: string; size?: string; color?: string; opacity?: number }
  | { type: 'image'; src: string; alt?: string; fit?: string; radius?: string; width?: string; height?: string }
  | { type: 'icon'; name: string; size?: string; color?: string; library?: 'lucide' | 'heroicons' }
  | { type: 'svg'; content: string; width?: string; height?: string }
  | { type: 'shape'; shape: 'circle' | 'rect' | 'triangle' | 'line'; x?: string; y?: string; width?: string; height?: string; color?: string; opacity?: number }
  | { type: 'spacer'; height: string }
  | { type: 'divider'; color?: string; thickness?: string }
  | { type: 'card'; elements: SkemaElement[]; bg?: string; border?: string; radius?: string; padding?: string }
  | { type: 'list'; items: string[]; icon?: string; style?: 'bullet' | 'number' | 'check' }
  | { type: 'button'; text: string; bg?: string; color?: string; radius?: string; size?: string }
  | { type: 'badge'; text: string; bg?: string; color?: string }
  | { type: 'progress'; value: number; label?: string; color?: string }
  | { type: 'quote'; text: string; author?: string }
  | { type: 'swipe-indicator'; direction?: 'left' | 'right' }
  | { type: 'cta'; text: string; subtitle?: string; icon?: string };

export type SkemaBackground =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; from: string; to: string; direction?: string }
  | { type: 'image'; src: string; overlay?: string; blur?: string }
  | { type: 'pattern'; pattern: 'dots' | 'grid' | 'waves'; color: string; bg?: string };

export type SkemaSlideLayout =
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

export interface SkemaSlideSpec {
  layout: SkemaSlideLayout;
  elements: SkemaElement[];
  background?: SkemaBackground;
  overlay?: { color: string; opacity: number };
  padding?: string;
}

export interface SkemaDesignSpec {
  version: 1;
  theme: SkemaTheme;
  slides: SkemaSlideSpec[];
  metadata?: {
    title: string;
    projectType: 'ig-carousel' | 'ig-story';
    slideCount: number;
  };
}

export interface SkemaComponent {
  id: string;
  name: string;
  category: 'section' | 'component' | 'icon' | 'svg' | 'template' | 'widget' | 'image' | 'palette' | 'layout';
  contentType: 'html' | 'svg' | 'json' | 'js' | 'image-url' | 'image-base64' | 'colors';
  projectType: 'canvas' | 'ig-carousel' | 'ig-story' | 'all';
  description: string;
  tags: string[];
  content: string;
  specSnippet?: string;
  thumbnail?: string;
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkemaComponentWithScore extends SkemaComponent {
  score: number;
}

export interface SpecEditOperation {
  path: string;
  value: any;
}
