import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered,
  CheckSquare, ChevronRight, Code2, Lightbulb, Quote, Minus,
  Image as ImageIcon,
} from 'lucide-react';

interface SlashMenuItem {
  title: string;
  description: string;
  icon: string;
  command: string;
  attrs?: Record<string, unknown>;
}

interface SlashMenuViewProps {
  items: SlashMenuItem[];
  command: (item: SlashMenuItem) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Type: <Type size={16} />,
  Heading1: <Heading1 size={16} />,
  Heading2: <Heading2 size={16} />,
  Heading3: <Heading3 size={16} />,
  List: <List size={16} />,
  ListOrdered: <ListOrdered size={16} />,
  CheckSquare: <CheckSquare size={16} />,
  ChevronRight: <ChevronRight size={16} />,
  Code2: <Code2 size={16} />,
  Lightbulb: <Lightbulb size={16} />,
  Quote: <Quote size={16} />,
  Minus: <Minus size={16} />,
  Image: <ImageIcon size={16} />,
};

export const SlashMenuView = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  SlashMenuViewProps
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) command(item);
    },
    [items, command]
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
        return true;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return true;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div
        ref={containerRef}
        className="w-72 rounded-xl border p-3 animate-dropdown-in"
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          backgroundColor: 'rgba(var(--bg-100-rgb, 255, 255, 255), 0.92)',
          borderColor: 'rgba(var(--neon-rgb), 0.15)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(var(--neon-rgb), 0.06)',
        }}
      >
        <div className="text-sm px-2" style={{ color: 'var(--text-500)' }}>
          No results
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-72 max-h-80 overflow-y-auto rounded-xl border animate-dropdown-in"
      style={{
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        backgroundColor: 'rgba(var(--bg-100-rgb, 255, 255, 255), 0.92)',
        borderColor: 'rgba(var(--neon-rgb), 0.15)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(var(--neon-rgb), 0.06)',
      }}
    >
      <div className="p-1.5">
        <div
          className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-500)' }}
        >
          Blocks
        </div>
        {items.map((item, idx) => (
          <button
            key={item.title}
            ref={(el) => { itemRefs.current[idx] = el; }}
            type="button"
            onClick={() => selectItem(idx)}
            className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer"
            style={{
              backgroundColor:
                idx === selectedIndex
                  ? 'rgba(var(--neon-rgb), 0.08)'
                  : 'transparent',
              borderLeft:
                idx === selectedIndex
                  ? '2px solid var(--neon-color)'
                  : '2px solid transparent',
            }}
            onMouseEnter={(e) => {
              if (idx !== selectedIndex) {
                e.currentTarget.style.backgroundColor = 'var(--bg-200)';
              }
            }}
            onMouseLeave={(e) => {
              if (idx !== selectedIndex) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150"
              style={{
                backgroundColor:
                  idx === selectedIndex
                    ? 'rgba(var(--neon-rgb), 0.15)'
                    : 'var(--bg-200)',
                color:
                  idx === selectedIndex
                    ? 'var(--neon-color)'
                    : 'var(--text-400)',
                boxShadow:
                  idx === selectedIndex
                    ? '0 0 8px rgba(var(--neon-rgb), 0.1)'
                    : 'none',
              }}
            >
              {ICON_MAP[item.icon] || <Type size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium" style={{ color: 'var(--text-100)' }}>
                {item.title}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-500)' }}>
                {item.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

SlashMenuView.displayName = 'SlashMenuView';
