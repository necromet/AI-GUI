import Editor from '@monaco-editor/react';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; }

export default function IfElseNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Condition (JavaScript)</label>
        <p className="text-[10px] mb-2" style={{ color: 'var(--text-500)' }}>
          Returns truthy {'->'} &quot;if&quot; branch, falsy {'->'} &quot;else&quot; branch
        </p>
        <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--border-300)' }}>
          <Editor
            height="80px"
            defaultLanguage="javascript"
            value={data.condition || ''}
            onChange={v => onUpdate({ condition: v })}
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
    </div>
  );
}
