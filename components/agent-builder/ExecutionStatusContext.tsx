import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface NodeExecStatus {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface ExecutionStatusContextValue {
  nodeStatuses: Map<string, NodeExecStatus>;
  setNodeStatuses: React.Dispatch<React.SetStateAction<Map<string, NodeExecStatus>>>;
  isExecuting: boolean;
  setIsExecuting: (v: boolean) => void;
  getNodeStatus: (nodeId: string) => NodeExecStatus | undefined;
}

const ExecutionStatusContext = createContext<ExecutionStatusContextValue | null>(null);

export function ExecutionStatusProvider({ children }: { children: ReactNode }) {
  const [nodeStatuses, setNodeStatuses] = useState<Map<string, NodeExecStatus>>(new Map());
  const [isExecuting, setIsExecuting] = useState(false);

  const getNodeStatus = useCallback((nodeId: string) => {
    return nodeStatuses.get(nodeId);
  }, [nodeStatuses]);

  return (
    <ExecutionStatusContext.Provider value={{ nodeStatuses, setNodeStatuses, isExecuting, setIsExecuting, getNodeStatus }}>
      {children}
    </ExecutionStatusContext.Provider>
  );
}

export function useExecutionStatus() {
  const ctx = useContext(ExecutionStatusContext);
  if (!ctx) throw new Error('useExecutionStatus must be used within ExecutionStatusProvider');
  return ctx;
}
