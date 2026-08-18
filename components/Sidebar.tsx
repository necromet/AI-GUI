import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, PanelLeftClose, Settings as SettingsIcon, Trash2, BarChart3, Sun, Moon, Database, Puzzle, Home, Layers, Package, ArrowLeft, FileCode, FileText, FileJson, FileType, Eye, Code, Terminal, FileCode2, ChevronRight, ChevronDown, ArrowUp, ArrowDown, RefreshCw, ChevronUp, Bot, Workflow, MessageSquare, Wrench, LayoutGrid, SlidersHorizontal } from 'lucide-react';
import { ChatSession, Mode, ModelConfig } from '../types';
import type { LibraryComponentFile, LibraryFolder } from '../types';
import type { LibraryControls } from './LibraryPanel';
import type { CanvasSidebarControls } from './canvas';
import type { DatabaseSidebarControls } from './DatabasePanel';
import type { AgentBuilderSidebarControls } from './agent-builder/AgentBuilderPanel';
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
  agentBuilderControls?: AgentBuilderSidebarControls | null;
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
        className="border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-200)' }}
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

const AgentBuilderSidebarContent: React.FC<{ controls: AgentBuilderSidebarControls; onBack: () => void }> = ({ controls, onBack }) => {
  const [newAgentName, setNewAgentName] = useState('');
  const [newToolName, setNewToolName] = useState('');
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [agentPopoverOpen, setAgentPopoverOpen] = useState(false);
  const [toolPopoverOpen, setToolPopoverOpen] = useState(false);
  const [workflowPopoverOpen, setWorkflowPopoverOpen] = useState(false);

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim()) return;
    const wf = await controls.onCreateWorkflow({ name: newWorkflowName.trim() });
    setNewWorkflowName('');
    setWorkflowPopoverOpen(false);
    if (wf?.id) controls.onSelectWorkflow(wf.id);
  };

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    const agent = await controls.onCreateAgent({ name: newAgentName.trim() });
    setNewAgentName('');
    setAgentPopoverOpen(false);
    if (agent && controls.selectedWorkflowId) {
      await controls.onAddAgentToWorkflow(controls.selectedWorkflowId, agent.id);
    }
  };

  const handleCreateTool = async () => {
    if (!newToolName.trim()) return;
    const tool = await controls.onCreateTool({ name: newToolName.trim(), description: '', parameters_schema: { type: 'object', properties: { input: { type: 'string', description: 'Input text' } }, required: ['input'] } });
    setNewToolName('');
    setToolPopoverOpen(false);
    if (tool && controls.selectedWorkflowId) {
      await controls.onAddToolToWorkflow(controls.selectedWorkflowId, tool.id);
    }
  };

  const workflowAgentIds = new Set(controls.workflowDetail?.agents.map(a => a.id) ?? []);
  const workflowToolIds = new Set(controls.workflowDetail?.tools.map(t => t.id) ?? []);
  const availableAgents = controls.agents.filter(a => !workflowAgentIds.has(a.id));
  const availableTools = controls.tools.filter(t => !workflowToolIds.has(t.id));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Back button */}
      <div className="px-3 pt-3 pb-2">
        <button
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer text-[var(--text-500)] hover:text-[var(--text-100)] hover:bg-[var(--bg-200)]"
          onClick={onBack}
        >
          <ArrowLeft size={14} />
          <span>Back to Tools</span>
        </button>
      </div>

      {/* Workflow list — always visible */}
      <div className="px-3 pb-2">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-500)]">Workflows</span>
          <Popover open={workflowPopoverOpen} onOpenChange={setWorkflowPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center justify-center w-5 h-5 rounded-md transition-all duration-200 cursor-pointer hover:bg-[var(--bg-200)] text-[var(--text-500)] hover:text-[var(--text-100)]">
                <Plus size={12} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={4}
              className="w-56 p-3 rounded-xl"
              style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
            >
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-100)' }}>New Workflow</div>
              <Input
                value={newWorkflowName}
                onChange={e => setNewWorkflowName(e.target.value)}
                placeholder="Workflow name"
                className="h-8 text-xs mb-2"
                style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
                onKeyDown={e => e.key === 'Enter' && handleCreateWorkflow()}
                autoFocus
              />
              <Button
                size="sm"
                className="w-full h-7 text-xs cursor-pointer"
                style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
                onClick={handleCreateWorkflow}
                disabled={!newWorkflowName.trim()}
              >
                Create Workflow
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        {controls.workflows.map(wf => (
          <div
            key={wf.id}
            className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-200 cursor-pointer mb-0.5 ${
              controls.selectedWorkflowId === wf.id
                ? 'border'
                : 'border border-transparent hover:bg-[var(--bg-200)]'
            }`}
            style={
              controls.selectedWorkflowId === wf.id
                ? { backgroundColor: 'rgba(var(--neon-rgb), 0.08)', borderColor: 'rgba(var(--neon-rgb), 0.2)' }
                : undefined
            }
            onClick={() => controls.onSelectWorkflow(wf.id)}
          >
            <Workflow size={14} style={{ color: 'var(--text-300)' }} />
            <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--text-100)' }}>{wf.name}</span>
            <button
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all duration-200 cursor-pointer hover:bg-red-500/10"
              style={{ color: '#ef4444' }}
              onClick={(e) => { e.stopPropagation(); controls.onDeleteWorkflow(wf.id); }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}

        {controls.workflows.length === 0 && (
          <p className="text-[10px] px-1 py-3 text-center" style={{ color: 'var(--text-500)' }}>No workflows yet</p>
        )}
      </div>

      <div className="mx-3 h-px" style={{ background: 'var(--border-300)' }} />

      {/* Content below is only shown when a workflow is selected */}
      {controls.selectedWorkflowId && controls.workflowDetail ? (
        <ScrollArea className="flex-1 px-3 pt-3">
          {/* View toggle */}
          <div className="mb-3">
            <SlidingGroup
              direction="horizontal"
              activeKey={controls.view}
              onSelect={(key) => controls.onSwitchView(key as 'canvas' | 'chat')}
              className="gap-1 p-1 rounded-xl"
              style={{ backgroundColor: 'var(--bg-200)' }}
              indicatorStyle={{ top: 2, bottom: 2 }}
              items={[
                { key: 'canvas' as const, label: 'Canvas', icon: <Workflow size={12} /> },
                { key: 'chat' as const, label: 'Chat', icon: <MessageSquare size={12} /> },
              ]}
              renderItem={(item, isActive) => (
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
                  style={{ color: isActive ? 'var(--text-100)' : 'var(--text-500)' }}
                >
                  {item.icon}
                  {item.label}
                </button>
              )}
            />
          </div>

          <div className="mx-1 mb-3 h-px" style={{ background: 'var(--border-300)' }} />

          {/* IN THIS WORKFLOW */}
          {(controls.workflowDetail.agents.length > 0 || controls.workflowDetail.tools.length > 0) && (
            <div className="mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-500)] px-1 pb-2 block">In This Workflow</span>
              {controls.workflowDetail.agents.map(agent => (
                <div key={agent.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5">
                  <Bot size={14} style={{ color: agent.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium truncate block" style={{ color: 'var(--text-100)' }}>{agent.name}</span>
                    <span className="text-[10px] truncate block" style={{ color: 'var(--text-500)' }}>{agent.model}</span>
                  </div>
                  <button
                    className="p-0.5 rounded transition-all duration-200 cursor-pointer hover:bg-red-500/10"
                    style={{ color: '#ef4444' }}
                    onClick={async () => {
                      await controls.onRemoveAgentFromWorkflow(controls.selectedWorkflowId!, agent.id);
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              {controls.workflowDetail.tools.map(t => (
                <div key={t.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5">
                  <Wrench size={14} style={{ color: t.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium truncate block" style={{ color: 'var(--text-100)' }}>{t.name}</span>
                  </div>
                  <button
                    className="p-0.5 rounded transition-all duration-200 cursor-pointer hover:bg-red-500/10"
                    style={{ color: '#ef4444' }}
                    onClick={async () => {
                      await controls.onRemoveToolFromWorkflow(controls.selectedWorkflowId!, t.id);
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mx-1 my-2 h-px" style={{ background: 'var(--border-300)' }} />

          {/* AVAILABLE AGENTS */}
          <div className="mb-3">
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-500)]">Available Agents</span>
              <Popover open={agentPopoverOpen} onOpenChange={setAgentPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center justify-center w-5 h-5 rounded-md transition-all duration-200 cursor-pointer hover:bg-[var(--bg-200)] text-[var(--text-500)] hover:text-[var(--text-100)]">
                    <Plus size={12} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="end"
                  sideOffset={4}
                  className="w-56 p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                >
                  <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-100)' }}>New Agent</div>
                  <Input
                    value={newAgentName}
                    onChange={e => setNewAgentName(e.target.value)}
                    placeholder="Agent name"
                    className="h-8 text-xs mb-2"
                    style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
                    onKeyDown={e => e.key === 'Enter' && handleCreateAgent()}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs cursor-pointer"
                    style={{ backgroundColor: '#5ABDAC', color: '#000' }}
                    onClick={handleCreateAgent}
                    disabled={!newAgentName.trim()}
                  >
                    Create Agent
                  </Button>
                </PopoverContent>
              </Popover>
            </div>

            {availableAgents.map(agent => (
              <button
                key={agent.id}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-200 cursor-pointer mb-0.5 border border-transparent hover:bg-[var(--bg-200)]"
                onClick={async () => {
                  await controls.onAddAgentToWorkflow(controls.selectedWorkflowId!, agent.id);
                }}
              >
                <Bot size={14} style={{ color: agent.color }} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate block" style={{ color: 'var(--text-100)' }}>{agent.name}</span>
                  <span className="text-[10px] truncate block" style={{ color: 'var(--text-500)' }}>{agent.model}</span>
                </div>
                <Plus size={12} style={{ color: 'var(--text-400)' }} />
              </button>
            ))}

            {availableAgents.length === 0 && (
              <p className="text-[10px] px-1 py-2 text-center" style={{ color: 'var(--text-500)' }}>
                {controls.agents.length === 0 ? 'No agents yet — create one above' : 'All agents are in this workflow'}
              </p>
            )}
          </div>

          <div className="mx-1 my-2 h-px" style={{ background: 'var(--border-300)' }} />

          {/* AVAILABLE TOOLS */}
          <div className="mb-3">
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-500)]">Available Tools</span>
              <Popover open={toolPopoverOpen} onOpenChange={setToolPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center justify-center w-5 h-5 rounded-md transition-all duration-200 cursor-pointer hover:bg-[var(--bg-200)] text-[var(--text-500)] hover:text-[var(--text-100)]">
                    <Plus size={12} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="end"
                  sideOffset={4}
                  className="w-56 p-3 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                >
                  <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-100)' }}>New Tool</div>
                  <Input
                    value={newToolName}
                    onChange={e => setNewToolName(e.target.value)}
                    placeholder="Tool name"
                    className="h-8 text-xs mb-2"
                    style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
                    onKeyDown={e => e.key === 'Enter' && handleCreateTool()}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs cursor-pointer"
                    style={{ backgroundColor: '#66A0C8', color: '#000' }}
                    onClick={handleCreateTool}
                    disabled={!newToolName.trim()}
                  >
                    Create Tool
                  </Button>
                </PopoverContent>
              </Popover>
            </div>

            {availableTools.map(t => (
              <button
                key={t.id}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-200 cursor-pointer mb-0.5 border border-transparent hover:bg-[var(--bg-200)]"
                onClick={async () => {
                  await controls.onAddToolToWorkflow(controls.selectedWorkflowId!, t.id);
                }}
              >
                <Wrench size={14} style={{ color: t.color }} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate block" style={{ color: 'var(--text-100)' }}>{t.name}</span>
                  <span className="text-[10px] truncate block" style={{ color: 'var(--text-500)' }}>
                    {Object.keys(t.parameters_schema?.properties || {}).length} params
                  </span>
                </div>
                <Plus size={12} style={{ color: 'var(--text-400)' }} />
              </button>
            ))}

            {availableTools.length === 0 && (
              <p className="text-[10px] px-1 py-2 text-center" style={{ color: 'var(--text-500)' }}>
                {controls.tools.length === 0 ? 'No tools yet — create one above' : 'All tools are in this workflow'}
              </p>
            )}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.08)' }}>
            <Workflow size={18} style={{ color: 'var(--neon-color)' }} />
          </div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>Select a workflow</p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-500)' }}>Pick or create a workflow above to start building</p>
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
  agentBuilderControls,
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

  const currentMode: Mode = isChatMode ? 'chat' : isRagMode ? 'rag' : isSkemaMode ? 'skema' : isPythonMode ? 'python' : isLibraryMode ? 'library' : isDatabaseMode ? 'database' : 'chat';

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
          <span className="truncate flex-1 text-[13px]">
            {truncateTitle(conv.title)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              conv.dbConversationId && onDeleteConversation(conv.dbConversationId);
            }}
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-[var(--text-500)] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 rounded-lg"
          >
            <Trash2 size={13} />
          </Button>
        </div>
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
        borderRight: '1px solid var(--border-300)',
      }}
    >
      <div className={`flex flex-col h-full ${isDatabaseMode ? 'w-[360px]' : 'w-[288px]'} transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>

        {/* Header */}
        <div className="relative flex w-full items-center px-3 pt-4 pb-2">
          <div className="flex items-center gap-2.5 pl-1">
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
            <div className="flex items-center gap-2.5">
              <div className="sidebar-brand-mark flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.15), rgba(var(--neon-rgb), 0.05))' }}>
                <span className="text-xs font-bold" style={{ color: 'var(--neon-color)' }}>e</span>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-semibold text-[13px] tracking-tight text-[var(--text-100)]">edward:labs</span>
                <span className="text-[10px] tabular-nums tracking-wide text-[var(--text-500)]">{gmt7Time}</span>
              </div>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-semibold border-0 px-1.5 py-0.5 ml-0.5"
              style={{
                backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
                color: 'var(--neon-color)',
              }}
            >
              {currentMode === 'chat' ? 'Chat' : currentMode === 'rag' ? 'RAG' : currentMode === 'skema' ? 'Skema' : currentMode === 'python' ? 'Python' : currentMode === 'library' ? 'Library' : currentMode === 'database' ? 'DB' : isSettingsPage ? 'Settings' : ''}
            </Badge>
          </div>
          <div className="absolute flex items-center right-3 top-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-7 w-7 rounded-lg text-[var(--text-500)] hover:bg-[var(--bg-200)] hover:text-[var(--text-100)] transition-all duration-200"
            >
              <PanelLeftClose size={15} />
            </Button>
          </div>
        </div>

        {/* Divider after header */}
        <div className="mx-3 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--border-300), transparent)' }} />

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
                className="sidebar-new-chat group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.08), rgba(var(--neon-rgb), 0.03))',
                  border: '1px solid rgba(var(--neon-rgb), 0.12)',
                  color: 'var(--text-100)',
                }}
                onClick={onNewChat}
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
              <>
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
                  <div className="px-3 pt-2">
                    <div className="px-2 pb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-500)]">Folders</span>
                    </div>
                    <ScrollArea className="flex-1">
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
              </>
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
        ) : (
          <>
            {/* New Chat */}
            <div className="px-3 pt-3">
              <button
                className="sidebar-new-chat group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.08), rgba(var(--neon-rgb), 0.03))',
                  border: '1px solid rgba(var(--neon-rgb), 0.12)',
                  color: 'var(--text-100)',
                }}
                onClick={onNewChat}
              >
                <div
                  className="flex items-center justify-center rounded-lg w-5 h-5 transition-all duration-200"
                  style={{ backgroundColor: 'rgba(var(--neon-rgb), 0.15)' }}
                >
                  <Plus size={13} style={{ color: 'var(--neon-color)' }} />
                </div>
                <span>New chat</span>
                <span className="ml-auto text-[10px] opacity-0 group-hover:opacity-60 transition-opacity text-[var(--text-500)] font-mono">
                  Ctrl+⇧+O
                </span>
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
          <div className="mx-1 my-2 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--border-300), transparent)' }} />

          <Popover>
            <PopoverTrigger asChild>
              <button className="sidebar-user-card w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 cursor-pointer hover:bg-[var(--bg-200)]">
                <div className="sidebar-user-avatar relative">
                  <Avatar className="h-8 w-8 ring-2 ring-transparent transition-all duration-200">
                    <AvatarFallback
                      className="text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, rgba(var(--neon-rgb), 0.2), rgba(var(--neon-rgb), 0.08))', color: 'var(--neon-color)' }}
                    >
                      E
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ backgroundColor: '#34d399', borderColor: 'var(--bg-100)' }} />
                </div>
                <div className="flex flex-col min-w-0 flex-1 text-left">
                  <span className="font-semibold text-[13px] truncate text-[var(--text-100)]">Edward</span>
                  <span className="text-[10px] truncate text-[var(--text-500)]">
                    {currentModelName || 'MiMo V2.5'}
                  </span>
                </div>
                <ChevronUp size={14} className="text-[var(--text-500)] flex-shrink-0" />
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

              <div className="h-px mx-2" style={{ background: 'var(--border-300)' }} />

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
