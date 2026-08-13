import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Square, Bot, Wrench, Check, X, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage from '../ChatMessage';
import { Role, Message } from '../../types';
import { useAgentChat } from './hooks/useAgentChat';
import type { AgentBuilderAgent } from './types';

interface AgentChatViewProps {
  agent: AgentBuilderAgent | null;
  workflowAgents?: AgentBuilderAgent[];
  onSelectAgent?: (id: string) => void;
}

export function AgentChatView({ agent, workflowAgents, onSelectAgent }: AgentChatViewProps) {
  const { messages, isStreaming, toolCalls, sendMessage, stopStreaming, clearMessages } = useAgentChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolCalls]);

  useEffect(() => {
    clearMessages();
  }, [agent?.id, clearMessages]);

  const handleSend = useCallback(async () => {
    if (!agent || !input.trim() || isStreaming) return;
    const text = input;
    setInput('');
    await sendMessage(agent.id, text);
  }, [agent, input, isStreaming, sendMessage]);

  const hasWorkflowAgents = workflowAgents && workflowAgents.length > 0;

  if (!agent) {
    return (
      <div className="ab-chat-view">
        <div className="ab-chat-empty">
          <Bot size={40} style={{ color: 'var(--text-500)' }} />
          <p className="text-sm mt-3" style={{ color: 'var(--text-300)' }}>Select a workflow to start chatting</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-500)' }}>
            Choose a workflow from the sidebar to begin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ab-chat-view">
      <div className="ab-chat-header">
        <div className="flex items-center gap-2">
          {hasWorkflowAgents && onSelectAgent && (
            <button
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 cursor-pointer text-[var(--text-500)] hover:text-[var(--text-100)] hover:bg-[var(--bg-200)]"
              onClick={() => onSelectAgent(null as any)}
              title="Switch agent"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          <div className="p-1.5 rounded-lg" style={{ background: `${agent.color}15` }}>
            <Bot size={16} style={{ color: agent.color }} />
          </div>
          <div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>{agent.name}</span>
            <span className="text-[10px] block" style={{ color: 'var(--text-500)' }}>
              {agent.model} · {(agent.tools || []).length} tools
            </span>
          </div>
        </div>
      </div>

      <ScrollArea className="ab-chat-messages">
        {messages.length === 0 ? (
          <div className="ab-chat-empty">
            <Bot size={32} style={{ color: 'var(--text-500)' }} />
            <p className="text-xs mt-2" style={{ color: 'var(--text-500)' }}>
              Start a conversation with {agent.name}
            </p>
          </div>
        ) : (
          <div className="ab-chat-messages-inner">
            {messages.map((msg, i) => {
              const chatMsg: Message = {
                id: String(i),
                role: msg.role === 'user' ? Role.User : Role.Assistant,
                content: msg.content,
                timestamp: msg.timestamp || Date.now(),
                isThinking: isStreaming && i === messages.length - 1 && !msg.content,
              };
              return (
                <ChatMessage
                  key={i}
                  message={chatMsg}
                  onRegenerate={() => {}}
                  onFeedback={() => {}}
                  isStreaming={isStreaming && i === messages.length - 1}
                />
              );
            })}

            {toolCalls.length > 0 && (
              <div className="ab-chat-tools">
                {toolCalls.map((tc, i) => (
                  <div key={i} className="ab-chat-tool-call">
                    <div className="flex items-center gap-1.5">
                      <Wrench size={10} />
                      <span className="text-[11px] font-semibold">{tc.name}</span>
                      {tc.output ? (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5" style={{ borderColor: '#4ade80', color: '#4ade80' }}>
                          <Check size={8} /> Done
                        </Badge>
                      ) : tc.error ? (
                        <Badge variant="destructive" className="h-4 px-1 text-[9px] gap-0.5">
                          <X size={8} /> Error
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5" style={{ borderColor: agent.color, color: agent.color }}>
                          <Loader2 size={8} className="animate-spin" /> Running
                        </Badge>
                      )}
                    </div>
                    {tc.output && (
                      <pre className="text-[10px] mt-1 max-h-16 overflow-auto font-mono" style={{ color: 'var(--text-500)', whiteSpace: 'pre-wrap' }}>
                        {tc.output.substring(0, 300)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      <div className="ab-chat-input-area">
        <div className="ab-chat-input-wrapper">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={`Message ${agent.name}...`}
            className="ab-chat-input"
            disabled={isStreaming}
            aria-label={`Message ${agent.name}`}
          />
          <Button
            variant="ghost"
            size="sm"
            className="ab-chat-send"
            onClick={isStreaming ? stopStreaming : handleSend}
            disabled={!isStreaming && !input.trim()}
            aria-label={isStreaming ? 'Stop generation' : 'Send message'}
          >
            {isStreaming ? <Square size={16} /> : <Send size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
