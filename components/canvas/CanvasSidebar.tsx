import React, { useState, useCallback, useRef } from 'react';
import { FileCode2, FileJson, FileText, ChevronRight, ChevronDown, ArrowUp, ArrowDown, RefreshCw, Trash2, Eye, Package, LayoutGrid, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SlidingGroup } from '@/components/ui/sliding-group';
import { SECTION_TYPES, COLORS } from './constants';
import type { SectionType, ProjectFile, GridComponent, ResolutionConfig } from './types';
import { CatalogueModal } from './CatalogueModal';

interface LibraryComponent {
  id: string;
  name: string;
  category: string;
  contentType: string;
  description: string;
  content: string;
  thumbnail?: string;
}

interface CanvasSidebarProps {
  onAiGenerate: (prompt: string) => void;
  onQuickAdd: (type: SectionType) => void;
  projectFiles?: ProjectFile[];
  components?: GridComponent[];
  activeFile?: string | null;
  onFileSelect?: (path: string) => void;
  selectedComponent?: GridComponent | null;
  resolution?: ResolutionConfig;
  onUpdatePrompt?: (id: string, prompt: string) => void;
  onUpdateTsxCode?: (id: string, tsxCode: string) => void;
  onRemove?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onMove?: (id: string, dc: number, dr: number) => void;
  onCatalogueAdd?: (component: LibraryComponent) => void;
}

function getFileIcon(language: string) {
  switch (language) {
    case 'tsx':
    case 'ts':
      return <FileCode2 size={12} style={{ color: '#60a5fa' }} />;
    case 'json':
      return <FileJson size={12} style={{ color: '#fbbf24' }} />;
    case 'css':
      return <FileText size={12} style={{ color: '#c084fc' }} />;
    default:
      return <FileText size={12} style={{ color: 'var(--text-400)' }} />;
  }
}

