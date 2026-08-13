import React, { useRef, useState, useEffect, type ReactNode } from 'react';

export interface SlidingGroupItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface SlidingGroupProps {
  items: SlidingGroupItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  direction?: 'vertical' | 'horizontal';
  className?: string;
  style?: React.CSSProperties;
  indicatorClassName?: string;
  indicatorStyle?: React.CSSProperties;
  renderItem?: (item: SlidingGroupItem, isActive: boolean) => ReactNode;
}

export const SlidingGroup: React.FC<SlidingGroupProps> = ({
  items,
  activeKey,
  onSelect,
  direction = 'vertical',
  className,
  style,
  indicatorClassName,
  indicatorStyle,
  renderItem,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<number, HTMLElement>>(new Map());
  const [indicator, setIndicator] = useState({ offset: 0, size: 0 });

  const activeIndex = items.findIndex((i) => i.key === activeKey);
  const isVertical = direction === 'vertical';

  useEffect(() => {
    const btn = buttonRefs.current.get(activeIndex);
    const container = containerRef.current;
    if (!btn || !container) return;

    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();

    if (isVertical) {
      setIndicator({
        offset: btnRect.top - containerRect.top,
        size: btnRect.height,
      });
    } else {
      setIndicator({
        offset: btnRect.left - containerRect.left,
        size: btnRect.width,
      });
    }
  }, [activeIndex, isVertical]);

  const defaultIndicatorStyle: React.CSSProperties = isVertical
    ? {
        top: indicator.offset,
        height: indicator.size,
        left: 4,
        right: 4,
      }
    : {
        left: indicator.offset,
        width: indicator.size,
        top: 4,
        bottom: 4,
      };

  return (
    <div
      ref={containerRef}
      className={`relative ${isVertical ? 'flex flex-col' : 'flex'} ${className ?? ''}`}
      style={style}
    >
      <div
        className={`absolute rounded-xl pointer-events-none ${indicatorClassName ?? ''}`}
        style={{
          ...defaultIndicatorStyle,
          backgroundColor: 'var(--bg-100)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          transition:
            'top 0.3s cubic-bezier(0.16, 1, 0.3, 1), left 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s ease, width 0.25s ease',
          zIndex: 0,
          ...indicatorStyle,
        }}
      />
      {items.map((item, index) => {
        const isActive = activeKey === item.key;
        return (
          <div key={item.key} className="relative z-[1]">
            {renderItem ? (
              <div
                ref={(el) => {
                  if (el) buttonRefs.current.set(index, el);
                }}
                onClick={() => onSelect(item.key)}
              >
                {renderItem(item, isActive)}
              </div>
            ) : (
              <button
                ref={(el) => {
                  if (el) buttonRefs.current.set(index, el);
                }}
                onClick={() => onSelect(item.key)}
                className={item.className}
                style={item.style}
              >
                {item.icon}
                {item.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
