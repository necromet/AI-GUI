import { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentMessage } from './types';
import type { SkemaProject } from '../../types';

export function useSkemaAgentSessions({
  project,
  activeBoardIdx,
  isStreaming,
  messages,
  setMessages,
  onResetAgentState,
}: {
  project: SkemaProject;
  activeBoardIdx: number;
  isStreaming: boolean;
  messages: AgentMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>;
  onResetAgentState: () => void;
}) {
  const [sessions, setSessions] = useState<Array<{ id: string; title: string | null; createdAt: string; updatedAt: string }>>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    if (!project?.id) {
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
      return;
    }
    const loadSessions = async () => {
      try {
        const resp = await fetch(`/api/skema-agent/sessions/${project.id}?boardIdx=${activeBoardIdx}`);
        if (!resp.ok) return;
        const data = await resp.json();
        const loadedSessions = data.sessions || [];
        setSessions(loadedSessions);
        if (loadedSessions.length > 0) {
          const latest = loadedSessions[0];
          setActiveSessionId(latest.id);
          try {
            const sessionResp = await fetch(`/api/skema-agent/session/${latest.id}`);
            if (sessionResp.ok) {
              const sessionData = await sessionResp.json();
              setMessages(JSON.parse(sessionData.session?.messagesJson || '[]'));
              return;
            }
          } catch {}
          setMessages([]);
          return;
        }
        const createResp = await fetch('/api/skema-agent/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project.id, boardIdx: activeBoardIdx }),
        });
        if (createResp.ok) {
          const createData = await createResp.json();
          setActiveSessionId(createData.session.id);
          setSessions(prev => [createData.session, ...prev]);
        }
        setMessages([]);
      } catch {}
    };
    loadSessions();
  }, [project?.id, activeBoardIdx, setMessages]);

  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && activeSessionId) {
      const body: Record<string, any> = { messages };
      if (messages.length === 2 && messages[0].role === 'user') {
        body.title = messages[0].content.substring(0, 50);
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, title: body.title } : s));
      }
      fetch(`/api/skema-agent/sessions/${activeSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {});
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming, messages, activeSessionId]);

  const handleSwitchSession = useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    onResetAgentState();
    try {
      const resp = await fetch(`/api/skema-agent/session/${sessionId}`);
      if (resp.ok) {
        const data = await resp.json();
        setMessages(JSON.parse(data.session?.messagesJson || '[]'));
      }
    } catch {}
  }, [activeSessionId, onResetAgentState, setMessages]);

  const handleNewSession = useCallback(async () => {
    if (!project?.id || sessions.length >= 3) return;
    try {
      const resp = await fetch('/api/skema-agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, boardIdx: activeBoardIdx }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setActiveSessionId(data.session.id);
        setSessions(prev => [data.session, ...prev]);
        setMessages([]);
        onResetAgentState();
      }
    } catch {}
  }, [project?.id, activeBoardIdx, sessions.length, setMessages, onResetAgentState]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      const resp = await fetch(`/api/skema-agent/sessions/${sessionId}`, { method: 'DELETE' });
      if (resp.ok) {
        setSessions(prev => {
          const remaining = prev.filter(s => s.id !== sessionId);
          if (activeSessionId === sessionId) {
            if (remaining.length > 0) handleSwitchSession(remaining[0].id);
            else { setActiveSessionId(null); setMessages([]); }
          }
          return remaining;
        });
      }
    } catch {}
  }, [activeSessionId, handleSwitchSession, setMessages]);

  return {
    sessions,
    activeSessionId,
    handleSwitchSession,
    handleNewSession,
    handleDeleteSession,
  };
}
