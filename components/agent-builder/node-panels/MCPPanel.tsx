import { useState, useEffect } from 'react';
import VariablePicker from '../VariablePicker';

interface Props {
  data: Record<string, any>;
  onUpdate: (data: Record<string, any>) => void;
}

export default function MCPPanel({ data, onUpdate }: Props) {
  const [servers, setServers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/workflows/mcp-servers')
      .then(r => r.json())
      .then(setServers)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>MCP Server</span>
        <select
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs"
          style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
          value={data.serverId || ''}
          onChange={(e) => onUpdate({ serverId: e.target.value })}
        >
          <option value="">Select server...</option>
          {servers.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Tool Name</span>
        <input
          type="text"
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs"
          style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
          value={data.toolName || ''}
          onChange={(e) => onUpdate({ toolName: e.target.value })}
          placeholder="e.g. firecrawl_scrape"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium" style={{ color: 'var(--text-300)' }}>Arguments (JSON)</span>
        <textarea
          className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs font-mono resize-y min-h-[60px]"
          style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-200)', color: 'var(--text-100)' }}
          value={JSON.stringify(data.arguments || {}, null, 2)}
          onChange={(e) => {
            try { onUpdate({ arguments: JSON.parse(e.target.value) }); }
            catch {}
          }}
          placeholder={'{"url": "{{input.text}}"}'}
        />
      </label>

      <div>
        <span className="text-[10px] font-medium" style={{ color: 'var(--text-500)' }}>Insert variable</span>
        <div className="mt-1">
          <VariablePicker onSelect={(v) => onUpdate({ arguments: { ...(data.arguments || {}), _insert: v } })} />
        </div>
      </div>
    </div>
  );
}