function FileTree({ files, activeFile, onFileSelect }: { files: ProjectFile[]; activeFile?: string | null; onFileSelect?: (path: string) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['src', 'src/components']));

  const tree: Record<string, ProjectFile[]> = {};
  for (const f of files) {
    const parts = f.path.split('/');
    const dir = parts.slice(0, -1).join('/') || '.';
    if (!tree[dir]) tree[dir] = [];
    tree[dir].push(f);
  }

  const dirs = Object.keys(tree).sort();

  return (
    <div className="text-[11px] font-mono">
      {dirs.map(dir => {
        const isRoot = dir === '.';
        const dirName = isRoot ? '' : dir.split('/').pop() || dir;
        const isExpanded = expanded.has(dir);

        return (
          <div key={dir}>
            {!isRoot && (
              <button
                onClick={() => {
                  setExpanded(prev => {
                    const next = new Set(prev);
                    if (next.has(dir)) next.delete(dir);
                    else next.add(dir);
                    return next;
                  });
                }}
                className="flex items-center gap-1 w-full px-2 py-1 hover:bg-[var(--bg-200)] rounded transition-colors cursor-pointer"
                style={{ color: 'var(--text-400)' }}
              >
                {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                <span className="text-[10px]">{dirName}/</span>
              </button>
            )}
            {(isRoot || isExpanded) && tree[dir].map(file => {
              const fileName = file.path.split('/').pop() || file.path;
              const isActive = activeFile === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => onFileSelect?.(file.path)}
                  className="flex items-center gap-1.5 w-full py-[5px] px-2 rounded transition-colors cursor-pointer"
                  style={{
                    paddingLeft: isRoot ? '8px' : '24px',
                    background: isActive ? 'rgba(var(--neon-rgb), 0.1)' : 'transparent',
                    color: isActive ? 'var(--neon-color)' : 'var(--text-300)',
                    border: isActive ? '1px solid rgba(var(--neon-rgb), 0.2)' : '1px solid transparent',
                  }}
                >
                  {getFileIcon(file.language)}
                  <span className="truncate">{fileName}</span>
                  {file.isEntry && (
                    <span className="text-[8px] ml-auto px-1 py-0.5 rounded" style={{ background: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}>
                      entry
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const PropertyField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-400)' }}>
      {label}
    </span>
    {children}
  </div>
);

export const CanvasSidebar: React.FC<CanvasSidebarProps> = ({
  onAiGenerate,
  onQuickAdd,
  projectFiles = [],
  components = [],
  activeFile,
  onFileSelect,
  selectedComponent = null,
  resolution,
  onUpdatePrompt,
  onUpdateTsxCode,
  onRemove,
  onRegenerate,
  onMove,
  onCatalogueAdd,
}) => {
  const [tab, setTab] = useState<'components' | 'properties'>('components');
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [localPrompt, setLocalPrompt] = useState('');
  const [localTsx, setLocalTsx] = useState('');
  const [showCode, setShowCode] = useState(false);
  const lastCompIdRef = useRef<string | null>(null);

  const component = selectedComponent;

  if (component && component.id !== lastCompIdRef.current) {
    lastCompIdRef.current = component.id;
    setLocalPrompt(component.prompt);
    setLocalTsx(component.tsxCode || '');
    setShowCode(false);
  }

  const handlePromptBlur = useCallback(() => {
    if (component && localPrompt !== component.prompt) {
      onUpdatePrompt?.(component.id, localPrompt);
    }
  }, [component, localPrompt, onUpdatePrompt]);

  const tabs = [
    { key: 'components' as const, label: 'Components', icon: <LayoutGrid size={12} /> },
    { key: 'properties' as const, label: 'Properties', icon: <SlidersHorizontal size={12} /> },
  ];

  return (
    <aside
      className="w-[270px] flex-shrink-0 flex flex-col overflow-hidden border-r"
      style={{ background: 'var(--bg-100)', borderColor: 'var(--border-300)' }}
    >
      <SlidingGroup
        direction="horizontal"
        activeKey={tab}
        onSelect={(key) => setTab(key as 'components' | 'properties')}
        className="border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-200)' }}
        indicatorClassName="!rounded-none"
        indicatorStyle={{ top: 'auto', bottom: 0, height: 2, backgroundColor: 'var(--neon-color)', boxShadow: 'none' }}
        items={tabs.map((t) => ({
          key: t.key,
          label: t.label,
          icon: t.icon,
        }))}
        renderItem={(item, isActive) => (
          <button
            className="flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            style={{
              color: isActive ? 'var(--neon-color)' : 'var(--text-400)',
            }}
          >
            {item.icon}
            {item.label}
            {item.key === 'components' && components.length > 0 && (
              <span
                className="text-[9px] font-mono px-1 py-0 rounded-full ml-0.5"
                style={{
                  background: isActive ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--bg-200)',
                  color: isActive ? 'var(--neon-color)' : 'var(--text-500)',
                }}
              >
                {components.length}
              </span>
            )}
          </button>
        )}
      />

      <div className="flex-1 overflow-y-auto">
        {tab === 'components' && (
          <>
            <div className="p-3.5 pb-0">
              <button
                onClick={() => setShowCatalogue(true)}
                className="w-full flex items-center gap-2 py-2 px-3 rounded-lg transition-colors cursor-pointer"
                style={{ background: 'var(--bg-200)', border: '1px solid var(--border-300)', color: 'var(--text-100)' }}
              >
                <Package size={14} style={{ color: 'var(--neon-color)' }} />
                <span className="text-[12px] font-medium">Open Catalogue</span>
              </button>
            </div>

            <div className="h-px mx-3.5 mt-3" style={{ background: 'var(--border-200)' }} />

            <div className="p-3.5">
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-400)' }}>
                Quick Add (Full Width)
              </div>
              <div className="flex flex-col gap-0.5">
                {(Object.entries(SECTION_TYPES) as [SectionType, typeof SECTION_TYPES[SectionType]][]).map(
                  ([key, val]) => (
                    <button
                      key={key}
                      onClick={() => onQuickAdd(key)}
                      className="flex items-center gap-2.5 py-[7px] px-2.5 bg-transparent border border-transparent rounded-md cursor-pointer transition-colors hover:bg-[var(--bg-200)] hover:border-[var(--border-300)] w-full text-left"
                    >
                      <span
                        className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                        style={{ background: val.color }}
                      />
                      <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-100)' }}>
                        {val.label}
                      </span>
                      <span className="text-[10px] ml-auto font-mono" style={{ color: 'var(--text-400)' }}>
                        {val.rows}r
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>

            {projectFiles.length > 0 && (
              <>
                <div className="h-px mx-3.5" style={{ background: 'var(--border-200)' }} />
                <div className="p-3.5">
                  <div className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-400)' }}>
                    Project Files ({projectFiles.length})
                  </div>
                  <FileTree files={projectFiles} activeFile={activeFile} onFileSelect={onFileSelect} />
                </div>
              </>
            )}
          </>
        )}

        {tab === 'properties' && (
          <>
            {!component ? (
              <div className="flex-1 flex flex-col items-center justify-center p-5 text-center">
                <div
                  className="w-9 h-9 border-[1.5px] border-dashed rounded-[9px] flex items-center justify-center mb-3 text-[15px]"
                  style={{ borderColor: 'var(--border-300)', color: 'var(--text-400)' }}
                >
                  ✦
                </div>
                <div className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-400)' }}>
                  Draw on the grid to create components, or click one to edit
                </div>
              </div>
            ) : (
              <div className="p-3.5 flex flex-col gap-3.5">
                <PropertyField label="Type">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: 'var(--text-100)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: COLORS[component.type] }} />
                    {SECTION_TYPES[component.type].label}
                  </span>
                </PropertyField>

                <PropertyField label="Grid Position">
                  <span className="font-mono text-[11.5px]" style={{ color: 'var(--text-100)' }}>
                    cols {component.cs}–{component.ce} · rows {component.rs}–{component.re}
                  </span>
                </PropertyField>

                <PropertyField label="Size">
                  <span className="font-mono text-[11.5px]" style={{ color: 'var(--text-100)' }}>
                    {component.ce - component.cs + 1} cols × {component.re - component.rs + 1} rows
                    {resolution && ` (${(component.ce - component.cs + 1) * resolution.cellW}px × ${(component.re - component.rs + 1) * resolution.cellH}px)`}
                  </span>
                </PropertyField>

                {resolution && (
                  <PropertyField label="Grid System">
                    <span className="font-mono text-[11.5px]" style={{ color: 'var(--text-100)' }}>
                      {resolution.cols}-col · {resolution.cellW}px cells
                    </span>
                  </PropertyField>
                )}

                <PropertyField label="Prompt">
                  <Textarea
                    value={localPrompt}
                    onChange={(e) => setLocalPrompt(e.target.value)}
                    onBlur={handlePromptBlur}
                    className="w-full resize-none h-12 text-[11px] rounded-md"
                    style={{
                      background: 'var(--bg-200)',
                      borderColor: 'var(--border-300)',
                      color: 'var(--text-100)',
                    }}
                  />
                </PropertyField>

                <PropertyField label="Status">
                  <span
                    className="text-[12.5px] font-medium"
                    style={{
                      color: component.generated
                        ? '#34d399'
                        : component.generating
                          ? 'var(--neon-color)'
                          : 'var(--text-400)',
                    }}
                  >
                    {component.generated ? '✓ Generated' : component.generating ? '⟳ Generating...' : '○ Pending'}
                  </span>
                </PropertyField>

                <div className="h-px" style={{ background: 'var(--border-200)' }} />

                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-400)' }}>
                    TSX Source
                  </div>
                  <button
                    onClick={() => setShowCode(prev => !prev)}
                    className="text-[10px] font-medium px-2 py-0.5 rounded cursor-pointer transition-colors"
                    style={{
                      background: showCode ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--bg-200)',
                      color: showCode ? 'var(--neon-color)' : 'var(--text-400)',
                      border: '1px solid var(--border-300)',
                    }}
                  >
                    {showCode ? <Eye size={10} className="inline mr-1" /> : <FileCode2 size={10} className="inline mr-1" />}
                    {showCode ? 'Hide' : 'Edit'}
                  </button>
                </div>

                {showCode && component.tsxCode && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-0)', color: 'var(--text-500)' }}>
                      src/components/{component.fileName || component.type}.tsx
                    </div>
                    <Textarea
                      value={localTsx}
                      onChange={(e) => setLocalTsx(e.target.value)}
                      onBlur={() => {
                        if (component && onUpdateTsxCode && localTsx !== component.tsxCode) {
                          onUpdateTsxCode(component.id, localTsx);
                        }
                      }}
                      className="w-full resize-none font-mono text-[10px] leading-relaxed rounded-md"
                      style={{
                        background: 'var(--bg-0)',
                        borderColor: 'var(--border-300)',
                        color: 'var(--text-100)',
                        minHeight: '200px',
                        tabSize: 2,
                      }}
                      spellCheck={false}
                    />
                  </div>
                )}

                <div className="h-px" style={{ background: 'var(--border-200)' }} />

                <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-400)' }}>
                  Nudge
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMove?.(component.id, 0, -1)}
                    className="flex-1 justify-center text-[11px] cursor-pointer gap-1"
                    style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
                  >
                    <ArrowUp size={12} /> Up
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMove?.(component.id, 0, 1)}
                    className="flex-1 justify-center text-[11px] cursor-pointer gap-1"
                    style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
                  >
                    <ArrowDown size={12} /> Down
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMove?.(component.id, -1, 0)}
                    className="flex-1 justify-center text-[11px] cursor-pointer gap-1"
                    style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
                  >
                    ←
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMove?.(component.id, 1, 0)}
                    className="flex-1 justify-center text-[11px] cursor-pointer gap-1"
                    style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
                  >
                    →
                  </Button>
                </div>

                <div className="h-px" style={{ background: 'var(--border-200)' }} />

                <div className="flex flex-col gap-1.5">
                  <Button
                    onClick={() => onRegenerate?.(component.id)}
                    className="w-full justify-center py-1.75 gap-1.5 cursor-pointer"
                    style={{ background: 'var(--neon-color)', color: '#000' }}
                  >
                    <RefreshCw size={14} /> Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onRemove?.(component.id)}
                    className="w-full justify-center py-1.75 cursor-pointer"
                    style={{ borderColor: 'var(--border-300)', color: '#f87171' }}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CatalogueModal
        isOpen={showCatalogue}
        onClose={() => setShowCatalogue(false)}
        onAddToCanvas={(comp) => onCatalogueAdd?.(comp)}
      />
    </aside>
  );
};
