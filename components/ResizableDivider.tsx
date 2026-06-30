import React, { useCallback, useRef } from 'react';
import { GripVertical, ChevronLeft } from 'lucide-react';

interface ResizableDividerProps {
  onResize: (leftPercent: number) => void;
  onCollapse: () => void;
  isCollapsed: boolean;
}

const ResizableDivider: React.FC<ResizableDividerProps> = ({ onResize, onCollapse, isCollapsed }) => {
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const container = containerRef.current?.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(Math.max(percent, 30), 70);
      onResize(clamped);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize]);

  const handleDoubleClick = useCallback(() => {
    onResize(50);
  }, [onResize]);

  return (
    <div
      ref={containerRef}
      className="relative flex-shrink-0 flex items-center justify-center group cursor-col-resize"
      style={{ width: '12px' }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="absolute inset-y-0 w-px transition-colors duration-200"
        style={{ backgroundColor: 'var(--border-300)' }}
      />
      <div
        className="absolute inset-y-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{
          backgroundColor: 'rgba(var(--neon-rgb), 0.3)',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
      <div
        className="relative z-10 flex items-center justify-center w-6 h-10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ backgroundColor: 'var(--bg-300)' }}
      >
        <GripVertical size={12} style={{ color: 'var(--text-500)' }} />
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onCollapse(); }}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
        style={{
          backgroundColor: 'var(--bg-300)',
          color: 'var(--text-500)',
        }}
        title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
      >
        <ChevronLeft
          size={12}
          style={{
            transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>
    </div>
  );
};

export default ResizableDivider;
