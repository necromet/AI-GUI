import { useCallback, useState } from 'react';
import { X, Code, ClipboardPaste } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Node } from '@xyflow/react';
import { NODE_DEFINITIONS, DEFAULT_NODE_COLOR, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH } from './constants';
import type { WorkflowNodeType } from './types';
import { ICON_MAP } from './shared/icons';
import PasteConfigModal from './PasteConfigModal';
import { StaggeredContainer } from './shared/StaggeredContainer';
import {
  StartNodeConfig,
  AgentNodeConfig,
  MCPNodeConfig,
  GuardrailsNodeConfig,
  TransformNodeConfig,
  IfElseNodeConfig,
  WhileNodeConfig,
  ApprovalNodeConfig,
  EndNodeConfig,
  NoteNodeConfig,
  HTTPNodeConfig,
  ExtractNodeConfig,
  SetStateNodeConfig,
} from './nodes';

interface Props {
  node: Node;
  onUpdate: (data: Record<string, any>) => void;
  onClose: () => void;
  upstreamNodes?: { id: string; label: string }[];
}

const CONFIG_PANELS: Record<string, React.ComponentType<{ data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; upstreamNodes?: { id: string; label: string }[]; accentColor?: string }>> = {
  start: StartNodeConfig,
  agent: AgentNodeConfig,
  mcp: MCPNodeConfig,
  guardrails: GuardrailsNodeConfig,
  transform: TransformNodeConfig,
  'data-transform': TransformNodeConfig,
  'if-else': IfElseNodeConfig,
  while: WhileNodeConfig,
  'user-approval': ApprovalNodeConfig,
  'user approval': ApprovalNodeConfig,
  approval: ApprovalNodeConfig,
  end: EndNodeConfig,
  note: NoteNodeConfig,
  http: HTTPNodeConfig,
  'http-request': HTTPNodeConfig,
  extract: ExtractNodeConfig,
  'set-state': SetStateNodeConfig,
  'set state': SetStateNodeConfig,
};

const panelSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  filter: { duration: 0.2 },
};

export default function NodeSettingsPanel({ node, onUpdate, onClose, upstreamNodes = [] }: Props) {
  const [showJson, setShowJson] = useState(false);
  const [panelWidth, setPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [showPasteConfig, setShowPasteConfig] = useState(false);
  const nodeType = (node.data?.nodeType || node.type || 'agent') as string;
  const def = NODE_DEFINITIONS[nodeType as WorkflowNodeType];
  const color = node.data?.color || def?.color || DEFAULT_NODE_COLOR;
  const label = node.data?.label || def?.label || nodeType;

  const ConfigPanel = CONFIG_PANELS[nodeType];
  const NodeIcon = ICON_MAP[def?.icon] || ICON_MAP.bot;

  const handleUpdate = useCallback((data: Record<string, any>) => {
    onUpdate(data);
  }, [onUpdate]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = panelWidth;
    const handleMouseMove = (moveE: MouseEvent) => {
      const delta = moveE.clientX - startX;
      setPanelWidth(Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, startWidth + delta)));
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  return (
    <div className="flex h-full relative">
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 group"
        onMouseDown={handleResizeStart}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 transition-colors group-hover:bg-[var(--neon-color)]"
          style={{
            opacity: isResizing ? 1 : 0.15,
            backgroundColor: isResizing ? 'var(--neon-color)' : undefined,
          }}
        />
        {/* Grip dots */}
        <div className="absolute left-[3px] top-1/2 -translate-y-1/2 flex flex-col gap-[3px] opacity-0 group-hover:opacity-40 transition-opacity">
          <div className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: 'var(--text-500)' }} />
          <div className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: 'var(--text-500)' }} />
          <div className="w-[3px] h-[3px] rounded-full" style={{ backgroundColor: 'var(--text-500)' }} />
        </div>
      </div>

      {/* Panel content with framer-motion crossfade */}
      <AnimatePresence mode="wait">
        <motion.div
          key={node.id}
          initial={{ x: 80, opacity: 0, filter: "blur(2px)" }}
          animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ x: 80, opacity: 0, filter: "blur(2px)" }}
          transition={panelSpring}
          className="h-full border-l overflow-hidden flex flex-col"
          style={{
            borderColor: 'var(--border-300)',
            backgroundColor: 'var(--bg-100, #111114)',
            width: panelWidth + 'px',
          }}
        >
          {/* Header */}
          <motion.div
            className="flex items-center gap-2 px-4 py-3"
            style={{
              backgroundColor: `${color}08`,
              transition: 'background-color 0.2s ease',
            }}
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${color}18` }}
            >
              <NodeIcon size={14} style={{ color }} />
            </div>
            <input
              value={label}
              onChange={e => handleUpdate({ label: e.target.value })}
              className="flex-1 min-w-0 text-sm font-semibold bg-transparent border-none outline-none px-1 py-0.5 rounded hover:bg-[var(--bg-200)] focus:bg-[var(--bg-200)] transition-colors"
              style={{ color: 'var(--text-100)' }}
            />
            <button
              onClick={() => setShowPasteConfig(true)}
              className="p-1.5 rounded transition-colors cursor-pointer flex-shrink-0 hover:scale-105 active:scale-95"
              style={{ color: 'var(--text-500)' }}
              title="Paste config from JSON"
            >
              <ClipboardPaste size={13} />
            </button>
            <button
              onClick={() => setShowJson(!showJson)}
              className="p-1.5 rounded transition-colors cursor-pointer flex-shrink-0 hover:scale-105 active:scale-95"
              style={{
                backgroundColor: showJson ? `${color}20` : 'transparent',
                color: showJson ? color : 'var(--text-500)',
              }}
              title={showJson ? 'Switch to visual' : 'Switch to JSON'}
            >
              <Code size={13} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[var(--bg-300)] transition-all cursor-pointer flex-shrink-0 group/close"
              style={{ color: 'var(--text-500)' }}
            >
              <X size={14} className="transition-transform duration-200 group-hover/close:rotate-90" />
            </button>
          </motion.div>

          {/* Node ID subtitle */}
          {label !== node.id && (
            <div className="px-4 pb-1 -mt-1">
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-500)' }}>{node.id}</span>
            </div>
          )}

          {/* Body: JSON view or config panel */}
          <AnimatePresence mode="wait">
            {showJson ? (
              <motion.div
                key="json-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 overflow-y-auto node-settings-scroll"
              >
                <pre
                  className="text-[11px] font-mono p-4 h-full"
                  style={{ backgroundColor: 'var(--bg-200)', color: 'var(--text-300)' }}
                >
                  {JSON.stringify(node.data, null, 2)}
                </pre>
              </motion.div>
            ) : (
              <motion.div
                key={`config-${nodeType}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 px-4 pt-4 pb-6 overflow-y-auto node-settings-scroll"
              >
                <StaggeredContainer staggerDelay={0.03}>
                  {ConfigPanel ? (
                    <ConfigPanel
                      data={node.data as Record<string, any>}
                      onUpdate={handleUpdate}
                      upstreamNodes={upstreamNodes}
                      accentColor={color}
                    />
                  ) : (
                    <div className="text-xs text-center py-8" style={{ color: 'var(--text-500)' }}>
                      No settings available for this node type
                    </div>
                  )}
                </StaggeredContainer>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Paste config modal */}
      <AnimatePresence>
        {showPasteConfig && (
          <PasteConfigModal
            nodeLabel={label}
            onApply={(data) => handleUpdate(data)}
            onClose={() => setShowPasteConfig(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
