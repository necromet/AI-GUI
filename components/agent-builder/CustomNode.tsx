import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Play, Square, Bot, Wrench, GitBranch, Repeat,
  UserCheck, Code, FileText, Globe, StickyNote
} from 'lucide-react';

const ICONS: Record<string, any> = {
  start: Play, end: Square, agent: Bot, mcp: Wrench,
  'if-else': GitBranch, while: Repeat, 'user-approval': UserCheck,
  transform: Code, extract: FileText, http: Globe, note: StickyNote,
};

function CustomNode({ data, selected }: NodeProps) {
  const { nodeType, label, color, executing, completed, failed } = data as any;
  const Icon = ICONS[nodeType as string] || Bot;

  const borderColor = executing
    ? '#e4a853'
    : failed
    ? '#f87171'
    : completed
    ? '#34d399'
    : selected
    ? color
    : 'rgba(255,255,255,0.08)';

  return (
    <div
      className="relative min-w-[140px] rounded-lg border-2 transition-all duration-300"
      style={{
        borderColor,
        boxShadow: executing
          ? `0 0 20px ${color}40`
          : completed
          ? `0 0 15px #34d39930`
          : 'none',
        background: '#111114',
      }}
    >
      {nodeType !== 'start' && nodeType !== 'note' && (
        <Handle type="target" position={Position.Left} className="!bg-[#2a2a30] !w-3 !h-3" />
      )}

      <div className="flex items-center gap-2 px-3 py-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}20`, color }}
        >
          <Icon size={14} />
        </div>
        <span className="text-xs font-medium text-[#e4e4e8] truncate">
          {String(label)}
        </span>
      </div>

      {nodeType !== 'end' && nodeType !== 'note' && (
        <Handle
          type="source"
          position={Position.Right}
          id={nodeType === 'if-else' ? 'if' : nodeType === 'while' ? 'continue' : undefined}
          className="!bg-[#2a2a30] !w-3 !h-3"
        />
      )}

      {(nodeType === 'if-else' || nodeType === 'while') && (
        <Handle
          type="source"
          position={Position.Right}
          id={nodeType === 'if-else' ? 'else' : 'break'}
          className="!bg-[#2a2a30] !w-3 !h-3"
          style={{ top: '70%' }}
        />
      )}
    </div>
  );
}

export default memo(CustomNode);
