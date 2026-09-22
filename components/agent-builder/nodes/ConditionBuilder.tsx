import VariableAutocomplete from '../VariableAutocomplete';
import { ThemedSwitch } from '../shared/ThemedSwitch';
import {
  CONDITION_OPERATOR_LABELS,
  UNARY_CONDITION_OPERATORS,
  formatConditionRule,
} from '../../../lib/workflow/conditions';
import type { ConditionOperator, ConditionRule } from '../../../lib/workflow/types';

interface Props {
  rule: ConditionRule;
  onChange: (rule: ConditionRule) => void;
  upstreamNodes?: { id: string; label: string }[];
}

const OPERATORS = Object.entries(CONDITION_OPERATOR_LABELS) as Array<[ConditionOperator, string]>;

export default function ConditionBuilder({ rule, onChange, upstreamNodes = [] }: Props) {
  const update = (patch: Partial<ConditionRule>) => onChange({ ...rule, ...patch });
  const unary = UNARY_CONDITION_OPERATORS.has(rule.op);

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-400)' }}>Value to check</label>
        <VariableAutocomplete value={rule.left || ''} onChange={left => update({ left })} placeholder="lastOutput or input.status" upstreamNodes={upstreamNodes} />
      </div>
      <div>
        <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-400)' }}>Operator</label>
        <select value={rule.op} onChange={event => update({ op: event.target.value as ConditionOperator })} className="w-full h-8 px-2.5 text-xs rounded-lg border outline-none cursor-pointer focus:ring-1 focus:ring-[var(--neon-color)]" style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)', backgroundColor: 'var(--bg-100)' }}>
          {OPERATORS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {!unary && (
        <div>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-400)' }}>Comparison value</label>
          <VariableAutocomplete value={rule.right || ''} onChange={right => update({ right })} placeholder="Type a value or {{variable}}" upstreamNodes={upstreamNodes} />
        </div>
      )}
      {['eq', 'neq', 'contains', 'not_contains', 'starts_with', 'ends_with', 'matches'].includes(rule.op) && (
        <div className="flex items-center justify-between rounded-lg border px-2.5 py-2" style={{ borderColor: 'var(--border-200)' }}>
          <span className="text-[10px]" style={{ color: 'var(--text-300)' }}>Case sensitive</span>
          <ThemedSwitch checked={Boolean(rule.caseSensitive)} onCheckedChange={caseSensitive => update({ caseSensitive })} />
        </div>
      )}
      <div className="rounded-lg px-2.5 py-2 text-[10px] font-mono" style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)' }}>{formatConditionRule(rule)}</div>
    </div>
  );
}
