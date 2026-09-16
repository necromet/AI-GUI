import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

const FIRECRAWL_ACTIONS = ['scrape', 'search', 'crawl', 'extract', 'map'];

export default function MCPNodeConfig({ data, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Action</label>
        <select
          value={data.mcpAction || data.toolName || 'scrape'}
          onChange={e => onUpdate({ mcpAction: e.target.value, toolName: e.target.value })}
          className={fieldClasses.select}
          style={FIELD_STYLES.input}
        >
          {FIRECRAWL_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>URL</label>
        <input
          value={data.scrapeUrl || data.url || ''}
          onChange={e => onUpdate({ scrapeUrl: e.target.value, url: e.target.value })}
          placeholder="{{input}} or https://..."
          className={fieldClasses.input}
          style={FIELD_STYLES.input}
        />
      </div>
      {(data.mcpAction === 'search' || data.toolName === 'search') && (
        <div>
          <label className={fieldClasses.label} style={FIELD_STYLES.label}>Search Query</label>
          <input
            value={data.searchQuery || ''}
            onChange={e => onUpdate({ searchQuery: e.target.value })}
            placeholder="{{input}}"
            className={fieldClasses.input}
            style={FIELD_STYLES.input}
          />
        </div>
      )}
    </div>
  );
}
