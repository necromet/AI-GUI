import Editor from '@monaco-editor/react';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; }

export default function TransformNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>
          JavaScript Code
        </label>
        <p className="text-[10px] mb-2" style={{ color: 'var(--text-500)' }}>
          Available: input, lastOutput, state, variables
        </p>
        <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--border-300)' }}>
          <Editor
            height="160px"
            defaultLanguage="javascript"
            value={data.code || data.transformScript || 'return input;'}
            onChange={v => onUpdate({ code: v, transformScript: v })}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 11,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 8, bottom: 8 },
              suggest: { showWords: false },
            }}
          />
        </div>
      </div>
    </div>
  );
}
