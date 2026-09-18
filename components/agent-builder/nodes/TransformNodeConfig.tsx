import Editor from '@monaco-editor/react';
import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';
import {
  ThemedTooltip,
  ThemedTooltipTrigger,
  ThemedTooltipContent,
  ThemedTooltipProvider,
} from '../shared/ThemedTooltip';
import { Info } from 'lucide-react';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

export default function TransformNodeConfig({ data, onUpdate }: Props) {
  return (
    <ThemedTooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>
              JavaScript Code
            </label>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}>
              JS
            </span>
            <ThemedTooltip>
              <ThemedTooltipTrigger asChild>
                <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
              </ThemedTooltipTrigger>
              <ThemedTooltipContent side="top">
                Return the transformed data. Available variables: input, lastOutput, state, variables
              </ThemedTooltipContent>
            </ThemedTooltip>
          </div>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-300)' }}>
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
    </ThemedTooltipProvider>
  );
}
