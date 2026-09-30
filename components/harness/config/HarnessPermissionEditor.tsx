import React, { useState } from 'react';
import type { HarnessConfig, PermissionRule, PermissionAction } from '@/lib/harnessTypes';

const ACTIONS: PermissionAction[] = ['allow', 'deny', 'ask'];
const ACTION_COLORS: Record<PermissionAction, string> = { allow: '#4ade80', deny: '#f87171', ask: '#fbbf24' };

interface HarnessPermissionEditorProps {
  config: HarnessConfig;
  onChange: (config: HarnessConfig) => void;
}

export const HarnessPermissionEditor: React.FC<HarnessPermissionEditorProps> = ({ config, onChange }) => {
  const [newTool, setNewTool] = useState('');

  const updateRule = (idx: number, patch: Partial<PermissionRule>) => {
    const rules = [...config.permissions];
    rules[idx] = { ...rules[idx], ...patch };
    onChange({ ...config, permissions: rules });
  };

  const removeRule = (idx: number) => {
    const rules = config.permissions.filter((_, i) => i !== idx);
    onChange({ ...config, permissions: rules });
  };

  const addRule = () => {
    if (!newTool.trim()) return;
    onChange({ ...config, permissions: [...config.permissions, { tool: newTool.trim(), action: 'ask' }] });
    setNewTool('');
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold" style={{ color: 'var(--text-400)' }}>Permissions</div>
      {config.permissions.map((rule, idx) => (
        <div key={idx} className="flex items-center gap-1.5 text-xs">
          <span className="font-mono truncate flex-1" style={{ color: 'var(--text-100)' }}>{rule.tool}</span>
          {rule.pattern && <span className="font-mono truncate text-[10px]" style={{ color: 'var(--text-400)' }}>{rule.pattern}</span>}
          <select
            value={rule.action}
            onChange={e => updateRule(idx, { action: e.target.value as PermissionAction })}
            className="text-[10px] px-1 py-0.5 rounded cursor-pointer"
            style={{ backgroundColor: 'var(--bg-200)', color: ACTION_COLORS[rule.action], border: '1px solid var(--border-300)' }}
          >
            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={() => removeRule(idx)} className="text-[10px] px-1 cursor-pointer" style={{ color: 'var(--text-400)' }}>&times;</button>
        </div>
      ))}
      <div className="flex gap-1.5">
        <input
          value={newTool}
          onChange={e => setNewTool(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addRule(); }}
          placeholder="tool name"
          className="flex-1 text-xs px-2 py-1 rounded-lg"
          style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-100)', border: '1px solid var(--border-300)', outline: 'none' }}
        />
        <button
          onClick={addRule}
          className="text-xs px-2 py-1 rounded-lg cursor-pointer"
          style={{ backgroundColor: 'var(--neon-color)', color: '#fff' }}
        >+</button>
      </div>
    </div>
  );
};
