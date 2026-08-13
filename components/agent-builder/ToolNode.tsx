import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Wrench, Info } from 'lucide-react';

function ToolNodeInner({ data, selected }: NodeProps) {
  const color = (data.color as string) || '#66A0C8';
  const name = (data.name as string) || 'Tool';
  const description = (data.description as string) || '';
  const paramCount = Object.keys((data.parameters as Record<string, any>) || {}).length;

  return (
    <>
      <Handle type="target" position={Position.Top} className="ab-handle" />
      <div
        className="ab-node ab-tool-node"
        style={{ borderColor: color, boxShadow: selected ? `0 0 16px 6px ${color}66` : undefined }}
      >
        <div className="ab-node-header" style={{ color }}>
          <Wrench size={16} />
          <span className="ab-node-title">{name}</span>
          <button
            className="ab-node-info"
            title="Edit tool"
            onClick={(e) => { e.stopPropagation(); (data as any).onOpenDetail?.(data.id); }}
          >
            <Info size={14} />
          </button>
        </div>
        <p className="ab-node-body">
          {description.substring(0, 80)}{description.length > 80 ? '...' : ''}
        </p>
        <div className="ab-node-meta">
          {paramCount} parameter{paramCount !== 1 ? 's' : ''}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="ab-handle" />
    </>
  );
}

export const ToolNode = memo(ToolNodeInner);
