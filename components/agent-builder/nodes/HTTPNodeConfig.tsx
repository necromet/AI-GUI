import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';
import {
  ThemedSelect,
  ThemedSelectTrigger,
  ThemedSelectValue,
  ThemedSelectContent,
  ThemedSelectItem,
} from '../shared/ThemedSelect';
import { motion, AnimatePresence } from 'framer-motion';
import { HTTP_METHOD_COLORS } from '../shared/colors';
import VariableAutocomplete from '../VariableAutocomplete';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; upstreamNodes?: { id: string; label: string }[]; accentColor?: string; }

const METHOD_BADGE_STYLE = (method: string) => {
  const colors = HTTP_METHOD_COLORS[method as keyof typeof HTTP_METHOD_COLORS];
  if (!colors) return {};
  return { backgroundColor: colors.bg, color: colors.text };
};

export default function HTTPNodeConfig({ data, onUpdate, upstreamNodes = [] }: Props) {
  const authType = data.authType || 'none';
  const method = data.method || 'GET';

  return (
    <div className="space-y-4">
      <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
        Request
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={fieldClasses.label} style={FIELD_STYLES.label}>Method</label>
          <ThemedSelect
            value={method}
            onValueChange={v => onUpdate({ method: v })}
          >
            <ThemedSelectTrigger>
              <ThemedSelectValue>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="text-[9px] font-bold px-1 py-0.5 rounded"
                    style={METHOD_BADGE_STYLE(method)}
                  >
                    {method}
                  </span>
                </span>
              </ThemedSelectValue>
            </ThemedSelectTrigger>
            <ThemedSelectContent>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                <ThemedSelectItem key={m} value={m}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="text-[9px] font-bold px-1 py-0.5 rounded"
                      style={METHOD_BADGE_STYLE(m)}
                    >
                      {m}
                    </span>
                  </span>
                </ThemedSelectItem>
              ))}
            </ThemedSelectContent>
          </ThemedSelect>
        </div>
        <div className="col-span-2">
          <label className={fieldClasses.label} style={FIELD_STYLES.label}>URL</label>
          <VariableAutocomplete
            value={data.url || data.httpUrl || ''}
            onChange={value => onUpdate({ url: value, httpUrl: value })}
            placeholder="https://api.example.com/..."
            upstreamNodes={upstreamNodes}
          />
        </div>
      </div>

      <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
        Authentication
      </div>
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Auth Type</label>
        <ThemedSelect
          value={authType}
          onValueChange={v => onUpdate({ authType: v })}
        >
          <ThemedSelectTrigger>
            <ThemedSelectValue />
          </ThemedSelectTrigger>
          <ThemedSelectContent>
            <ThemedSelectItem value="none">None</ThemedSelectItem>
            <ThemedSelectItem value="bearer">Bearer Token</ThemedSelectItem>
            <ThemedSelectItem value="api-key">API Key</ThemedSelectItem>
            <ThemedSelectItem value="basic">Basic Auth</ThemedSelectItem>
          </ThemedSelectContent>
        </ThemedSelect>
      </div>

      {/* Animated auth fields */}
      <AnimatePresence mode="wait">
        {authType === 'bearer' && (
          <motion.div
            key="bearer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label className={fieldClasses.label} style={FIELD_STYLES.label}>Token</label>
            <VariableAutocomplete
              value={data.authToken || ''}
              onChange={value => onUpdate({ authToken: value })}
              placeholder="{{token}} or direct value"
              upstreamNodes={upstreamNodes}
            />
          </motion.div>
        )}

        {authType === 'api-key' && (
          <motion.div
            key="api-key"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Header Name</label>
              <VariableAutocomplete
                value={data.apiKeyHeader || 'X-API-Key'}
                onChange={value => onUpdate({ apiKeyHeader: value })}
                upstreamNodes={upstreamNodes}
              />
            </div>
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>API Key</label>
              <VariableAutocomplete
                value={data.apiKey || ''}
                onChange={value => onUpdate({ apiKey: value })}
                placeholder="{{apiKey}} or direct value"
                upstreamNodes={upstreamNodes}
              />
            </div>
          </motion.div>
        )}

        {authType === 'basic' && (
          <motion.div
            key="basic"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Username</label>
              <VariableAutocomplete
                value={data.basicUser || ''}
                onChange={value => onUpdate({ basicUser: value })}
                upstreamNodes={upstreamNodes}
              />
            </div>
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Password</label>
              <VariableAutocomplete
                type="password"
                value={data.basicPassword || ''}
                onChange={value => onUpdate({ basicPassword: value })}
                upstreamNodes={upstreamNodes}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
        Headers
      </div>
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Headers (JSON)</label>
        <VariableAutocomplete
          value={typeof data.headers === 'string' ? data.headers : JSON.stringify(data.headers || {}, null, 2)}
          onChange={value => { try { onUpdate({ headers: JSON.parse(value) }); } catch { onUpdate({ headers: value }); } }}
          placeholder='{"Authorization": "Bearer {{token}}"}'
          multiline
          rows={3}
          upstreamNodes={upstreamNodes}
        />
      </div>
      {method !== 'GET' && (
        <>
          <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
            Body
          </div>
          <div>
            <label className={fieldClasses.label} style={FIELD_STYLES.label}>Body</label>
            <VariableAutocomplete
              value={typeof data.body === 'string' ? data.body : JSON.stringify(data.body || '', null, 2)}
              onChange={value => onUpdate({ body: value })}
              multiline
              rows={4}
              upstreamNodes={upstreamNodes}
            />
          </div>
        </>
      )}
    </div>
  );
}
