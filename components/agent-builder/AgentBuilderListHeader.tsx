import { FileCode2, Plus, Workflow } from 'lucide-react';
import type { WorkflowListHeaderControls } from './AgentBuilderMode';
import { ThemedTooltip, ThemedTooltipContent, ThemedTooltipProvider, ThemedTooltipTrigger } from './shared/ThemedTooltip';

export default function AgentBuilderListHeader({ controls }: { controls: WorkflowListHeaderControls }) {
  return (
    <ThemedTooltipProvider delayDuration={250}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'var(--neon-color)', background: 'linear-gradient(135deg, rgba(var(--neon-rgb),.18), rgba(var(--neon-rgb),.06))', border: '1px solid rgba(var(--neon-rgb),.18)' }}>
          <Workflow size={16} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>Agent Builder</div>
          <div className="text-[10px]" style={{ color: 'var(--text-500)' }}>{controls.workflowCount} workflow{controls.workflowCount === 1 ? '' : 's'}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemedTooltip>
          <ThemedTooltipTrigger asChild>
            <button onClick={controls.onTemplates} className="h-8 px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all hover:-translate-y-px" style={{ color: 'var(--text-300)', backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}><FileCode2 size={14} />Templates</button>
          </ThemedTooltipTrigger>
          <ThemedTooltipContent side="bottom">Browse reusable workflow templates</ThemedTooltipContent>
        </ThemedTooltip>
        <ThemedTooltip>
          <ThemedTooltipTrigger asChild>
            <button onClick={controls.onNewWorkflow} disabled={controls.creating} className="h-8 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all hover:-translate-y-px" style={{ color: '#050505', backgroundColor: 'var(--neon-color)', boxShadow: '0 8px 22px rgba(var(--neon-rgb),.18)' }}><Plus size={14} />{controls.creating ? 'Creating…' : 'New Workflow'}</button>
          </ThemedTooltipTrigger>
          <ThemedTooltipContent side="bottom">Create a workflow with a Start node</ThemedTooltipContent>
        </ThemedTooltip>
      </div>
    </ThemedTooltipProvider>
  );
}
