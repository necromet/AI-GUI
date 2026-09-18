import { CHAT_MODELS } from '@/constants';
import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';
import {
  ThemedSelect,
  ThemedSelectTrigger,
  ThemedSelectValue,
  ThemedSelectContent,
  ThemedSelectGroup,
  ThemedSelectLabel,
  ThemedSelectItem,
} from '../shared/ThemedSelect';
import {
  ThemedCollapsible,
  ThemedCollapsibleTrigger,
  ThemedCollapsibleContent,
} from '../shared/ThemedCollapsible';
import {
  ThemedTooltip,
  ThemedTooltipTrigger,
  ThemedTooltipContent,
  ThemedTooltipProvider,
} from '../shared/ThemedTooltip';
import { Info } from 'lucide-react';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

const MODELS = CHAT_MODELS.map(m => ({
  value: m.id,
  label: m.name,
  provider: m.provider,
}));

const PROVIDER_GROUPS = MODELS.reduce<Record<string, typeof MODELS>>((acc, m) => {
  const key = m.provider || 'other';
  if (!acc[key]) acc[key] = [];
  acc[key].push(m);
  return acc;
}, {});

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  'mimo': 'MiMo',
  'mimo-direct': 'MiMo (API Key)',
  'deepseek': 'DeepSeek',
};

export default function ExtractNodeConfig({ data, onUpdate }: Props) {
  return (
    <ThemedTooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>Extraction Schema (JSON)</label>
            <ThemedTooltip>
              <ThemedTooltipTrigger asChild>
                <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
              </ThemedTooltipTrigger>
              <ThemedTooltipContent side="top">
                Define the fields to extract. Each field needs a name and type.
              </ThemedTooltipContent>
            </ThemedTooltip>
          </div>
          <textarea
            value={data.schema ? (typeof data.schema === 'string' ? data.schema : JSON.stringify(data.schema, null, 2)) : ''}
            onChange={e => { try { onUpdate({ schema: JSON.parse(e.target.value) }); } catch { onUpdate({ schema: e.target.value }); } }}
            placeholder='{"type": "object", "properties": {"title": {"type": "string"}}}'
            rows={5}
            className={fieldClasses.textarea}
            style={FIELD_STYLES.input}
          />
        </div>

        <ThemedCollapsible>
          <ThemedCollapsibleTrigger label="Advanced" />
          <ThemedCollapsibleContent>
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Extraction Model</label>
              <ThemedSelect
                value={data.extractModel || ''}
                onValueChange={v => onUpdate({ extractModel: v || undefined })}
              >
                <ThemedSelectTrigger>
                  <ThemedSelectValue placeholder="Use Firecrawl (default)" />
                </ThemedSelectTrigger>
                <ThemedSelectContent>
                  <ThemedSelectItem value="">Use Firecrawl (default)</ThemedSelectItem>
                  {Object.entries(PROVIDER_GROUPS).map(([provider, models]) => (
                    <ThemedSelectGroup key={provider}>
                      <ThemedSelectLabel>{PROVIDER_DISPLAY_NAMES[provider] || provider}</ThemedSelectLabel>
                      {models.map(m => (
                        <ThemedSelectItem key={m.value} value={m.value}>{m.label}</ThemedSelectItem>
                      ))}
                    </ThemedSelectGroup>
                  ))}
                </ThemedSelectContent>
              </ThemedSelect>
              <div className="text-[10px] mt-1" style={{ color: 'var(--text-500)' }}>
                LLM-based extraction for non-URL inputs
              </div>
            </div>
          </ThemedCollapsibleContent>
        </ThemedCollapsible>
      </div>
    </ThemedTooltipProvider>
  );
}
