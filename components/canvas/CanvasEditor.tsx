import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import type { SkemaProject, SkemaBoard, ModelConfig } from '../../types';
import type { GridComponent, GridState, GridBounds, ResolutionTemplate, SectionType, ProjectFile } from './types';
import { RESOLUTIONS, SECTION_TYPES, DEFAULT_TEMPLATE, ROWS } from './constants';
import { CanvasGrid } from './CanvasGrid';
import { CanvasExportModal } from './CanvasExportModal';
import { compileProject, generateComponentTsx, generateAppTsx, generateMainTsx, generateGlobalsCss } from '../../lib/tsxCompiler';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CodeEditor } from '@/components/ui/code-editor-sheet';
import { ACE_LANG_MAP } from '@/components/library/constants';
import { Monitor, Tablet, Smartphone, Laptop, Eye, Code2, CodeXml } from 'lucide-react';

export interface CanvasControls {
  onExport: () => void;
  isGenerating: boolean;
  hasContent: boolean;
  projectTitle: string;
  layout: string;
  viewMode: 'preview' | 'source' | 'canvas';
  onViewModeToggle: () => void;
  onViewModeChange: (mode: 'canvas' | 'preview') => void;
  onRegenerate: () => void;
  onStopGeneration: () => void;
  onCopy: () => void;
  copied: boolean;
  hasLastPrompt: boolean;
  onToggleLibrary: () => void;
  isLibraryOpen: boolean;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  onToggleAgent: () => void;
  isAgentOpen: boolean;
  template: string;
  onTemplateChange: (template: string) => void;
  cols: number;
  cursorPos: { col: number; row: number } | null;
  fileCount: number;
  componentCount: number;
  agentGridState: GridState;
  onComponentPlaced: (component: GridComponent) => void;
  onComponentRemoved: (componentId: string) => void;
  onComponentUpdated: (component: GridComponent) => void;
  showAgentSidebar: boolean;
  onToggleAgentSidebar: () => void;
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
}

export interface CanvasSidebarControls {
  onAiGenerate: (prompt: string) => void;
  onQuickAdd: (type: SectionType) => void;
  components: GridComponent[];
  selectedComponent: GridComponent | null;
  resolution: ResolutionConfig;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onUpdateTsxCode: (id: string, tsxCode: string) => void;
  onRemove: (id: string) => void;
  onRegenerate: (id: string) => void;
  onMove: (id: string, dc: number, dr: number) => void;
  onCatalogueAdd: (component: any) => void;
  projectFiles: ProjectFile[];
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  onBack: () => void;
}

interface CanvasEditorProps {
  project: SkemaProject;
  theme?: 'dark' | 'light';
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onSave: (project: SkemaProject) => void;
  onBack?: () => void;
  modelConfig?: ModelConfig;
  models?: ModelConfig[];
  onControlsChange?: (controls: CanvasControls | null) => void;
  onSidebarControlsChange?: (controls: CanvasSidebarControls | null) => void;
}

function deserializeGridState(board?: SkemaBoard): GridState {
  if (board?.generatedHtml?.startsWith('__canvas__:')) {
    try {
      const parsed = JSON.parse(board.generatedHtml.slice('__canvas__:'.length));
      return { ...parsed, selectedId: parsed.selectedId ?? null };
    } catch {
      // fall through
    }
  }
  return {
    version: '1.0',
    template: DEFAULT_TEMPLATE,
    components: [],
    pageTitle: board?.title || 'Untitled',
    selectedId: null,
    projectFiles: [],
  };
}

function serializeGridState(state: GridState): string {
  return `__canvas__:${JSON.stringify(state)}`;
}

function overlap(c1: number, r1: number, c2: number, r2: number, comps: GridComponent[], exId?: string) {
  return comps.some((c) => {
    if (c.id === exId) return false;
    return !(c2 < c.cs || c1 > c.ce || r2 < c.rs || r1 > c.re);
  });
}

