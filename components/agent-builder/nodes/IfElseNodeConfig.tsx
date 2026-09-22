import Editor from '@monaco-editor/react';
import { GitBranch, Info } from 'lucide-react';
import ConditionBuilder from './ConditionBuilder';
import { resolveConditionMode } from '../../../lib/workflow/conditions';
import type { ConditionMode, ConditionRule } from '../../../lib/workflow/types';
import { ThemedTooltip, ThemedTooltipContent, ThemedTooltipProvider, ThemedTooltipTrigger } from '../shared/ThemedTooltip';

interface Props {
  data: Record<string, any>;
  onUpdate: (data: Record<string, any>) => void;
  upstreamNodes?: { id: string; label: string }[];
  accentColor?: string;
}

const DEFAULT_RULE: ConditionRule = { left: 'lastOutput', op: 'contains', right: '' };

export default function IfElseNodeConfig({ data, onUpdate, upstreamNodes = [] }: Props) {
  const mode: ConditionMode = resolveConditionMode(data) || 'simple';
  const rule: ConditionRule = data.conditionRule || DEFAULT_RULE;

  return (
    <ThemedTooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <section className="space-y-3">
          <div className="flex items-center gap-1.5">
            <GitBranch size={12} style={{ color: 'var(--neon-color)' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-300)' }}>Condition</span>
            <ThemedTooltip>
              <ThemedTooltipTrigger asChild><span style={{ color: 'var(--text-500)' }}><Info size={11} /></span></ThemedTooltipTrigger>
              <ThemedTooltipContent side="top">True follows the green branch; false follows the red branch.</ThemedTooltipContent>
            </ThemedTooltip>
          </div>

          <div className="grid grid-cols-2 rounded-lg border p-1 gap-1" style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)' }}>
            {(['simple', 'expression'] as ConditionMode[]).map(value => (
              <button key={value} type="button" onClick={() => onUpdate({ conditionMode: value })} className="px-2 py-1.5 rounded-md text-[10px] font-medium cursor-pointer transition-colors" style={{ backgroundColor: mode === value ? 'var(--bg-400)' : 'transparent', color: mode === value ? 'var(--text-100)' : 'var(--text-500)' }}>
                {value === 'expression' ? 'Expression (advanced)' : 'Simple'}
              </button>
            ))}
          </div>

          {mode === 'simple' ? (
            <ConditionBuilder rule={rule} onChange={conditionRule => onUpdate({ conditionMode: 'simple', conditionRule })} upstreamNodes={upstreamNodes} />
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-300)' }}>
              <Editor height="110px" defaultLanguage="javascript" value={data.condition || ''} onChange={condition => onUpdate({ conditionMode: 'expression', condition: condition || '' })} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 11, lineNumbers: 'off', scrollBeyondLastLine: false, wordWrap: 'on', padding: { top: 8, bottom: 8 }, suggest: { showWords: false } }} />
            </div>
          )}
        </section>

        <BranchSection title="If true" color="#4ade80" label={data.trueLabel ?? 'True'} path={data.truePath ?? ''} nodes={upstreamNodes} onLabel={trueLabel => onUpdate({ trueLabel })} onPath={truePath => onUpdate({ truePath })} />
        <BranchSection title="If false" color="#f87171" label={data.falseLabel ?? 'False'} path={data.falsePath ?? ''} nodes={upstreamNodes} onLabel={falseLabel => onUpdate({ falseLabel })} onPath={falsePath => onUpdate({ falsePath })} />
      </div>
    </ThemedTooltipProvider>
  );
}

function BranchSection({ title, color, label, path, nodes, onLabel, onPath }: {
  title: string;
  color: string;
  label: string;
  path: string;
  nodes: { id: string; label: string }[];
  onLabel: (value: string) => void;
  onPath: (value: string) => void;
}) {
  const listId = `branch-target-${title.replace(/\s/g, '-').toLowerCase()}`;
  const inputClass = 'w-full px-2.5 py-2 text-xs rounded-lg border bg-transparent outline-none focus:ring-1 focus:ring-[var(--neon-color)]';
  return (
    <section className="rounded-lg border p-3 space-y-3" style={{ borderColor: `${color}45`, backgroundColor: `${color}08` }}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color }}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />{title}</div>
      <div>
        <label className="text-[10px] block mb-1" style={{ color: 'var(--text-400)' }}>Branch label</label>
        <input value={label} onChange={event => onLabel(event.target.value)} className={inputClass} style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }} />
      </div>
      <div>
        <label className="text-[10px] block mb-1" style={{ color: 'var(--text-400)' }}>Go to node (optional)</label>
        <input list={listId} value={path} onChange={event => onPath(event.target.value)} placeholder="Choose or type a node ID/name" className={inputClass} style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }} />
        <datalist id={listId}>{nodes.map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</datalist>
      </div>
    </section>
  );
}
