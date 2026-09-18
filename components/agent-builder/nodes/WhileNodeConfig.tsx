import Editor from '@monaco-editor/react';
import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';
import { ThemedSlider } from '../shared/ThemedSlider';
import {
  ThemedTooltip,
  ThemedTooltipTrigger,
  ThemedTooltipContent,
  ThemedTooltipProvider,
} from '../shared/ThemedTooltip';
import { Info } from 'lucide-react';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

export default function WhileNodeConfig({ data, onUpdate }: Props) {
  return (
    <ThemedTooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>Continue Condition (JavaScript)</label>
            <ThemedTooltip>
              <ThemedTooltipTrigger asChild>
                <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
              </ThemedTooltipTrigger>
              <ThemedTooltipContent side="top">
                Returns true → loop body, false → exit. Available: input, state, lastOutput, variables, iteration
              </ThemedTooltipContent>
            </ThemedTooltip>
          </div>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-300)' }}>
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
          <div className="flex items-center justify-between mb-1.5">
            <label className={fieldClasses.label} style={FIELD_STYLES.label}>Max Iterations</label>
            <input
              type="number"
              min={1}
              max={100}
              value={data.maxIterations || 10}
              onChange={e => onUpdate({ maxIterations: parseInt(e.target.value) })}
              className="w-14 text-right text-xs px-1.5 py-0.5 rounded border bg-transparent outline-none transition-colors focus:ring-1 focus:ring-[var(--neon-color)]"
              style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>
          <ThemedSlider
            min={1}
            max={100}
            step={1}
            value={[data.maxIterations || 10]}
            onValueChange={([v]) => onUpdate({ maxIterations: v })}
          />
        </div>
      </div>
    </ThemedTooltipProvider>
  );
}
