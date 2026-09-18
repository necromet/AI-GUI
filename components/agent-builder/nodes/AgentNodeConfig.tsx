import { useState } from 'react';
import { FileCode, Info, Plug } from 'lucide-react';
import VariableAutocomplete from '../VariableAutocomplete';
import { CHAT_MODELS } from '@/constants';
import { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE, DEFAULT_AGENT_MODEL } from '../constants';
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
  ThemedPopover,
  ThemedPopoverTrigger,
  ThemedPopoverContent,
} from '../shared/ThemedPopover';
import {
  ThemedCollapsible,
  ThemedCollapsibleTrigger,
  ThemedCollapsibleContent,
} from '../shared/ThemedCollapsible';
import { ThemedSlider } from '../shared/ThemedSlider';
import { ThemedSwitch } from '../shared/ThemedSwitch';
import {
  ThemedTooltip,
  ThemedTooltipTrigger,
  ThemedTooltipContent,
  ThemedTooltipProvider,
} from '../shared/ThemedTooltip';
import MCPToolPicker from '../shared/MCPToolPicker';
import OutputSchemaBuilder from '../shared/OutputSchemaBuilder';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  data: Record<string, any>;
  onUpdate: (data: Record<string, any>) => void;
  upstreamNodes?: { id: string; label: string }[];
  accentColor?: string;
}

// Group models by provider for the select
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

const PROMPT_TEMPLATES = [
  { label: 'Summarizer', system: 'You are a text summarizer. Provide concise summaries.', user: 'Summarize the following:\n\n{{input}}' },
  { label: 'Classifier', system: 'You are a text classifier. Classify into the given categories.', user: 'Classify this text:\n\n{{input}}' },
  { label: 'Extractor', system: 'You extract structured data from unstructured text.', user: 'Extract key information from:\n\n{{input}}' },
  { label: 'Translator', system: 'You are a professional translator.', user: 'Translate the following:\n\n{{input}}' },
  { label: 'Code Generator', system: 'You write clean, efficient code.', user: 'Write code for:\n\n{{input}}' },
];

