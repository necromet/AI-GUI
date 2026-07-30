import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Moon, Sun, Palette, Type, Bot, Shield, Sparkles, Wrench, RotateCcw,
} from 'lucide-react';
import { ModelConfig } from '../types';
import { NEON_PRESETS, INDIVIDUAL_COLORS, THEME_PRESETS } from '../constants';
import { FONT_SIZE_MAP, FONT_FAMILY_MAP } from '../App';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  type AgentType, type AgentConfig, AGENT_TOOL_INFO, AGENT_DEFAULTS,
  getAgentConfig, saveAgentConfig,
} from '../lib/agentConfig';

export type SettingsTab = 'appearance' | 'typography' | 'model' | 'agents' | 'security';

export const SETTINGS_TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'model', label: 'AI Model', icon: Bot },
  { id: 'agents', label: 'Agents', icon: Wrench },
  { id: 'security', label: 'Security', icon: Shield },
];

interface SettingsPageProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  neonColor: string;
  onChangeNeonColor: (color: string) => void;
  neonPreset: string;
  onChangeNeonPreset: (preset: string) => void;
  themePreset: string;
  onChangeThemePreset: (preset: string) => void;
  models: ModelConfig[];
  defaultModelId: string;
  onChangeDefaultModel: (id: string) => void;
  maxOutputTokens: number | undefined;
  onChangeMaxOutputTokens: (value: number | undefined) => void;
  fontSize: string;
  onChangeFontSize: (size: string) => void;
  fontFamily: string;
  onChangeFontFamily: (family: string) => void;
}

const FONTS = [
  { id: 'default', name: 'Default', sample: 'Plus Jakarta Sans + system stack' },
  { id: 'plus-jakarta-sans', name: 'Plus Jakarta Sans', sample: 'Clean geometric sans-serif' },
  { id: 'google-sans', name: 'Google Sans', sample: 'Friendly and approachable' },
  { id: 'open-sans', name: 'Open Sans', sample: 'Neutral and highly legible' },
  { id: 'fredoka', name: 'Fredoka', sample: 'Rounded and playful' },
  { id: 'comfortaa', name: 'Comfortaa', sample: 'Geometric and modern' },
  { id: 'space-grotesk', name: 'Space Grotesk', sample: 'Technical and geometric' },
];

const FONT_CSS: Record<string, string> = {
  default: "'Plus Jakarta Sans', 'Google Sans', 'Open Sans', ui-sans-serif, system-ui",
  'plus-jakarta-sans': "'Plus Jakarta Sans', sans-serif",
  'google-sans': "'Google Sans', sans-serif",
  'open-sans': "'Open Sans', sans-serif",
  fredoka: "'Fredoka', sans-serif",
  comfortaa: "'Comfortaa', sans-serif",
  'space-grotesk': "'Space Grotesk', sans-serif",
};

const FONT_SIZES = [
  { id: 'xs', label: 'XS', px: 16 },
  { id: 'sm', label: 'SM', px: 17 },
  { id: 'base', label: 'Base', px: 18 },
  { id: 'lg', label: 'LG', px: 20 },
  { id: 'xl', label: 'XL', px: 22 },
];

