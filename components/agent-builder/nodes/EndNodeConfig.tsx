interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

export default function EndNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--text-500)' }}>
        The End node completes the workflow. The final output from the last executed node will be returned.
      </p>
    </div>
  );
}
