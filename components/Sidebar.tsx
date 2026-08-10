import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, PanelLeftClose, Settings as SettingsIcon, Trash2, BarChart3, Sun, Moon, Database, Puzzle, Home, Layers, Package, ArrowLeft, FileCode, FileText, FileJson, FileType, Eye, Code, Terminal, FileCode2, ChevronRight, ChevronDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { ChatSession, Mode, ModelConfig } from '../types';
import type { LibraryComponentFile } from '../types';
import type { LibraryControls } from './LibraryPanel';
import type { CanvasSidebarControls } from './canvas';
import type { SectionType, ProjectFile, GridComponent, ResolutionConfig } from './canvas/types';
import { SECTION_TYPES, COLORS } from './canvas/constants';
import { CatalogueModal } from './canvas/CatalogueModal';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import SidebarTokenStatsPanel from './SidebarTokenStatsPanel';
import { SETTINGS_TABS, type SettingsTab } from './SettingsPage';

export type SidebarPanel = 'none' | 'token-stats';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  conversations: ChatSession[];
  currentConversationId: number | null;
  onSelectConversation: (id: number) => Promise<void>;
  onDeleteConversation: (id: number) => Promise<void>;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  currentModelName?: string;
  sidebarPanel: SidebarPanel;
  onSidebarPanelChange: (panel: SidebarPanel) => void;
  availableModels: ModelConfig[];
  libraryControls?: LibraryControls | null;
  canvasControls?: CanvasSidebarControls | null;
}

