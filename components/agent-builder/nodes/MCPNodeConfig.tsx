interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; }

const FIRECRAWL_ACTIONS = ['scrape', 'search', 'crawl', 'extract', 'map'];

export default function MCPNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Action</label>
        <select
          value={data.mcpAction || data.toolName || 'scrape'}
          onChange={e => onUpdate({ mcpAction: e.target.value, toolName: e.target.value })}
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        >
          {FIRECRAWL_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>URL</label>
        <input
          value={data.scrapeUrl || data.url || ''}
          onChange={e => onUpdate({ scrapeUrl: e.target.value, url: e.target.value })}
          placeholder="{{input}} or https://..."
          className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
          style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
        />
      </div>
      {(data.mcpAction === 'search' || data.toolName === 'search') && (
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-300)' }}>Search Query</label>
          <input
            value={data.searchQuery || ''}
            onChange={e => onUpdate({ searchQuery: e.target.value })}
            placeholder="{{input}}"
            className="w-full px-2 py-1.5 text-xs rounded border bg-transparent"
            style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }}
          />
        </div>
      )}
    </div>
  );
}
