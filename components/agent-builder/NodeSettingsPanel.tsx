import { useCallback, useState } from 'react';
import { ClipboardPaste, Code, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Node } from '@xyflow/react';
import { NODE_DEFINITIONS, DEFAULT_NODE_COLOR } from './constants';
import type { WorkflowNodeType } from './types';
import PasteConfigModal from './PasteConfigModal';
import { StaggeredContainer } from './shared/StaggeredContainer';
import VariablePillText from './shared/VariablePill';
import {
  StartNodeConfig,
  AgentNodeConfig,
  MCPNodeConfig,
  GuardrailsNodeConfig,
  ArcadeNodeConfig,
  TransformNodeConfig,
  IfElseNodeConfig,
  WhileNodeConfig,
  ApprovalNodeConfig,
  EndNodeConfig,
  NoteNodeConfig,
  HTTPNodeConfig,
  ExtractNodeConfig,
  SetStateNodeConfig,
  DatabaseNodeConfig,
  WebSourceNodeConfig,
} from './nodes';

interface Props {
  node: Node;
  onUpdate: (data: Record<string, any>) => void;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
  upstreamNodes?: { id: string; label: string }[];
}

const CONFIG_PANELS: Record<string, React.ComponentType<{ data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; upstreamNodes?: { id: string; label: string }[]; accentColor?: string }>> = {
  start: StartNodeConfig,
  agent: AgentNodeConfig,
  mcp: MCPNodeConfig,
  guardrails: GuardrailsNodeConfig,
  arcade: ArcadeNodeConfig,
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
  database: DatabaseNodeConfig,
  'web-source': WebSourceNodeConfig,
  'web source': WebSourceNodeConfig,
  websource: WebSourceNodeConfig,
};

const panelTransition = { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const };

export default function NodeSettingsPanel({ node, onUpdate, onClose, onDelete, upstreamNodes = [] }: Props) {
  const [showJson, setShowJson] = useState(false);
  const [showPasteConfig, setShowPasteConfig] = useState(false);
  const nodeType = (node.data?.nodeType || node.type || 'agent') as string;
  const def = NODE_DEFINITIONS[nodeType as WorkflowNodeType];
  const color = node.data?.color || def?.color || DEFAULT_NODE_COLOR;
  const label = node.data?.label || def?.label || nodeType;
  const description = def?.description || 'Configure this workflow node';
  const ConfigPanel = CONFIG_PANELS[nodeType];

  const handleUpdate = useCallback((data: Record<string, any>) => {
    onUpdate(data);
  }, [onUpdate]);

  const actionButtonClass = 'flex h-[32px] w-[32px] shrink-0 cursor-pointer items-center justify-center rounded-[6px] transition-colors hover:bg-[var(--surface-hover)]';

  return (
    <>
      <motion.aside
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={panelTransition}
        className="agent-builder-node-panel node-settings-scroll overflow-x-hidden overflow-y-auto border"
        style={{
          borderColor: 'var(--border-200)',
          backgroundColor: 'var(--bg-100)',
        }}
        aria-label={`${label} settings`}
      >
        <header className="shrink-0 border-b p-[20px]" style={{ borderColor: 'var(--border-200)' }}>
          <div className="mb-[8px] flex min-w-0 items-center justify-between gap-[8px]">
            <input
              value={label}
              onChange={event => handleUpdate({ label: event.target.value })}
              className="-ml-[2px] min-w-0 flex-1 rounded-[4px] border-none bg-transparent px-[2px] text-[16px] font-medium leading-[24px] outline-none transition-colors hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)] focus:outline-none"
              style={{ color: 'var(--text-100)' }}
              placeholder="Enter node name..."
            />
            <div className="flex items-center gap-[8px]">
              <button
                type="button"
                onClick={() => setShowPasteConfig(true)}
                className={actionButtonClass}
                style={{ color: 'var(--text-400)' }}
                title="Paste config from JSON"
              >
                <ClipboardPaste size={16} />
              </button>
              <button
                type="button"
                onClick={() => setShowJson(current => !current)}
                className={actionButtonClass}
                style={{
                  backgroundColor: showJson ? 'rgba(var(--neon-rgb), 0.12)' : undefined,
                  color: showJson ? 'var(--neon-color)' : 'var(--text-400)',
                }}
                title={showJson ? 'Switch to visual editor' : 'Switch to JSON view'}
              >
                <Code size={16} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                className={`${actionButtonClass} group`}
                style={{ color: 'var(--text-400)' }}
                title="Delete node"
              >
                <Trash2 size={16} className="transition-colors group-hover:text-[var(--semantic-danger)]" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className={actionButtonClass}
                style={{ color: 'var(--text-400)' }}
                title="Close settings"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <p className="text-[14px] leading-[20px]" style={{ color: 'var(--text-400)' }}>
            {description}
          </p>
        </header>

        <AnimatePresence mode="wait">
          {showJson ? (
            <motion.div
              key="json-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="agent-builder-node-panel-body min-w-0 max-w-full p-[16px]"
            >
              <pre
                className="overflow-x-auto rounded-[8px] border p-[12px] font-mono text-[13px] leading-[20px]"
                style={{
                  borderColor: 'var(--border-200)',
                  backgroundColor: 'var(--bg-200)',
                  color: 'var(--text-300)',
                }}
              >
                <VariablePillText value={JSON.stringify(node.data, null, 2)} />
              </pre>
            </motion.div>
          ) : (
            <motion.div
              key={`config-${nodeType}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="agent-builder-node-panel-body min-w-0 max-w-full p-[16px]"
            >
              <StaggeredContainer staggerDelay={0.03} className="min-w-0 max-w-full space-y-[16px]">
                {ConfigPanel ? (
                  <ConfigPanel
                    data={node.data as Record<string, any>}
                    onUpdate={handleUpdate}
                    upstreamNodes={upstreamNodes}
                    accentColor={color}
                  />
                ) : (
                  <div className="py-[32px] text-center text-[13px] leading-[20px]" style={{ color: 'var(--text-400)' }}>
                    No settings available for this node type
                  </div>
                )}
              </StaggeredContainer>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      <AnimatePresence>
        {showPasteConfig && (
          <PasteConfigModal
            nodeLabel={label}
            onApply={data => handleUpdate(data)}
            onClose={() => setShowPasteConfig(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
