import { NODE_CATEGORIES, NODE_DEFINITIONS } from './constants';
import type { WorkflowNodeType } from './types';

export default function WorkflowSidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: WorkflowNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-56 border-r flex flex-col overflow-y-auto py-3 px-2 flex-shrink-0" style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100)' }}>
      <div className="px-2 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>Nodes</h3>
      </div>

      {NODE_CATEGORIES.map((cat) => (
        <div key={cat.id} className="mb-3">
          <div className="px-2 mb-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-500)' }}>{cat.label}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {cat.types.map((type) => {
              const def = NODE_DEFINITIONS[type];
              return (
                <div
                  key={type}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-colors"
                  style={{ color: 'var(--text-300)' }}
                  draggable
                  onDragStart={(e) => onDragStart(e, type)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-200)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title={def.description}
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: `${def.color}20`, color: def.color }}
                  >
                    <span className="text-[9px] font-bold">{def.label.charAt(0)}</span>
                  </div>
                  <span className="text-xs">{def.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
