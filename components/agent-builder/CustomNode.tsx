import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_DEFINITIONS, DEFAULT_NODE_COLOR } from './constants';
import type { WorkflowNodeType } from './types';
import { Circle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { ICON_MAP } from './shared/icons';
import { NODE_COLORS, STATUS_COLORS, HTTP_METHOD_COLORS } from './shared/colors';
import { useExecutionStatus } from './ExecutionStatusContext';

const HINTS: Partial<Record<WorkflowNodeType, string>> = {
  agent: 'Click to set model & prompt',
  'if-else': 'Click to set condition',
  while: 'Click to set condition',
  http: 'Click to set URL',
  transform: 'Click to set code',
  'set-state': 'Click to set variables',
  extract: 'Click to set fields',
  mcp: 'Click to configure tool',
  'user-approval': 'Click to set message',
};

function CustomNodeInner({ data, id }: NodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const { getNodeStatus } = useExecutionStatus();
  const execStatus = getNodeStatus(id);

  const nodeType = (data?.nodeType || 'agent') as WorkflowNodeType;
  const def = NODE_DEFINITIONS[nodeType];
  const color = data?.color || def?.color || DEFAULT_NODE_COLOR;
  const iconKey = data?.icon || def?.icon || 'circle';
  const IconComponent = ICON_MAP[iconKey] || Circle;
  const label = data?.label || def?.label || nodeType;

  const isStart = nodeType === 'start';
  const isEnd = nodeType === 'end';
  const isIfElse = nodeType === 'if-else';
  const isWhile = nodeType === 'while';
  const isNote = nodeType === 'note';

  const hint = HINTS[nodeType];
  const isUnconfigured = hint && !isConfigured(nodeType, data);

  const execBorderColor = execStatus?.status === 'running' ? STATUS_COLORS.running : execStatus?.status === 'completed' ? STATUS_COLORS.completed : execStatus?.status === 'failed' ? STATUS_COLORS.failed : undefined;

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditLabel(label);
    setIsEditing(true);
  }, [label]);

  const handleLabelSubmit = useCallback(() => {
    setIsEditing(false);
    if (editLabel.trim() && editLabel !== label) {
      window.dispatchEvent(new CustomEvent('ab-rename-node', { detail: { nodeId: id, label: editLabel.trim() } }));
    }
  }, [editLabel, label, id]);

  return (
    <div
      className="relative min-w-[160px] rounded-lg border shadow-lg ab-node-enter"
      style={{
        borderColor: execBorderColor || (isHovered ? `${color}70` : `${color}40`),
        backgroundColor: 'var(--bg-100, #1a1a2e)',
        boxShadow: execStatus?.status === 'running'
          ? `0 0 20px ${color}50, 0 0 8px ${color}30, inset 0 0 12px ${color}10`
          : isHovered
            ? `0 0 24px ${color}35, 0 0 8px ${color}25`
            : `0 0 12px ${color}15`,
        transform: isHovered ? 'scale(1.03)' : 'scale(1)',
        transition: 'all 0.15s ease',
        ...(execStatus?.status === 'running' ? { animation: 'ab-node-enter 0.15s ease-out, ab-pulse-border 1.5s ease-in-out 0.15s infinite' } : {}),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
    >
      {!isNote && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            className="!w-3 !h-3 !border-2"
            style={{ borderColor: color, backgroundColor: 'var(--bg-100, #1a1a2e)' }}
          />
          {!isStart && (
            <Handle
              type="source"
              position={Position.Left}
              id="left-source"
              className="!w-3 !h-3 !border-2 !opacity-0"
              style={{ borderColor: color, backgroundColor: 'var(--bg-100, #1a1a2e)' }}
            />
          )}
        </>
      )}

      <div className="px-3 py-2 flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 relative"
          style={{ backgroundColor: `${color}20` }}
        >
          <IconComponent size={14} style={{ color }} />
          {execStatus?.status === 'running' && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-200" style={{ backgroundColor: 'var(--bg-100, #1a1a2e)' }}>
              <Loader2 size={9} className="animate-spin" style={{ color: STATUS_COLORS.running }} />
            </div>
          )}
          {execStatus?.status === 'completed' && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-200" style={{ backgroundColor: 'var(--bg-100, #1a1a2e)' }}>
              <CheckCircle2 size={9} style={{ color: STATUS_COLORS.completed }} />
            </div>
          )}
          {execStatus?.status === 'failed' && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-200" style={{ backgroundColor: 'var(--bg-100, #1a1a2e)' }}>
              <XCircle size={9} style={{ color: STATUS_COLORS.failed }} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              onBlur={handleLabelSubmit}
              onKeyDown={e => { if (e.key === 'Enter') handleLabelSubmit(); if (e.key === 'Escape') setIsEditing(false); }}
              className="text-[13px] font-semibold bg-transparent border-b outline-none w-full"
              style={{ color: 'var(--text-100)', borderColor: color }}
              autoFocus
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-100, #e5e5e5)' }}>
              {label}
            </div>
          )}
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
            <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-500, #666)' }}>
              {typeof data.model === 'string' ? data.model.split('/').pop() : data.model}
            </div>
          )}
          {data?.condition && (
            <div className="text-[10px] truncate font-mono mt-0.5" style={{ color: 'var(--text-500, #666)' }}>
              {String(data.condition).slice(0, 30)}{String(data.condition).length > 30 ? '...' : ''}
            </div>
          )}
          {data?.url && (
            <div className="text-[10px] truncate mt-0.5 flex items-center gap-1">
              <span className="px-1 rounded text-[8px] font-bold" style={{ backgroundColor: (HTTP_METHOD_COLORS[data.method || 'GET'] || HTTP_METHOD_COLORS.GET).bg, color: (HTTP_METHOD_COLORS[data.method || 'GET'] || HTTP_METHOD_COLORS.GET).text }}>
                {data.method || 'GET'}
              </span>
              <span style={{ color: 'var(--text-500, #666)' }} className="truncate">{data.url}</span>
            </div>
          )}
          {data?.message && nodeType === 'user-approval' && (
            <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-500, #666)' }}>
              {data.message}
            </div>
          )}
          {data?.maxIterations && isWhile && (
            <div className="text-[10px] mt-0.5">
              <span className="px-1 rounded text-[8px]" style={{ backgroundColor: NODE_COLORS.while + '15', color: NODE_COLORS.while }}>
                max {data.maxIterations} iterations
              </span>
            </div>
          )}
          {data?.code && nodeType === 'transform' && (
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-500, #666)' }}>
              {String(data.code).split('\n').length} lines
            </div>
          )}
          {isUnconfigured && !execStatus && (
            <div className="text-[9px] mt-0.5 italic" style={{ color: `${color}80` }}>
              {hint}
            </div>
          )}
        </div>
      </div>

      {!isEnd && !isNote && !isIfElse && !isWhile && isHovered && (
        <button
          className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center z-10 cursor-pointer transition-all hover:scale-110"
          style={{ backgroundColor: 'var(--neon-color)', color: '#000', fontSize: '10px', lineHeight: 1 }}
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('ab-quick-add', { detail: { sourceId: id, x: e.clientX, y: e.clientY } }));
          }}
        >
          +
        </button>
      )}

      {!isNote && (
        <>
          {isIfElse ? (
            <>
              <Handle type="source" position={Position.Right} id="if" className="!w-3 !h-3 !border-2 !top-[30%]" style={{ borderColor: NODE_COLORS.start, backgroundColor: 'var(--bg-100, #1a1a2e)' }} />
              <Handle type="target" position={Position.Right} id="if-in" className="!w-3 !h-3 !border-2 !top-[30%] !opacity-0" style={{ borderColor: NODE_COLORS.start, backgroundColor: 'var(--bg-100, #1a1a2e)' }} />
              <Handle type="source" position={Position.Right} id="else" className="!w-3 !h-3 !border-2 !top-[70%]" style={{ borderColor: NODE_COLORS.end, backgroundColor: 'var(--bg-100, #1a1a2e)' }} />
              <Handle type="target" position={Position.Right} id="else-in" className="!w-3 !h-3 !border-2 !top-[70%] !opacity-0" style={{ borderColor: NODE_COLORS.end, backgroundColor: 'var(--bg-100, #1a1a2e)' }} />
              <div className="absolute -right-9 top-[28%] text-[9px] text-green-400">T</div>
              <div className="absolute -right-9 top-[68%] text-[9px] text-red-400">F</div>
            </>
          ) : isWhile ? (
            <>
              <Handle type="source" position={Position.Right} id="continue" className="!w-3 !h-3 !border-2 !top-[30%]" style={{ borderColor: NODE_COLORS.while, backgroundColor: 'var(--bg-100, #1a1a2e)' }} />
              <Handle type="target" position={Position.Right} id="continue-in" className="!w-3 !h-3 !border-2 !top-[30%] !opacity-0" style={{ borderColor: NODE_COLORS.while, backgroundColor: 'var(--bg-100, #1a1a2e)' }} />
              <Handle type="source" position={Position.Right} id="break" className="!w-3 !h-3 !border-2 !top-[70%]" style={{ borderColor: NODE_COLORS.mcp, backgroundColor: 'var(--bg-100, #1a1a2e)' }} />
              <Handle type="target" position={Position.Right} id="break-in" className="!w-3 !h-3 !border-2 !top-[70%] !opacity-0" style={{ borderColor: NODE_COLORS.mcp, backgroundColor: 'var(--bg-100, #1a1a2e)' }} />
              <div className="absolute -right-9 top-[28%] text-[9px] text-purple-400">loop</div>
              <div className="absolute -right-9 top-[68%] text-[9px] text-yellow-400">exit</div>
            </>
          ) : (
            <>
              <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2" style={{ borderColor: color, backgroundColor: 'var(--bg-100, #1a1a2e)' }} />
              <Handle type="target" position={Position.Right} id="right-target" className="!w-3 !h-3 !border-2 !opacity-0" style={{ borderColor: color, backgroundColor: 'var(--bg-100, #1a1a2e)' }} />
            </>
          )}
        </>
      )}

      {isEnd && !isNote && (
        <Handle
          type="source"
          position={Position.Left}
          id="end-source"
          className="!w-3 !h-3 !border-2 !opacity-0"
          style={{ borderColor: color, backgroundColor: 'var(--bg-100, #1a1a2e)' }}
        />
      )}

      {isNote && (
        <div className="absolute inset-0 rounded-lg opacity-10 pointer-events-none" style={{ backgroundColor: color }} />
      )}

      {execStatus?.status === 'running' && (
        <div className="absolute inset-0 rounded-lg pointer-events-none ab-node-running-ring" style={{ borderColor: color }} />
      )}
    </div>
  );
}

function isConfigured(nodeType: WorkflowNodeType, data: Record<string, any>): boolean {
  switch (nodeType) {
    case 'agent': return !!(data.model && (data.userPrompt || data.systemPrompt));
    case 'http': return !!(data.url || data.httpUrl);
    case 'if-else': return !!(data.condition);
    case 'while': return !!(data.condition);
    case 'transform': return !!(data.code || data.transformScript) && (data.code || data.transformScript) !== 'return input;';
    case 'set-state': return !!(data.variables && Object.keys(data.variables).length > 0);
    case 'extract': return !!(data.fields && data.fields.length > 0);
    case 'mcp': return !!(data.toolName);
    case 'user-approval': return !!(data.message) && data.message !== 'Approve to continue?';
    default: return true;
  }
}

export default memo(CustomNodeInner);
