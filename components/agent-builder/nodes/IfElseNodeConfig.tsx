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

export default function IfElseNodeConfig({ data, onUpdate }: Props) {
  return (
    <ThemedTooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>Condition (JavaScript)</label>
            <ThemedTooltip>
              <ThemedTooltipTrigger asChild>
                <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
              </ThemedTooltipTrigger>
              <ThemedTooltipContent side="top">
                Returns truthy → &quot;if&quot; branch (top handle), falsy → &quot;else&quot; branch (bottom handle)
              </ThemedTooltipContent>
            </ThemedTooltip>
          </div>
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

        {/* Branch legend */}
        <div className="p-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-200)' }}>
          <div className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--text-300)' }}>Output Branches</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span style={{ color: 'var(--text-300)' }}><strong>True</strong> — condition is truthy</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span style={{ color: 'var(--text-300)' }}><strong>False</strong> — condition is falsy</span>
            </div>
          </div>
        </div>
      </div>
    </ThemedTooltipProvider>
  );
}