function getFileIcon(filename: string) {
  if (filename.endsWith('.html')) return <FileCode size={12} />;
  if (filename.endsWith('.css')) return <FileCode size={12} />;
  if (filename.endsWith('.js') || filename.endsWith('.ts') || filename.endsWith('.tsx')) return <FileType size={12} />;
  if (filename.endsWith('.json')) return <FileJson size={12} />;
  return <FileText size={12} />;
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
                onClick={() => setExpanded(prev => { const next = new Set(prev); if (next.has(dir)) next.delete(dir); else next.add(dir); return next; })}
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

const CanvasSidebarContent: React.FC<{ controls: CanvasSidebarControls }> = ({ controls }) => {
  const [tab, setTab] = useState<'components' | 'properties'>('components');
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [localPrompt, setLocalPrompt] = useState('');
  const [localTsx, setLocalTsx] = useState('');
  const [showCode, setShowCode] = useState(false);
  const lastCompIdRef = useRef<string | null>(null);

  const component = controls.selectedComponent;

  if (component && component.id !== lastCompIdRef.current) {
    lastCompIdRef.current = component.id;
    setLocalPrompt(component.prompt);
    setLocalTsx(component.tsxCode || '');
    setShowCode(false);
  }

  const handlePromptBlur = useCallback(() => {
    if (component && localPrompt !== component.prompt) {
      controls.onUpdatePrompt(component.id, localPrompt);
    }
  }, [component, localPrompt, controls.onUpdatePrompt]);

  const tabs = [
    { key: 'components' as const, label: 'Components' },
    { key: 'properties' as const, label: 'Properties' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--border-200)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            style={{
              color: tab === t.key ? 'var(--neon-color)' : 'var(--text-400)',
              borderBottom: tab === t.key ? '2px solid var(--neon-color)' : '2px solid transparent',
              background: tab === t.key ? 'rgba(var(--neon-rgb), 0.04)' : 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

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
                      onClick={() => controls.onQuickAdd(key)}
                      className="flex items-center gap-2.5 py-[7px] px-2.5 bg-transparent border border-transparent rounded-md cursor-pointer transition-colors hover:bg-[var(--bg-200)] hover:border-[var(--border-300)] w-full text-left"
                    >
                      <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: val.color }} />
                      <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-100)' }}>{val.label}</span>
                      <span className="text-[10px] ml-auto font-mono" style={{ color: 'var(--text-400)' }}>{val.rows}r</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {controls.projectFiles.length > 0 && (
              <>
                <div className="h-px mx-3.5" style={{ background: 'var(--border-200)' }} />
                <div className="p-3.5">
                  <div className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-400)' }}>
                    Project Files ({controls.projectFiles.length})
                  </div>
                  <FileTree files={controls.projectFiles} activeFile={controls.activeFile} onFileSelect={controls.onFileSelect} />
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
                    {controls.resolution && ` (${(component.ce - component.cs + 1) * controls.resolution.cellW}px × ${(component.re - component.rs + 1) * controls.resolution.cellH}px)`}
                  </span>
                </PropertyField>

                {controls.resolution && (
                  <PropertyField label="Grid System">
                    <span className="font-mono text-[11.5px]" style={{ color: 'var(--text-100)' }}>
                      {controls.resolution.cols}-col · {controls.resolution.cellW}px cells
                    </span>
                  </PropertyField>
                )}

                <PropertyField label="Prompt">
                  <Textarea
                    value={localPrompt}
                    onChange={(e) => setLocalPrompt(e.target.value)}
                    onBlur={handlePromptBlur}
                    className="w-full resize-none h-12 text-[11px] rounded-md"
                    style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
                  />
                </PropertyField>

                <PropertyField label="Status">
                  <span
                    className="text-[12.5px] font-medium"
                    style={{
                      color: component.generated ? '#34d399' : component.generating ? 'var(--neon-color)' : 'var(--text-400)',
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
                        if (component && localTsx !== component.tsxCode) {
                          controls.onUpdateTsxCode(component.id, localTsx);
                        }
                      }}
                      className="w-full resize-none font-mono text-[10px] leading-relaxed rounded-md"
                      style={{ background: 'var(--bg-0)', borderColor: 'var(--border-300)', color: 'var(--text-100)', minHeight: '200px', tabSize: 2 }}
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
                    onClick={() => controls.onMove(component.id, 0, -1)}
                    className="flex-1 justify-center text-[11px] cursor-pointer gap-1"
                    style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
                  >
                    <ArrowUp size={12} /> Up
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => controls.onMove(component.id, 0, 1)}
                    className="flex-1 justify-center text-[11px] cursor-pointer gap-1"
                    style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
                  >
                    <ArrowDown size={12} /> Down
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => controls.onMove(component.id, -1, 0)}
                    className="flex-1 justify-center text-[11px] cursor-pointer gap-1"
                    style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
                  >
                    ←
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => controls.onMove(component.id, 1, 0)}
                    className="flex-1 justify-center text-[11px] cursor-pointer gap-1"
                    style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
                  >
                    →
                  </Button>
                </div>

                <div className="h-px" style={{ background: 'var(--border-200)' }} />

                <div className="flex flex-col gap-1.5">
                  <Button
                    onClick={() => controls.onRegenerate(component.id)}
                    className="w-full justify-center py-1.75 gap-1.5 cursor-pointer"
                    style={{ background: 'var(--neon-color)', color: '#000' }}
                  >
                    <RefreshCw size={14} /> Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => controls.onRemove(component.id)}
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
        onAddToCanvas={(comp) => controls.onCatalogueAdd(comp)}
      />
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  onNewChat,
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  theme,
  onToggleTheme,
  currentModelName,
  sidebarPanel,
  onSidebarPanelChange,
  availableModels,
  libraryControls,
  canvasControls,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeSettingsTab = searchParams.get('tab') as SettingsTab | null;
  const [gmt7Time, setGmt7Time] = useState(() => {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short', month: 'short', day: 'numeric' });
    const time = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    return `${date}  ${time}`;
  });
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const date = now.toLocaleDateString('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short', month: 'short', day: 'numeric' });
      const time = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      setGmt7Time(`${date}  ${time}`);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const isChatMode = location.pathname.startsWith('/chat');
  const isLibraryMode = location.pathname.startsWith('/library');
  const isSettingsPage = location.pathname === '/settings';
  const currentMode: Mode = isChatMode ? 'chat' : isLibraryMode ? 'library' : 'experiments';
  const activeView: 'chat' | 'rag' | 'plugin-agent' | 'skema' | 'python' = (() => {
    if (isChatMode) return 'chat';
    if (location.pathname.includes('/plugin-agent')) return 'plugin-agent';
    if (location.pathname.includes('/skema')) return 'skema';
    if (location.pathname.includes('/python')) return 'python';
    return 'rag';
  })();

  const prevPathRef = useRef<string>('/chat');
  useEffect(() => {
    if (!isSettingsPage) {
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, isSettingsPage]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const todayConvos = conversations.filter(c => c.updatedAt >= today.getTime());
  const yesterdayConvos = conversations.filter(c => c.updatedAt >= yesterday.getTime() && c.updatedAt < today.getTime());
  const lastWeekConvos = conversations.filter(c => c.updatedAt >= lastWeek.getTime() && c.updatedAt < yesterday.getTime());
  const olderConvos = conversations.filter(c => c.updatedAt < lastWeek.getTime());

  const itemClassName = (isActive: boolean) =>
    `w-full text-left flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-all duration-150 truncate ${
      isActive
        ? 'bg-[var(--bg-300)] text-[var(--text-100)]'
        : 'text-[var(--text-500)] hover:bg-[var(--bg-300)] hover:text-[var(--text-100)]'
    }`;

  const sidebarItemClassName =
    'w-full justify-start gap-3 px-3 py-2 h-auto rounded-lg text-sm font-medium text-[var(--text-500)] hover:bg-[var(--bg-300)] hover:text-[var(--text-100)] transition-all duration-150';

  const truncateTitle = (title: string) => {
    const words = title.split(/\s+/);
    return words.length > 3 ? words.slice(0, 3).join(' ') + '...' : title;
  };

  const renderConversation = (conv: ChatSession) => {
    const isActive = conv.dbConversationId === currentConversationId;
    return (
      <li key={conv.id}>
        <div
          onClick={() => conv.dbConversationId && onSelectConversation(conv.dbConversationId)}
          className={`${itemClassName(isActive)} group cursor-pointer relative`}
        >
          <span className="truncate flex-1">
            {truncateTitle(conv.title)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              conv.dbConversationId && onDeleteConversation(conv.dbConversationId);
            }}
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-[var(--text-500)] hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </li>
    );
  };

  const sectionLabel = (text: string) => (
    <div className="px-3 pt-4 pb-2">
      <span className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-500)]">
        {text}
      </span>
    </div>
  );

  const modeBadge = (
    <Badge
      variant="outline"
      className="text-xs font-medium border-0 px-2 py-0.5"
      style={{
        backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
        color: 'var(--neon-color)',
      }}
    >
      {currentMode === 'chat' ? 'Chat' : currentMode === 'library' ? 'Library' : isSettingsPage ? 'Settings' : 'Lab'}
    </Badge>
  );

  return (
    <aside
      className={`
        flex-shrink-0 h-full flex flex-col
        transition-all duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)]
        fixed md:relative z-50 md:z-auto
        ${isOpen ? 'w-[288px] translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 overflow-hidden'}
      `}
      style={{
        backgroundColor: 'var(--bg-100)',
        borderRight: '1px solid var(--border-300)',
      }}
    >
      <div className={`flex flex-col h-full w-[288px] transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>

        {/* Header: Logo + Mode Badge + Close */}
        <div className="relative flex w-full items-center p-2 pt-2">
          <div className="flex items-center gap-2 pl-2 h-8">
            {canvasControls && (
              <Button
                variant="ghost"
                size="icon"
                onClick={canvasControls.onBack}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent h-10 w-10 text-[var(--text-500)] hover:text-[var(--text-100)] flex-shrink-0"
              >
                <ArrowLeft size={18} />
              </Button>
            )}
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm text-[var(--text-100)]">edward:labs</span>
              <span className="text-xs tabular-nums text-[var(--text-500)]">{gmt7Time}</span>
            </div>
            {modeBadge}
          </div>
          <div className="absolute flex items-center gap-1 right-3 top-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8 text-[var(--text-500)] hover:bg-[var(--bg-300)] hover:text-[var(--text-100)]"
            >
              <PanelLeftClose size={16} />
            </Button>
          </div>
        </div>

        {sidebarPanel === 'token-stats' ? (
          /* Token Stats panel */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border-300)' }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSidebarPanelChange('none')}
                className="h-7 w-7 text-[var(--text-500)] hover:text-[var(--text-100)]"
              >
                <ArrowLeft size={14} />
              </Button>
              <BarChart3 size={14} style={{ color: 'var(--neon-color)' }} />
              <span className="text-xs font-semibold text-[var(--text-100)]">Token Stats</span>
            </div>
            <SidebarTokenStatsPanel availableModels={availableModels} />
          </div>
        ) : isSettingsPage ? (
          /* Settings: tab navigation */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-2 pt-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3 py-2 h-auto rounded-lg text-sm font-medium text-[var(--text-500)] hover:bg-[var(--bg-300)] hover:text-[var(--text-100)] transition-all duration-150"
                onClick={() => navigate(prevPathRef.current)}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </Button>
            </div>
            {sectionLabel('Settings')}
            <nav className="px-2 space-y-0.5">
              {SETTINGS_TABS.map((tab) => {
                const isActive = (activeSettingsTab || 'appearance') === tab.id;
                return (
                  <Button
                    key={tab.id}
                    variant="ghost"
                    className="w-full justify-start gap-3 px-3 py-2.5 h-auto rounded-lg text-sm font-medium transition-all duration-150"
                    style={{
                      backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.08)' : 'transparent',
                      color: isActive ? 'var(--neon-color)' : 'var(--text-500)',
                    }}
                    onClick={() => navigate(`/settings?tab=${tab.id}`)}
                  >
                    <tab.icon size={16} />
                    <span>{tab.label}</span>
                  </Button>
                );
              })}
            </nav>
          </div>
        ) : currentMode === 'experiments' && activeView === 'skema' && canvasControls ? (
          /* Canvas mode: Components/Catalogue/Properties tabs */
          <CanvasSidebarContent controls={canvasControls} />
        ) : currentMode === 'experiments' ? (
          /* Experiments mode: tool navigation + conversation history */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-2 pt-2">
              {sectionLabel('Tools')}
              <ul className="space-y-0.5">
                <li>
                  <Button
                    variant="ghost"
                    className={itemClassName(activeView === 'rag')}
                    onClick={() => navigate('/experiments/rag')}
                  >
                    <Database size={16} className={activeView === 'rag' ? 'text-[var(--text-100)]' : 'text-[var(--text-500)]'} />
                    <span className="truncate">RAG</span>
                  </Button>
                </li>
                <li>
                  <Button
                    variant="ghost"
                    className={itemClassName(activeView === 'plugin-agent')}
                    onClick={() => navigate('/experiments/plugin-agent')}
                  >
                    <Puzzle size={16} className={activeView === 'plugin-agent' ? 'text-[var(--text-100)]' : 'text-[var(--text-500)]'} />
                    <span className="truncate">Plug-in Agent</span>
                  </Button>
                </li>
                <li>
                  <Button
                    variant="ghost"
                    className={itemClassName(activeView === 'skema')}
                    onClick={() => navigate('/experiments/skema')}
                  >
                    <Layers size={16} className={activeView === 'skema' ? 'text-[var(--text-100)]' : 'text-[var(--text-500)]'} />
                    <span className="truncate">Skema</span>
                  </Button>
                </li>
                <li>
                  <Button
                    variant="ghost"
                    className={itemClassName(activeView === 'python')}
                    onClick={() => navigate('/experiments/python')}
                  >
                    <Terminal size={16} className={activeView === 'python' ? 'text-[var(--text-100)]' : 'text-[var(--text-500)]'} />
                    <span className="truncate">Python</span>
                  </Button>
                </li>
              </ul>
            </div>

            {/* Experiment conversation history */}
            {activeView !== 'skema' && activeView !== 'python' && (
              <>
                <div className="px-2 pt-1">
                  <Button
                    variant="ghost"
                    className={sidebarItemClassName}
                    onClick={onNewChat}
                  >
                    <div
                      className="flex items-center justify-center rounded-full w-5 h-5 transition-all duration-200 group-hover:scale-110"
                      style={{ backgroundColor: 'var(--surface-hover)' }}
                    >
                      <Plus size={14} className="text-[var(--text-300)]" />
                    </div>
                    <span>New chat</span>
                  </Button>
                </div>

                <ScrollArea className="flex-1 px-2 pt-2">
                  {todayConvos.length > 0 && (
                    <>
                      {sectionLabel('Today')}
                      <ul className="space-y-0.5">
                        {todayConvos.map(renderConversation)}
                      </ul>
                    </>
                  )}

                  {yesterdayConvos.length > 0 && (
                    <>
                      {sectionLabel('Yesterday')}
                      <ul className="space-y-0.5">
                        {yesterdayConvos.map(renderConversation)}
                      </ul>
                    </>
                  )}

                  {lastWeekConvos.length > 0 && (
                    <>
                      {sectionLabel('Last 7 Days')}
                      <ul className="space-y-0.5">
                        {lastWeekConvos.map(renderConversation)}
                      </ul>
                    </>
                  )}

                  {olderConvos.length > 0 && (
                    <>
                      {sectionLabel('Older')}
                      <ul className="space-y-0.5">
                        {olderConvos.map(renderConversation)}
                      </ul>
                    </>
                  )}

                  {conversations.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-xs text-[var(--text-500)]">
                      <p>No conversations yet</p>
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </div>
        ) : currentMode === 'library' ? (
          /* Library mode: file list when editing, otherwise info */
          <div className="flex-1 flex flex-col overflow-hidden">
            {libraryControls ? (
              <>
                {/* View mode toggle */}
                <div className="px-3 pt-2 pb-1 flex items-center gap-1">
                  <button
                    onClick={() => libraryControls.onViewModeChange('code')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors"
                    style={{
                      backgroundColor: libraryControls.viewMode === 'code' ? 'rgba(var(--neon-rgb), 0.15)' : 'transparent',
                      color: libraryControls.viewMode === 'code' ? 'var(--neon-color)' : 'var(--text-500)',
                    }}
                  >
                    <Code size={12} />
                    Code
                  </button>
                  <button
                    onClick={() => libraryControls.onViewModeChange('preview')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors"
                    style={{
                      backgroundColor: libraryControls.viewMode === 'preview' ? 'rgba(var(--neon-rgb), 0.15)' : 'transparent',
                      color: libraryControls.viewMode === 'preview' ? 'var(--neon-color)' : 'var(--text-500)',
                    }}
                  >
                    <Eye size={12} />
                    Preview
                  </button>
                </div>

                {/* File list */}
                <div className="px-3 pt-3">
                  <div className="flex items-center justify-between pb-1.5">
                    <span className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-500)]">
                      Files
                    </span>
                    <button
                      onClick={libraryControls.onAddFile}
                      className="p-0.5 rounded transition-colors hover:opacity-80"
                      style={{ color: 'var(--neon-color)' }}
                      title="Add file"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <ScrollArea className="flex-1 px-2">
                  <div className="space-y-0.5">
                    {libraryControls.files.map(file => (
                      <div
                        key={file.id}
                        className="flex items-center gap-1 group/file"
                      >
                        <button
                          onClick={() => libraryControls.onSelectFile(file.id)}
                          className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors min-w-0"
                          style={{
                            backgroundColor: libraryControls.activeFileId === file.id ? 'rgba(var(--neon-rgb), 0.1)' : 'transparent',
                            color: libraryControls.activeFileId === file.id ? 'var(--neon-color)' : 'var(--text-500)',
                            fontSize: '12px',
                          }}
                        >
                          {getFileIcon(file.filename)}
                          <span className="truncate flex-1">{file.filename}</span>
                          {file.isEntry && (
                            <span className="text-[8px] px-1 rounded flex-shrink-0" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)', color: 'var(--neon-color)' }}>E</span>
                          )}
                          {libraryControls.isDirty && libraryControls.activeFileId === file.id && (
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#f59e0b' }} />
                          )}
                        </button>
                        {libraryControls.files.length > 1 && (
                          <button
                            onClick={() => libraryControls.onDeleteFile(file.id)}
                            className="p-1 rounded opacity-0 group-hover/file:opacity-100 transition-opacity flex-shrink-0"
                            style={{ color: '#ef4444' }}
                            title="Delete file"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <>
                <div className="px-2 pt-2">
                  {sectionLabel('Library')}
                  <ul className="space-y-0.5">
                    <li>
                      <Button
                        variant="ghost"
                        className={itemClassName(true)}
                        onClick={() => navigate('/library')}
                      >
                        <Package size={18} className="text-[var(--text-100)]" />
                        <span className="truncate text-base">All Components</span>
                      </Button>
                    </li>
                  </ul>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
                  <Package size={36} className="mb-3 text-[var(--text-500)]" />
                  <p className="text-sm font-medium mb-1 text-[var(--text-300)]">Component Library</p>
                  <p className="text-xs leading-relaxed text-[var(--text-500)]">
                    Browse, search, and manage reusable components. Use the AI agent to find or create components.
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Chat mode: standard sidebar */
          <>
            {/* New Chat */}
            <div className="px-2 pt-1">
              <Button
                variant="ghost"
                className={sidebarItemClassName}
                onClick={onNewChat}
              >
                <div
                  className="flex items-center justify-center rounded-full w-5 h-5 transition-all duration-200 group-hover:scale-110"
                  style={{ backgroundColor: 'var(--surface-hover)' }}
                >
                  <Plus size={14} className="text-[var(--text-300)]" />
                </div>
                <span>New chat</span>
                <span className="ml-auto text-xs opacity-0 group-hover:opacity-60 transition-opacity text-[var(--text-500)]">
                  Ctrl+⇧+O
                </span>
              </Button>
            </div>

            {/* Conversation History */}
            <ScrollArea className="flex-1 px-2 pt-2">
              {todayConvos.length > 0 && (
                <>
                  {sectionLabel('Today')}
                  <ul className="space-y-0.5">
                    {todayConvos.map(renderConversation)}
                  </ul>
                </>
              )}

              {yesterdayConvos.length > 0 && (
                <>
                  {sectionLabel('Yesterday')}
                  <ul className="space-y-0.5">
                    {yesterdayConvos.map(renderConversation)}
                  </ul>
                </>
              )}

              {lastWeekConvos.length > 0 && (
                <>
                  {sectionLabel('Last 7 Days')}
                  <ul className="space-y-0.5">
                    {lastWeekConvos.map(renderConversation)}
                  </ul>
                </>
              )}

              {olderConvos.length > 0 && (
                <>
                  {sectionLabel('Older')}
                  <ul className="space-y-0.5">
                    {olderConvos.map(renderConversation)}
                  </ul>
                </>
              )}

              {conversations.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-xs text-[var(--text-500)]">
                  <p>No conversations yet</p>
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {/* Footer */}
        <div className="p-2 space-y-0.5">
          <Separator className="mx-1 my-1 bg-[var(--border-300)]" />

          {!isSettingsPage && (
            <>
              <Button
                variant="ghost"
                className={sidebarItemClassName}
                onClick={() => navigate('/')}
              >
                <Home size={16} />
                <span>Back to selector</span>
              </Button>

              <Button
                variant="ghost"
                className={sidebarItemClassName}
                onClick={() => onSidebarPanelChange('token-stats')}
              >
                <BarChart3 size={16} />
                <span>Token Stats</span>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            className={sidebarItemClassName}
            onClick={() => navigate('/settings')}
            style={isSettingsPage ? { backgroundColor: 'rgba(var(--neon-rgb), 0.08)', color: 'var(--neon-color)' } : undefined}
          >
            <SettingsIcon size={16} />
            <span>Settings</span>
          </Button>

          <Button
            variant="ghost"
            className={sidebarItemClassName}
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </Button>

          <Separator className="mx-1 my-1 bg-[var(--border-300)]" />

          {/* User profile */}
          <div className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm">
            <Avatar className="h-8 w-8">
              <AvatarFallback
                className="text-sm font-bold bg-[var(--bg-300)] text-[var(--text-300)]"
              >
                E
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-medium truncate text-[var(--text-100)]">Edward</span>
              <span className="text-xs truncate text-[var(--text-500)]">
                {currentModelName || 'MiMo V2.5'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
