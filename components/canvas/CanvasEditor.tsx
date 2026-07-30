import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import type { SkemaProject, SkemaBoard, ModelConfig } from '../../types';
import type { GridComponent, GridState, GridBounds, ResolutionTemplate, SectionType, ProjectFile } from './types';
import { RESOLUTIONS, SECTION_TYPES, DEFAULT_TEMPLATE, ROWS } from './constants';
import { CanvasGrid } from './CanvasGrid';
import { CanvasSidebar } from './CanvasSidebar';
import { CanvasExportModal } from './CanvasExportModal';
import { compileProject, generateComponentTsx, generateAppTsx, generateMainTsx, generateGlobalsCss } from '../../lib/tsxCompiler';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Monitor, Tablet, Smartphone, Laptop, Eye, Code2 } from 'lucide-react';
import SkemaAgentSidebar from '@/components/skema/SkemaAgentSidebar';

export interface CanvasControls {
  onExport: () => void;
  isGenerating: boolean;
  hasContent: boolean;
  projectTitle: string;
  layout: string;
  viewMode: 'preview' | 'source' | 'canvas';
  onViewModeToggle: () => void;
  onRegenerate: () => void;
  onStopGeneration: () => void;
  onCopy: () => void;
  copied: boolean;
  hasLastPrompt: boolean;
  onToggleLibrary: () => void;
  isLibraryOpen: boolean;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
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
  modelConfig,
  models,
  onControlsChange,
}) => {
  const board = project.boards[0];
  const idCounterRef = useRef(0);
  const [gridState, setGridState] = useState<GridState>(() => deserializeGridState(board));
  const [showExport, setShowExport] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ col: number; row: number } | null>(null);
  const [viewMode, setViewMode] = useState<'canvas' | 'preview'>('canvas');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [compileErrors, setCompileErrors] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const [showAgentSidebar, setShowAgentSidebar] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState<string>(modelConfig?.id || '');
  const chatModels = models?.filter(m => (m.modelType || 'chat') === 'chat') || [];

  const selectedId = gridState.selectedId ?? null;
  const setSelectedId = useCallback((id: string | null) => {
    setGridState(prev => ({ ...prev, selectedId: id }));
  }, []);

  const resolution = RESOLUTIONS[gridState.template];

  const projectFiles = useMemo(
    () => buildProjectFiles(gridState.components, gridState.pageTitle),
    [gridState.components, gridState.pageTitle]
  );

  const compilePreview = useCallback(() => {
    if (projectFiles.length === 0) {
      setPreviewHtml('');
      setCompileErrors([]);
      return;
    }
    const result = compileProject(projectFiles);
    setPreviewHtml(result.html);
    setCompileErrors(result.errors);
    if (result.errors.length > 0) {
      console.warn('[TSX Compiler] Errors:', result.errors);
    }
  }, [projectFiles]);

  useEffect(() => {
    compilePreview();
  }, [compilePreview]);

  const boardRef = useRef(board);
  const projectRef = useRef(project);
  boardRef.current = board;
  projectRef.current = project;

  const saveState = useCallback(
    (newState: GridState) => {
      setGridState(newState);
      const updatedBoard: SkemaBoard = {
        ...board,
        generatedHtml: serializeGridState(newState),
        updatedAt: Date.now(),
      };
      onSave({ ...project, boards: [updatedBoard], updatedAt: Date.now() });
    },
    [board, project, onSave]
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
    [gridState, saveState, board, project, onSave]
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
    [gridState, saveState, resolution.cols, board, project, onSave]
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
    [gridState, saveState, board, project, onSave]
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
      onRegenerate: () => {},
      onStopGeneration: () => {},
      onCopy: () => {},
      copied: false,
      hasLastPrompt: false,
      onToggleLibrary: () => {},
      isLibraryOpen: false,
      isFullscreen: false,
      onFullscreenToggle: () => {},
    });
    return () => onControlsChange?.(null);
  }, [isGenerating, gridState, resolution, viewMode, onControlsChange, handleExportZip]);

  return (
    <div className="flex h-full overflow-hidden">
      <CanvasSidebar
        onAiGenerate={handleAiGenerate}
        onQuickAdd={handleQuickAdd}
        projectFiles={projectFiles}
        components={gridState.components}
        activeFile={activeFile}
        onFileSelect={(path) => {
          setActiveFile(path);
          const comp = gridState.components.find(c => `src/components/${c.fileName || toPascalCase(c.type)}.tsx` === path);
          if (comp) setSelectedId(comp.id);
        }}
        selectedComponent={selectedComponent}
        resolution={resolution}
        onUpdatePrompt={handleUpdatePrompt}
        onUpdateTsxCode={handleUpdateTsxCode}
        onRemove={handleRemove}
        onRegenerate={handleRegenerate}
        onMove={handleMove}
        onCatalogueAdd={handleCatalogueAdd}
      />

      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-100)' }}>
        {/* Canvas toolbar */}
        <div
          className="h-9 flex items-center justify-between px-3.5 flex-shrink-0 border-b"
          style={{ background: 'var(--bg-0)', borderColor: 'var(--border-200)' }}
        >
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setViewMode('canvas')}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                style={{
                  background: viewMode === 'canvas' ? 'rgba(var(--neon-rgb), 0.15)' : 'transparent',
                  color: viewMode === 'canvas' ? 'var(--neon-color)' : 'var(--text-400)',
                  border: viewMode === 'canvas' ? '1px solid rgba(var(--neon-rgb), 0.3)' : '1px solid transparent',
                }}
              >
                <Code2 size={12} className="inline mr-1" />
                Canvas
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                style={{
                  background: viewMode === 'preview' ? 'rgba(var(--neon-rgb), 0.15)' : 'transparent',
                  color: viewMode === 'preview' ? 'var(--neon-color)' : 'var(--text-400)',
                  border: viewMode === 'preview' ? '1px solid rgba(var(--neon-rgb), 0.3)' : '1px solid transparent',
                }}
              >
                <Eye size={12} className="inline mr-1" />
                Preview
              </button>
            </div>
            <div className="text-[11px] font-mono flex gap-3.5" style={{ color: 'var(--text-400)' }}>
              {viewMode === 'canvas' ? (
                <>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--neon-color)' }} />
                    Draw to place component
                  </span>
                  <span style={{ color: 'var(--neon-color)' }}>
                    {cursorPos ? `col ${cursorPos.col} / row ${cursorPos.row}` : '—'}
                  </span>
                </>
              ) : (
                <span>{projectFiles.length} files · {gridState.components.filter(c => c.generated).length} components</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-400)' }}>
              Template
            </span>
            <Select value={gridState.template} onValueChange={(v) => updateTemplate(v as ResolutionTemplate)}>
              <SelectTrigger
                className="h-7 text-[11px] font-mono rounded-md w-[160px] cursor-pointer"
                style={{
                  background: 'var(--bg-200)',
                  borderColor: 'var(--border-300)',
                  color: 'var(--text-100)',
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: 'var(--bg-100)', borderColor: 'var(--border-300)' }}>
                {Object.entries(RESOLUTIONS).map(([key, res]) => (
                  <SelectItem key={key} value={key} className="text-[11px] font-mono cursor-pointer">
                    <span className="flex items-center gap-1.5">
                      {key.includes('mobile') ? (
                        <Smartphone size={12} />
                      ) : key.includes('tablet') ? (
                        <Tablet size={12} />
                      ) : key.includes('macbook') ? (
                        <Laptop size={12} />
                      ) : (
                        <Monitor size={12} />
                      )}
                      {res.label} ({res.width}×{res.height})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge
              variant="outline"
              className="text-[10px] font-mono"
              style={{ borderColor: 'var(--border-300)', color: 'var(--text-400)' }}
            >
              {resolution.cols}-col
            </Badge>
          </div>
        </div>

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

      <SkemaAgentSidebar
        isOpen={showAgentSidebar}
        onToggle={() => setShowAgentSidebar(!showAgentSidebar)}
        project={project}
        activeBoardIdx={0}
        currentHtml=""
        modelConfig={modelConfig}
        onNotification={onNotification}
        models={chatModels.map(m => ({ id: m.id, name: m.name }))}
        selectedModelId={selectedModelId}
        onModelChange={setSelectedModelId}
        gridState={gridState}
        onComponentPlaced={handleComponentPlaced}
        onComponentRemoved={handleComponentRemoved}
        onComponentUpdated={handleComponentUpdated}
      />

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
