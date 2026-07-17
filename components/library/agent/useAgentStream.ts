import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { AgentMessage } from './types';
import type { LibraryComponent, ModelConfig } from '../../types';
import type { AgentTask } from '@/components/ui/agent-plan';
import { getSystemPromptAppend } from '../../../lib/agentConfig';

interface UseAgentStreamOptions {
  messages: AgentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>;
  modelConfig?: ModelConfig;
  selectedComponent: LibraryComponent | null;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onComponentUpdated?: (comp: LibraryComponent) => void;
  onComponentsReload?: () => void;
}

export function useAgentStream({
  messages,
  setMessages,
  modelConfig,
  selectedComponent,
  onNotification,
  onComponentUpdated,
  onComponentsReload,
}: UseAgentStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingAskUser, setPendingAskUser] = useState<string | null>(null);
  const [agentPlanTasks, setAgentPlanTasks] = useState<AgentTask[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({});

  const abortControllerRef = useRef<AbortController | null>(null);
  const shouldAutoScrollRef = useRef(false);
  const isStreamingRef = useRef(false);
  const agentPlanTasksRef = useRef<AgentTask[]>([]);
  const verifyingComponentRef = useRef<string | null>(null);

  agentPlanTasksRef.current = agentPlanTasks;

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      try {
        await fetch('/api/library-agent/verify-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            componentId: verifyingComponentRef.current,
            errors: detail.errors || [],
            success: detail.success !== false,
          }),
        });
      } catch {}
      verifyingComponentRef.current = null;
    };
    window.addEventListener('agent-verify-result', handler);
    return () => window.removeEventListener('agent-verify-result', handler);
  }, []);

  const resetAgentState = useCallback(() => {
    setAgentPlanTasks([]);
    setTaskStatuses({});
    setPendingAskUser(null);
  }, []);

  const buildServerMessages = useCallback((msgs: AgentMessage[], newText: string) => {
    const serverMessages: any[] = [];
    for (const m of msgs) {
      const entry: any = { role: m.role, content: m.content };
      if (m.blocks) {
        const tcs = m.blocks.filter((b: any) => b.type === 'tool_call');
        if (tcs.length > 0) {
          const allHaveResults = tcs.every((tc: any) => tc.result);
          if (allHaveResults) {
            entry.tool_calls = tcs.map((tc: any) => ({
              id: tc.id || Math.random().toString(36).slice(2),
              type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            }));
            serverMessages.push(entry);
            for (const tc of tcs) {
              serverMessages.push({
                role: 'tool',
                tool_call_id: tc.id || Math.random().toString(36).slice(2),
                tool_name: tc.name,
                content: tc.result.error ? `Error: ${tc.result.error}` : tc.result.output,
              });
            }
          } else {
            serverMessages.push({ role: m.role, content: m.content });
          }
          continue;
        }
      }
      serverMessages.push(entry);
    }
    serverMessages.push({ role: 'user', content: newText });
    return serverMessages;
  }, []);

  const matchToolToTask = useCallback((toolName: string, tasks: AgentTask[]) => {
    if (tasks.length === 0) return null;
    return tasks.find(t =>
      toolName.includes(t.title.toLowerCase().split(' ')[0]) ||
      (toolName === 'read_component' && t.title.toLowerCase().includes('read')) ||
      (toolName === 'create_todo_list' && t.title.toLowerCase().includes('plan')) ||
      (toolName === 'write_component_file' && t.title.toLowerCase().includes('writ')) ||
      (toolName === 'verify_component' && t.title.toLowerCase().includes('verif'))
    );
  }, []);

  const handleSSEChunk = useCallback((parsed: any, ctx: {
    aiMsgId: string;
    roundToolCalls: Array<{ id: string; name: string; arguments: any }>;
    roundToolResults: Array<{ toolCallId: string; name: string; output: string; error?: string }>;
    roundTextContentRef: { current: string };
    roundHadToolCallsRef: { current: boolean };
    roundHadAskUserRef: { current: boolean };
    roundDoneRef: { current: boolean };
  }) => {
    const { aiMsgId, roundToolCalls, roundToolResults, roundTextContentRef, roundHadToolCallsRef, roundHadAskUserRef, roundDoneRef } = ctx;

    if (parsed.error) throw new Error(parsed.error);
    if (parsed.done) { roundDoneRef.current = true; return; }

    if (parsed.content) {
      roundTextContentRef.current += parsed.content;
      setMessages(prev => prev.map(m => {
        if (m.id !== aiMsgId) return m;
        const blocks = m.blocks ? [...m.blocks] : [];
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock && lastBlock.type === 'text') {
          blocks[blocks.length - 1] = { ...lastBlock, content: lastBlock.content + parsed.content };
        } else {
          blocks.push({ type: 'text', content: parsed.content });
        }
        return { ...m, blocks, isThinking: false };
      }));
    }

    if (parsed.reasoning) {
      setMessages(prev => prev.map(m => {
        if (m.id !== aiMsgId) return m;
        return { ...m, thinkingContent: ((m as any).thinkingContent || '') + parsed.reasoning };
      }));
    }

    if (parsed.tool_call) {
      const toolName = parsed.tool_call.name;
      const toolId = parsed.tool_call.id || `tc_${Math.random().toString(36).slice(2)}`;
      roundHadToolCallsRef.current = true;
      roundToolCalls.push({ id: toolId, name: toolName, arguments: parsed.tool_call.arguments });
      flushSync(() => {
        setMessages(prev => prev.map(m => {
          if (m.id !== aiMsgId) return m;
          const blocks = m.blocks ? [...m.blocks] : [];
          blocks.push({ type: 'tool_call', id: toolId, name: toolName, arguments: parsed.tool_call.arguments, collapsed: true });
          return { ...m, blocks, isThinking: false };
        }));
      });
      const match = matchToolToTask(toolName, agentPlanTasksRef.current);
      if (match) setTaskStatuses(prev => ({ ...prev, [match.id]: 'in-progress' }));
    }

    if (parsed.tool_result) {
      const { name: resultName, toolCallId, error: resultError } = parsed.tool_result;
      roundToolResults.push({ toolCallId, name: resultName, output: parsed.tool_result.output, error: resultError });
      setMessages(prev => prev.map(m => {
        if (m.id !== aiMsgId) return m;
        const blocks = m.blocks ? [...m.blocks] : [];
        for (let i = blocks.length - 1; i >= 0; i--) {
          const b = blocks[i];
          if (b.type === 'tool_call' && !b.result) {
            if (b.id === toolCallId || b.name === resultName) {
              blocks[i] = { ...b, result: { output: parsed.tool_result.output, error: resultError }, progress: undefined };
              break;
            }
          }
        }
        return { ...m, blocks };
      }));
      const match = matchToolToTask(resultName, agentPlanTasksRef.current);
      if (match) setTaskStatuses(prev => ({ ...prev, [match.id]: resultError ? 'failed' : 'completed' }));
    }

    if (parsed.ask_user) {
      roundHadAskUserRef.current = true;
      setPendingAskUser(parsed.ask_user.question);
      setMessages(prev => prev.map(m => {
        if (m.id !== aiMsgId) return m;
        const blocks = m.blocks ? [...m.blocks] : [];
        blocks.push({ type: 'ask_user', question: parsed.ask_user.question });
        return { ...m, blocks, isThinking: false };
      }));
    }

    if (parsed.verify_component) {
      verifyingComponentRef.current = parsed.verify_component.componentId;
      window.dispatchEvent(new CustomEvent('agent-verify-component', {
        detail: { componentId: parsed.verify_component.componentId },
      }));
    }

    if (parsed.component_created) {
      onNotification?.(`Created: ${parsed.component_created.name}`, 'success');
      onComponentsReload?.();
      window.dispatchEvent(new CustomEvent('agent-file-changed', {
        detail: { componentId: parsed.component_created.id, files: parsed.component_created.files },
      }));
    }

    if (parsed.component_updated) {
      onComponentUpdated?.(parsed.component_updated);
      onComponentsReload?.();
      window.dispatchEvent(new CustomEvent('agent-file-changed', {
        detail: { componentId: parsed.component_updated.id, files: parsed.component_updated.files },
      }));
    }

    if (parsed.todo_list && Array.isArray(parsed.todo_list)) {
      const tasks: AgentTask[] = parsed.todo_list.map((t: any) => ({
        id: String(t.id),
        title: t.title || `Task ${t.id}`,
        description: t.description || '',
        status: 'pending',
        priority: t.priority || 'medium',
        subtasks: [],
      }));
      setAgentPlanTasks(tasks);
      setTaskStatuses({});
      setMessages(prev => prev.map(m => {
        if (m.id !== aiMsgId) return m;
        const blocks = m.blocks ? [...m.blocks] : [];
        blocks.push({ type: 'agent_plan', tasks });
        return { ...m, blocks, isThinking: false };
      }));
    }
  }, [matchToolToTask, onNotification, onComponentUpdated, onComponentsReload, setMessages]);

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? '').trim();
    if (!text || isStreamingRef.current || !selectedComponent) return;

    isStreamingRef.current = true;
    setPendingAskUser(null);
    setAgentPlanTasks([]);
    setTaskStatuses({});
    shouldAutoScrollRef.current = true;

    const userMsg: AgentMessage = { id: Math.random().toString(36).slice(2), role: 'user', content: text };
    const aiMsgId = Math.random().toString(36).slice(2);
    setMessages(prev => [...prev, userMsg, { id: aiMsgId, role: 'assistant', content: '', isThinking: true, blocks: [] }]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const MAX_AGENT_ROUNDS = 10;
      let round = 0;
      const serverMessages = buildServerMessages(messages, text);

      while (round < MAX_AGENT_ROUNDS) {
        round++;

        const response = await fetch('/api/library-agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: serverMessages,
            model: modelConfig?.apiModelId || modelConfig?.id || 'mimo-v2.5',
            provider: modelConfig?.provider,
            stream: true,
            componentId: selectedComponent.id,
            systemPromptAppend: getSystemPromptAppend('library'),
          }),
          signal: abortController.signal,
        });

        if (!response.ok) throw new Error(await response.text());

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        const roundToolCalls: Array<{ id: string; name: string; arguments: any }> = [];
        const roundToolResults: Array<{ toolCallId: string; name: string; output: string; error?: string }> = [];
        const roundTextContentRef = { current: '' };
        const roundHadToolCallsRef = { current: false };
        const roundHadAskUserRef = { current: false };
        const roundDoneRef = { current: false };

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

            let parsed: any;
            try { parsed = JSON.parse(data); } catch { continue; }

            handleSSEChunk(parsed, {
              aiMsgId,
              roundToolCalls,
              roundToolResults,
              roundTextContentRef,
              roundHadToolCallsRef,
              roundHadAskUserRef,
              roundDoneRef,
            });
          }
        }

        if (roundDoneRef.current || !roundHadToolCallsRef.current || roundHadAskUserRef.current) break;

        serverMessages.push({
          role: 'assistant',
          content: roundTextContentRef.current || '',
          tool_calls: roundToolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        });
        for (const tr of roundToolResults) {
          serverMessages.push({
            role: 'tool',
            tool_call_id: tr.toolCallId,
            tool_name: tr.name,
            content: tr.error ? `Error: ${tr.error}` : tr.output,
          });
        }

        await new Promise(r => setTimeout(r, 300));
        if (abortController.signal.aborted) break;

        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, isThinking: true } : m
        ));
      }

      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, isThinking: false } : m
      ));
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, isThinking: false } : m
        ));
      } else {
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: `Error: ${err.message}`, isThinking: false } : m
        ));
      }
    } finally {
      abortControllerRef.current = null;
      isStreamingRef.current = false;
      setIsStreaming(false);
    }
  }, [messages, setMessages, modelConfig, selectedComponent, buildServerMessages, handleSSEChunk]);

  const handleAbort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    isStreaming,
    pendingAskUser,
    setPendingAskUser,
    agentPlanTasks,
    taskStatuses,
    abortControllerRef,
    shouldAutoScrollRef,
    isStreamingRef,
    resetAgentState,
    handleSend,
    handleAbort,
  };
}