function findEmptyRow(comps: GridComponent[], cols: number, needRows: number): number {
  for (let r = 1; r <= ROWS - needRows + 1; r++) {
    if (!overlap(1, r, cols, r + needRows - 1, comps)) return r;
  }
  return -1;
}

function toPascalCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildCanvasPreviewHtml(moduleKey: string): string {
  return `<!DOCTYPE html>
<html class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script type="importmap">${JSON.stringify({
    imports: {
      'react': 'https://esm.sh/react@19',
      'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
      'react-dom': 'https://esm.sh/react-dom@19',
      'react-dom/client': 'https://esm.sh/react-dom@19/client',
      'motion/react': 'https://esm.sh/motion@11/react?external=react,react-dom',
      'framer-motion': 'https://esm.sh/framer-motion@11?external=react,react-dom',
      '@phosphor-icons/react': 'https://esm.sh/@phosphor-icons/react?external=react,react-dom',
      'lucide-react': 'https://esm.sh/lucide-react@0.554.0?external=react,react-dom',
    },
  })}<\/script>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #1a1a1a; color: #ececec; font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; }
#root { min-height: 100vh; }
#error-overlay { position: fixed; inset: 0; background: rgba(10,10,26,0.95); color: #f87171; padding: 24px; font-size: 13px; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; overflow: auto; z-index: 9999; display: none; }
#error-overlay .err-title { color: #fca5a5; font-weight: 700; font-size: 14px; margin-bottom: 12px; }
#error-overlay .err-msg { color: #f87171; line-height: 1.6; }
#error-overlay .err-stack { color: #888; font-size: 12px; margin-top: 8px; }
</style>
</head>
<body>
<div id="root"></div>
<div id="error-overlay"><div class="err-title">Preview Error</div><div class="err-msg" id="err-msg"></div><div class="err-stack" id="err-stack"></div></div>
<script type="module">
function showError(msg, stack) {
  var overlay = document.getElementById('error-overlay');
  var msgEl = document.getElementById('err-msg');
  var stackEl = document.getElementById('err-stack');
  overlay.style.display = 'block';
  msgEl.textContent = msg;
  stackEl.textContent = stack || '';
  try { window.parent.postMessage({ type: 'preview-errors', errors: [msg] }, '*'); } catch(e) {}
}
window.addEventListener('error', function(e) { showError(e.message, e.filename + ':' + e.lineno); });
window.addEventListener('unhandledrejection', function(e) { showError('Unhandled: ' + (e.reason?.message || e.reason || 'unknown'), e.reason?.stack); });
try {
  const [React, ReactDOM, ReactDOMClient] = await Promise.all([
    import('react'), import('react-dom'), import('react-dom/client'),
  ]);
  if (!window.React) window.React = React;
  if (!window.ReactDOM) window.ReactDOM = { ...ReactDOM };
  if (!window.ReactDOM.createRoot) window.ReactDOM.createRoot = ReactDOMClient.createRoot;
  var mod = await import('/api/skema/preview-module/${moduleKey}');
  var root = document.getElementById('root');
  if (root && !root.hasChildNodes()) {
    var Component = mod.default;
    if (Component == null) {
      var named = Object.entries(mod).find(function(e) { return e[0] !== 'default' && e[0][0] !== '_' && typeof e[1] === 'function'; });
      if (named) Component = named[1];
    }
    if (Component != null) {
      ReactDOMClient.createRoot(root).render(React.createElement(Component));
    } else {
      showError('No component found. Export a React component from your file.');
    }
  }
  try { window.parent.postMessage({ type: 'preview-errors', errors: [] }, '*'); } catch(e) {}
} catch(e) { showError(e.message, e.stack); }
<\/script>
</body>
</html>`;
}

