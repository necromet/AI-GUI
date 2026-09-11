import { useState, useEffect, useCallback, useRef } from 'react';

interface PendingApproval {
  approvalId: string;
  nodeId: string;
  message: string;
  executionId?: string;
}

export function useApprovalWatch(executionId: string | null) {
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!executionId) {
      setPendingApproval(null);
      return;
    }

    const checkApproval = async () => {
      try {
        const res = await fetch(`/api/workflows/executions/${executionId}`);
        if (!res.ok) return;
        const execution = await res.json();

        if (execution.status === 'paused' && execution.thread_id) {
          const approvalRes = await fetch(`/api/workflows/approval/${execution.thread_id}`);
          if (approvalRes.ok) {
            const approval = await approvalRes.json();
            if (approval.status === 'pending') {
              setPendingApproval({
                approvalId: approval.approval_id,
                nodeId: approval.node_id,
                message: approval.message,
                executionId: approval.execution_id,
              });
              return;
            }
          }
        }
        setPendingApproval(null);
      } catch {}
    };

    checkApproval();
    intervalRef.current = setInterval(checkApproval, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [executionId]);

  const approve = useCallback(async () => {
    if (!pendingApproval) return;
    setLoading(true);
    try {
      await fetch(`/api/workflows/approval/${pendingApproval.approvalId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });
      setPendingApproval(null);
    } catch {} finally {
      setLoading(false);
    }
  }, [pendingApproval]);

  const reject = useCallback(async () => {
    if (!pendingApproval) return;
    setLoading(true);
    try {
      await fetch(`/api/workflows/approval/${pendingApproval.approvalId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false }),
      });
      setPendingApproval(null);
    } catch {} finally {
      setLoading(false);
    }
  }, [pendingApproval]);

  return { pendingApproval, approve, reject, loading };
}
