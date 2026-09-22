import { X, Workflow } from 'lucide-react';
import { ReactFlow, Background, Controls, ReactFlowProvider, type Node, type Edge } from '@xyflow/react';

interface Props {
  name: string;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
}

function Preview({ name, nodes, edges, onClose }: Props) {
  const previewNodes = nodes.map(node => ({
    ...node,
    type: 'default',
    data: { label: String(node.data?.label || node.data?.nodeType || node.id) },
    draggable: false,
    connectable: false,
    selectable: false,
  }));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[900px] max-w-[calc(100vw-32px)] h-[70vh] rounded-xl border overflow-hidden flex flex-col" style={{ background: 'var(--bg-100)', borderColor: 'var(--border-300)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-300)' }}>
          <Workflow size={16} style={{ color: 'var(--neon-color)' }} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-100)' }}>{name}</div>
            <div className="text-[10px]" style={{ color: 'var(--text-500)' }}>{nodes.length} nodes · {edges.length} connections</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded cursor-pointer" style={{ color: 'var(--text-500)' }}><X size={15} /></button>
        </div>
        <div className="flex-1 min-h-0">
          <ReactFlow nodes={previewNodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} colorMode="dark">
            <Background color="rgba(255,255,255,0.05)" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function WorkflowPreviewModal(props: Props) {
  return <ReactFlowProvider><Preview {...props} /></ReactFlowProvider>;
}
