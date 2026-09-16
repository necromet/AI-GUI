import Editor from '@monaco-editor/react';
import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

export default function IfElseNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Condition (JavaScript)</label>
        <p className="text-[10px] mb-2" style={FIELD_STYLES.helperText}>
          Returns truthy {'->'} &quot;if&quot; branch, falsy {'->'} &quot;else&quot; branch
        </p>
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-300)' }}>
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
