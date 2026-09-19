import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';
import {
  ThemedSelect,
  ThemedSelectTrigger,
  ThemedSelectValue,
  ThemedSelectContent,
  ThemedSelectItem,
} from '../shared/ThemedSelect';
import {
  ThemedTooltip,
  ThemedTooltipTrigger,
  ThemedTooltipContent,
  ThemedTooltipProvider,
} from '../shared/ThemedTooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

const FIRECRAWL_ACTIONS = [
  { value: 'scrape', label: 'Scrape', desc: 'Extract content from a single URL' },
  { value: 'search', label: 'Search', desc: 'Search the web for a query' },
  { value: 'crawl', label: 'Crawl', desc: 'Crawl multiple pages from a site' },
  { value: 'extract', label: 'Extract', desc: 'Extract structured data from URLs' },
  { value: 'map', label: 'Map', desc: 'Discover all URLs on a website' },
];

export default function MCPNodeConfig({ data, onUpdate }: Props) {
  const action = data.mcpAction || data.toolName || 'scrape';

  return (
    <ThemedTooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className={fieldClasses.label} style={{ ...FIELD_STYLES.label, marginBottom: 0 }}>Action</label>
            <ThemedTooltip>
              <ThemedTooltipTrigger asChild>
                <span style={{ color: 'var(--text-500)' }}><Info size={11} /></span>
              </ThemedTooltipTrigger>
              <ThemedTooltipContent side="top">
                {FIRECRAWL_ACTIONS.find(a => a.value === action)?.desc || 'Select an action'}
              </ThemedTooltipContent>
            </ThemedTooltip>
          </div>
          <ThemedSelect
            value={action}
            onValueChange={v => onUpdate({ mcpAction: v, toolName: v })}
          >
            <ThemedSelectTrigger>
              <ThemedSelectValue />
            </ThemedSelectTrigger>
            <ThemedSelectContent>
              {FIRECRAWL_ACTIONS.map(a => (
                <ThemedSelectItem key={a.value} value={a.value}>{a.label}</ThemedSelectItem>
              ))}
            </ThemedSelectContent>
          </ThemedSelect>
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

        <AnimatePresence>
          {action === 'search' && (
            <motion.div
              key="search-query"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Search Query</label>
              <input
                value={data.searchQuery || ''}
                onChange={e => onUpdate({ searchQuery: e.target.value })}
                placeholder="{{input}}"
                className={fieldClasses.input}
                style={FIELD_STYLES.input}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ThemedTooltipProvider>
  );
}
