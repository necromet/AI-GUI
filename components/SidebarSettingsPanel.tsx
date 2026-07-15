import React, { useState } from 'react';
import { Moon, Sun, ChevronDown, ChevronUp } from 'lucide-react';
import { ModelConfig } from '../types';
import { NEON_PRESETS, INDIVIDUAL_COLORS } from '../constants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SidebarSettingsPanelProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  neonColor: string;
  onChangeNeonColor: (color: string) => void;
  neonPreset: string;
  onChangeNeonPreset: (preset: string) => void;
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
  { id: 'default', name: 'Default' },
  { id: 'plus-jakarta-sans', name: 'Plus Jakarta Sans' },
  { id: 'google-sans', name: 'Google Sans' },
  { id: 'open-sans', name: 'Open Sans' },
  { id: 'fredoka', name: 'Fredoka' },
  { id: 'comfortaa', name: 'Comfortaa' },
];

const FONT_CSS: Record<string, string> = {
  default: "'Plus Jakarta Sans', 'Google Sans', 'Open Sans', ui-sans-serif, system-ui",
  'plus-jakarta-sans': "'Plus Jakarta Sans', sans-serif",
  'google-sans': "'Google Sans', sans-serif",
  'open-sans': "'Open Sans', sans-serif",
  fredoka: "'Fredoka', sans-serif",
  comfortaa: "'Comfortaa', sans-serif",
};

const FONT_SIZES = [
  { id: 'xs', label: 'XS' },
  { id: 'sm', label: 'SM' },
  { id: 'base', label: 'Base' },
  { id: 'lg', label: 'LG' },
  { id: 'xl', label: 'XL' },
];

const SidebarSettingsPanel: React.FC<SidebarSettingsPanelProps> = ({
  theme,
  onToggleTheme,
  neonColor,
  onChangeNeonColor,
  neonPreset,
  onChangeNeonPreset,
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
  const [maxTokensInput, setMaxTokensInput] = useState(maxOutputTokens?.toString() || '');
  const [showIndividualColors, setShowIndividualColors] = useState(false);
  const mode = theme === 'dark' ? 'dark' : 'light';

  const section = (title: string) => (
    <div className="pt-4 pb-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--text-500)' }}>{title}</span>
    </div>
  );

  return (
    <ScrollArea className="flex-1">
      <div className="px-3 pb-4 space-y-1">
        {/* Theme */}
        {section('Appearance')}
        <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}>
          <div className="flex items-center gap-2.5">
            {theme === 'dark' ? <Moon size={15} style={{ color: 'var(--neon-color)' }} /> : <Sun size={15} className="text-orange-500" />}
            <span className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
          <Switch checked={theme === 'dark'} onCheckedChange={onToggleTheme} />
        </div>

        {/* Default Model */}
        {section('Default Model')}
        <Select value={defaultModelId} onValueChange={onChangeDefaultModel}>
          <SelectTrigger className="h-8 text-xs" style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}>
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)' }}>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id} className="text-xs" style={{ color: 'var(--text-100)' }}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Token Limit */}
        {section('Output Token Limit')}
        <div className="flex items-center gap-2">
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
            className="h-8 text-xs flex-1"
            style={{ backgroundColor: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          />
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-500)' }}>tokens</span>
        </div>

        {/* Font Size */}
        {section('Font Size')}
        <div className="flex items-center gap-1">
          {FONT_SIZES.map((size) => (
            <button
              key={size.id}
              onClick={() => onChangeFontSize(size.id)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: fontSize === size.id ? 'rgba(var(--neon-rgb), 0.1)' : 'var(--bg-200)',
                color: fontSize === size.id ? 'var(--neon-color)' : 'var(--text-500)',
                border: `1px solid ${fontSize === size.id ? 'rgba(var(--neon-rgb), 0.2)' : 'var(--border-300)'}`,
              }}
            >
              {size.label}
            </button>
          ))}
        </div>

        {/* Font Family */}
        {section('Font Family')}
        <div className="space-y-1">
          {FONTS.map((font) => {
            const isActive = fontFamily === font.id;
            return (
              <button
                key={font.id}
                onClick={() => onChangeFontFamily(font.id)}
                className="w-full text-left px-3 py-2 rounded-lg transition-all text-xs"
                style={{
                  backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.08)' : 'transparent',
                  color: isActive ? 'var(--neon-color)' : 'var(--text-300)',
                  fontFamily: FONT_CSS[font.id],
                }}
              >
                {font.name}
              </button>
            );
          })}
        </div>

        {/* Color Presets */}
        {section('Color Presets')}
        <div className="space-y-1">
          {NEON_PRESETS.map((preset) => {
            const isActive = neonPreset === preset.id;
            const colors = [preset.primary[mode], preset.secondary[mode], preset.accent[mode]];
            return (
              <button
                key={preset.id}
                onClick={() => onChangeNeonPreset(preset.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all"
                style={{
                  backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.08)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(var(--neon-rgb), 0.15)' : 'transparent'}`,
                }}
              >
                <div className="flex items-center gap-0.5">
                  {colors.map((c, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full"
                      style={{
                        backgroundColor: c.tailwind,
                        marginLeft: i > 0 ? '-3px' : '0',
                        boxShadow: isActive ? `0 0 6px ${c.tailwind.replace('rgb', 'rgba').replace(')', ', 0.4)')}` : 'none',
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium" style={{ color: isActive ? 'var(--neon-color)' : 'var(--text-300)' }}>
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Individual Colors */}
        <button
          onClick={() => setShowIndividualColors(!showIndividualColors)}
          className="flex items-center gap-2 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors"
          style={{ color: 'var(--text-500)' }}
        >
          <span>Individual Colors</span>
          {showIndividualColors ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {showIndividualColors && (
          <div className="grid grid-cols-3 gap-1.5">
            {Object.entries(INDIVIDUAL_COLORS).map(([id, colorDef]) => {
              const isActive = !neonPreset && neonColor === id;
              const rgb = colorDef[mode].tailwind;
              return (
                <button
                  key={id}
                  onClick={() => onChangeNeonColor(id)}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg transition-all"
                  style={{
                    backgroundColor: isActive ? 'rgba(var(--neon-rgb), 0.08)' : 'var(--bg-200)',
                    border: `1px solid ${isActive ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--border-300)'}`,
                  }}
                >
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{
                      backgroundColor: rgb,
                      boxShadow: isActive ? `0 0 10px ${rgb.replace('rgb', 'rgba').replace(')', ', 0.5)')}` : 'none',
                    }}
                  />
                  <span className="text-[10px] capitalize" style={{ color: isActive ? 'var(--neon-color)' : 'var(--text-500)' }}>
                    {id}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Security */}
        {section('Security')}
        <button
          onClick={resetPassword}
          className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors"
          style={{ color: 'var(--text-500)', backgroundColor: 'var(--bg-200)', border: '1px solid var(--border-300)' }}
        >
          Lock Screen
        </button>
        <p className="text-[10px] pl-1" style={{ color: 'var(--text-500)' }}>You'll need to re-enter your password.</p>
      </div>
    </ScrollArea>
  );
};

export default SidebarSettingsPanel;
