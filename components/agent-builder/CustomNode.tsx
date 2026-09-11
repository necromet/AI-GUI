import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_DEFINITIONS } from './constants';
import type { WorkflowNodeType } from './types';
import { Circle } from 'lucide-react';
import { ICON_MAP } from './shared/icons';

function CustomNodeInner({ data, id }: NodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const nodeType = (data?.nodeType || 'agent') as WorkflowNodeType;
  const def = NODE_DEFINITIONS[nodeType];
  const color = data?.color || def?.color || '#6b7280';
  const iconKey = data?.icon || def?.icon || 'circle';
  const IconComponent = ICON_MAP[iconKey] || Circle;
  const label = data?.label || def?.label || nodeType;

  const isStart = nodeType === 'start';
  const isEnd = nodeType === 'end';
  const isIfElse = nodeType === 'if-else';
  const isWhile = nodeType === 'while';
  const isNote = nodeType === 'note';

  return (
    <div
      className="relative min-w-[160px] rounded-lg border shadow-lg transition-all"
      style={{
        borderColor: isHovered ? `${color}70` : `${color}40`,
        backgroundColor: 'var(--bg-100, #1a1a2e)',
        boxShadow: isHovered ? `0 0 24px ${color}35, 0 0 8px ${color}25` : `0 0 12px ${color}15`,
        transform: isHovered ? 'scale(1.03)' : 'scale(1)',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!isStart && !isNote && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !border-2"
          style={{ borderColor: color, backgroundColor: 'var(--bg-100, #1a1a2e)' }}
        />
      )}

      <div className="px-3 py-2 flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          <IconComponent size={14} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-100, #e5e5e5)' }}>
            {label}
          </div>
          {nodeType !== 'start' && nodeType !== 'end' && (
            <div className="mt-0.5">
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {def?.category?.toUpperCase() || nodeType}
              </span>
            </div>
          )}
          {data?.model && (
            <div className="text-[10px] truncate" style={{ color: 'var(--text-500, #666)' }}>
              {data.model}
            </div>
          )}
          {data?.condition && (
            <div className="text-[10px] truncate font-mono" style={{ color: 'var(--text-500, #666)' }}>
              {data.condition}
            </div>
          )}
          {data?.url && (
            <div className="text-[10px] truncate" style={{ color: 'var(--text-500, #666)' }}>
              {data.method || 'GET'} {data.url}
            </div>
          )}
          {data?.message && nodeType === 'user-approval' && (
            <div className="text-[10px] truncate" style={{ color: 'var(--text-500, #666)' }}>
              {data.message}
            </div>
          )}
        </div>
      </div>

      {!isEnd && !isNote && isHovered && (
        <button
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center z-10 cursor-pointer transition-all hover:scale-110"
          style={{ backgroundColor: 'var(--neon-color)', color: '#000', fontSize: '10px', lineHeight: 1 }}
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('ab-quick-add', { detail: { sourceId: id, x: e.clientX, y: e.clientY } }));
          }}
        >
          +
        </button>
      )}

      {!isEnd && !isNote && (
        <>
          {isIfElse ? (
            <>
              <Handle
                type="source"
                position={Position.Right}
                id="if"
                className="!w-3 !h-3 !border-2 !top-[30%]"
                style={{ borderColor: '#34d399', backgroundColor: 'var(--bg-100, #1a1a2e)' }}
              />
              <Handle
                type="source"
                position={Position.Right}
                id="else"
                className="!w-3 !h-3 !border-2 !top-[70%]"
                style={{ borderColor: '#f87171', backgroundColor: 'var(--bg-100, #1a1a2e)' }}
              />
              <div className="absolute -right-8 top-[25%] text-[9px] text-green-400">T</div>
              <div className="absolute -right-8 top-[65%] text-[9px] text-red-400">F</div>
            </>
          ) : isWhile ? (
            <>
              <Handle
                type="source"
                position={Position.Right}
                id="continue"
                className="!w-3 !h-3 !border-2 !top-[30%]"
                style={{ borderColor: '#c084fc', backgroundColor: 'var(--bg-100, #1a1a2e)' }}
              />
              <Handle
                type="source"
                position={Position.Right}
                id="break"
                className="!w-3 !h-3 !border-2 !top-[70%]"
                style={{ borderColor: '#fbbf24', backgroundColor: 'var(--bg-100, #1a1a2e)' }}
              />
              <div className="absolute -right-12 top-[25%] text-[9px] text-purple-400">loop</div>
              <div className="absolute -right-10 top-[65%] text-[9px] text-yellow-400">exit</div>
            </>
          ) : (
            <Handle
              type="source"
              position={Position.Right}
              className="!w-3 !h-3 !border-2"
              style={{ borderColor: color, backgroundColor: 'var(--bg-100, #1a1a2e)' }}
            />
          )}
        </>
      )}

      {isNote && (
        <div
          className="absolute inset-0 rounded-lg opacity-10 pointer-events-none"
          style={{ backgroundColor: color }}
        />
      )}
    </div>
  );
}

export default memo(CustomNodeInner);
