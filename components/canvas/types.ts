export type SectionType =
  | 'navbar'
  | 'hero'
  | 'features'
  | 'testimonials'
  | 'pricing'
  | 'cta'
  | 'footer'
  | 'form'
  | 'text'
  | 'image'
  | 'generic';

export type ResolutionTemplate =
  | 'desktop-1080p'
  | 'desktop-1440p'
  | 'desktop-2k'
  | 'desktop-4k'
  | 'macbook-14'
  | 'macbook-16'
  | 'ultrawide'
  | 'tablet'
  | 'mobile';

export interface GridComponent {
  id: string;
  type: SectionType;
  cs: number;
  ce: number;
  rs: number;
  re: number;
  prompt: string;
  generating: boolean;
  generated: boolean;
  tsxCode?: string;
  fileName?: string;
  referenceComponentId?: string;
  generatedHtml?: string;
}

export interface GridState {
  version: '1.0';
  template: ResolutionTemplate;
  components: GridComponent[];
  pageTitle: string;
  selectedId: string | null;
  projectFiles?: ProjectFile[];
}

export interface ResolutionConfig {
  label: string;
  width: number;
  height: number;
  cols: number;
  cellW: number;
  cellH: number;
}

export interface GridPos {
  col: number;
  row: number;
}

export interface GridBounds {
  c1: number;
  c2: number;
  r1: number;
  r2: number;
}

export interface ProjectFile {
  path: string;
  content: string;
  language: 'tsx' | 'ts' | 'css' | 'json';
  isEntry?: boolean;
}