function buildProjectFiles(components: GridComponent[], pageTitle: string): ProjectFile[] {
  const files: ProjectFile[] = [];

  const generated = components.filter(c => c.generated && c.tsxCode);
  const seen = new Set<string>();

  for (const comp of generated) {
    const baseName = comp.fileName || toPascalCase(comp.type);
    let name = baseName;
    let i = 2;
    while (seen.has(name)) {
      name = `${baseName}${i++}`;
    }
    seen.add(name);

    files.push({
      path: `src/components/${name}.tsx`,
      content: comp.tsxCode || generateComponentTsx(name, comp.type, comp.prompt, comp.ce - comp.cs + 1, comp.re - comp.rs + 1),
      language: 'tsx',
    });
  }

  if (files.length > 0) {
    const names = files.map(f => f.path.split('/').pop()!.replace('.tsx', ''));
    const imports = files.map(f => `./components/${f.path.split('/').pop()!.replace('.tsx', '')}`);
    files.push({
      path: 'src/App.tsx',
      content: generateAppTsx(names, imports),
      language: 'tsx',
      isEntry: true,
    });
    files.push({
      path: 'src/main.tsx',
      content: generateMainTsx(),
      language: 'tsx',
    });
    files.push({
      path: 'src/globals.css',
      content: generateGlobalsCss(),
      language: 'css',
    });
  }

  return files;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  project,
  onNotification,
  onSave,
  onBack,
  modelConfig,
  models,
  onControlsChange,
  onSidebarControlsChange,
}) => {
  const board = project.boards[0];
  const idCounterRef = useRef(0);
  const [gridState, setGridState] = useState<GridState>(() => deserializeGridState(board));
  const [showExport, setShowExport] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ col: number; row: number } | null>(null);
  const [viewMode, setViewMode] = useState<'canvas' | 'preview' | 'source'>('canvas');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [compileErrors, setCompileErrors] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const [showAgentSidebar, setShowAgentSidebar] = useState(true);

  const selectedId = gridState.selectedId ?? null;
  const setSelectedId = useCallback((id: string | null) => {
    setGridState(prev => ({ ...prev, selectedId: id }));
  }, []);

  const resolution = RESOLUTIONS[gridState.template];

  const projectFiles = useMemo(
    () => buildProjectFiles(gridState.components, gridState.pageTitle),
    [gridState.components, gridState.pageTitle]
  );

  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);

    if (projectFiles.length === 0) {
      setPreviewHtml('');
      setCompileErrors([]);
      return;
    }

    previewTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/skema/compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: projectFiles }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(errBody.error || 'Compilation failed');
        }
        const { key } = await res.json();
        setPreviewHtml(buildCanvasPreviewHtml(key));
        setCompileErrors([]);
      } catch (err: any) {
        setPreviewHtml('');
        setCompileErrors([err.message]);
      }
    }, 400);

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [projectFiles]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'preview-errors') {
        setCompileErrors(e.data.errors || []);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (viewMode === 'source' && !activeFile && projectFiles.length > 0) {
      setActiveFile(projectFiles[0].path);
    }
  }, [viewMode, activeFile, projectFiles]);

  const boardRef = useRef(board);
  const projectRef = useRef(project);
  boardRef.current = board;
  projectRef.current = project;

  const saveState = useCallback(
    (newState: GridState) => {
      setGridState(newState);
      const updatedBoard: SkemaBoard = {
        ...boardRef.current,
        generatedHtml: serializeGridState(newState),
        updatedAt: Date.now(),
      };
      onSave({ ...projectRef.current, boards: [updatedBoard], updatedAt: Date.now() });
    },
    [onSave]
  );

  const handleComponentPlaced = useCallback((component: GridComponent) => {
    const newState: GridState = {
      ...gridState,
      components: [...gridState.components, component],
    };
    saveState(newState);
    toast.success(`${component.type} placed`);
  }, [gridState, saveState]);

  const handleComponentRemoved = useCallback((componentId: string) => {
    const newState: GridState = {
      ...gridState,
      components: gridState.components.filter(c => c.id !== componentId),
    };
    saveState(newState);
  }, [gridState, saveState]);

  const handleComponentUpdated = useCallback((component: GridComponent) => {
    const newState: GridState = {
      ...gridState,
      components: gridState.components.map(c => c.id === component.id ? component : c),
    };
    saveState(newState);
  }, [gridState, saveState]);

  const handleCatalogueAdd = useCallback((libComp: { id: string; name: string; category: string; contentType: string; content: string }) => {
    const type: SectionType = 'generic';
    const rows = SECTION_TYPES[type].rows;
    const r = findEmptyRow(gridState.components, resolution.cols, rows);
    if (r < 0) {
      toast.error('No space available on canvas');
      return;
    }
    const comp: GridComponent = {
      id: `c${Date.now()}`,
      type,
      cs: 1,
      ce: resolution.cols,
      rs: r,
      re: r + rows - 1,
      prompt: libComp.name,
      generating: false,
      generated: true,
      referenceComponentId: libComp.id,
      generatedHtml: libComp.contentType === 'html' ? libComp.content : undefined,
    };
    const newState: GridState = {
      ...gridState,
      components: [...gridState.components, comp],
    };
    saveState(newState);
    setSelectedId(comp.id);
    toast.success(`Added ${libComp.name} from library`);
  }, [gridState, saveState, resolution.cols]);

  const updateTemplate = useCallback(
    (template: ResolutionTemplate) => {
      const newCols = RESOLUTIONS[template].cols;
      const removed = gridState.components.filter((c) => c.ce > newCols);
      const kept = gridState.components
        .filter((c) => c.ce <= newCols)
        .map((c, i) => ({ ...c }));
      const newState: GridState = { ...gridState, template, components: kept };
      saveState(newState);
      if (removed.length) {
        toast.warning(`${removed.length} component(s) removed (out of bounds)`);
      }
      toast.success(`Switched to ${RESOLUTIONS[template].label}`);
    },
    [gridState, saveState]
  );

  const handlePlace = useCallback(
    (bounds: GridBounds, type: SectionType, prompt: string) => {
      const name = toPascalCase(type);
      let uniqueName = name;
      const existing = gridState.components.map(c => c.fileName || toPascalCase(c.type));
      let i = 2;
      while (existing.includes(uniqueName)) {
        uniqueName = `${name}${i++}`;
      }

      const comp: GridComponent = {
        id: `c${++idCounterRef.current}`,
        type,
        cs: bounds.c1,
        ce: bounds.c2,
        rs: bounds.r1,
        re: bounds.r2,
        prompt,
        generating: true,
        generated: false,
        fileName: uniqueName,
        tsxCode: generateComponentTsx(uniqueName, type, prompt, bounds.c2 - bounds.c1 + 1, bounds.r2 - bounds.r1 + 1),
      };
      const newState: GridState = {
        ...gridState,
        components: [...gridState.components, comp],
      };
      saveState(newState);
      setSelectedId(comp.id);

      setTimeout(() => {
        setGridState((prev) => {
          const updated: GridState = {
            ...prev,
            components: prev.components.map((c) =>
              c.id === comp.id ? { ...c, generating: false, generated: true } : c
            ),
          };
          const updatedBoard: SkemaBoard = {
            ...boardRef.current,
            generatedHtml: serializeGridState(updated),
            updatedAt: Date.now(),
          };
          onSave({ ...projectRef.current, boards: [updatedBoard], updatedAt: Date.now() });
          return updated;
        });
        toast.success(`${uniqueName}.tsx generated`);
      }, 900 + Math.random() * 600);
    },
    [gridState, saveState]
  );

  const handleQuickAdd = useCallback(
    (type: SectionType) => {
      const rows = SECTION_TYPES[type].rows;
      const r = findEmptyRow(gridState.components, resolution.cols, rows);
      if (r < 0) {
        toast.error('No space available');
        return;
      }
      handlePlace({ c1: 1, c2: resolution.cols, r1: r, r2: r + rows - 1 }, type, type);
    },
    [gridState.components, resolution.cols, handlePlace]
  );

  const handleAiGenerate = useCallback(
    (prompt: string) => {
      const types: SectionType[] = ['navbar', 'hero', 'features', 'testimonials', 'pricing', 'cta', 'footer'];
      const newComponents: GridComponent[] = [];
      let r = 1;
      let delay = 0;

      types.forEach((type) => {
        const rows = SECTION_TYPES[type].rows;
        const name = toPascalCase(type);
        let uniqueName = name;
        const existing = newComponents.map(c => c.fileName || toPascalCase(c.type));
        let i = 2;
        while (existing.includes(uniqueName)) {
          uniqueName = `${name}${i++}`;
        }

        const comp: GridComponent = {
          id: `c${++idCounterRef.current}`,
          type,
          cs: 1,
          ce: resolution.cols,
          rs: r,
          re: r + rows - 1,
          prompt: type,
          generating: true,
          generated: false,
          fileName: uniqueName,
          tsxCode: generateComponentTsx(uniqueName, type, type, resolution.cols, rows),
        };
        newComponents.push(comp);
        r += rows;
      });

      const newState: GridState = {
        ...gridState,
        components: newComponents,
      };
      saveState(newState);
      setIsGenerating(true);

      newComponents.forEach((comp, i) => {
        setTimeout(() => {
          setGridState((prev) => {
            const updated: GridState = {
              ...prev,
              components: prev.components.map((c) =>
                c.id === comp.id ? { ...c, generating: false, generated: true } : c
              ),
            };
            const updatedBoard: SkemaBoard = {
              ...boardRef.current,
              generatedHtml: serializeGridState(updated),
              updatedAt: Date.now(),
            };
            onSave({ ...projectRef.current, boards: [updatedBoard], updatedAt: Date.now() });
            return updated;
          });
          if (i === newComponents.length - 1) {
            setIsGenerating(false);
            toast.success('Full page generated — TSX codebase ready');
          }
        }, delay + 800);
        delay += 250;
      });

      toast.success('Generating TSX codebase...');
    },
    [gridState, saveState, resolution.cols]
  );

  const handleMove = useCallback(
    (id: string, dc: number, dr: number) => {
      const comp = gridState.components.find((c) => c.id === id);
      if (!comp) return;
      const nc = comp.cs + dc;
      const ne = comp.ce + dc;
      const nr = comp.rs + dr;
      const nre = comp.re + dr;
      if (nc < 1 || ne > resolution.cols || nr < 1 || nre > ROWS) return;
      if (overlap(nc, nr, ne, nre, gridState.components, id)) return;
      const newState: GridState = {
        ...gridState,
        components: gridState.components.map((c) =>
          c.id === id ? { ...c, cs: nc, ce: ne, rs: nr, re: nre } : c
        ),
      };
      saveState(newState);
    },
    [gridState, resolution.cols, saveState]
  );

  const handleRemove = useCallback(
    (id: string) => {
      const newState: GridState = {
        ...gridState,
        components: gridState.components.filter((c) => c.id !== id),
      };
      saveState(newState);
      if (selectedId === id) setSelectedId(null);
      toast.success('Removed');
    },
    [gridState, saveState, selectedId]
  );

  const handleRegenerate = useCallback(
    (id: string) => {
      const comp = gridState.components.find(c => c.id === id);
      if (!comp) return;
      const name = comp.fileName || toPascalCase(comp.type);
      const newTsx = generateComponentTsx(name, comp.type, comp.prompt, comp.ce - comp.cs + 1, comp.re - comp.rs + 1);

      const generatingState: GridState = {
        ...gridState,
        components: gridState.components.map((c) =>
          c.id === id ? { ...c, generating: true, generated: false, tsxCode: newTsx } : c
        ),
      };
      saveState(generatingState);
      setTimeout(() => {
        setGridState((prev) => {
          const updated: GridState = {
            ...prev,
            components: prev.components.map((c) =>
              c.id === id ? { ...c, generating: false, generated: true } : c
            ),
          };
          const updatedBoard: SkemaBoard = {
            ...boardRef.current,
            generatedHtml: serializeGridState(updated),
            updatedAt: Date.now(),
          };
          onSave({ ...projectRef.current, boards: [updatedBoard], updatedAt: Date.now() });
          return updated;
        });
        toast.success(`${name}.tsx regenerated`);
      }, 1200);
    },
    [gridState, saveState]
  );

  const handleUpdateTsxCode = useCallback(
    (id: string, tsxCode: string) => {
      const newState: GridState = {
        ...gridState,
        components: gridState.components.map((c) =>
          c.id === id ? { ...c, tsxCode } : c
        ),
      };
      saveState(newState);
    },
    [gridState, saveState]
  );

  const handleUpdatePrompt = useCallback(
    (id: string, prompt: string) => {
      const newState: GridState = {
        ...gridState,
        components: gridState.components.map((c) =>
          c.id === id ? { ...c, prompt } : c
        ),
      };
      saveState(newState);
    },
    [gridState, saveState]
  );

  const handleExportZip = useCallback(async () => {
    if (projectFiles.length === 0) {
      toast.error('No TSX files to export');
      return;
    }

    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();

    for (const file of projectFiles) {
      zip.file(file.path, file.content);
    }

    zip.file('package.json', JSON.stringify({
      name: gridState.pageTitle.toLowerCase().replace(/\s+/g, '-'),
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
      devDependencies: {
        '@types/react': '^19.0.0',
        '@types/react-dom': '^19.0.0',
        '@vitejs/plugin-react': '^4.0.0',
        typescript: '~5.8.0',
        vite: '^6.0.0',
      },
    }, null, 2));

    zip.file('index.html', `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${gridState.pageTitle}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"><\/script>
  </body>
</html>`);

    zip.file('tsconfig.json', JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        isolatedModules: true,
        moduleDetection: 'force',
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noFallthroughCasesInSwitch: true,
      },
      include: ['src'],
    }, null, 2));

    zip.file('vite.config.ts', `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gridState.pageTitle.toLowerCase().replace(/\s+/g, '-')}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported TSX project as .zip');
  }, [projectFiles, gridState.pageTitle]);

  const selectedComponent = selectedId
    ? gridState.components.find((c) => c.id === selectedId) || null
    : null;

  useEffect(() => {
    onControlsChange?.({
      onExport: handleExportZip,
      isGenerating,
      hasContent: gridState.components.length > 0,
      projectTitle: gridState.pageTitle,
      layout: resolution.label,
      viewMode,
      onViewModeToggle: () => setViewMode(v => v === 'canvas' ? 'preview' : 'canvas'),
      onViewModeChange: (mode) => setViewMode(mode),
      onRegenerate: () => {},
      onStopGeneration: () => {},
      onCopy: () => {},
      copied: false,
      hasLastPrompt: false,
      onToggleLibrary: () => {},
      isLibraryOpen: false,
      isFullscreen: false,
      onFullscreenToggle: () => {},
      onToggleAgent: () => setShowAgentSidebar(v => !v),
      isAgentOpen: showAgentSidebar,
      template: gridState.template,
      onTemplateChange: (t) => updateTemplate(t as ResolutionTemplate),
      cols: resolution.cols,
      cursorPos,
      fileCount: projectFiles.length,
      componentCount: gridState.components.filter(c => c.generated).length,
      agentGridState: gridState,
      onComponentPlaced: handleComponentPlaced,
      onComponentRemoved: handleComponentRemoved,
      onComponentUpdated: handleComponentUpdated,
      showAgentSidebar,
      onToggleAgentSidebar: () => setShowAgentSidebar(prev => !prev),
      selectedModelId,
      onModelChange: setSelectedModelId,
    });
    return () => onControlsChange?.(null);
  }, [isGenerating, gridState, resolution, viewMode, showAgentSidebar, onControlsChange, handleExportZip, cursorPos, projectFiles, updateTemplate, handleComponentPlaced, handleComponentRemoved, handleComponentUpdated, selectedModelId]);

  useEffect(() => {
    onSidebarControlsChange?.({
      onAiGenerate: handleAiGenerate,
      onQuickAdd: handleQuickAdd,
      components: gridState.components,
      selectedComponent,
      resolution,
      onUpdatePrompt: handleUpdatePrompt,
      onUpdateTsxCode: handleUpdateTsxCode,
      onRemove: handleRemove,
      onRegenerate: handleRegenerate,
      onMove: handleMove,
      onCatalogueAdd: handleCatalogueAdd,
      projectFiles,
      activeFile,
      onFileSelect: (path) => {
        setActiveFile(path);
        const comp = gridState.components.find(c => `src/components/${c.fileName || toPascalCase(c.type)}.tsx` === path);
        if (comp) setSelectedId(comp.id);
      },
      onBack: () => onBack?.(),
    });
    return () => onSidebarControlsChange?.(null);
  }, [gridState, selectedComponent, resolution, projectFiles, activeFile, handleAiGenerate, handleQuickAdd, handleUpdatePrompt, handleUpdateTsxCode, handleRemove, handleRegenerate, handleMove, handleCatalogueAdd, onSidebarControlsChange, onBack]);

  return (
    <div className="flex h-full overflow-hidden">

      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-100)' }}>
        {/* Main content area */}
        {viewMode === 'canvas' ? (
          <CanvasGrid
            components={gridState.components}
            resolution={resolution}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={handleMove}
            onRemove={handleRemove}
            onRegenerate={handleRegenerate}
            onPlace={handlePlace}
            onCursorChange={setCursorPos}
          />
        ) : viewMode === 'source' ? (
          <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-0)' }}>
            {projectFiles.length > 0 ? (
              <>
                <div className="flex items-center gap-0.5 px-2 py-1.5 overflow-x-auto flex-shrink-0 border-b" style={{ background: 'var(--bg-100)', borderColor: 'var(--border-200)' }}>
                  {projectFiles.map((f) => {
                    const name = f.path.split('/').pop()!;
                    const isActive = activeFile === f.path;
                    return (
                      <button
                        key={f.path}
                        onClick={() => setActiveFile(f.path)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
                        style={{
                          background: isActive ? 'var(--bg-200)' : 'transparent',
                          color: isActive ? 'var(--text-100)' : 'var(--text-400)',
                          border: isActive ? '1px solid var(--border-300)' : '1px solid transparent',
                        }}
                      >
                        {name}
                        {f.isEntry && (
                          <Badge
                            className="text-[8px] px-1 py-0 ml-1"
                            style={{ background: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}
                          >
                            entry
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1 relative min-h-0">
                  <CodeEditor
                    language={(() => {
                      const ext = (activeFile || projectFiles[0]?.path || '').split('.').pop()?.toLowerCase() || '';
                      return (ACE_LANG_MAP as Record<string, any>)[ext] || 'typescript';
                    })()}
                    value={projectFiles.find(f => f.path === activeFile)?.content || projectFiles[0]?.content || ''}
                    className="absolute inset-0"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                  <CodeXml size={48} className="mx-auto mb-4" style={{ color: 'var(--text-500)' }} />
                  <p className="text-sm mb-1" style={{ color: 'var(--text-300)' }}>No TSX files yet</p>
                  <p className="text-xs" style={{ color: 'var(--text-500)' }}>
                    Place components on the canvas to generate a TSX codebase
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden relative">
            {previewHtml ? (
              <iframe
                ref={previewIframeRef}
                className="w-full h-full border-0"
                sandbox="allow-scripts"
                srcDoc={previewHtml}
                title="TSX Preview"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                  <Code2 size={48} className="mx-auto mb-4" style={{ color: 'var(--text-500)' }} />
                  <p className="text-sm mb-1" style={{ color: 'var(--text-300)' }}>No TSX files yet</p>
                  <p className="text-xs" style={{ color: 'var(--text-500)' }}>
                    Place components on the canvas to generate a TSX codebase
                  </p>
                </div>
              </div>
            )}
            {compileErrors.length > 0 && (
              <div className="absolute bottom-4 left-4 right-4 max-h-32 overflow-auto rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                {compileErrors.map((err, i) => (
                  <p key={i} className="text-[11px] font-mono" style={{ color: '#f87171' }}>{err}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CanvasExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        components={gridState.components}
        resolution={resolution}
        pageTitle={gridState.pageTitle}
        projectFiles={projectFiles}
      />
    </div>
  );
};
