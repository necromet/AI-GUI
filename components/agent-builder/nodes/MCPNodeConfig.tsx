import { useEffect, useMemo, useState } from 'react';
import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';
import { ThemedSelect, ThemedSelectTrigger, ThemedSelectValue, ThemedSelectContent, ThemedSelectItem } from '../shared/ThemedSelect';
import { ThemedTooltip, ThemedTooltipTrigger, ThemedTooltipContent, ThemedTooltipProvider } from '../shared/ThemedTooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Loader2 } from 'lucide-react';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

const FIRECRAWL_ACTIONS = [
  { value: 'scrape', label: 'Scrape', desc: 'Extract content from a single URL' },
  { value: 'search', label: 'Search', desc: 'Search the web for a query' },
  { value: 'crawl', label: 'Crawl', desc: 'Crawl multiple pages from a site' },
  { value: 'extract', label: 'Extract', desc: 'Extract structured data from URLs' },
  { value: 'map', label: 'Map', desc: 'Discover all URLs on a website' },
];

export default function MCPNodeConfig({ data, onUpdate }: Props) {
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [argumentsText, setArgumentsText] = useState(JSON.stringify(data.arguments || {}, null, 2));
  const [argumentsError, setArgumentsError] = useState(false);
  const provider = data.serverId || 'firecrawl';
  const action = data.mcpAction || data.toolName || 'scrape';
  const selectedServer = useMemo(() => servers.find(server => server.id === data.serverId), [servers, data.serverId]);
  const tools = Array.isArray(selectedServer?.tools) ? selectedServer.tools : [];

  useEffect(() => {
    fetch('/api/workflows/mcp/registry')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Could not load MCP registry')))
      .then(setServers)
      .finally(() => setLoading(false));
  }, []);

  const selectProvider = (value: string) => {
    if (value === 'firecrawl') {
      onUpdate({ serverId: '', serverUrl: '', mcpAction: 'scrape', toolName: 'scrape' });
      return;
    }
    const server = servers.find(item => item.id === value);
    const firstTool = server?.tools?.[0];
    onUpdate({
      serverId: value,
      serverUrl: server?.url || '',
      mcpAction: undefined,
      toolName: typeof firstTool === 'string' ? firstTool : firstTool?.name || '',
    });
  };

  return (
    <ThemedTooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div>
          <label className={fieldClasses.label} style={FIELD_STYLES.label}>MCP server</label>
          {loading ? <div className="h-9 flex items-center justify-center"><Loader2 size={14} className="animate-spin" /></div> : (
            <ThemedSelect value={provider} onValueChange={selectProvider}>
              <ThemedSelectTrigger><ThemedSelectValue /></ThemedSelectTrigger>
              <ThemedSelectContent>
                <ThemedSelectItem value="firecrawl">Firecrawl (built in)</ThemedSelectItem>
                {servers.map(server => <ThemedSelectItem key={server.id} value={server.id}>{server.name}</ThemedSelectItem>)}
              </ThemedSelectContent>
            </ThemedSelect>
          )}
        </div>

        {provider === 'firecrawl' ? (
          <>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>Action</label>
                <ThemedTooltip><ThemedTooltipTrigger asChild><span style={{ color: 'var(--text-500)' }}><Info size={11} /></span></ThemedTooltipTrigger><ThemedTooltipContent side="top">{FIRECRAWL_ACTIONS.find(item => item.value === action)?.desc}</ThemedTooltipContent></ThemedTooltip>
              </div>
              <ThemedSelect value={action} onValueChange={value => onUpdate({ mcpAction: value, toolName: value })}>
                <ThemedSelectTrigger><ThemedSelectValue /></ThemedSelectTrigger>
                <ThemedSelectContent>{FIRECRAWL_ACTIONS.map(item => <ThemedSelectItem key={item.value} value={item.value}>{item.label}</ThemedSelectItem>)}</ThemedSelectContent>
              </ThemedSelect>
            </div>
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>URL</label>
              <input value={data.scrapeUrl || data.url || ''} onChange={event => onUpdate({ scrapeUrl: event.target.value, url: event.target.value })} placeholder="{{input.url}} or https://..." className={fieldClasses.input} style={FIELD_STYLES.input} />
            </div>
            <AnimatePresence>{action === 'search' && <motion.div key="search-query" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}><label className={fieldClasses.label} style={FIELD_STYLES.label}>Search query</label><input value={data.searchQuery || ''} onChange={event => onUpdate({ searchQuery: event.target.value })} placeholder="{{input.query}}" className={fieldClasses.input} style={FIELD_STYLES.input} /></motion.div>}</AnimatePresence>
          </>
        ) : (
          <>
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Tool</label>
              <ThemedSelect value={data.toolName || ''} onValueChange={value => onUpdate({ toolName: value })}>
                <ThemedSelectTrigger><ThemedSelectValue placeholder="Select a tool" /></ThemedSelectTrigger>
                <ThemedSelectContent>{tools.map((tool: any) => { const name = typeof tool === 'string' ? tool : tool.name; return <ThemedSelectItem key={name} value={name}>{name}</ThemedSelectItem>; })}</ThemedSelectContent>
              </ThemedSelect>
            </div>
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Arguments (JSON)</label>
              <textarea value={argumentsText} onChange={event => { setArgumentsText(event.target.value); try { onUpdate({ arguments: JSON.parse(event.target.value) }); setArgumentsError(false); } catch { setArgumentsError(true); } }} rows={7} className={fieldClasses.textarea} style={FIELD_STYLES.input} />
              {argumentsError && <p className="text-[10px] text-red-400 mt-1">Enter valid JSON before running.</p>}
            </div>
          </>
        )}
      </div>
    </ThemedTooltipProvider>
  );
}
