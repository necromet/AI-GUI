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

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; accentColor?: string; }

const METHOD_BADGE_STYLE = (method: string) => {
  const colors = HTTP_METHOD_COLORS[method as keyof typeof HTTP_METHOD_COLORS];
  if (!colors) return {};
  return { backgroundColor: colors.bg, color: colors.text };
};

export default function HTTPNodeConfig({ data, onUpdate }: Props) {
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
          <input
            value={data.url || data.httpUrl || ''}
            onChange={e => onUpdate({ url: e.target.value, httpUrl: e.target.value })}
            placeholder="https://api.example.com/..."
            className={fieldClasses.input}
            style={FIELD_STYLES.input}
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
            <input
              value={data.authToken || ''}
              onChange={e => onUpdate({ authToken: e.target.value })}
              placeholder="{{token}} or direct value"
              className={fieldClasses.input}
              style={FIELD_STYLES.input}
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
              <input
                value={data.apiKeyHeader || 'X-API-Key'}
                onChange={e => onUpdate({ apiKeyHeader: e.target.value })}
                className={fieldClasses.input}
                style={FIELD_STYLES.input}
              />
            </div>
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>API Key</label>
              <input
                value={data.apiKey || ''}
                onChange={e => onUpdate({ apiKey: e.target.value })}
                placeholder="{{apiKey}} or direct value"
                className={fieldClasses.input}
                style={FIELD_STYLES.input}
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
              <input
                value={data.basicUser || ''}
                onChange={e => onUpdate({ basicUser: e.target.value })}
                className={fieldClasses.input}
                style={FIELD_STYLES.input}
              />
            </div>
            <div>
              <label className={fieldClasses.label} style={FIELD_STYLES.label}>Password</label>
              <input
                type="password"
                value={data.basicPassword || ''}
                onChange={e => onUpdate({ basicPassword: e.target.value })}
                className={fieldClasses.input}
                style={FIELD_STYLES.input}
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
        <textarea
          value={typeof data.headers === 'string' ? data.headers : JSON.stringify(data.headers || {}, null, 2)}
          onChange={e => { try { onUpdate({ headers: JSON.parse(e.target.value) }); } catch { onUpdate({ headers: e.target.value }); } }}
          placeholder='{"Authorization": "Bearer {{token}}"}'
          rows={3}
          className={fieldClasses.textarea}
          style={FIELD_STYLES.input}
        />
      </div>
      {method !== 'GET' && (
        <>
          <div className={fieldClasses.sectionLabel} style={FIELD_STYLES.helperText}>
            Body
          </div>
          <div>
            <label className={fieldClasses.label} style={FIELD_STYLES.label}>Body</label>
            <textarea
              value={typeof data.body === 'string' ? data.body : JSON.stringify(data.body || '', null, 2)}
              onChange={e => onUpdate({ body: e.target.value })}
              rows={4}
              className={fieldClasses.textarea}
              style={FIELD_STYLES.input}
            />
          </div>
        </>
      )}
    </div>
  );
}
