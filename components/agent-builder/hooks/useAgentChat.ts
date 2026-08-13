import { useState, useRef, useCallback } from 'react';
import type { AgentBuilderMessage } from '../types';

const API = '/api/agent-builder';

export function useAgentChat() {
  const [messages, setMessages] = useState<AgentBuilderMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolCalls, setToolCalls] = useState<Array<{ name: string; arguments: Record<string, any>; output?: string; error?: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<AgentBuilderMessage[]>([]);
  const isStreamingRef = useRef(false);
  messagesRef.current = messages;

  const sendMessage = useCallback(async (agentId: string, text: string) => {
    if (!text.trim()) return;
    if (isStreamingRef.current) return;

    const userMsg: AgentBuilderMessage = { role: 'user', content: text, timestamp: Date.now() };
    const aiMsgId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const aiPlaceholder: AgentBuilderMessage = { role: 'assistant', content: '', timestamp: Date.now() };

    setMessages(prev => {
      const currentMessages = [...prev, userMsg, aiPlaceholder];
      return currentMessages;
    });
    setIsStreaming(true);
    isStreamingRef.current = true;
    setToolCalls([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = [...messagesRef.current, userMsg].map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, messages: history }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.error) {
              throw new Error(parsed.error);
            }

            if (parsed.tool_call) {
              setToolCalls(prev => [...prev, { name: parsed.tool_call.name, arguments: parsed.tool_call.arguments }]);
              continue;
            }

            if (parsed.tool_result) {
              setToolCalls(prev => {
                const updated = [...prev];
                const idx = updated.findIndex(r => r.name === parsed.tool_result.name && !r.output);
                if (idx >= 0) updated[idx] = { ...updated[idx], output: parsed.tool_result.output };
                return updated;
              });
              continue;
            }

            if (parsed.content) {
              fullText += parsed.content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullText };
                return updated;
              });
            }
          } catch (err: any) {
            if (err.name === 'AbortError') throw err;
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && !last.content) return prev.slice(0, -1);
          return prev;
        });
      } else {
        setMessages(prev => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'assistant') {
              updated[i] = { ...updated[i], content: `**Error:** ${err.message}` };
              break;
            }
          }
          return updated;
        });
      }
    } finally {
      abortRef.current = null;
      isStreamingRef.current = false;
      setIsStreaming(false);
    }
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setToolCalls([]);
  }, []);

  const loadMessages = useCallback((msgs: AgentBuilderMessage[]) => {
    setMessages(msgs);
    setToolCalls([]);
  }, []);

  return { messages, isStreaming, toolCalls, sendMessage, stopStreaming, clearMessages, loadMessages, setMessages };
}
