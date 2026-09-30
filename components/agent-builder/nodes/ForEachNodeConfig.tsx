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

export default function ForEachNodeConfig({ data, onUpdate }: Props) {
  return (
    <ThemedTooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>Items (JavaScript)</label>
            <ThemedTooltip>
              <ThemedTooltipTrigger asChild>
                <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
              </ThemedTooltipTrigger>
              <ThemedTooltipContent side="top" className="max-w-[280px]">
                Must evaluate to an array. Available: input, state, lastOutput, variables.
                Example: input.urls — connect the loop body back to this node to process the next item.
              </ThemedTooltipContent>
            </ThemedTooltip>
          </div>
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-300)' }}>
            <Editor
              height="80px"
              defaultLanguage="javascript"
              value={data.items || data.forEachItems || ''}
              onChange={v => onUpdate({ items: v, forEachItems: v })}
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>Item variable</label>
              <ThemedTooltip>
                <ThemedTooltipTrigger asChild>
                  <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
                </ThemedTooltipTrigger>
                <ThemedTooltipContent side="top">
                  Name exposed to the loop body for the current element (default: item)
                </ThemedTooltipContent>
              </ThemedTooltip>
            </div>
            <input
              value={data.itemVar || 'item'}
              onChange={e => onUpdate({ itemVar: e.target.value || 'item' })}
              className="w-full text-xs px-2 py-1.5 rounded border bg-transparent outline-none transition-colors focus:ring-1 focus:ring-[var(--neon-color)]"
              style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>Index variable</label>
              <ThemedTooltip>
                <ThemedTooltipTrigger asChild>
                  <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
                </ThemedTooltipTrigger>
                <ThemedTooltipContent side="top">
                  Name exposed for the 0-based index (default: index)
                </ThemedTooltipContent>
              </ThemedTooltip>
            </div>
            <input
              value={data.indexVar || 'index'}
              onChange={e => onUpdate({ indexVar: e.target.value || 'index' })}
              className="w-full text-xs px-2 py-1.5 rounded border bg-transparent outline-none transition-colors focus:ring-1 focus:ring-[var(--neon-color)]"
              style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>Max Items</label>
              <ThemedTooltip>
                <ThemedTooltipTrigger asChild>
                  <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
                </ThemedTooltipTrigger>
                <ThemedTooltipContent side="top">
                  Safety cap so a bad list cannot run away (1–1000)
                </ThemedTooltipContent>
              </ThemedTooltip>
            </div>
            <input
              type="number"
              min={1}
              max={1000}
              value={data.maxItems || 100}
              onChange={e => onUpdate({ maxItems: parseInt(e.target.value) || 100 })}
              className="w-16 text-right text-xs px-1.5 py-0.5 rounded border bg-transparent outline-none transition-colors focus:ring-1 focus:ring-[var(--neon-color)]"
              style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>
          <ThemedSlider
            min={1}
            max={1000}
            step={1}
            value={[Math.min(Math.max(Number(data.maxItems) || 100, 1), 1000)]}
            onValueChange={([v]) => onUpdate({ maxItems: v })}
          />
        </div>
      </div>
    </ThemedTooltipProvider>
  );
}