export default function AgentNodeConfig({ data, onUpdate, upstreamNodes = [], accentColor }: Props) {
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false);

  const accentStyle = { '--accent': accentColor || 'var(--neon-color)' } as React.CSSProperties;

  const applyTemplate = (tmpl: typeof PROMPT_TEMPLATES[number]) => {
    onUpdate({ systemPrompt: tmpl.system, userPrompt: tmpl.user });
    setTemplatePopoverOpen(false);
  };

  return (
    <ThemedTooltipProvider delayDuration={300}>
      <div className="space-y-4" style={accentStyle}>

        {/* ── Model Section ── */}
        <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
          Model
        </div>
        <div>
          <label className={fieldClasses.label} style={FIELD_STYLES.label}>Model</label>
          <ThemedSelect
            value={data.model || DEFAULT_AGENT_MODEL}
            onValueChange={v => onUpdate({ model: v })}
          >
            <ThemedSelectTrigger>
              <ThemedSelectValue placeholder="Select model..." />
            </ThemedSelectTrigger>
            <ThemedSelectContent>
              {Object.entries(PROVIDER_GROUPS).map(([provider, models]) => (
                <ThemedSelectGroup key={provider}>
                  <ThemedSelectLabel>
                    {PROVIDER_DISPLAY_NAMES[provider] || provider}
                  </ThemedSelectLabel>
                  {models.map(m => (
                    <ThemedSelectItem key={m.value} value={m.value}>
                      {m.label}
                    </ThemedSelectItem>
                  ))}
                </ThemedSelectGroup>
              ))}
            </ThemedSelectContent>
          </ThemedSelect>
        </div>

        {/* ── Prompt Section ── */}
        <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
          Prompt
        </div>

        {/* System Prompt with template popover */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium" style={FIELD_STYLES.label}>System Prompt</label>
              <ThemedTooltip>
                <ThemedTooltipTrigger asChild>
                  <span className="cursor-help" style={{ color: 'var(--text-500)' }}>
                    <Info size={11} />
                  </span>
                </ThemedTooltipTrigger>
                <ThemedTooltipContent side="top">
                  Instructions that define the agent&apos;s role and behavior
                </ThemedTooltipContent>
              </ThemedTooltip>
            </div>
            <ThemedPopover open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
              <ThemedPopoverTrigger asChild>
                <button
                  className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md cursor-pointer transition-colors hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    border: '1px solid var(--border-300)',
                    color: 'var(--text-500)',
                  }}
                >
                  <FileCode size={11} />
                  Templates
                </button>
              </ThemedPopoverTrigger>
              <ThemedPopoverContent align="end" side="bottom" className="w-64 p-2">
                <div className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-500)' }}>
                  Prompt Templates
                </div>
                <div className="space-y-1">
                  {PROMPT_TEMPLATES.map((tmpl, i) => (
                    <button
                      key={i}
                      onClick={() => applyTemplate(tmpl)}
                      className="w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                      style={{ color: 'var(--text-300)' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-300)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div className="font-medium" style={{ color: 'var(--text-100)' }}>{tmpl.label}</div>
                      <div className="mt-0.5 truncate text-[10px]" style={{ color: 'var(--text-500)' }}>
                        {tmpl.system}
                      </div>
                    </button>
                  ))}
                </div>
              </ThemedPopoverContent>
            </ThemedPopover>
          </div>
          <VariableAutocomplete
            value={data.systemPrompt || data.instructions || ''}
            onChange={v => onUpdate({ systemPrompt: v, instructions: v })}
            placeholder="You are a helpful assistant..."
            multiline
            upstreamNodes={upstreamNodes}
          />
        </div>

        {/* User Prompt */}
        <div>
          <label className={fieldClasses.label} style={FIELD_STYLES.label}>User Prompt</label>
          <VariableAutocomplete
            value={data.userPrompt || ''}
            onChange={v => onUpdate({ userPrompt: v })}
            placeholder="Use {{variable}} for dynamic values..."
            multiline
            upstreamNodes={upstreamNodes}
          />
        </div>

        {/* ── MCP Tools Section ── */}
        <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
          <div className="flex items-center gap-1.5">
            <Plug size={10} />
            MCP Tools
          </div>
        </div>
        <MCPToolPicker
          selectedServerIds={data.mcpServerIds || []}
          onUpdate={serverIds => onUpdate({ mcpServerIds: serverIds })}
        />

        {/* ── Advanced Section (Collapsible) ── */}
        <ThemedCollapsible>
          <ThemedCollapsibleTrigger label="Advanced" />
          <ThemedCollapsibleContent>
            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={fieldClasses.label} style={FIELD_STYLES.label}>Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={data.temperature ?? DEFAULT_TEMPERATURE}
                  onChange={e => onUpdate({ temperature: parseFloat(e.target.value) })}
                  className="w-14 text-right text-xs px-1.5 py-0.5 rounded border bg-transparent outline-none transition-colors focus:ring-1 focus:ring-[var(--neon-color)]"
                  style={{
                    borderColor: 'var(--border-300)',
                    color: 'var(--text-100)',
                  }}
                />
              </div>
              <ThemedSlider
                min={0}
                max={2}
                step={0.1}
                value={[data.temperature ?? DEFAULT_TEMPERATURE]}
                onValueChange={([v]) => onUpdate({ temperature: v })}
              />
            </div>

            {/* Max Tokens */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={fieldClasses.label} style={FIELD_STYLES.label}>Max Tokens</label>
                <input
                  type="number"
                  min={1}
                  max={32768}
                  step={256}
                  value={data.maxTokens || DEFAULT_MAX_TOKENS}
                  onChange={e => onUpdate({ maxTokens: parseInt(e.target.value) })}
                  className="w-16 text-right text-xs px-1.5 py-0.5 rounded border bg-transparent outline-none transition-colors focus:ring-1 focus:ring-[var(--neon-color)]"
                  style={{
                    borderColor: 'var(--border-300)',
                    color: 'var(--text-100)',
                  }}
                />
              </div>
              <ThemedSlider
                min={256}
                max={32768}
                step={256}
                value={[data.maxTokens || DEFAULT_MAX_TOKENS]}
                onValueChange={([v]) => onUpdate({ maxTokens: v })}
              />
            </div>

            {/* Output Format */}
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Output Format</label>
              <ThemedSelect
                value={data.outputFormat || 'text'}
                onValueChange={v => onUpdate({ outputFormat: v })}
              >
                <ThemedSelectTrigger>
                  <ThemedSelectValue />
                </ThemedSelectTrigger>
                <ThemedSelectContent>
                  <ThemedSelectItem value="text">Text</ThemedSelectItem>
                  <ThemedSelectItem value="json">JSON</ThemedSelectItem>
                </ThemedSelectContent>
              </ThemedSelect>
            </div>

            {/* JSON Schema Builder — visible when JSON output selected */}
            <AnimatePresence>
              {data.outputFormat === 'json' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <OutputSchemaBuilder
                    schema={data.outputSchema || '{}'}
                    onSchemaChange={schema => onUpdate({ outputSchema: schema })}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Include Chat History */}
            <div className="flex items-center justify-between">
              <label className="text-xs cursor-pointer" style={FIELD_STYLES.label}>
                Include chat history
              </label>
              <ThemedSwitch
                checked={data.includeChatHistory || false}
                onCheckedChange={v => onUpdate({ includeChatHistory: v })}
              />
            </div>
          </ThemedCollapsibleContent>
        </ThemedCollapsible>

        {/* Token estimate */}
        <div className="text-[10px] rounded-lg px-2.5 py-2" style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-500)' }}>
          ~{Math.ceil(((data.systemPrompt || '').length + (data.userPrompt || '').length) / 4)} tokens
        </div>
      </div>
    </ThemedTooltipProvider>
  );
}
