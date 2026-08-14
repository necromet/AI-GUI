import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ArrowUpDown, ArrowLeftRight, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { GridComponent, GridPos, GridBounds, ResolutionConfig, SectionType } from './types';
import { COLORS, SECTION_TYPES, ROWS } from './constants';
import { MockContent } from './MockContent';
import { detectType } from './utils';

interface CanvasGridProps {
  components: GridComponent[];
  resolution: ResolutionConfig;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, dc: number, dr: number) => void;
  onRemove: (id: string) => void;
  onRegenerate: (id: string) => void;
  onPlace: (bounds: GridBounds, type: SectionType, prompt: string) => void;
  onCursorChange?: (pos: GridPos | null) => void;
}

export const CanvasGrid: React.FC<CanvasGridProps> = ({
  components,
  resolution,
  selectedId,
  onSelect,
  onMove,
  onRemove,
  onRegenerate,
  onPlace,
  onCursorChange,
}) => {
  const { cols, cellW, cellH } = resolution;
  const canvasWidth = cols * cellW;
  const canvasHeight = ROWS * cellH;
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [drawing, setDrawing] = useState(false);
  const [dStart, setDStart] = useState<GridPos | null>(null);
  const [dEnd, setDEnd] = useState<GridPos | null>(null);
  const [hoverPos, setHoverPos] = useState<GridPos | null>(null);
  const [promptBar, setPromptBar] = useState<{ bounds: GridBounds; visible: boolean } | null>(null);
  const [promptInput, setPromptInput] = useState('');
  const promptInputRef = useRef<HTMLInputElement>(null);

  const gx = useCallback((col: number) => (col - 1) * cellW, [cellW]);
  const gy = useCallback((row: number) => (row - 1) * cellH, [cellH]);

  const gridPos = useCallback(
    (e: React.MouseEvent): GridPos => {
      if (!canvasRef.current) return { col: 1, row: 1 };
      const r = canvasRef.current.getBoundingClientRect();
      const bw = canvasRef.current.clientLeft;
      const x = e.clientX - r.left - bw;
      const y = e.clientY - r.top - bw - 26;
      return {
        col: Math.max(1, Math.min(cols, Math.floor(x / cellW) + 1)),
        row: Math.max(1, Math.min(ROWS, Math.floor(y / cellH) + 1)),
      };
    },
    [cols, cellW, cellH]
  );

  const overlap = useCallback(
    (c1: number, r1: number, c2: number, r2: number, exId?: string) =>
      components.some((c) => {
        if (c.id === exId) return false;
        return !(c2 < c.cs || c1 > c.ce || r2 < c.rs || r1 > c.re);
      }),
    [components]
  );

  const bounds = useCallback((s: GridPos, e: GridPos): GridBounds => ({
    c1: Math.min(s.col, e.col),
    c2: Math.max(s.col, e.col),
    r1: Math.min(s.row, e.row),
    r2: Math.max(s.row, e.row),
  }), []);

  const selBounds = useMemo(() => {
    if (!dStart || !dEnd) return null;
    return bounds(dStart, dEnd);
  }, [dStart, dEnd, bounds]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.canvas-comp') || (e.target as HTMLElement).closest('.canvas-prompt-bar')) return;
      if ((e.target as HTMLElement).closest('[role="dialog"], [data-radix-popper-content-wrapper], [data-portal]')) return;
      const p = gridPos(e);
      setDrawing(true);
      setDStart(p);
      setDEnd(p);
      setHoverPos(null);
      setPromptBar(null);
      onSelect(null);
    },
    [gridPos, onSelect]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const p = gridPos(e);
      if (!drawing) {
        setHoverPos(p);
        onCursorChange?.(p);
      } else {
        setHoverPos(null);
        setDEnd(p);
      }
    },
    [drawing, gridPos, onCursorChange]
  );

  const handleMouseUp = useCallback(() => {
    setDrawing(false);
    if (selBounds) {
      if (overlap(selBounds.c1, selBounds.r1, selBounds.c2, selBounds.r2)) {
        toast.error('Selection overlaps an existing component');
        setDStart(null);
        setDEnd(null);
      } else {
        setPromptBar({ bounds: selBounds, visible: true });
        setTimeout(() => promptInputRef.current?.focus(), 50);
      }
    }
  }, [selBounds, overlap]);

  const handleMouseLeave = useCallback(() => {
    setHoverPos(null);
    onCursorChange?.(null);
  }, [onCursorChange]);

  const confirmGenerate = useCallback(() => {
    if (!promptBar) return;
    const prompt = promptInput.trim() || 'Component';
    const type = detectType(prompt);
    onPlace(promptBar.bounds, type, prompt);
    setPromptBar(null);
    setPromptInput('');
    setDStart(null);
    setDEnd(null);
  }, [promptBar, promptInput, onPlace]);

  const cancelSelection = useCallback(() => {
    setPromptBar(null);
    setPromptInput('');
    setDStart(null);
    setDEnd(null);
    setDrawing(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelSelection();
        onSelect(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement as HTMLElement)?.tagName)) {
        onRemove(selectedId);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [cancelSelection, onSelect, selectedId, onRemove]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto relative isolate" style={{ background: 'var(--bg-100)' }}>
      <div className="p-6 flex justify-center items-start min-h-full">
      <div
        ref={canvasRef}
        className="relative rounded-xl border cursor-crosshair select-none"
        style={{
          width: canvasWidth,
          minHeight: canvasHeight + 26,
          margin: '0 auto',
          background: 'var(--bg-0)',
          borderColor: 'var(--border-200)',
          boxShadow: '0 0 80px rgba(0,0,0,0.3)',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Column ruler */}
        <div
          className="sticky top-0 z-20 overflow-hidden rounded-t-xl"
          style={{
            height: 26,
            background: 'rgba(12,12,15,0.92)',
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {Array.from({ length: cols }, (_, i) => (
            <div
              key={i}
              className={cn(
                'absolute top-0 h-[26px] flex items-center justify-center text-[9px] font-semibold font-mono',
                i % 2 === 0 ? '' : 'bg-white/[0.025]'
              )}
              style={{
                left: i * cellW,
                width: cellW,
                color: 'var(--text-400)',
                borderRight: i < cols - 1 ? '1px solid rgba(255,255,255,0.1)' : undefined,
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Grid lines */}
        <div className="absolute top-[26px] left-0 right-0 bottom-0 pointer-events-none z-0">
          {Array.from({ length: cols }, (_, i) => (
            <div
              key={`col-${i}`}
              className={cn('absolute top-0 bottom-0', i % 2 === 0 ? '' : 'bg-white/[0.012]')}
              style={{
                left: i * cellW,
                width: cellW,
                borderRight: i < cols - 1 ? '1px solid rgba(255,255,255,0.07)' : undefined,
              }}
            />
          ))}
          {Array.from({ length: ROWS }, (_, j) => (
            <div
              key={`row-${j}`}
              className="absolute left-0 right-0"
              style={{
                top: j * cellH,
                height: cellH,
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            />
          ))}
        </div>

        {/* Hover cell */}
        {hoverPos && !drawing && (
          <div
            className="absolute z-[2] pointer-events-none"
            style={{
              left: gx(hoverPos.col),
              top: gy(hoverPos.row) + 26,
              width: cellW,
              height: cellH,
            }}
          >
            <div
              className="w-full h-full rounded"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
          </div>
        )}

        {/* Selection rectangle */}
        {selBounds && (drawing || promptBar) && (
          <div
            className="absolute z-[8] pointer-events-none"
            style={{
              left: gx(selBounds.c1),
              top: gy(selBounds.r1) + 26,
              width: (selBounds.c2 - selBounds.c1 + 1) * cellW,
              height: (selBounds.r2 - selBounds.r1 + 1) * cellH,
            }}
          >
            <div
              className="w-full h-full rounded-md"
              style={{
                background: 'rgba(var(--neon-rgb), 0.1)',
                border: '2px dashed var(--neon-color)',
              }}
            />
            <div
              className="absolute left-0 whitespace-nowrap font-mono text-[10px] font-semibold px-2 py-0.5 rounded z-10 pointer-events-none"
              style={{
                top: selBounds.r1 <= 1 ? undefined : -26,
                bottom: selBounds.r1 <= 1 ? -26 : undefined,
                background: 'var(--neon-color)',
                color: '#000',
              }}
            >
              {selBounds.c2 - selBounds.c1 + 1}×{selBounds.r2 - selBounds.r1 + 1} · cols {selBounds.c1}–{selBounds.c2} · rows {selBounds.r1}–{selBounds.r2}
            </div>
          </div>
        )}

        {/* Components layer */}
        <div className="absolute inset-0 z-[3] pointer-events-none">
          {components.map((comp) => {
            const sectionDef = SECTION_TYPES[comp.type];
            const color = COLORS[comp.type];
            const isSelected = comp.id === selectedId;
            const w = (comp.ce - comp.cs + 1) * cellW;
            const h = (comp.re - comp.rs + 1) * cellH;

            return (
              <div
                key={comp.id}
                className="canvas-comp absolute rounded-lg overflow-hidden cursor-pointer transition-shadow border pointer-events-auto"
                style={{
                  left: gx(comp.cs),
                  top: gy(comp.rs) + 26,
                  width: w,
                  height: h,
                  zIndex: isSelected ? 4 : 3,
                  borderColor: isSelected ? 'var(--neon-color)' : 'var(--border-200)',
                  borderLeft: `3px solid ${color}`,
                  boxShadow: isSelected
                    ? '0 0 0 2px var(--neon-color), 0 4px 20px rgba(var(--neon-rgb), 0.1)'
                    : undefined,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  cancelSelection();
                  onSelect(comp.id);
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.boxShadow = '';
                }}
              >
                {/* Header bar */}
                <div
                  className={cn(
                    'absolute top-0 left-0 right-0 h-[26px] flex items-center justify-between px-2 z-[6] transition-opacity',
                    isSelected ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                  )}
                  style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)' }}
                >
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: `${color}22`, color }}
                  >
                    {comp.type} · {comp.ce - comp.cs + 1}×{comp.re - comp.rs + 1} · cols {comp.cs}–{comp.ce}
                  </span>
                  <div className="flex gap-0.5">
                    <ActionButton onClick={(e) => { e.stopPropagation(); onMove(comp.id, 0, -1); }} title="Up">
                      <ArrowUpDown size={12} />
                    </ActionButton>
                    <ActionButton onClick={(e) => { e.stopPropagation(); onMove(comp.id, 0, 1); }} title="Down">
                      <ArrowUpDown size={12} />
                    </ActionButton>
                    <ActionButton onClick={(e) => { e.stopPropagation(); onMove(comp.id, -1, 0); }} title="Left">
                      <ArrowLeftRight size={12} />
                    </ActionButton>
                    <ActionButton onClick={(e) => { e.stopPropagation(); onMove(comp.id, 1, 0); }} title="Right">
                      <ArrowLeftRight size={12} />
                    </ActionButton>
                    <ActionButton onClick={(e) => { e.stopPropagation(); onRegenerate(comp.id); }} title="Regenerate">
                      <RefreshCw size={12} />
                    </ActionButton>
                    <ActionButton onClick={(e) => { e.stopPropagation(); onRemove(comp.id); }} title="Delete" variant="danger">
                      <Trash2 size={12} />
                    </ActionButton>
                  </div>
                </div>

                {/* Generating overlay */}
                {comp.generating && (
                  <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
                    <div
                      className="absolute inset-0 animate-[shimmer_1.2s_ease-in-out]"
                      style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(var(--neon-rgb), 0.1) 40%, transparent 80%)' }}
                    />
                  </div>
                )}

                {/* Body */}
                <div className="h-full p-2 relative z-[2] flex flex-col">
                  {comp.generating ? (
                    <div className="flex items-center justify-center gap-2 h-full" style={{ color: 'var(--text-400)' }}>
                      <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-300)', borderTopColor: 'var(--neon-color)' }} />
                      <span className="text-[11px]">Generating...</span>
                    </div>
                  ) : comp.generatedHtml ? (
                    <iframe
                      srcDoc={comp.generatedHtml}
                      className="w-full h-full border-0 rounded"
                      sandbox="allow-scripts"
                      title={`${comp.type} content`}
                    />
                  ) : comp.referenceComponentId ? (
                    <iframe
                      srcDoc={`<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100%;background:#18181b;color:#a1a1aa;font-family:system-ui;font-size:12px">Library component: ${comp.referenceComponentId}</body></html>`}
                      className="w-full h-full border-0 rounded"
                      sandbox="allow-scripts"
                      title={`Library: ${comp.referenceComponentId}`}
                    />
                  ) : (
                    <MockContent type={comp.type} prompt={comp.prompt} cols={comp.ce - comp.cs + 1} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Prompt bar */}
        {promptBar?.visible && (
          <div
            className="canvas-prompt-bar absolute z-[14] flex items-center gap-1.5 rounded-[9px] py-1.5 px-2 animate-[slideUp_0.2s_ease]"
            style={{
              left: Math.max(0, Math.min(gx(promptBar.bounds.c1), canvasWidth - 460)),
              top: promptBar.bounds.r2 * cellH + 10 + 26 > ROWS * cellH + 26
                ? gy(promptBar.bounds.r1) - 60 + 26
                : promptBar.bounds.r2 * cellH + 10 + 26,
              background: 'var(--bg-100)',
              border: '1px solid var(--border-300)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              minWidth: 440,
            }}
          >
            <div className="font-mono text-[10px] font-semibold px-2 whitespace-nowrap leading-tight" style={{ color: 'var(--neon-color)' }}>
              <span>{promptBar.bounds.c2 - promptBar.bounds.c1 + 1}×{promptBar.bounds.r2 - promptBar.bounds.r1 + 1}</span>
              <span className="opacity-50 text-[9px] ml-1">cols {promptBar.bounds.c1}–{promptBar.bounds.c2}</span>
            </div>
            <input
              ref={promptInputRef}
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmGenerate(); } }}
              placeholder="Describe this component... e.g. hero with headline and image"
              className="flex-1 text-xs rounded-md px-2.5 py-[7px] outline-none min-w-[160px]"
              style={{
                background: 'var(--bg-200)',
                border: '1px solid var(--border-300)',
                color: 'var(--text-100)',
              }}
            />
            <button
              onClick={confirmGenerate}
              className="text-[11px] font-semibold px-3.5 py-[7px] rounded-md cursor-pointer"
              style={{ background: 'var(--neon-color)', color: '#000' }}
            >
              Generate
            </button>
            <button
              onClick={cancelSelection}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[15px] cursor-pointer transition-colors"
              style={{ background: 'transparent', color: 'var(--text-400)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-200)'; e.currentTarget.style.color = 'var(--text-100)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-400)'; }}
            >
              ×
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

const ActionButton: React.FC<{
  onClick: (e: React.MouseEvent) => void;
  title: string;
  variant?: 'default' | 'danger';
  children: React.ReactNode;
}> = ({ onClick, title, variant = 'default', children }) => (
  <button
    onClick={onClick}
    title={title}
    className={cn(
      'w-6 h-6 rounded-[5px] border flex items-center justify-center transition-colors cursor-pointer backdrop-blur-sm',
      variant === 'danger'
        ? 'border-white/10 bg-black/50 text-[var(--text-300)] hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400'
        : 'border-white/10 bg-black/50 text-[var(--text-300)] hover:bg-[var(--bg-300)] hover:text-[var(--text-100)] hover:border-[var(--border-300)]'
    )}
    style={{ fontSize: 12 }}
  >
    {children}
  </button>
);