const SettingsPage: React.FC<SettingsPageProps> = ({
  theme,
  onToggleTheme,
  neonColor,
  onChangeNeonColor,
  neonPreset,
  onChangeNeonPreset,
  themePreset,
  onChangeThemePreset,
  models,
  defaultModelId,
  onChangeDefaultModel,
  maxOutputTokens,
  onChangeMaxOutputTokens,
  fontSize,
  onChangeFontSize,
  fontFamily,
  onChangeFontFamily,
}) => {
  const [searchParams] = useSearchParams();
  const activeTab: SettingsTab = useMemo(() => {
    const tab = searchParams.get('tab');
    if (tab && SETTINGS_TABS.some(t => t.id === tab)) return tab as SettingsTab;
    return 'appearance';
  }, [searchParams]);

  const [maxTokensInput, setMaxTokensInput] = useState(maxOutputTokens?.toString() || '');
  const mode = theme === 'dark' ? 'dark' : 'light';

  const resetPassword = () => {
    sessionStorage.removeItem('edward:labs_chat_session');
    sessionStorage.removeItem('edward:labs_experiments_session');
    sessionStorage.removeItem('edward:labs_library_session');
    window.location.reload();
  };

  const sectionTitle = (title: string, subtitle?: string) => (
    <div className="mb-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>{title}</h3>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-500)' }}>{subtitle}</p>}
    </div>
  );

  const renderAppearanceTab = () => (
    <div className="space-y-8">
      <div>
        {sectionTitle('Theme', 'Switch between dark and light mode')}
        <div
          className="flex items-center justify-between p-4 rounded-xl transition-all duration-300"
          style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg transition-all duration-300"
              style={{ backgroundColor: theme === 'dark' ? 'rgba(var(--neon-rgb), 0.1)' : 'rgba(251, 146, 60, 0.1)' }}
            >
              {theme === 'dark'
                ? <Moon size={18} style={{ color: 'var(--neon-color)' }} />
                : <Sun size={18} className="text-orange-500" />}
            </div>
            <div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-100)' }}>
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </span>
              <p className="text-xs" style={{ color: 'var(--text-500)' }}>
                {theme === 'dark' ? 'Easy on the eyes, great for night sessions' : 'Bright and clear for daytime use'}
              </p>
            </div>
          </div>
          <Switch checked={theme === 'dark'} onCheckedChange={onToggleTheme} />
        </div>
      </div>

      <div>
        {sectionTitle('Theme Preset', 'Full visual theme including backgrounds, text, and accent colors')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {THEME_PRESETS.map((preset) => {
            const isActive = themePreset === preset.id;
            const previewColors = preset.id === 'default'
              ? (mode === 'dark' ? ['#0e0e0e', '#1a1a1a', '#f87171'] : ['#ffffff', '#f7f7f8', '#f87171'])
              : preset.neon
                ? [preset[mode]['--bg-100'] || (mode === 'dark' ? '#0e0e0e' : '#fff'), preset[mode]['--bg-200'] || (mode === 'dark' ? '#1a1a1a' : '#f7f7f8'), preset.neon[mode].primary.tailwind]
                : [preset[mode]['--bg-100'] || '#fff', preset[mode]['--bg-200'] || '#f7f7f8', 'var(--neon-color)'];
            return (
              <button
                key={preset.id}
                onClick={() => onChangeThemePreset(preset.id)}
                className="group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
                style={{
                  backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.08)' : 'var(--bg-200)',
                  border: `1px solid ${isActive ? 'rgba(var(--neon-rgb), 0.25)' : 'var(--border-300)'}`,
                }}
              >
                <div className="flex items-center gap-1">
                  {previewColors.map((c, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full transition-all duration-200"
                      style={{
                        backgroundColor: c,
                        marginLeft: i > 0 ? '-4px' : '0',
                        border: '1px solid var(--border-300)',
                        boxShadow: isActive ? `0 0 8px ${c}80` : 'none',
                      }}
                    />
                  ))}
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium" style={{ color: isActive ? 'var(--neon-color)' : 'var(--text-100)' }}>
                    {preset.name}
                  </span>
                </div>
                {isActive && (
                  <div className="ml-auto">
                    <Sparkles size={14} style={{ color: 'var(--neon-color)' }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {sectionTitle('Color Presets', 'Curated palettes that define the accent, secondary, and highlight colors')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {NEON_PRESETS.map((preset) => {
            const isActive = neonPreset === preset.id;
            const colors = [preset.primary[mode], preset.secondary[mode], preset.accent[mode]];
            return (
              <button
                key={preset.id}
                onClick={() => onChangeNeonPreset(preset.id)}
                className="group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
                style={{
                  backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.08)' : 'var(--bg-200)',
                  border: `1px solid ${isActive ? 'rgba(var(--neon-rgb), 0.25)' : 'var(--border-300)'}`,
                }}
              >
                <div className="flex items-center gap-1">
                  {colors.map((c, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full transition-all duration-200"
                      style={{
                        backgroundColor: c.tailwind,
                        marginLeft: i > 0 ? '-4px' : '0',
                        boxShadow: isActive
                          ? `0 0 8px ${c.tailwind.replace('rgb', 'rgba').replace(')', ', 0.5)')}`
                          : 'none',
                      }}
                    />
                  ))}
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium" style={{ color: isActive ? 'var(--neon-color)' : 'var(--text-100)' }}>
                    {preset.name}
                  </span>
                </div>
                {isActive && (
                  <div className="ml-auto">
                    <Sparkles size={14} style={{ color: 'var(--neon-color)' }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {sectionTitle('Individual Colors', 'Pick a single accent color')}
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {Object.entries(INDIVIDUAL_COLORS).map(([id, colorDef]) => {
            const isActive = !neonPreset && neonColor === id;
            const rgb = colorDef[mode].tailwind;
            return (
              <button
                key={id}
                onClick={() => onChangeNeonColor(id)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200"
                style={{
                  backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.08)' : 'var(--bg-200)',
                  border: `1px solid ${isActive ? 'rgba(var(--neon-rgb), 0.2)' : 'var(--border-300)'}`,
                }}
              >
                <div
                  className="w-7 h-7 rounded-full transition-all duration-200"
                  style={{
                    backgroundColor: rgb,
                    boxShadow: isActive ? `0 0 12px ${rgb.replace('rgb', 'rgba').replace(')', ', 0.6)')}` : 'none',
                    transform: isActive ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
                <span
                  className="text-[10px] font-medium capitalize"
                  style={{ color: isActive ? 'var(--neon-color)' : 'var(--text-500)' }}
                >
                  {id}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderTypographyTab = () => (
    <div className="space-y-8">
      <div>
        {sectionTitle('Font Family', 'Choose a typeface that suits your style')}
        <div className="space-y-2">
          {FONTS.map((font) => {
            const isActive = fontFamily === font.id;
            return (
              <button
                key={font.id}
                onClick={() => onChangeFontFamily(font.id)}
                className="w-full text-left px-4 py-3 rounded-xl transition-all duration-200"
                style={{
                  backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.08)' : 'var(--bg-200)',
                  border: `1px solid ${isActive ? 'rgba(var(--neon-rgb), 0.2)' : 'var(--border-300)'}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm font-medium"
                    style={{ color: isActive ? 'var(--neon-color)' : 'var(--text-100)', fontFamily: FONT_CSS[font.id] }}
                  >
                    {font.name}
                  </span>
                  {isActive && <Sparkles size={12} style={{ color: 'var(--neon-color)' }} />}
                </div>
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--text-500)', fontFamily: FONT_CSS[font.id] }}
                >
                  The quick brown fox jumps over the lazy dog
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {sectionTitle('Font Size', 'Adjust the base text size across the entire app')}
        <div className="flex items-center gap-2">
          {FONT_SIZES.map((size) => (
            <button
              key={size.id}
              onClick={() => onChangeFontSize(size.id)}
              className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl transition-all duration-200"
              style={{
                backgroundColor: fontSize === size.id ? 'rgba(var(--neon-rgb), 0.08)' : 'var(--bg-200)',
                color: fontSize === size.id ? 'var(--neon-color)' : 'var(--text-500)',
                border: `1px solid ${fontSize === size.id ? 'rgba(var(--neon-rgb), 0.2)' : 'var(--border-300)'}`,
              }}
            >
              <span className="text-lg font-bold" style={{ fontSize: `${size.px}px` }}>Aa</span>
              <span className="text-[10px] font-medium">{size.label}</span>
              <span className="text-[9px]" style={{ color: 'var(--text-500)' }}>{size.px}px</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderModelTab = () => (
    <div className="space-y-8">
      <div>
        {sectionTitle('Default Model', 'The model used when starting a new conversation')}
        <Select value={defaultModelId} onValueChange={onChangeDefaultModel}>
          <SelectTrigger
            className="h-10 text-sm rounded-xl"
            style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          >
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id} className="text-sm" style={{ color: 'var(--text-100)' }}>
                <div className="flex items-center gap-2">
                  <span>{model.name}</span>
                  {model.isReasoning && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0"
                      style={{ borderColor: 'rgba(var(--neon-rgb), 0.3)', color: 'var(--neon-color)' }}
                    >
                      Reasoning
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(() => {
          const selected = models.find(m => m.id === defaultModelId);
          if (!selected) return null;
          return (
            <div
              className="mt-3 p-3 rounded-xl text-xs"
              style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)', color: 'var(--text-500)' }}
            >
              <p className="font-medium mb-1" style={{ color: 'var(--text-300)' }}>{selected.name}</p>
              <p>{selected.description}</p>
              {selected.contextWindowSize && (
                <p className="mt-1">Context: {Math.round(selected.contextWindowSize / 1024)}K tokens</p>
              )}
            </div>
          );
        })()}
      </div>

      <div>
        {sectionTitle('Output Token Limit', 'Cap the maximum tokens in a single AI response')}
        <div className="flex items-center gap-3">
          <Input
            type="number"
            value={maxTokensInput}
            onChange={(e) => {
              setMaxTokensInput(e.target.value);
              const val = parseInt(e.target.value, 10);
              onChangeMaxOutputTokens(isNaN(val) || val <= 0 ? undefined : val);
            }}
            placeholder="No limit"
            min="1"
            max="128000"
            className="h-10 text-sm flex-1 rounded-xl"
            style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          />
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-500)' }}>tokens</span>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-500)' }}>
          Leave empty for no limit. Higher values allow longer responses but cost more.
        </p>
      </div>
    </div>
  );

  const [selectedAgent, setSelectedAgent] = useState<AgentType>('plugin');
  const [agentConfigs, setAgentConfigs] = useState<Record<AgentType, AgentConfig>>({
    plugin: getAgentConfig('plugin'),
    library: getAgentConfig('library'),
    skema: getAgentConfig('skema'),
    rag: getAgentConfig('rag'),
  });
  const currentAgentConfig = agentConfigs[selectedAgent];

  const updateAgentConfig = useCallback((agent: AgentType, updater: (prev: AgentConfig) => AgentConfig) => {
    setAgentConfigs(prev => {
      const next = updater(prev[agent]);
      saveAgentConfig(agent, next);
      return { ...prev, [agent]: next };
    });
  }, []);

  const toggleAgentTool = useCallback((toolName: string) => {
    updateAgentConfig(selectedAgent, prev => ({
      ...prev,
      tools: {
        ...prev.tools,
        [toolName]: { ...prev.tools[toolName], enabled: !prev.tools[toolName]?.enabled },
      },
    }));
  }, [selectedAgent, updateAgentConfig]);

  const setSystemPromptAppend = useCallback((text: string) => {
    updateAgentConfig(selectedAgent, prev => ({ ...prev, systemPromptAppend: text }));
  }, [selectedAgent, updateAgentConfig]);

  const resetAgentConfig = useCallback(() => {
    updateAgentConfig(selectedAgent, () => ({ ...AGENT_DEFAULTS[selectedAgent] }));
  }, [selectedAgent, updateAgentConfig]);

  const agentLabels: Record<AgentType, string> = {
    plugin: 'Plugin Agent',
    library: 'Librarian',
    skema: 'Skema Agent',
    rag: 'RAG Agent',
  };

  const renderAgentsTab = () => {
    const tools = AGENT_TOOL_INFO[selectedAgent];
    const hasTools = tools.length > 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}>
          {(['plugin', 'library', 'skema', 'rag'] as AgentType[]).map(agent => (
            <button
              key={agent}
              onClick={() => setSelectedAgent(agent)}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200"
              style={{
                backgroundColor: selectedAgent === agent ? 'rgba(var(--neon-rgb), 0.15)' : 'transparent',
                color: selectedAgent === agent ? 'var(--neon-color)' : 'var(--text-500)',
              }}
            >
              {agentLabels[agent].replace(' Agent', '')}
            </button>
          ))}
        </div>

        {hasTools && (
          <div>
            {sectionTitle('Tools', `Enable or disable tools for ${agentLabels[selectedAgent]}`)}
            <div className="space-y-1.5">
              {tools.map(tool => {
                const isEnabled = currentAgentConfig.tools[tool.name]?.enabled ?? true;
                return (
                  <div
                    key={tool.name}
                    className="rounded-xl overflow-hidden transition-all duration-200"
                    style={{
                      backgroundColor: 'var(--bg-200)',
                      border: `1px solid ${isEnabled ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--border-300)'}`,
                    }}
                  >
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleAgentTool(tool.name)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium" style={{ color: isEnabled ? 'var(--text-100)' : 'var(--text-500)' }}>
                          {tool.name}
                        </span>
                        <p className="text-xs truncate" style={{ color: 'var(--text-500)' }}>{tool.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!hasTools && (
          <div
            className="p-4 rounded-xl text-center"
            style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}
          >
            <p className="text-xs" style={{ color: 'var(--text-500)' }}>
              RAG Agent uses document retrieval only — no configurable tools.
            </p>
          </div>
        )}

        <div>
          {sectionTitle('System Prompt', `Additional instructions appended to ${agentLabels[selectedAgent]}'s default prompt`)}
          <Textarea
            value={currentAgentConfig.systemPromptAppend}
            onChange={(e) => setSystemPromptAppend(e.target.value)}
            placeholder="e.g. Always respond in a concise, technical tone."
            className="min-h-[100px] text-sm rounded-xl resize-y"
            style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-500)' }}>
            This text is appended to the end of the agent's built-in system prompt.
          </p>
        </div>

        <button
          onClick={resetAgentConfig}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all duration-200 w-full"
          style={{
            backgroundColor: 'var(--bg-200)',
            border: '1px solid var(--border-300)',
            color: 'var(--text-500)',
          }}
        >
          <RotateCcw size={14} />
          <span>Reset {agentLabels[selectedAgent]} to Defaults</span>
        </button>
      </div>
    );
  };

  const renderSecurityTab = () => (
    <div className="space-y-8">
      <div>
        {sectionTitle('Lock Screen', 'Require passwords to re-access modes')}
        <button
          onClick={resetPassword}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200"
          style={{
            color: 'var(--text-100)',
            backgroundColor: 'var(--bg-200)',
            border: '1px solid var(--border-300)',
          }}
        >
          <Shield size={18} style={{ color: 'var(--neon-color)' }} />
          <div className="text-left">
            <span className="font-medium">Lock All Modes</span>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-500)' }}>
              You'll need to re-enter passwords for Chat, Experiments, and Library.
            </p>
          </div>
        </button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'appearance': return renderAppearanceTab();
      case 'typography': return renderTypographyTab();
      case 'model': return renderModelTab();
      case 'agents': return renderAgentsTab();
      case 'security': return renderSecurityTab();
    }
  };

  const currentFontPx = FONT_SIZE_MAP[fontSize] || 18;
  const currentFontCss = FONT_FAMILY_MAP[fontFamily] || FONT_FAMILY_MAP.default;

  return (
    <div className="flex h-full" style={{ backgroundColor: 'var(--bg-100)' }}>
      {/* Center: Settings Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-xl mx-auto p-8">
          <div className="mb-8">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-100)' }}>
              {SETTINGS_TABS.find(t => t.id === activeTab)?.label}
            </h2>
          </div>
          {renderTabContent()}
        </div>
      </ScrollArea>

      {/* Right: Live Preview */}
      <div
        className="w-80 flex-shrink-0 flex flex-col border-l"
        style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)' }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-300)' }}>
          <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-500)' }}>
            Live Preview
          </span>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            <div
              className="p-3 rounded-xl text-center"
              style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)' }}
            >
              <span className="text-xs" style={{ color: 'var(--text-500)' }}>
                {currentFontPx}px &middot; {FONTS.find(f => f.id === fontFamily)?.name || 'Default'}
              </span>
            </div>

            <div className="flex justify-end">
              <div
                className="max-w-[85%] px-4 py-3 rounded-2xl rounded-br-md"
                style={{
                  backgroundColor: 'rgba(var(--neon-rgb), 0.15)',
                  border: '1px solid rgba(var(--neon-rgb), 0.2)',
                  fontFamily: currentFontCss,
                  fontSize: `${currentFontPx}px`,
                }}
              >
                <p style={{ color: 'var(--text-100)' }}>Explain quantum computing in simple terms</p>
              </div>
            </div>

            <div className="flex justify-start">
              <div
                className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md"
                style={{
                  backgroundColor: 'var(--bg-100)',
                  border: '1px solid var(--border-300)',
                  fontFamily: currentFontCss,
                  fontSize: `${currentFontPx}px`,
                }}
              >
                <p style={{ color: 'var(--text-100)', marginBottom: '0.75em' }}>
                  Quantum computing uses <strong style={{ color: 'var(--neon-color)' }}>qubits</strong> instead of regular bits. While a normal bit is either 0 or 1, a qubit can be both at the same time — this is called <strong style={{ color: 'var(--neon-secondary)' }}>superposition</strong>.
                </p>
                <p style={{ color: 'var(--text-300)', margin: 0 }}>
                  Think of it like a coin spinning in the air — it's both heads and tails until it lands.
                </p>
              </div>
            </div>

            <div className="flex justify-start">
              <div
                className="max-w-[85%] rounded-2xl rounded-bl-md overflow-hidden"
                style={{
                  backgroundColor: 'var(--bg-100)',
                  border: '1px solid var(--border-300)',
                  fontFamily: currentFontCss,
                  fontSize: `${currentFontPx}px`,
                }}
              >
                <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border-300)' }}>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-500)' }}>python</span>
                </div>
                <pre
                  className="px-4 py-3 text-xs overflow-x-auto"
                  style={{
                    backgroundColor: theme === 'dark' ? '#1e1e2e' : '#eff1f5',
                    color: theme === 'dark' ? '#cdd6f4' : '#4c4f69',
                    margin: 0,
                    fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
                    fontSize: '11px',
                    lineHeight: '1.6',
                  }}
                >
{`qubit = QuantumRegister(1)
circuit = QuantumCircuit(qubit)
circuit.h(qubit)  # Hadamard gate`}
                </pre>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                size="sm"
                className="text-xs h-7 rounded-lg"
                style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
              >
                Primary
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 rounded-lg"
                style={{
                  borderColor: 'rgba(var(--neon-rgb), 0.3)',
                  color: 'var(--neon-color)',
                }}
              >
                Secondary
              </Button>
              <Badge
                variant="outline"
                className="text-[10px] rounded-lg"
                style={{
                  backgroundColor: 'rgba(var(--neon-rgb), 0.1)',
                  color: 'var(--neon-color)',
                  borderColor: 'rgba(var(--neon-rgb), 0.2)',
                }}
              >
                Badge
              </Badge>
            </div>

            <div
              className="p-3 rounded-xl"
              style={{ backgroundColor: 'var(--bg-100)', border: '1px solid var(--border-300)' }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-500)' }}>
                Active Palette
              </p>
              <div className="flex gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-8 h-8 rounded-lg"
                    style={{
                      backgroundColor: 'var(--neon-color)',
                      boxShadow: '0 0 12px rgba(var(--neon-rgb), 0.4)',
                    }}
                  />
                  <span className="text-[9px]" style={{ color: 'var(--text-500)' }}>Primary</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'var(--neon-secondary)' }} />
                  <span className="text-[9px]" style={{ color: 'var(--text-500)' }}>Secondary</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: 'var(--neon-accent)' }} />
                  <span className="text-[9px]" style={{ color: 'var(--text-500)' }}>Accent</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default SettingsPage;
