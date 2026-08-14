import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SelectedElement } from './InteractivePreview';

interface ElementToolbarProps {
  element: SelectedElement;
  position: { top: number; left: number };
  onStyleChange: (property: string, value: string) => void;
  onTextChange: (text: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onClose: () => void;
}

function rgbToHex(color: string): string {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return '#000000';
  if (color.startsWith('#'))
    return color.length === 4
      ? '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
      : color;
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#000000';
  const r = parseInt(match[1]),
    g = parseInt(match[2]),
    b = parseInt(match[3]);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function parsePx(value: string): number {
  if (!value) return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

function getTagColor(tag: string): string {
  const t = tag.toLowerCase();
  if (/^h[1-6]$/.test(t)) return '#3b82f6';
  if (['p', 'span', 'a', 'li', 'label', 'strong', 'em', 'blockquote'].includes(t)) return '#22c55e';
  if (['div', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside', 'ul', 'ol', 'table'].includes(t))
    return '#f97316';
  return '#9ca3af';
}

const TOOLBAR_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  background: '#1a1a2e',
  border: '1px solid #333',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  maxWidth: '320px',
  width: '320px',
  fontSize: '12px',
  color: '#e0e0e0',
  animation: 'elementToolbarFadeIn 0.15s ease-out',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: '#888',
  lineHeight: '1',
  marginBottom: '2px',
  userSelect: 'none',
};

const INPUT_STYLE: React.CSSProperties = {
  background: '#0d0d1a',
  border: '1px solid #333',
  borderRadius: '6px',
  color: '#e0e0e0',
  fontSize: '12px',
  padding: '4px 6px',
  width: '100%',
  outline: 'none',
};

const COLOR_INPUT_STYLE: React.CSSProperties = {
  width: '24px',
  height: '24px',
  border: '1px solid #333',
  borderRadius: '6px',
  padding: '0',
  cursor: 'pointer',
  background: 'none',
};

const KEYFRAME_ID = 'element-toolbar-keyframes';

function ensureKeyframes() {
  if (document.getElementById(KEYFRAME_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes elementToolbarFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

export const ElementToolbar: React.FC<ElementToolbarProps> = ({
  element,
  position,
  onStyleChange,
  onTextChange,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onClose,
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(position);
  const [editText, setEditText] = useState(element.text ?? '');

  useEffect(() => {
    ensureKeyframes();
  }, []);

  useEffect(() => {
    setEditText(element.text ?? '');
  }, [element.text]);

  useEffect(() => {
    if (!toolbarRef.current) return;
    const rect = toolbarRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = position.top;
    let left = position.left;

    if (top + rect.height > vh - 8) {
      top = position.top - rect.height - 8;
      if (top < 8) top = 8;
    }
    if (left + rect.width > vw - 8) {
      left = vw - rect.width - 8;
      if (left < 8) left = 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    setAdjustedPos({ top, left });
  }, [position.top, position.left]);

  const handleColorInput = useCallback(
    (property: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      onStyleChange(property, e.target.value);
    },
    [onStyleChange],
  );

  const handleNumberInput = useCallback(
    (property: string, unit: string = 'px') =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
          onStyleChange(property, '');
          return;
        }
        onStyleChange(property, `${val}${unit}`);
      },
    [onStyleChange],
  );

  const handleAlign = useCallback(
    (align: string) => () => {
      onStyleChange('textAlign', align);
    },
    [onStyleChange],
  );

  const handleOpacity = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      onStyleChange('opacity', String(val / 100));
    },
    [onStyleChange],
  );

  const handleApplyText = useCallback(() => {
    onTextChange(editText);
  }, [editText, onTextChange]);

  const tagColor = getTagColor(element.tag);
  const textColor = rgbToHex(element.styles.color ?? '');
  const bgColor = rgbToHex(element.styles.backgroundColor ?? '');
  const fontSize = parsePx(element.styles.fontSize ?? '');
  const fontWeight = parseInt(element.styles.fontWeight ?? '400', 10) || 400;
  const paddingTop = parsePx(element.styles.paddingTop ?? '');
  const borderRadius = parsePx(element.styles.borderRadius ?? '');
  const textAlign = element.styles.textAlign ?? 'left';
  const opacityVal = Math.round((parseFloat(element.styles.opacity ?? '1') || 1) * 100);

  return (
    <div
      ref={toolbarRef}
      style={{
        ...TOOLBAR_STYLE,
        top: adjustedPos.top,
        left: adjustedPos.left,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-3 py-2"
        style={{ borderBottom: '1px solid #333' }}
      >
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={{ background: tagColor + '22', color: tagColor }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: tagColor }}
          />
          {element.tag}
        </span>

        {element.id && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{ background: '#2a2a4a', color: '#a78bfa' }}
          >
            #{element.id}
          </span>
        )}

        {element.classes && element.classes.length > 0 && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-mono truncate max-w-[80px]"
            style={{ background: '#2a2a4a', color: '#67e8f9' }}
            title={element.classes}
          >
            .{element.classes.split(/\s+/)[0]}
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-white/10"
          style={{ color: '#888' }}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Style Controls */}
      <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #222' }}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {/* Text Color */}
          <div>
            <div style={LABEL_STYLE}>T Color</div>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={textColor}
                onChange={handleColorInput('color')}
                style={COLOR_INPUT_STYLE}
                title="Text color"
              />
              <input
                type="text"
                value={textColor}
                onChange={handleColorInput('color')}
                style={{ ...INPUT_STYLE, flex: 1, fontSize: '11px', padding: '3px 5px' }}
                spellCheck={false}
              />
            </div>
          </div>

          {/* Background Color */}
          <div>
            <div style={LABEL_STYLE}>BG Color</div>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={bgColor === '#000000' && (!element.styles.backgroundColor || element.styles.backgroundColor === 'transparent' || element.styles.backgroundColor === 'rgba(0, 0, 0, 0)') ? '#000000' : bgColor}
                onChange={handleColorInput('backgroundColor')}
                style={COLOR_INPUT_STYLE}
                title="Background color"
              />
              <input
                type="text"
                value={element.styles.backgroundColor && element.styles.backgroundColor !== 'transparent' && element.styles.backgroundColor !== 'rgba(0, 0, 0, 0)' ? bgColor : ''}
                onChange={handleColorInput('backgroundColor')}
                style={{ ...INPUT_STYLE, flex: 1, fontSize: '11px', padding: '3px 5px' }}
                placeholder="transparent"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Font Size */}
          <div>
            <div style={LABEL_STYLE}>Size (px)</div>
            <input
              type="number"
              min={8}
              max={120}
              value={fontSize || ''}
              onChange={handleNumberInput('fontSize')}
              style={INPUT_STYLE}
              placeholder="16"
            />
          </div>

          {/* Font Weight */}
          <div>
            <div style={LABEL_STYLE}>Weight</div>
            <input
              type="number"
              min={100}
              max={900}
              step={100}
              value={fontWeight}
              onChange={handleNumberInput('fontWeight', '')}
              style={INPUT_STYLE}
              placeholder="400"
            />
          </div>

          {/* Padding */}
          <div>
            <div style={LABEL_STYLE}>Padding (px)</div>
            <input
              type="number"
              min={0}
              max={100}
              value={paddingTop || ''}
              onChange={handleNumberInput('padding')}
              style={INPUT_STYLE}
              placeholder="0"
            />
          </div>

          {/* Border Radius */}
          <div>
            <div style={LABEL_STYLE}>Radius (px)</div>
            <input
              type="number"
              min={0}
              max={100}
              value={borderRadius || ''}
              onChange={handleNumberInput('borderRadius')}
              style={INPUT_STYLE}
              placeholder="0"
            />
          </div>

          {/* Text Align */}
          <div>
            <div style={LABEL_STYLE}>Align</div>
            <div className="flex gap-1">
              {[
                { value: 'left', Icon: AlignLeft },
                { value: 'center', Icon: AlignCenter },
                { value: 'right', Icon: AlignRight },
              ].map(({ value, Icon }) => (
                <button
                  key={value}
                  onClick={handleAlign(value)}
                  className={cn(
                    'flex-1 h-7 flex items-center justify-center rounded transition-colors',
                    textAlign === value
                      ? 'bg-white/15 text-white'
                      : 'text-[#666] hover:text-[#999] hover:bg-white/5',
                  )}
                  title={value}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>

          {/* Opacity */}
          <div>
            <div style={LABEL_STYLE}>Opacity ({opacityVal}%)</div>
            <input
              type="range"
              min={0}
              max={100}
              value={opacityVal}
              onChange={handleOpacity}
              className="w-full h-7"
              style={{ accentColor: '#6366f1' }}
            />
          </div>
        </div>
      </div>

      {/* Text Section */}
      {element.isTextEditable && (
        <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #222' }}>
          <div style={LABEL_STYLE}>Text Content</div>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="resize-none w-full"
            style={{
              ...INPUT_STYLE,
              padding: '6px 8px',
              minHeight: '56px',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleApplyText}
            className="mt-1.5 w-full h-7 rounded text-[11px] font-medium transition-colors"
            style={{
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Apply
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-3 py-2">
        <button
          onClick={onDelete}
          className="flex-1 h-7 flex items-center justify-center gap-1.5 rounded text-[11px] font-medium transition-colors hover:bg-red-500/20"
          style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
          title="Delete element"
        >
          <Trash2 size={13} />
          Delete
        </button>
        <button
          onClick={onDuplicate}
          className="flex-1 h-7 flex items-center justify-center gap-1.5 rounded text-[11px] font-medium transition-colors hover:bg-white/10"
          style={{ color: '#a0a0a0', background: 'transparent', border: 'none', cursor: 'pointer' }}
          title="Duplicate element"
        >
          <Copy size={13} />
          Duplicate
        </button>
        <button
          onClick={onMoveUp}
          className="w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-white/10"
          style={{ color: '#a0a0a0', background: 'transparent', border: 'none', cursor: 'pointer' }}
          title="Move up"
        >
          <ChevronUp size={15} />
        </button>
        <button
          onClick={onMoveDown}
          className="w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-white/10"
          style={{ color: '#a0a0a0', background: 'transparent', border: 'none', cursor: 'pointer' }}
          title="Move down"
        >
          <ChevronDown size={15} />
        </button>
      </div>
    </div>
  );
};

export default ElementToolbar;
