import Editor from '@monaco-editor/react';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; }

export default function WhileNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Continue Condition (JavaScript)</label>
        <p className="text-[10px] mb-2" style={{ color: 'var(--text-500)' }}>
          Returns true {'->'} loop, false {'->'} exit. Available: input, state, lastOutput, variables, iteration
        </p>
        <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--border-300)' }}>
          <Editor
            height="80px"
            defaultLanguage="javascript"
            value={data.condition || data.whileCondition || ''}
            onChange={v => onUpdate({ condition: v, whileCondition: v })}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 11,
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 8, bottom: 8 },
              suggest: { showWords: false },
            }}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Max Iterations</label>
        <input
          type="number"
          min={1}
          max={100}
          value={data.maxIterations || 10}
          onChange={e => onUpdate({ maxIterations: parseInt(e.target.value) })}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      </div>
    </div>
  );
}
