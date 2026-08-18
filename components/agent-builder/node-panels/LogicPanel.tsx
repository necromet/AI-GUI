import VariablePicker from '../VariablePicker';

interface Props {
  data: Record<string, any>;
  onUpdate: (data: Record<string, any>) => void;
  nodeType: 'if-else' | 'while' | 'user-approval';
}

export default function LogicPanel({ data, onUpdate, nodeType }: Props) {
  if (nodeType === 'user-approval') {
    return (
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Approval Message</span>
          <textarea
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs resize-y min-h-[60px]"
            style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
            value={data.message || ''}
            onChange={(e) => onUpdate({ message: e.target.value })}
            placeholder="Approve to continue?"
          />
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Condition</span>
        <textarea
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs font-mono resize-y min-h-[60px]"
          style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
          value={data.condition || ''}
          onChange={(e) => onUpdate({ condition: e.target.value })}
          placeholder={nodeType === 'if-else' ? 'state.input.score > 0.5' : 'state.lastOutput.shouldContinue'}
        />
      </label>

      <div>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-500)' }}>Insert variable</span>
        <div className="mt-1">
          <VariablePicker onSelect={(v) => onUpdate({ condition: (data.condition || '') + v })} />
        </div>
      </div>

      {nodeType === 'while' && (
        <label className="block">
          <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Max Iterations</span>
          <input
            type="number"
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs"
            style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
            value={data.maxIterations || 10}
            onChange={(e) => onUpdate({ maxIterations: parseInt(e.target.value) || 10 })}
            min={1}
            max={100}
          />
        </label>
      )}

      <p className="text-[10px]" style={{ color: 'var(--text-500)' }}>
        {nodeType === 'if-else'
          ? 'If condition is truthy, follows the "if" branch. Otherwise, "else".'
          : 'Loops back while condition is truthy. Exits via "break" when false.'}
      </p>
    </div>
  );
}
