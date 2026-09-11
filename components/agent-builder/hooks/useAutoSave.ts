import { useEffect, useRef } from 'react';

export function useAutoSave(
  workflowId: string | undefined,
  nodes: any[],
  edges: any[],
  enabled: boolean = true
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!enabled || !workflowId) return;

    const current = JSON.stringify({ nodes, edges });
    if (current === lastSavedRef.current) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/workflows/${workflowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodes, edges }),
        });
        lastSavedRef.current = current;
      } catch {}
    }, 5000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [workflowId, nodes, edges, enabled]);
}
