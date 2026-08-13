import { useState } from 'react';
import { Bot, Plus, Workflow, MessageSquare, Wrench, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { AgentBuilderAgent, AgentBuilderTool, AgentBuilderWorkflow } from './types';
import { DEFAULT_PARAMETERS_SCHEMA } from './types';

interface AgentSidebarProps {
  agents: AgentBuilderAgent[];
  tools: AgentBuilderTool[];
  workflows: AgentBuilderWorkflow[];
  selectedAgentId: string | null;
  selectedWorkflowId: string | null;
  view: 'canvas' | 'chat';
  onSelectAgent: (id: string | null) => void;
  onSelectWorkflow: (id: string | null) => void;
  onSwitchView: (view: 'canvas' | 'chat') => void;
  onCreateAgent: (data: Partial<AgentBuilderAgent>) => Promise<any>;
  onCreateTool: (data: Partial<AgentBuilderTool>) => Promise<any>;
  onCreateWorkflow: (data: Partial<AgentBuilderWorkflow>) => Promise<any>;
  onDeleteWorkflow: (id: string) => Promise<any>;
}

export function AgentSidebar({
  agents,
  tools,
  workflows,
  selectedAgentId,
  selectedWorkflowId,
  view,
  onSelectAgent,
  onSelectWorkflow,
  onSwitchView,
  onCreateAgent,
  onCreateTool,
  onCreateWorkflow,
  onDeleteWorkflow,
}: AgentSidebarProps) {
  const [newAgentName, setNewAgentName] = useState('');
  const [newToolName, setNewToolName] = useState('');
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [showNewTool, setShowNewTool] = useState(false);

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    await onCreateAgent({ name: newAgentName.trim() });
    setNewAgentName('');
    setShowNewAgent(false);
  };

  const handleCreateTool = async () => {
    if (!newToolName.trim()) return;
    await onCreateTool({ name: newToolName.trim(), description: '', parameters_schema: DEFAULT_PARAMETERS_SCHEMA });
    setNewToolName('');
    setShowNewTool(false);
  };

  return (
    <div className="ab-sidebar">
      <div className="ab-sidebar-header">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: 'rgba(90, 189, 172, 0.1)' }}>
            <Bot size={16} style={{ color: '#5ABDAC' }} />
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>Agent Builder</span>
        </div>
      </div>

      <div className="ab-sidebar-tabs">
        <button
          className={`ab-sidebar-tab ${view === 'canvas' ? 'ab-sidebar-tab-active' : ''}`}
          onClick={() => onSwitchView('canvas')}
        >
          <Workflow size={14} />
          Canvas
        </button>
        <button
          className={`ab-sidebar-tab ${view === 'chat' ? 'ab-sidebar-tab-active' : ''}`}
          onClick={() => onSwitchView('chat')}
        >
          <MessageSquare size={14} />
          Chat
        </button>
      </div>

      <Separator style={{ backgroundColor: 'var(--border-300)' }} />

      <ScrollArea className="ab-sidebar-content">
        {/* Agents */}
        <div className="ab-sidebar-section">
          <div className="ab-sidebar-section-header">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-300)' }}>AGENTS</span>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setShowNewAgent(!showNewAgent)} aria-label="Create new agent">
              <Plus size={12} />
            </Button>
          </div>

          {showNewAgent && (
            <div className="flex gap-1 mb-2">
              <Input
                value={newAgentName}
                onChange={e => setNewAgentName(e.target.value)}
                placeholder="Agent name"
                className="h-7 text-xs"
                onKeyDown={e => e.key === 'Enter' && handleCreateAgent()}
              />
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleCreateAgent}>
                Add
              </Button>
            </div>
          )}

          {agents.map(agent => (
            <button
              key={agent.id}
              className={`ab-sidebar-item ${selectedAgentId === agent.id ? 'ab-sidebar-item-active' : ''}`}
              onClick={() => onSelectAgent(agent.id)}
              style={{ '--item-color': agent.color } as React.CSSProperties}
            >
              <Bot size={14} style={{ color: agent.color }} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate block">{agent.name}</span>
                <span className="text-[10px] truncate block" style={{ color: 'var(--text-500)' }}>
                  {agent.model}
                </span>
              </div>
              <Badge variant="outline" className="h-4 px-1 text-[9px]" style={{ borderColor: 'var(--border-300)' }}>
                {agent.tools?.length || 0}
              </Badge>
            </button>
          ))}

          {agents.length === 0 && !showNewAgent && (
            <p className="text-[10px] py-2" style={{ color: 'var(--text-500)' }}>No agents yet. Click + to create one.</p>
          )}
        </div>

        <Separator className="my-2" style={{ backgroundColor: 'var(--border-300)' }} />

        {/* Tools */}
        <div className="ab-sidebar-section">
          <div className="ab-sidebar-section-header">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-300)' }}>TOOLS</span>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setShowNewTool(!showNewTool)} aria-label="Create new tool">
              <Plus size={12} />
            </Button>
          </div>

          {showNewTool && (
            <div className="flex gap-1 mb-2">
              <Input
                value={newToolName}
                onChange={e => setNewToolName(e.target.value)}
                placeholder="Tool name"
                className="h-7 text-xs"
                onKeyDown={e => e.key === 'Enter' && handleCreateTool()}
              />
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleCreateTool}>
                Add
              </Button>
            </div>
          )}

          {tools.map(t => (
            <div key={t.id} className="ab-sidebar-item ab-sidebar-item-static" style={{ '--item-color': t.color } as React.CSSProperties}>
              <Wrench size={14} style={{ color: t.color }} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate block">{t.name}</span>
                <span className="text-[10px] truncate block" style={{ color: 'var(--text-500)' }}>
                  {Object.keys(t.parameters_schema?.properties || {}).length} params
                </span>
              </div>
            </div>
          ))}

          {tools.length === 0 && !showNewTool && (
            <p className="text-[10px] py-2" style={{ color: 'var(--text-500)' }}>No tools yet. Click + to create one.</p>
          )}
        </div>

        <Separator className="my-2" style={{ backgroundColor: 'var(--border-300)' }} />

        {/* Workflows */}
        <div className="ab-sidebar-section">
          <div className="ab-sidebar-section-header">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-300)' }}>WORKFLOWS</span>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onCreateWorkflow({ name: 'New Workflow' })} aria-label="Create new workflow">
              <Plus size={12} />
            </Button>
          </div>

          {workflows.map(wf => (
            <div
              key={wf.id}
              className={`ab-sidebar-item group cursor-pointer ${selectedWorkflowId === wf.id ? 'ab-sidebar-item-active' : ''}`}
              onClick={() => onSelectWorkflow(wf.id)}
            >
              <Workflow size={14} style={{ color: 'var(--text-300)' }} />
              <span className="text-xs font-medium flex-1 truncate">{wf.name}</span>
              <button
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                onClick={(e) => { e.stopPropagation(); onDeleteWorkflow(wf.id); }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {workflows.length === 0 && (
            <p className="text-[10px] py-2" style={{ color: 'var(--text-500)' }}>No workflows yet.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
