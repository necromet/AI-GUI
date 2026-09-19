interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

export default function EndNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)' }}>
        <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-100)' }}>
          Workflow Complete
        </div>
        <p className="text-[10px]" style={{ color: 'var(--text-500)' }}>
          The End node completes the workflow. The final output from the last executed node will be returned as the workflow result.
        </p>
      </div>
    </div>
  );
}
