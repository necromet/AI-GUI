import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { AgentMessage } from './types';
import type { SkemaProject, ModelConfig } from '../../types';
import type { AgentTask } from '@/components/ui/agent-plan';
import { getSystemPromptAppend, getEnabledTools } from '../../../lib/agentConfig';

import type { GridComponent, GridState } from '../../canvas/types';

interface UseSkemaAgentStreamOptions {
  messages: AgentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>;
  modelConfig?: ModelConfig;
  selectedModelId?: string;
  project: SkemaProject;
  activeBoardIdx: number;
  currentHtml: string;
  onNotification?: (msg: string, type: 'success' | 'error') => void;
  onHtmlGenerated?: (html: string) => void;
  gridState?: GridState;
  onComponentPlaced?: (component: GridComponent) => void;
  onComponentRemoved?: (componentId: string) => void;
  onComponentUpdated?: (component: GridComponent) => void;
}

export function useSkemaAgentStream({
  messages,
  setMessages,
  modelConfig,
  selectedModelId,
  project,
  activeBoardIdx,
  currentHtml,
  onNotification,
  onHtmlGenerated,
  gridState,
  onComponentPlaced,
  onComponentRemoved,
  onComponentUpdated,
}: UseSkemaAgentStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingAskUser, setPendingAskUser] = useState<string | null>(null);
  const [agentPlanTasks, setAgentPlanTasks] = useState<AgentTask[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({});

  const abortControllerRef = useRef<AbortController | null>(null);
  const shouldAutoScrollRef = useRef(false);
  const isStreamingRef = useRef(false);
  const agentPlanTasksRef = useRef<AgentTask[]>([]);

  agentPlanTasksRef.current = agentPlanTasks;

  const resetAgentState = useCallback(() => {
    setAgentPlanTasks([]);
    setTaskStatuses({});
    setPendingAskUser(null);
  }, []);

  const buildContext = useCallback(() => {
    const board = project.boards[activeBoardIdx];
    const layout = board?.layout || '16:9';

    const context: Record<string, any> = {
      layout,
      boardDescription: project.title,
      model: selectedModelId || modelConfig?.apiModelId || modelConfig?.id || 'mimo-v2.5',
      provider: modelConfig?.provider,
      projectType: project.projectType,
    };

    if (currentHtml) context.currentHtml = currentHtml;
    if (gridState) context.gridState = gridState;

    return context;
  }, [project, activeBoardIdx, currentHtml, gridState, modelConfig, selectedModelId]);

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
      (toolName === 'place_component' && t.title.toLowerCase().includes('place')) ||
      (toolName === 'remove_component' && t.title.toLowerCase().includes('remove')) ||
      (toolName === 'move_component' && t.title.toLowerCase().includes('move')) ||
      (toolName === 'resize_component' && t.title.toLowerCase().includes('resize')) ||
      (toolName === 'update_component' && t.title.toLowerCase().includes('update')) ||
      (toolName === 'regenerate_component' && t.title.toLowerCase().includes('regenerat'))
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

    if (parsed.html_generated) {
      onHtmlGenerated?.(parsed.html_generated);
    }

    if (parsed.component_placed) {
      onComponentPlaced?.(parsed.component_placed);
    }
    if (parsed.component_removed) {
      onComponentRemoved?.(parsed.component_removed.componentId);
    }
    if (parsed.component_updated) {
      onComponentUpdated?.(parsed.component_updated);
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
  }, [matchToolToTask, onHtmlGenerated, onComponentPlaced, onComponentRemoved, onComponentUpdated, setMessages]);

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? '').trim();
    if (!text || isStreamingRef.current) return;

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
      const context = buildContext();

      const skemaEnabledTools = getEnabledTools('skema');
      const defaultTools = ['place_component', 'remove_component', 'move_component', 'resize_component', 'update_component', 'regenerate_component', 'search_library'];
      const tools = defaultTools.filter(t => skemaEnabledTools.includes(t));

      while (round < MAX_AGENT_ROUNDS) {
        round++;

        const response = await fetch('/api/skema-agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: serverMessages,
            model: selectedModelId || modelConfig?.apiModelId || modelConfig?.id || 'mimo-v2.5',
            provider: modelConfig?.provider,
            stream: true,
            tools,
            context,
            systemPromptAppend: getSystemPromptAppend('skema'),
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
  }, [messages, setMessages, modelConfig, selectedModelId, project, activeBoardIdx, buildServerMessages, buildContext, handleSSEChunk]);

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
