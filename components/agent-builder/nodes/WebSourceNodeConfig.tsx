import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';
import {
  ThemedSelect,
  ThemedSelectTrigger,
  ThemedSelectValue,
  ThemedSelectContent,
  ThemedSelectItem,
} from '../shared/ThemedSelect';
import { motion, AnimatePresence } from 'framer-motion';
import VariableAutocomplete from '../VariableAutocomplete';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; upstreamNodes?: { id: string; label: string }[]; accentColor?: string; }

const FETCH_MODES = [
  { value: 'fetch-url', label: 'Fetch URL', description: 'Download and extract content from a web page' },
  { value: 'search-web', label: 'Search Web', description: 'Search the internet and return results' },
] as const;

export default function WebSourceNodeConfig({ data, onUpdate, upstreamNodes = [] }: Props) {
  const fetchMode = data.fetchMode || 'fetch-url';

  return (
    <div className="space-y-4">
      <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
        Source
      </div>

      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Fetch Mode</label>
        <ThemedSelect value={fetchMode} onValueChange={v => onUpdate({ fetchMode: v })}>
          <ThemedSelectTrigger>
            <ThemedSelectValue />
          </ThemedSelectTrigger>
          <ThemedSelectContent>
            {FETCH_MODES.map(m => (
              <ThemedSelectItem key={m.value} value={m.value} displayText={m.label}>
                {m.description}
              </ThemedSelectItem>
            ))}
          </ThemedSelectContent>
        </ThemedSelect>
      </div>

      <AnimatePresence mode="wait">
        {fetchMode === 'fetch-url' && (
          <motion.div
            key="fetch-url"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 overflow-hidden"
          >
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>URL</label>
              <VariableAutocomplete
                value={data.url || ''}
                onChange={value => onUpdate({ url: value })}
                placeholder="https://example.com/article — supports {{variable}}"
                upstreamNodes={upstreamNodes}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={fieldClasses.label} style={FIELD_STYLES.label}>Extract Mode</label>
                <ThemedSelect value={data.extractMode || 'text'} onValueChange={v => onUpdate({ extractMode: v })}>
                  <ThemedSelectTrigger>
                    <ThemedSelectValue />
                  </ThemedSelectTrigger>
                  <ThemedSelectContent>
                    <ThemedSelectItem value="text">Plain Text</ThemedSelectItem>
                    <ThemedSelectItem value="markdown">Markdown</ThemedSelectItem>
                    <ThemedSelectItem value="html">Raw HTML</ThemedSelectItem>
                  </ThemedSelectContent>
                </ThemedSelect>
              </div>
              <div>
                <label className={fieldClasses.label} style={FIELD_STYLES.label}>Max Content Length</label>
                <input
                  type="number"
                  value={data.maxContentLength ?? 5000}
                  onChange={e => onUpdate({ maxContentLength: Number(e.target.value) })}
                  min={500}
                  max={50000}
                  step={500}
                  className={fieldClasses.input}
                  style={FIELD_STYLES.input}
                />
              </div>
            </div>
          </motion.div>
        )}

        {fetchMode === 'search-web' && (
          <motion.div
            key="search-web"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 overflow-hidden"
          >
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Search Query</label>
              <VariableAutocomplete
                value={data.searchQuery || ''}
                onChange={value => onUpdate({ searchQuery: value })}
                placeholder="What to search for — supports {{variable}}"
                multiline
                rows={3}
                upstreamNodes={upstreamNodes}
              />
            </div>
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Max Results</label>
              <input
                type="number"
                value={data.maxResults ?? 5}
                onChange={e => onUpdate({ maxResults: Number(e.target.value) })}
                min={1}
                max={20}
                className={fieldClasses.input}
                style={FIELD_STYLES.input}
              />
            </div>
            <p className="text-[11px]" style={FIELD_STYLES.helperText}>
              Web search uses the Firecrawl API. Configure FIRECRAWL_API_KEY on the server or in Agent Builder settings.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
