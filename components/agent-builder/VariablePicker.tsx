interface Props {
  onSelect: (variable: string) => void;
  variables?: string[];
}

const DEFAULT_VARS = [
  'input',
  'input.text',
  'lastOutput',
  'lastOutput.response',
];

export default function VariablePicker({ onSelect, variables }: Props) {
  const vars = variables || DEFAULT_VARS;

  return (
    <div className="flex flex-wrap gap-1">
      {vars.map((v) => (
        <button
          key={v}
          onClick={() => onSelect(`{{${v}}}`)}
          className="px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-300)',
            color: 'var(--text-300)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(var(--neon-rgb), 0.15)';
            e.currentTarget.style.color = 'var(--neon-color)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-300)';
            e.currentTarget.style.color = 'var(--text-300)';
          }}
          title={`Insert {{${v}}}`}
        >
          {`{{${v}}}`}
        </button>
      ))}
    </div>
  );
}
