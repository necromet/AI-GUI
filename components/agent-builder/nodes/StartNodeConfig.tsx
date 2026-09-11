import { Plus, X } from 'lucide-react';

interface InputVariable {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue?: string;
}

interface Props {
  data: Record<string, any>;
  onUpdate: (data: Record<string, any>) => void;
}

export default function StartNodeConfig({ data, onUpdate }: Props) {
  const variables: InputVariable[] = data.inputVariables || [];

  const addVariable = () => {
    onUpdate({
      inputVariables: [...variables, { name: '', type: 'string', required: true, description: '' }],
    });
  };

  const updateVariable = (idx: number, field: string, value: any) => {
    const updated = variables.map((v, i) => i === idx ? { ...v, [field]: value } : v);
    onUpdate({ inputVariables: updated });
  };

  const removeVariable = (idx: number) => {
    onUpdate({ inputVariables: variables.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Input Variables</label>
        <button onClick={addVariable} className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: 'var(--neon-color)' }}>
          <Plus size={12} /> Add
        </button>
      </div>
      {variables.map((v, i) => (
        <div key={i} className="flex gap-2 items-start p-2 rounded border" style={{ borderColor: 'var(--border-300)' }}>
          <div className="flex-1 space-y-1">
            <input
              value={v.name}
              onChange={e => updateVariable(i, 'name', e.target.value)}
              placeholder="Variable name"
              className="w-full px-2 py-1 text-xs rounded border bg-transparent"
              style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
            <input
              value={v.description}
              onChange={e => updateVariable(i, 'description', e.target.value)}
              placeholder="Description"
              className="w-full px-2 py-1 text-xs rounded border bg-transparent"
              style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
            />
          </div>
          <button onClick={() => removeVariable(i)} className="p-1 cursor-pointer" style={{ color: 'var(--text-500)' }}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
