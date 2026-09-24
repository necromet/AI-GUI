import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

function activateEdge(id: string, clientX: number, clientY: number) {
  window.dispatchEvent(new CustomEvent('ab-edge-activate', {
    detail: { edgeId: id, x: clientX, y: clientY },
  }));
}

export default function InteractiveWorkflowEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });
  const label = typeof props.label === 'string' ? props.label : '';
  const stroke = props.selected ? 'var(--neon-color)' : undefined;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        style={{ ...props.style, stroke }}
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={32}
        pointerEvents="stroke"
        className="cursor-pointer"
        onClick={event => {
          event.stopPropagation();
          activateEdge(props.id, event.clientX, event.clientY);
        }}
        onPointerDown={event => event.stopPropagation()}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          aria-label={`Manage connection${label ? `: ${label}` : ''}`}
          title="Manage connection"
          className="nodrag nopan absolute min-h-[28px] min-w-[28px] -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 text-[9px] leading-4 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--neon-color)]"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            borderColor: props.selected ? 'var(--neon-color)' : 'var(--border-300)',
            background: 'var(--bg-100)',
            color: 'var(--text-300)',
            opacity: props.selected || label ? 1 : undefined,
            pointerEvents: 'all',
          }}
          onClick={event => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            activateEdge(props.id, rect.left + rect.width / 2, rect.bottom + 4);
          }}
          onKeyDown={event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            activateEdge(props.id, rect.left + rect.width / 2, rect.bottom + 4);
          }}
        >
          {label || <span aria-hidden="true">&bull;</span>}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
