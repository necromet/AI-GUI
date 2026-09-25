import { useEffect, useRef } from 'react';
import { AUTO_SAVE_DELAY_MS } from '../constants';

export function useAutoSave(
  workflowId: string | undefined,
  name: string,
  nodes: any[],
  edges: any[],
  enabled: boolean = true,
  onError?: (message: string) => void,
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!enabled || !workflowId) return;

    const current = JSON.stringify({ name, nodes, edges });
    if (current === lastSavedRef.current) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/workflows/${workflowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, nodes, edges }),
        });
        if (!response.ok) throw new Error(`Autosave failed (HTTP ${response.status})`);
        lastSavedRef.current = current;
      } catch (error: any) {
        onError?.(error.message || 'Autosave failed');
      }
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [workflowId, name, nodes, edges, enabled, onError]);
}
