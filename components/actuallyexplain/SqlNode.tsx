import { useContext } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Database,
  Link,
  Filter,
  ArrowUpDown,
  Trash2,
  Scissors,
  ArrowLeftFromLine,
  Settings,
  Columns3,
  Crosshair,
  Braces,
  type LucideIcon,
  SquaresUnite,
  Group,
  Repeat2,
  BetweenHorizonalStart,
  SquarePen,
  SquarePlus,
  Cog,
  Replace,
  SquareDashedMousePointer,
  Info,
} from 'lucide-react';
import { NodeActionsContext } from './NodeActionsContext';

export const kindIcons: Record<string, LucideIcon> = {
  table: Database,
  insert_target: Database,
  join: Link,
  where: Filter,
  having: Filter,
  select: SquareDashedMousePointer,
  groupby: Group,
  orderby: ArrowUpDown,
  limit: Scissors,
  cte: Repeat2,
  union: SquaresUnite,
  values: Braces,
  insert: BetweenHorizonalStart,
  update: SquarePen,
  delete: Trash2,
  create: SquarePlus,
  column: Columns3,
  set: Replace,
  returning: ArrowLeftFromLine,
  operation: Cog,
  target: Crosshair,
};

export default function SqlNode({ id, data }: NodeProps) {
  const kind = (data.kind as string) ?? 'operation';
  const Icon = kindIcons[kind] ?? kindIcons.operation ?? Settings;
  const { openDetails } = useContext(NodeActionsContext);

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-0 !h-0 !min-w-0 !min-h-0 !opacity-0 !pointer-events-none !bg-transparent !border-none" />
      <div
        className="flex flex-col min-w-0 p-0 rounded-lg overflow-hidden border-2"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '1rem',
          background: 'var(--bg-200)',
          color: 'var(--text-100)',
          borderColor: 'var(--node-color, var(--border-300))',
        }}
      >
        <div
          className="flex items-center gap-1 min-w-0 px-3 py-0"
          style={{ color: 'var(--node-color, var(--neon-color))' }}
        >
          <Icon size={16} />
          <span
            className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ fontSize: '0.625rem', fontWeight: 475 }}
          >
            {data.label as string}
          </span>
          <button
            className="flex shrink-0 justify-center items-center p-3 rounded cursor-pointer border-none transition-colors"
            style={{ fontSize: '1rem', color: 'var(--text-400)', background: 'transparent' }}
            title="Open details panel"
            onClick={(e) => { e.stopPropagation(); openDetails(id); }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-100)'; e.currentTarget.style.background = 'var(--bg-300)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-400)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Info size={16} />
          </button>
        </div>
        <p
          className="px-3 pb-3 m-0"
          style={{ fontSize: '0.75rem', fontWeight: 325, color: 'var(--text-100)' }}
        >
          {data.plainEnglish as string}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-0 !h-0 !min-w-0 !min-h-0 !opacity-0 !pointer-events-none !bg-transparent !border-none" />
    </>
  );
}
