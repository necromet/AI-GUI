import { useState } from 'react';
import { NODE_CATEGORIES, NODE_DEFINITIONS } from './constants';
import type { WorkflowNodeType } from './types';
import { Circle, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { ICON_MAP } from './shared/icons';

export default function WorkflowSidebar() {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const onDragStart = (event: React.DragEvent, nodeType: WorkflowNodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const toggleCategory = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const searchLower = search.toLowerCase();

  return (
    <div className="w-56 border-r flex flex-col overflow-y-auto flex-shrink-0" style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100)' }}>
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-500)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search nodes..."
            className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-md border bg-transparent"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          />
        </div>
      </div>

      {NODE_CATEGORIES.map((cat) => {
        const filteredTypes = cat.types.filter(type => {
          if (!search) return true;
          const def = NODE_DEFINITIONS[type];
          return def.label.toLowerCase().includes(searchLower) || def.description.toLowerCase().includes(searchLower);
        });
        if (filteredTypes.length === 0) return null;

        const isCollapsed = collapsed.has(cat.id);

        return (
          <div key={cat.id} className="mb-1">
            <button
              onClick={() => toggleCategory(cat.id)}
              className="flex items-center justify-between w-full px-3 py-1.5 cursor-pointer"
              style={{ color: 'var(--text-500)' }}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider">{cat.label}</span>
              {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
            </button>
            {!isCollapsed && (
              <div className="flex flex-col gap-0.5 px-1 pb-1">
                {filteredTypes.map((type) => {
                  const def = NODE_DEFINITIONS[type];
                  const Icon = ICON_MAP[def.icon] || Circle;
                  return (
                    <div
                      key={type}
                      className="group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-all"
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
                        style={{ background: `${def.color}20` }}
                      >
                        <Icon size={10} style={{ color: def.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-medium block">{def.label}</span>
                        <span className="text-[9px] block truncate opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-500)' }}>
                          {def.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
