import React, { useState, useCallback } from 'react';
import { Send, Square, Settings2 } from 'lucide-react';
import { HarnessMessageList } from '../harness/HarnessMessageList';
import { HarnessToolToggles, HarnessModeSwitch } from '../harness/config/HarnessToolToggles';
import { HarnessPermissionEditor } from '../harness/config/HarnessPermissionEditor';
import { useHarnessStream } from '../harness/useHarnessStream';
import type { HarnessMessage, PendingState } from '../harness/types';
import type { HarnessConfig } from '@/lib/harnessTypes';
import { DEFAULT_HARNESS_CONFIG } from '@/lib/harnessTypes';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

interface HarnessPanelProps {
  agentId: string;
  harnessConfig?: Partial<HarnessConfig>;
  onConfigChange?: (config: HarnessConfig) => void;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
}

export const HarnessPanel: React.FC<HarnessPanelProps> = ({
  agentId,
  harnessConfig,
  onConfigChange,
  onNotification,
}) => {
  const [messages, setMessages] = useState<HarnessMessage[]>([]);
  const [pending, setPending] = useState<PendingState | null>(null);
  const [input, setInput] = useState('');
  const [sessionId] = useState(() => 'sess_' + uid());
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<HarnessConfig>({ ...DEFAULT_HARNESS_CONFIG, ...(harnessConfig || {}) });

  const { isStreaming, send, resume, stop } = useHarnessStream({
    agentId,
    sessionId,
    messages,
    setMessages,
    setPending,
    onNotification,
  });

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    send(input.trim());
    setInput('');
  }, [input, isStreaming, send]);

  const handleToggleCollapse = useCallback((msgId: string, blockIdx: number) => {
    setMessages(prev => prev.map(m =>
      m.id === msgId
        ? { ...m, blocks: m.blocks.map((b, i) => i === blockIdx && b.type === 'tool_call' ? { ...b, collapsed: !b.collapsed } : b) }
        : m
    ));
  }, []);

  const handleConfigChange = useCallback((next: HarnessConfig) => {
    setConfig(next);
    onConfigChange?.(next);
  }, [onConfigChange]);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-50)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border-300)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-100)' }}>Agent Chat</span>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="p-1 rounded-md cursor-pointer transition-colors hover:opacity-80"
          style={{ color: 'var(--text-400)' }}
        >
          <Settings2 size={14} />
        </button>
      </div>

      {showConfig && (
        <div className="px-3 py-3 space-y-3 border-b overflow-y-auto" style={{ borderColor: 'var(--border-300)', maxHeight: 240 }}>
          <HarnessModeSwitch config={config} onChange={handleConfigChange} />
          <HarnessToolToggles config={config} onChange={handleConfigChange} />
          <HarnessPermissionEditor config={config} onChange={handleConfigChange} />
        </div>
      )}

      <HarnessMessageList
        messages={messages}
        pending={pending}
        onToggleCollapse={handleToggleCollapse}
        onQuestionAnswer={(id, answer) => resume(id, answer)}
        onPermissionDecision={(id, decision) => resume(id, '', decision)}
      />

      <div className="px-3 py-2 border-t flex items-center gap-2" style={{ borderColor: 'var(--border-300)' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={isStreaming ? 'Agent is working...' : 'Message the agent...'}
          disabled={isStreaming}
          rows={1}
          className="flex-1 text-sm px-3 py-2 rounded-xl resize-none"
          style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-100)', border: '1px solid var(--border-300)', outline: 'none', minHeight: 36, maxHeight: 80 }}
        />
        {isStreaming ? (
          <button
            onClick={stop}
            className="p-2 rounded-xl cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: 'rgba(248,113,113,0.15)', color: '#f87171' }}
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 rounded-xl cursor-pointer transition-colors hover:scale-[1.02] disabled:opacity-30"
            style={{ backgroundColor: 'var(--neon-color)', color: '#fff' }}
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
