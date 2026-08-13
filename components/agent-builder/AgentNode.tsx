import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Bot, Info } from 'lucide-react';

function AgentNodeInner({ data, selected }: NodeProps) {
  const color = (data.color as string) || '#5ABDAC';
  const name = (data.name as string) || 'Agent';
  const systemPrompt = (data.systemPrompt as string) || '';
  const model = (data.model as string) || '';
  const toolCount = (data.toolCount as number) || 0;

  return (
    <>
      <Handle type="target" position={Position.Top} className="ab-handle" />
      <div
        className="ab-node ab-agent-node"
        style={{ borderColor: color, boxShadow: selected ? `0 0 16px 6px ${color}66` : undefined }}
      >
        <div className="ab-node-header" style={{ color }}>
          <Bot size={16} />
          <span className="ab-node-title">{name}</span>
          <button
            className="ab-node-info"
            title="Edit agent"
            onClick={(e) => { e.stopPropagation(); (data as any).onOpenDetail?.(data.id); }}
          >
            <Info size={14} />
          </button>
        </div>
        <p className="ab-node-body">
          {systemPrompt ? systemPrompt.substring(0, 80) + (systemPrompt.length > 80 ? '...' : '') : 'No system prompt'}
        </p>
        <div className="ab-node-meta">
          {model} · {toolCount} tool{toolCount !== 1 ? 's' : ''}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="ab-handle" />
    </>
  );
}

export const AgentNode = memo(AgentNodeInner);
