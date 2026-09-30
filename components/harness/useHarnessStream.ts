import { useState, useRef, useCallback } from 'react';
import type { HarnessMessage, HarnessBlock, PendingState } from './types';
import type { HarnessEvent, TaskNode } from '@/lib/harnessTypes';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

interface UseHarnessStreamOptions {
  agentId: string;
  sessionId: string | null;
  messages: HarnessMessage[];
  setMessages: React.Dispatch<React.SetStateAction<HarnessMessage[]>>;
  setPending: React.Dispatch<React.SetStateAction<PendingState | null>>;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
}

export function useHarnessStream({
  agentId,
  sessionId,
  messages,
  setMessages,
  setPending,
  onNotification,
}: UseHarnessStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    const sid = sessionId || uid();

    const userMsg: HarnessMessage = { id: uid(), role: 'user', content: text, blocks: [] };
    const aiMsg: HarnessMessage = { id: uid(), role: 'assistant', content: '', blocks: [], isStreaming: true };

    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, aiMsg]);
    setIsStreaming(true);

    const serverMessages = nextMessages.map(m => ({ role: m.role, content: m.content }));

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch('/api/agent-builder/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, sessionId: sid, messages: serverMessages }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      const updateAi = (fn: (msg: HarnessMessage) => HarnessMessage) => {
        setMessages(prev => prev.map(m => m.id === aiMsg.id ? fn(m) : m));
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          let event: HarnessEvent;
          try {
            event = JSON.parse(data);
          } catch {
            continue;
          }

          switch (event.type) {
            case 'content':
              updateAi(m => ({
                ...m,
                content: m.content + event.text,
                blocks: mergeTextBlock(m.blocks, event.text),
              }));
              break;

            case 'tool_call':
              updateAi(m => ({
                ...m,
                blocks: [...m.blocks, { type: 'tool_call', id: event.id, name: event.name, args: event.args, status: 'running' }],
              }));
              break;

            case 'tool_result':
              updateAi(m => ({
                ...m,
                blocks: m.blocks.map(b =>
                  b.type === 'tool_call' && b.id === event.id
                    ? { ...b, status: event.error ? 'error' as const : 'done' as const, output: event.output, error: event.error, collapsed: true }
                    : b
                ),
              }));
              break;

            case 'task_update':
              updateAi(m => {
                const withoutTasks = m.blocks.filter(b => b.type !== 'task_tree');
                return { ...m, blocks: [...withoutTasks, { type: 'task_tree', tasks: event.tasks }] };
              });
              break;

            case 'question':
              updateAi(m => ({
                ...m,
                blocks: [...m.blocks, { type: 'question', id: event.id, question: event.question, options: event.options }],
              }));
              setPending({ id: event.id, kind: 'question', block: { type: 'question', id: event.id, question: event.question, options: event.options } });
              break;

            case 'permission_request':
              updateAi(m => ({
                ...m,
                blocks: [...m.blocks, { type: 'permission', id: event.id, tool: event.tool, args: event.args, pattern: event.pattern }],
              }));
              setPending({ id: event.id, kind: 'permission', block: { type: 'permission', id: event.id, tool: event.tool, args: event.args, pattern: event.pattern } });
              break;

            case 'done':
              updateAi(m => ({ ...m, isStreaming: false, usage: event.usage }));
              break;

            case 'error':
              updateAi(m => ({
                ...m,
                blocks: [...m.blocks, { type: 'error', message: event.message }],
                isStreaming: false,
              }));
              break;
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        onNotification?.(err.message || 'Stream error', 'error');
        updateAi(m => ({ ...m, isStreaming: false }));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [agentId, sessionId, messages, isStreaming, setMessages, setPending, onNotification]);

  const resume = useCallback(async (pendingId: string, answer: string, decision?: 'allow' | 'allow_always' | 'deny') => {
    setPending(null);
    setMessages(prev => prev.map(m => ({
      ...m,
      blocks: m.blocks.map(b => {
        if (b.type === 'question' && b.id === pendingId) return { ...b, answered: answer };
        if (b.type === 'permission' && b.id === pendingId) return { ...b, decision: decision || 'allow' };
        return b;
      }),
    })));

    try {
      await fetch('/api/agent-builder/chat/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingId, decision: decision || 'allow', answer }),
      });
    } catch (err: any) {
      onNotification?.('Resume failed: ' + err.message, 'error');
    }
  }, [setMessages, setPending, onNotification]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { isStreaming, send, resume, stop };
}

function mergeTextBlock(blocks: HarnessBlock[], text: string): HarnessBlock[] {
  const last = blocks[blocks.length - 1];
  if (last && last.type === 'text') {
    return [...blocks.slice(0, -1), { type: 'text', text: last.text + text }];
  }
  return [...blocks, { type: 'text', text }];
}
