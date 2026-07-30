import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, ArrowDown, RefreshCw, Trash2, FileCode2, Eye } from 'lucide-react';
import type { GridComponent, ResolutionConfig } from './types';
import { COLORS, SECTION_TYPES } from './constants';
import { CanvasCatalogue } from './CanvasCatalogue';

interface LibraryComponent {
  id: string;
  name: string;
  category: string;
  contentType: string;
  description: string;
  content: string;
  thumbnail?: string;
}

interface CanvasPropertiesProps {
  component: GridComponent | null;
  resolution: ResolutionConfig;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onUpdateTsxCode?: (id: string, tsxCode: string) => void;
  onRemove: (id: string) => void;
  onRegenerate: (id: string) => void;
  onMove: (id: string, dc: number, dr: number) => void;
  onCatalogueAdd?: (component: LibraryComponent) => void;
  collapsed?: boolean;
}

export const CanvasProperties: React.FC<CanvasPropertiesProps> = ({
  component,
  resolution,
  onUpdatePrompt,
  onUpdateTsxCode,
  onRemove,
  onRegenerate,
  onMove,
  onCatalogueAdd,
  collapsed = false,
}) => {
  const [localPrompt, setLocalPrompt] = useState('');
  const [localTsx, setLocalTsx] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [tab, setTab] = useState<'properties' | 'catalogue'>('properties');
  const lastCompIdRef = useRef<string | null>(null);

  if (component && component.id !== lastCompIdRef.current) {
    lastCompIdRef.current = component.id;
    setLocalPrompt(component.prompt);
    setLocalTsx(component.tsxCode || '');
    setShowCode(false);
  }

  const handlePromptBlur = useCallback(() => {
    if (component && localPrompt !== component.prompt) {
      onUpdatePrompt(component.id, localPrompt);
    }
  }, [component, localPrompt, onUpdatePrompt]);

  if (!component) {
    return (
      <aside
        className="flex-shrink-0 border-l flex flex-col overflow-y-auto transition-all duration-300"
        style={{ width: collapsed ? 0 : 270, overflow: 'hidden', background: 'var(--bg-100)', borderColor: collapsed ? 'transparent' : 'var(--border-300)' }}
      >
        <div className="flex border-b" style={{ borderColor: 'var(--border-200)' }}>
          <button
            onClick={() => setTab('properties')}
            className="flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            style={{
              color: tab === 'properties' ? 'var(--neon-color)' : 'var(--text-400)',
              borderBottom: tab === 'properties' ? '2px solid var(--neon-color)' : '2px solid transparent',
              background: tab === 'properties' ? 'rgba(var(--neon-rgb), 0.04)' : 'transparent',
            }}
          >
            Properties
          </button>
          <button
            onClick={() => setTab('catalogue')}
            className="flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            style={{
              color: tab === 'catalogue' ? 'var(--neon-color)' : 'var(--text-400)',
              borderBottom: tab === 'catalogue' ? '2px solid var(--neon-color)' : '2px solid transparent',
              background: tab === 'catalogue' ? 'rgba(var(--neon-rgb), 0.04)' : 'transparent',
            }}
          >
            Catalogue
          </button>
        </div>
        {tab === 'catalogue' ? (
          <CanvasCatalogue onAddToCanvas={(comp) => onCatalogueAdd?.(comp)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-5 text-center">
            <div
              className="w-9 h-9 border-[1.5px] border-dashed rounded-[9px] flex items-center justify-center mb-3 text-[15px]"
              style={{ borderColor: 'var(--border-300)', color: 'var(--text-400)' }}
            >
              ✦
            </div>
            <div className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-400)' }}>
              Draw on the grid to create components, or click one to edit
            </div>
          </div>
        )}
      </aside>
    );
  }

  const sectionDef = SECTION_TYPES[component.type];
  const color = COLORS[component.type];
  const cols = component.ce - component.cs + 1;
  const rows = component.re - component.rs + 1;
  const heightPx = rows * resolution.cellH;
  const widthPx = cols * resolution.cellW;

  return (
    <aside
      className="flex-shrink-0 border-l flex flex-col overflow-y-auto transition-all duration-300"
      style={{ width: collapsed ? 0 : 270, overflow: 'hidden', background: 'var(--bg-100)', borderColor: collapsed ? 'transparent' : 'var(--border-300)' }}
    >
      <div className="flex border-b" style={{ borderColor: 'var(--border-200)' }}>
        <button
          onClick={() => setTab('properties')}
          className="flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          style={{
            color: tab === 'properties' ? 'var(--neon-color)' : 'var(--text-400)',
            borderBottom: tab === 'properties' ? '2px solid var(--neon-color)' : '2px solid transparent',
            background: tab === 'properties' ? 'rgba(var(--neon-rgb), 0.04)' : 'transparent',
          }}
        >
          Properties
        </button>
        <button
          onClick={() => setTab('catalogue')}
          className="flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          style={{
            color: tab === 'catalogue' ? 'var(--neon-color)' : 'var(--text-400)',
            borderBottom: tab === 'catalogue' ? '2px solid var(--neon-color)' : '2px solid transparent',
            background: tab === 'catalogue' ? 'rgba(var(--neon-rgb), 0.04)' : 'transparent',
          }}
        >
          Catalogue
        </button>
      </div>

      {tab === 'catalogue' ? (
        <CanvasCatalogue onAddToCanvas={(comp) => onCatalogueAdd?.(comp)} />
      ) : (
      <div className="p-3.5 flex flex-col gap-3.5">
        <PropertyField label="Type">
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: 'var(--text-100)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {sectionDef.label}
          </span>
        </PropertyField>

        <PropertyField label="Grid Position">
          <span className="font-mono text-[11.5px]" style={{ color: 'var(--text-100)' }}>
            cols {component.cs}–{component.ce} · rows {component.rs}–{component.re}
          </span>
        </PropertyField>

        <PropertyField label="Size">
          <span className="font-mono text-[11.5px]" style={{ color: 'var(--text-100)' }}>
            {cols} cols × {rows} rows ({widthPx}px × {heightPx}px)
          </span>
        </PropertyField>

        <PropertyField label="Grid System">
          <span className="font-mono text-[11.5px]" style={{ color: 'var(--text-100)' }}>
            {resolution.cols}-col · {resolution.cellW}px cells
          </span>
        </PropertyField>

        <PropertyField label="Prompt">
          <Textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            onBlur={handlePromptBlur}
            className="w-full resize-none h-12 text-[11px] rounded-md"
            style={{
              background: 'var(--bg-200)',
              borderColor: 'var(--border-300)',
              color: 'var(--text-100)',
            }}
          />
        </PropertyField>

        <PropertyField label="Status">
          <span
            className="text-[12.5px] font-medium"
            style={{
              color: component.generated
                ? '#34d399'
                : component.generating
                  ? 'var(--neon-color)'
                  : 'var(--text-400)',
            }}
          >
            {component.generated ? '✓ Generated' : component.generating ? '⟳ Generating...' : '○ Pending'}
          </span>
        </PropertyField>

        <div className="h-px" style={{ background: 'var(--border-200)' }} />

        <div className="flex items-center justify-between">
          <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-400)' }}>
            TSX Source
          </div>
          <button
            onClick={() => setShowCode(prev => !prev)}
            className="text-[10px] font-medium px-2 py-0.5 rounded cursor-pointer transition-colors"
            style={{
              background: showCode ? 'rgba(var(--neon-rgb), 0.15)' : 'var(--bg-200)',
              color: showCode ? 'var(--neon-color)' : 'var(--text-400)',
              border: '1px solid var(--border-300)',
            }}
          >
            {showCode ? <Eye size={10} className="inline mr-1" /> : <FileCode2 size={10} className="inline mr-1" />}
            {showCode ? 'Hide' : 'Edit'}
          </button>
        </div>

        {showCode && component.tsxCode && (
          <div className="flex flex-col gap-1.5">
            <div className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-0)', color: 'var(--text-500)' }}>
              src/components/{component.fileName || component.type}.tsx
            </div>
            <Textarea
              value={localTsx}
              onChange={(e) => setLocalTsx(e.target.value)}
              onBlur={() => {
                if (component && onUpdateTsxCode && localTsx !== component.tsxCode) {
                  onUpdateTsxCode(component.id, localTsx);
                }
              }}
              className="w-full resize-none font-mono text-[10px] leading-relaxed rounded-md"
              style={{
                background: 'var(--bg-0)',
                borderColor: 'var(--border-300)',
                color: 'var(--text-100)',
                minHeight: '200px',
                tabSize: 2,
              }}
              spellCheck={false}
            />
          </div>
        )}

        <div className="h-px" style={{ background: 'var(--border-200)' }} />

        <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-400)' }}>
          Nudge
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMove(component.id, 0, -1)}
            className="flex-1 justify-center text-[11px] cursor-pointer gap-1"
            style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
          >
            <ArrowUp size={12} /> Up
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMove(component.id, 0, 1)}
            className="flex-1 justify-center text-[11px] cursor-pointer gap-1"
            style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
          >
            <ArrowDown size={12} /> Down
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMove(component.id, -1, 0)}
            className="flex-1 justify-center text-[11px] cursor-pointer gap-1"
            style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
          >
            ←
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMove(component.id, 1, 0)}
            className="flex-1 justify-center text-[11px] cursor-pointer gap-1"
            style={{ background: 'var(--bg-200)', borderColor: 'var(--border-300)', color: 'var(--text-200)' }}
          >
            →
          </Button>
        </div>

        <div className="h-px" style={{ background: 'var(--border-200)' }} />

        <div className="flex flex-col gap-1.5">
          <Button
            onClick={() => onRegenerate(component.id)}
            className="w-full justify-center py-1.75 gap-1.5 cursor-pointer"
            style={{ background: 'var(--neon-color)', color: '#000' }}
          >
            <RefreshCw size={14} /> Regenerate
          </Button>
          <Button
            variant="outline"
            onClick={() => onRemove(component.id)}
            className="w-full justify-center py-1.75 cursor-pointer"
            style={{ borderColor: 'var(--border-300)', color: '#f87171' }}
          >
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>
      )}
    </aside>
  );
};

const PropertyField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-400)' }}>
      {label}
    </span>
    {children}
  </div>
);
