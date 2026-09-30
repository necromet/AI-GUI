import React from 'react';
import type { HarnessConfig, HarnessMode } from '@/lib/harnessTypes';

const ALL_TOOLS = [
  { name: 'read', label: 'Read', cap: 'fs', modes: ['build', 'plan'] },
  { name: 'write', label: 'Write', cap: 'fs', modes: ['build'] },
  { name: 'edit', label: 'Edit', cap: 'fs', modes: ['build'] },
  { name: 'glob', label: 'Glob', cap: 'fs', modes: ['build', 'plan'] },
  { name: 'grep', label: 'Grep', cap: 'fs', modes: ['build', 'plan'] },
  { name: 'bash', label: 'Bash', cap: 'shell', modes: ['build'] },
  { name: 'webfetch', label: 'Web Fetch', cap: 'web', modes: ['build', 'plan'] },
  { name: 'websearch', label: 'Web Search', cap: 'web', modes: ['build', 'plan'] },
  { name: 'memory', label: 'Memory', cap: 'meta', modes: ['build', 'plan'] },
  { name: 'skill', label: 'Skill', cap: 'meta', modes: ['build', 'plan'] },
  { name: 'skill_search', label: 'Skill Search', cap: 'meta', modes: ['build', 'plan'] },
  { name: 'subagent', label: 'Subagent', cap: 'meta', modes: ['build'] },
];

const CAP_COLORS: Record<string, string> = { fs: '#60a5fa', shell: '#f87171', web: '#34d399', meta: '#a78bfa' };

interface HarnessToolTogglesProps {
  config: HarnessConfig;
  onChange: (config: HarnessConfig) => void;
}

export const HarnessToolToggles: React.FC<HarnessToolTogglesProps> = ({ config, onChange }) => {
  const toggle = (name: string) => {
    const next = { ...config, tools: { ...config.tools } };
    next.tools[name] = next.tools[name] === false ? true : false;
    onChange(next);
  };

  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--text-400)' }}>Tools</div>
      {ALL_TOOLS.map(t => {
        const enabled = config.tools[t.name] !== false;
        const availableInMode = (t.modes as HarnessMode[]).includes(config.mode);
        return (
          <button
            key={t.name}
            onClick={() => toggle(t.name)}
            disabled={!availableInMode}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
            style={{
              backgroundColor: enabled ? 'var(--bg-200)' : 'transparent',
              opacity: availableInMode ? 1 : 0.35,
              border: '1px solid',
              borderColor: enabled ? 'var(--border-300)' : 'transparent',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: enabled ? CAP_COLORS[t.cap] || 'var(--text-400)' : 'var(--text-400)' }} />
            <span style={{ color: 'var(--text-100)' }}>{t.label}</span>
            <span className="ml-auto text-[9px] px-1 py-0 rounded" style={{ backgroundColor: CAP_COLORS[t.cap] + '18', color: CAP_COLORS[t.cap] }}>{t.cap}</span>
          </button>
        );
      })}
    </div>
  );
};

interface HarnessModeSwitchProps {
  config: HarnessConfig;
  onChange: (config: HarnessConfig) => void;
}

export const HarnessModeSwitch: React.FC<HarnessModeSwitchProps> = ({ config, onChange }) => (
  <div className="flex gap-1 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--bg-200)' }}>
    {(['build', 'plan'] as const).map(mode => (
      <button
        key={mode}
        onClick={() => onChange({ ...config, mode })}
        className="flex-1 text-xs px-2 py-1.5 rounded-md transition-colors cursor-pointer font-medium"
        style={{
          backgroundColor: config.mode === mode ? 'var(--neon-color)' : 'transparent',
          color: config.mode === mode ? '#fff' : 'var(--text-400)',
        }}
      >
        {mode.charAt(0).toUpperCase() + mode.slice(1)}
      </button>
    ))}
  </div>
);
