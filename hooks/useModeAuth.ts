import { useState, useCallback, useEffect } from 'react';
import { MODES } from '../lib/modeRegistry';

const MODE_IDS = MODES.map(m => m.id);

export function useModeAuth() {
  const [authStates, setAuthStates] = useState<Record<string, boolean>>(() => {
    const states: Record<string, boolean> = {};
    for (const id of MODE_IDS) {
      states[id] = false;
    }
    return states;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/auth/status', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          const unlocked: string[] = data.unlockedModes ?? [];
          const states: Record<string, boolean> = {};
          for (const id of MODE_IDS) {
            states[id] = unlocked.includes(id);
          }
          setAuthStates(states);
        }
      } catch {
        // Session check failed — all modes stay locked
      } finally {
        setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const isUnlocked = useCallback((modeId: string): boolean => {
    return authStates[modeId] ?? false;
  }, [authStates]);

  const unlock = useCallback(async (modeId: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: modeId, password }),
      });
      if (res.ok) {
        setAuthStates(prev => ({ ...prev, [modeId]: true }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const isChatAuthenticated = authStates['chat'] ?? false;
  const isRagAuthenticated = authStates['rag'] ?? false;
  const isSkemaAuthenticated = authStates['skema'] ?? false;
  const isPythonAuthenticated = authStates['python'] ?? false;
  const isLibraryAuthenticated = authStates['library'] ?? false;
  const isDatabaseAuthenticated = authStates['database'] ?? false;
  const isAgentBuilderAuthenticated = authStates['agent-builder'] ?? false;
  const isNotesAuthenticated = authStates['notes'] ?? false;

  const isAnyAuthenticated = Object.values(authStates).some(Boolean);

  return {
    isUnlocked,
    unlock,
    authStates,
    isLoading,
    isAnyAuthenticated,

    isChatAuthenticated,
    isRagAuthenticated,
    isSkemaAuthenticated,
    isPythonAuthenticated,
    isLibraryAuthenticated,
    isDatabaseAuthenticated,
    isAgentBuilderAuthenticated,
    isNotesAuthenticated,

    onUnlockChat: (password: string) => unlock('chat', password),
    onUnlockRag: (password: string) => unlock('rag', password),
    onUnlockSkema: (password: string) => unlock('skema', password),
    onUnlockPython: (password: string) => unlock('python', password),
    onUnlockLibrary: (password: string) => unlock('library', password),
    onUnlockDatabase: (password: string) => unlock('database', password),
    onUnlockAgentBuilder: (password: string) => unlock('agent-builder', password),
    onUnlockNotes: (password: string) => unlock('notes', password),
  };
}
