import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, PanelLeftClose, Settings as SettingsIcon, Trash2, BarChart3, Sun, Moon, Database, Puzzle, Home, Layers, Package, ArrowLeft, FileCode, FileText, FileJson, FileType, Eye, Code, Terminal, FileCode2, ChevronRight, ChevronDown, ArrowUp, ArrowDown, RefreshCw, ChevronUp, Bot, Workflow, MessageSquare, Wrench, LayoutGrid, SlidersHorizontal, StickyNote, MoreHorizontal, Star, StarOff } from 'lucide-react';
import { ChatSession, Mode, ModelConfig } from '../types';
import type { LibraryComponentFile, LibraryFolder } from '../types';
import type { LibraryControls } from './LibraryPanel';
import type { CanvasSidebarControls } from './canvas';
import type { DatabaseSidebarControls } from './DatabasePanel';
import WorkflowSidebar from './agent-builder/WorkflowSidebar';
import type { NotesControls } from './notes/NotesPanel';
import DatabaseSchemaBrowser from './DatabaseSchemaBrowser';
import type { SectionType, ProjectFile, GridComponent, ResolutionConfig } from './canvas/types';
import { SECTION_TYPES, COLORS } from './canvas/constants';
import { CatalogueModal } from './canvas/CatalogueModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { SlidingGroup } from '@/components/ui/sliding-group';
import SidebarTokenStatsPanel from './SidebarTokenStatsPanel';
import { SETTINGS_TABS, type SettingsTab } from './SettingsPage';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

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
  dbSidebarControls?: DatabaseSidebarControls | null;
  notesControls?: NotesControls | null;
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
    { key: 'components' as const, label: 'Components', icon: <LayoutGrid size={12} /> },
    { key: 'properties' as const, label: 'Properties', icon: <SlidersHorizontal size={12} /> },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <SlidingGroup
        direction="horizontal"
        activeKey={tab}
        onSelect={(key) => setTab(key as 'components' | 'properties')}
        className="flex-shrink-0"
        indicatorClassName="!rounded-none"
        indicatorStyle={{ top: 'auto', bottom: 0, height: 2, backgroundColor: 'var(--neon-color)', boxShadow: 'none' }}
        items={tabs.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
        renderItem={(item, isActive) => (
          <button
            className="flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            style={{ color: isActive ? 'var(--neon-color)' : 'var(--text-400)' }}
          >
            {item.icon}
            {item.label}
            {item.key === 'components' && controls.components.length > 0 && (
              <span
                className="text-[9px] font-mono px-1 py-0 rounded-full ml-0.5"
                style={{
                  background: isActive ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--bg-200)',
                  color: isActive ? 'var(--neon-color)' : 'var(--text-500)',
                }}
              >
                {controls.components.length}
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
                      className="flex items-center gap-2.5 py-[7px] px-2.5 bg-transparent rounded-md cursor-pointer transition-colors hover:bg-[var(--bg-200)] w-full text-left"
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

const NoteSidebarItem: React.FC<{
  note: any;
  depth: number;
  selectedNoteId: string | null;
  controls: NotesControls;
}> = ({ note, depth, selectedNoteId, controls }) => {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(note.title);
  const hasChildren = note.children && note.children.length > 0;
  const isActive = selectedNoteId === note.id;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleRename = () => {
    if (renameValue.trim() && renameValue !== note.title) {
      controls.onRenameNote(note.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition-colors relative ${
          isActive ? 'bg-[var(--bg-200)]' : 'hover:bg-[var(--bg-200)]'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => controls.onSelectNote(note.id)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="w-4 h-4 flex items-center justify-center flex-shrink-0"
          style={{ color: 'var(--text-500)', visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          <ChevronDown size={12} className={`transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
        </button>

        <span className="text-sm flex-shrink-0 w-5 text-center">{note.icon}</span>

        {isRenaming ? (
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            className="flex-1 min-w-0 text-sm bg-transparent border-none outline-none px-1"
            style={{ color: 'var(--text-100)' }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 min-w-0 text-sm truncate" style={{ color: isActive ? 'var(--text-100)' : 'var(--text-300)' }}>
            {note.title || 'Untitled'}
          </span>
        )}

        {note.isFavorite && (
          <Star size={10} fill="var(--neon-color)" style={{ color: 'var(--neon-color)' }} className="flex-shrink-0" />
        )}

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--bg-300)] transition-colors"
            style={{ color: 'var(--text-500)' }}
          >
            <MoreHorizontal size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); controls.onCreateNote(note.id); }}
            className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--bg-300)] transition-colors"
            style={{ color: 'var(--text-500)' }}
            title="Add sub-page"
          >
            <Plus size={12} />
          </button>
        </div>

        {showMenu && (
          <div
            ref={menuRef}
            className="absolute left-full top-0 z-50 w-44 rounded-lg border shadow-lg py-1 ml-1"
            style={{ backgroundColor: 'var(--bg-100)', borderColor: 'var(--border-300)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setIsRenaming(true); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--bg-200)] transition-colors cursor-pointer"
              style={{ color: 'var(--text-300)' }}
            >
              <FileText size={12} /> Rename
            </button>
            <button
              onClick={() => { controls.onToggleFavorite(note.id, note.isFavorite); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--bg-200)] transition-colors cursor-pointer"
              style={{ color: 'var(--text-300)' }}
            >
              {note.isFavorite ? <StarOff size={12} /> : <Star size={12} />}
              {note.isFavorite ? 'Unfavorite' : 'Favorite'}
            </button>
            <button
              onClick={() => { controls.onDeleteNote(note.id); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--bg-200)] transition-colors cursor-pointer"
              style={{ color: '#ef4444' }}
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {note.children!.map((child: any) => (
            <NoteSidebarItem
              key={child.id}
              note={child}
              depth={depth + 1}
              selectedNoteId={selectedNoteId}
              controls={controls}
            />
          ))}
        </div>
      )}
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
  dbSidebarControls,
  notesControls,
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
  const isRagMode = location.pathname.startsWith('/rag');
  const isSkemaMode = location.pathname.startsWith('/skema');
  const isPythonMode = location.pathname.startsWith('/python');
  const isLibraryMode = location.pathname.startsWith('/library');
  const isDatabaseMode = location.pathname.startsWith('/database');
  const isNotesMode = location.pathname.startsWith('/notes');
  const isAgentBuilderMode = location.pathname.startsWith('/agent-builder');
  const isSettingsPage = location.pathname === '/settings';

  const [libraryFolders, setLibraryFolders] = useState<LibraryFolder[]>([]);
  const fetchLibraryFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/library/folders');
      if (!res.ok) return;
      const data = await res.json();
      setLibraryFolders(data.folders || []);
    } catch {}
  }, []);
  useEffect(() => {
    if (isLibraryMode) fetchLibraryFolders();
  }, [isLibraryMode, fetchLibraryFolders]);
  useEffect(() => {
    if (!isLibraryMode) return;
    const handler = () => fetchLibraryFolders();
    window.addEventListener('library-reload', handler);
    return () => window.removeEventListener('library-reload', handler);
  }, [isLibraryMode, fetchLibraryFolders]);

  const currentMode: Mode = isChatMode ? 'chat' : isRagMode ? 'rag' : isSkemaMode ? 'skema' : isPythonMode ? 'python' : isLibraryMode ? 'library' : isDatabaseMode ? 'database' : isNotesMode ? 'notes' : isAgentBuilderMode ? 'agent-builder' : 'chat';

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
    `w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 truncate ${
      isActive
        ? 'bg-[var(--bg-200)] text-[var(--text-100)]'
        : 'text-[var(--text-500)] hover:bg-[var(--bg-200)] hover:text-[var(--text-100)]'
    }`;

  const renderConversation = (conv: ChatSession) => {
    const isActive = conv.dbConversationId === currentConversationId;
    return (
      <li
        key={conv.id}
        className={`group flex min-w-0 items-center rounded-xl transition-colors duration-200 ${
          isActive ? 'bg-[var(--bg-200)]' : 'hover:bg-[var(--bg-200)]'
        }`}
      >
        <button
          type="button"
          onClick={() => conv.dbConversationId && onSelectConversation(conv.dbConversationId)}
          className="min-w-0 flex-1 px-3 py-2 text-left text-[13px] transition-colors"
          style={{ color: isActive ? 'var(--text-100)' : 'var(--text-500)' }}
          title={conv.title}
          aria-current={isActive ? 'page' : undefined}
        >
          <span className="block truncate">{conv.title || 'Untitled conversation'}</span>
        </button>
        <button
          type="button"
          onClick={() => conv.dbConversationId && onDeleteConversation(conv.dbConversationId)}
          className={`mr-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-500)] transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100 ${
            isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          }`}
          title={`Delete ${conv.title || 'conversation'}`}
          aria-label={`Delete ${conv.title || 'conversation'}`}
        >
          <Trash2 size={13} />
        </button>
      </li>
    );
  };

  const sectionLabel = (text: string) => (
    <div className="px-2 pt-5 pb-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-500)]">
        {text}
      </span>
    </div>
  );

  const modeLabel = isSettingsPage
    ? 'Settings'
    : currentMode === 'agent-builder'
      ? 'Builder'
      : currentMode === 'database'
        ? 'DB'
        : currentMode.charAt(0).toUpperCase() + currentMode.slice(1);

  return (
    <aside
      className={`
        flex-shrink-0 h-full flex flex-col
        transition-all duration-300 ease-[cubic-bezier(0.165,0.85,0.45,1)]
        fixed md:relative z-50 md:z-auto
        ${isOpen ? `${isDatabaseMode ? 'w-[360px]' : 'w-[288px]'} translate-x-0` : 'w-0 -translate-x-full md:translate-x-0 overflow-hidden'}
      `}
      style={{
        backgroundColor: 'var(--bg-100)',
      }}
    >
      <div className={`flex flex-col h-full ${isDatabaseMode ? 'w-[360px]' : 'w-[288px]'} transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>

        {/* Header */}
        <div className="flex w-full items-start gap-2 px-3 pt-4 pb-3">
          <div className="flex min-w-0 flex-1 items-start gap-2.5 pl-1">
            {canvasControls && (
              <Button
                variant="ghost"
                size="icon"
                onClick={canvasControls.onBack}
                className="h-8 w-8 rounded-lg text-[var(--text-500)] hover:bg-[var(--bg-200)] hover:text-[var(--text-100)] flex-shrink-0 transition-all duration-200"
              >
                <ArrowLeft size={16} />
              </Button>
            )}
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <div className="sidebar-brand-mark flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.15), rgba(var(--neon-rgb), 0.05))' }}>
                <span className="text-sm font-bold" style={{ color: 'var(--neon-color)' }}>e</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                <span className="truncate font-semibold text-[14px] tracking-tight text-[var(--text-100)]">edward:labs</span>
                <div className="flex min-w-0 items-center gap-2">
                  <Badge
                    variant="outline"
                    className="flex-shrink-0 border-0 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                    style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.1)', color: 'var(--neon-color)' }}
                  >
                    {modeLabel}
                  </Badge>
                  <span className="min-w-0 truncate text-[10px] tabular-nums tracking-wide text-[var(--text-500)]" title={`${gmt7Time} GMT+7`}>
                    {gmt7Time}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-9 w-9 flex-shrink-0 rounded-lg text-[var(--text-500)] hover:bg-[var(--bg-200)] hover:text-[var(--text-100)] transition-all duration-200"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <PanelLeftClose size={16} />
          </Button>
        </div>

        {sidebarPanel === 'token-stats' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSidebarPanelChange('none')}
                className="h-7 w-7 rounded-lg text-[var(--text-500)] hover:text-[var(--text-100)] hover:bg-[var(--bg-200)] transition-all duration-200"
              >
                <ArrowLeft size={14} />
              </Button>
              <BarChart3 size={14} style={{ color: 'var(--neon-color)' }} />
              <span className="text-xs font-semibold text-[var(--text-100)]">Token Stats</span>
            </div>
            <SidebarTokenStatsPanel availableModels={availableModels} />
          </div>
        ) : isSettingsPage ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 pt-3">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2.5 px-3 py-2 h-auto rounded-xl text-sm font-medium text-[var(--text-500)] hover:bg-[var(--bg-200)] hover:text-[var(--text-100)] transition-all duration-200"
                onClick={() => navigate(prevPathRef.current)}
              >
                <ArrowLeft size={15} />
                <span>Back</span>
              </Button>
            </div>
            <div className="px-4 pt-5 pb-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-500)]">
                Settings
              </span>
            </div>
            <SlidingGroup
              direction="vertical"
              activeKey={activeSettingsTab || 'appearance'}
              onSelect={(key) => navigate(`/settings?tab=${key}`)}
              className="px-3 gap-0.5"
              items={SETTINGS_TABS.map((tab) => ({
                key: tab.id,
                label: tab.label,
                icon: <tab.icon size={15} />,
              }))}
              renderItem={(item, isActive) => (
                <button
                  className="w-full justify-start gap-3 px-3 py-2.5 h-auto rounded-xl text-sm font-medium transition-all duration-200 flex items-center cursor-pointer"
                  style={{
                    color: isActive ? 'var(--neon-color)' : 'var(--text-500)',
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              )}
            />
          </div>
        ) : currentMode === 'skema' && canvasControls ? (
          <CanvasSidebarContent controls={canvasControls} />
        ) : currentMode === 'skema' ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.12), rgba(var(--neon-rgb), 0.04))' }}>
              <Layers size={22} style={{ color: 'var(--neon-color)' }} />
            </div>
            <p className="text-sm font-semibold mb-1.5 text-[var(--text-300)]">Skema</p>
            <p className="text-xs leading-relaxed text-[var(--text-500)]">
              AI-powered visual design editor. Open a project to get started.
            </p>
          </div>
        ) : currentMode === 'python' ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.12), rgba(var(--neon-rgb), 0.04))' }}>
              <Terminal size={22} style={{ color: 'var(--neon-color)' }} />
            </div>
            <p className="text-sm font-semibold mb-1.5 text-[var(--text-300)]">Python</p>
            <p className="text-xs leading-relaxed text-[var(--text-500)]">
              Python code executor with project management and file uploads.
            </p>
          </div>
        ) : currentMode === 'rag' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 pt-3">
              <button
                type="button"
                className="sidebar-new-chat group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.08), rgba(var(--neon-rgb), 0.03))',
                  border: '1px solid rgba(var(--neon-rgb), 0.12)',
                  color: 'var(--text-100)',
                }}
                onClick={onNewChat}
                title="Start a new chat"
              >
                <div
                  className="flex items-center justify-center rounded-lg w-5 h-5 transition-all duration-200"
                  style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)' }}
                >
                  <Plus size={13} style={{ color: 'var(--neon-color)' }} />
                </div>
                <span>New chat</span>
              </button>
            </div>

            <ScrollArea className="flex-1 px-3 pt-3">
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
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--bg-200)' }}>
                    <Plus size={18} className="text-[var(--text-500)]" />
                  </div>
                  <p className="text-xs font-medium text-[var(--text-500)]">No conversations yet</p>
                </div>
              )}
            </ScrollArea>
          </div>
        ) : currentMode === 'library' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {libraryControls ? (
              <>
                <div className="px-3 pt-3 pb-1">
                  <SlidingGroup
                    direction="horizontal"
                    activeKey={libraryControls.viewMode}
                    onSelect={(key) => libraryControls.onViewModeChange(key as 'code' | 'preview')}
                    className="gap-1 p-1 rounded-xl"
                    style={{ backgroundColor: 'var(--bg-200)' }}
                    indicatorStyle={{ top: 2, bottom: 2 }}
                    items={[
                      { key: 'code', label: 'Code', icon: <Code size={12} /> },
                      { key: 'preview', label: 'Preview', icon: <Eye size={12} /> },
                    ]}
                    renderItem={(item, isActive) => (
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer"
                        style={{
                          color: isActive ? 'var(--text-100)' : 'var(--text-500)',
                        }}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    )}
                  />
                </div>

                <div className="px-4 pt-4">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-500)]">
                      Files
                    </span>
                    <button
                      onClick={libraryControls.onAddFile}
                      className="p-1 rounded-lg transition-all duration-200 hover:opacity-80"
                      style={{ color: 'var(--neon-color)' }}
                      title="Add file"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <ScrollArea className="flex-1 px-3">
                  <div className="space-y-0.5">
                    {libraryControls.files.map(file => (
                      <div
                        key={file.id}
                        className="flex items-center gap-1 group/file"
                      >
                        <button
                          onClick={() => libraryControls.onSelectFile(file.id)}
                          className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all duration-200 min-w-0"
                          style={{
                            backgroundColor: libraryControls.activeFileId === file.id ? 'rgba(var(--neon-rgb), 0.08)' : 'transparent',
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
                            className="p-1 rounded-lg opacity-0 group-hover/file:opacity-100 transition-all duration-200 flex-shrink-0"
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
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-3 pt-3">
                  <div className="px-2 pb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-500)]">Library</span>
                  </div>
                  <ul className="space-y-0.5">
                    <li>
                      <Button
                        variant="ghost"
                        className={itemClassName(location.pathname === '/library')}
                        onClick={() => navigate('/library')}
                      >
                        <Package size={16} className="text-[var(--text-100)]" />
                        <span className="truncate text-[13px]">All Components</span>
                      </Button>
                    </li>
                  </ul>
                </div>
                {libraryFolders.length > 0 && (
                  <div className="flex flex-col flex-1 min-h-0 px-3 pt-2">
                    <div className="px-2 pb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-500)]">Folders</span>
                    </div>
                    <ScrollArea className="flex-1 min-h-0">
                      <ul className="space-y-0.5">
                        {libraryFolders.map(folder => {
                          const isActive = location.pathname.startsWith(`/library/folder/${folder.id}`);
                          return (
                            <li key={folder.id}>
                              <Button
                                variant="ghost"
                                className={itemClassName(isActive)}
                                onClick={() => navigate(`/library/folder/${folder.id}`)}
                              >
                                <div
                                  className="w-3 h-3 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: folder.color }}
                                />
                                <span className="truncate text-[13px] flex-1 text-left">{folder.name}</span>
                                <span className="text-[10px] text-[var(--text-500)] flex-shrink-0">
                                  {folder.componentCount ?? 0}
                                </span>
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : currentMode === 'database' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {dbSidebarControls ? (
              <DatabaseSchemaBrowser
                schemas={dbSidebarControls.schemas}
                tables={dbSidebarControls.tables}
                isLoading={dbSidebarControls.isLoading}
                onRefresh={dbSidebarControls.onRefresh}
                onSelectTable={dbSidebarControls.onSelectTable}
                onQuickAction={dbSidebarControls.onQuickAction}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.12), rgba(var(--neon-rgb), 0.04))' }}>
                  <Database size={22} style={{ color: 'var(--neon-color)' }} />
                </div>
                <p className="text-sm font-semibold mb-1.5 text-[var(--text-300)]">Database Explorer</p>
                <p className="text-xs leading-relaxed text-[var(--text-500)]">
                  Connect to PostgreSQL databases, browse schemas, and run SQL queries.
                </p>
              </div>
            )}
          </div>
        ) : currentMode === 'notes' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {notesControls ? (
              <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
                <div className="px-3 pt-3 pb-2">
                  <button
                    onClick={() => notesControls.onCreateNote(null)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer hover:scale-[0.98] active:scale-[0.96]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.08), rgba(var(--neon-rgb), 0.03))',
                      border: '1px solid rgba(var(--neon-rgb), 0.12)',
                      color: 'var(--text-100)',
                    }}
                  >
                    <div
                      className="flex items-center justify-center rounded-lg w-5 h-5 transition-all duration-200"
                      style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)' }}
                    >
                      <Plus size={13} style={{ color: 'var(--neon-color)' }} />
                    </div>
                    <span>New page</span>
                  </button>
                </div>

                <ScrollArea className="flex-1 px-3 pt-2">
                  {(() => {
                    const collectFavorites = (notes: typeof notesControls.notes): typeof notesControls.notes => {
                      const result: typeof notesControls.notes = [];
                      for (const n of notes) {
                        if (n.isFavorite) result.push(n);
                        if (n.children) result.push(...collectFavorites(n.children));
                      }
                      return result;
                    };
                    const favorites = collectFavorites(notesControls.notes);
                    const favoriteIds = new Set(favorites.map(f => f.id));
                    const rootPages = notesControls.notes.filter(n => !n.parentId && !favoriteIds.has(n.id));
                    const hasAnyNotes = notesControls.notes.filter(n => !n.parentId).length > 0;

                    return (
                      <>
                        {/* Favorites */}
                        {favorites.length > 0 && (
                          <div className="mb-3">
                            <div className="px-2 pb-1.5 flex items-center gap-1.5">
                              <Star size={10} fill="var(--neon-color)" style={{ color: 'var(--neon-color)' }} />
                              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-500)' }}>
                                Favorites
                              </span>
                            </div>
                            {favorites.map(note => (
                              <NoteSidebarItem
                                key={note.id}
                                note={note}
                                depth={0}
                                selectedNoteId={notesControls.selectedNoteId}
                                controls={notesControls}
                              />
                            ))}
                          </div>
                        )}

                        {/* All pages (excluding favorites) */}
                        <div>
                          <div className="px-2 pb-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-500)' }}>
                              Pages
                            </span>
                          </div>
                          {!hasAnyNotes ? (
                            <div className="flex flex-col items-center justify-center py-8">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--bg-200)' }}>
                                <StickyNote size={18} className="text-[var(--text-500)]" />
                              </div>
                              <p className="text-xs font-medium text-[var(--text-500)]">No pages yet</p>
                            </div>
                          ) : rootPages.length === 0 ? (
                            <p className="px-2 py-3 text-xs text-[var(--text-500)]">All pages are in Favorites</p>
                          ) : (
                            rootPages.map(note => (
                              <NoteSidebarItem
                                key={note.id}
                                note={note}
                                depth={0}
                                selectedNoteId={notesControls.selectedNoteId}
                                controls={notesControls}
                              />
                            ))
                          )}
                        </div>
                      </>
                    );
                  })()}
                </ScrollArea>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.12), rgba(var(--neon-rgb), 0.04))' }}>
                  <StickyNote size={22} style={{ color: 'var(--neon-color)' }} />
                </div>
                <p className="text-sm font-semibold mb-1.5 text-[var(--text-300)]">Notes</p>
                <p className="text-xs leading-relaxed text-[var(--text-500)]">
                  Notion-style notes with blocks, pages, and markdown.
                </p>
              </div>
            )}
          </div>
        ) : isAgentBuilderMode ? (
          <WorkflowSidebar embedded />
        ) : (
          <>
            {/* New Chat */}
            <div className="px-3 pt-3">
              <button
                type="button"
                className="sidebar-new-chat group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.08), rgba(var(--neon-rgb), 0.03))',
                  border: '1px solid rgba(var(--neon-rgb), 0.12)',
                  color: 'var(--text-100)',
                }}
                onClick={onNewChat}
                title="Start a new chat"
              >
                <div
                  className="flex items-center justify-center rounded-lg w-5 h-5 transition-all duration-200"
                  style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)' }}
                >
                  <Plus size={13} style={{ color: 'var(--neon-color)' }} />
                </div>
                <span className="min-w-0 flex-1 truncate text-left">New chat</span>
              </button>
            </div>

            {/* Conversation History */}
            <ScrollArea className="flex-1 px-3 pt-3">
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
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--bg-200)' }}>
                    <Plus size={18} className="text-[var(--text-500)]" />
                  </div>
                  <p className="text-xs font-medium text-[var(--text-500)]">No conversations yet</p>
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {/* Footer — user card with popover menu */}
        <div className="px-3 pb-3 pt-1">
          <Popover>
            <PopoverTrigger asChild>
              <button className="sidebar-user-card w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all duration-200 cursor-pointer hover:bg-[var(--bg-200)]">
                <div className="sidebar-user-avatar relative">
                  <Avatar className="h-9 w-9 ring-2 ring-transparent transition-all duration-200">
                    <AvatarFallback
                      className="text-sm font-bold"
                      style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.2), rgba(var(--neon-rgb), 0.08))', color: 'var(--neon-color)' }}
                    >
                      E
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ backgroundColor: '#34d399', borderColor: 'var(--bg-100)' }} />
                </div>
                <div className="flex flex-col min-w-0 flex-1 text-left">
                  <span className="font-semibold text-[14px] truncate text-[var(--text-100)]">Edward</span>
                  <span className="text-[11px] truncate text-[var(--text-500)]">
                    {currentModelName || 'MiMo V2.5'}
                  </span>
                </div>
                <ChevronUp size={16} className="text-[var(--text-500)] flex-shrink-0" />
              </button>
            </PopoverTrigger>

            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-[260px] p-1.5 rounded-xl border-[var(--border-300)]"
              style={{
                backgroundColor: 'var(--bg-100)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              {/* User info header inside popover */}
              <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
                <Avatar className="h-9 w-9">
                  <AvatarFallback
                    className="text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.2), rgba(var(--neon-rgb), 0.08))', color: 'var(--neon-color)' }}
                  >
                    E
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-[13px] truncate text-[var(--text-100)]">Edward</span>
                  <span className="text-[10px] truncate text-[var(--text-500)]">
                    {currentModelName || 'MiMo V2.5'}
                  </span>
                </div>
              </div>

              <div className="py-1">
                {!isSettingsPage && (
                  <>
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-500)] hover:bg-[var(--bg-200)] hover:text-[var(--text-100)] transition-all duration-200 cursor-pointer"
                      onClick={() => navigate('/')}
                    >
                      <Home size={15} />
                      <span>Home</span>
                    </button>

                    <button
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-500)] hover:bg-[var(--bg-200)] hover:text-[var(--text-100)] transition-all duration-200 cursor-pointer"
                      onClick={() => onSidebarPanelChange('token-stats')}
                    >
                      <BarChart3 size={15} />
                      <span>Token Stats</span>
                    </button>
                  </>
                )}

                <button
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-500)] hover:bg-[var(--bg-200)] hover:text-[var(--text-100)] transition-all duration-200 cursor-pointer"
                  onClick={() => navigate('/settings')}
                  style={isSettingsPage ? { backgroundColor: 'rgba(var(--neon-rgb), 0.08)', color: 'var(--neon-color)' } : undefined}
                >
                  <SettingsIcon size={15} />
                  <span>Settings</span>
                </button>

                <button
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-500)] hover:bg-[var(--bg-200)] hover:text-[var(--text-100)] transition-all duration-200 cursor-pointer"
                  onClick={onToggleTheme}
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                  <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
