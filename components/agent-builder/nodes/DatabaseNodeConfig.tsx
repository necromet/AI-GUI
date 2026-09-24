import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import DatabaseConnectForm from '../../DatabaseConnectForm';
import VariableAutocomplete from '../VariableAutocomplete';
import { FIELD_STYLES, fieldClasses } from '../shared/formStyles';
import { ThemedSelect, ThemedSelectContent, ThemedSelectItem, ThemedSelectTrigger, ThemedSelectValue } from '../shared/ThemedSelect';
import { ThemedSwitch } from '../shared/ThemedSwitch';

interface Props { data: Record<string, any>; onUpdate: (data: Record<string, any>) => void; upstreamNodes?: { id: string; label: string }[] }
interface Connection { id: string; name: string; host: string; database: string }
interface DocumentInfo { id: string; name: string }

export default function DatabaseNodeConfig({ data, onUpdate, upstreamNodes = [] }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState(false);
  const dataSource = data.dataSource || '';

  const loadConnections = async () => {
    const response = await fetch('/api/database/connections');
    const body = await response.json().catch(() => ({}));
    if (response.ok) setConnections(body.connections || []);
  };

  useEffect(() => {
    void loadConnections();
    fetch('/api/rag/documents').then(response => response.json()).then(body => setDocuments(Array.isArray(body) ? body : body.documents || [])).catch(() => {});
  }, []);

  const missingDocumentIds = useMemo(() => {
    const existing = new Set(documents.map(document => document.id));
    return (Array.isArray(data.documentIds) ? data.documentIds : []).filter((id: string) => !existing.has(id));
  }, [data.documentIds, documents]);

  const selectConnection = (connectionId: string) => {
    const connection = connections.find(item => item.id === connectionId);
    onUpdate({ connectionId, connectionName: connection?.name || '' });
    setTestOk(false);
  };

  const testSavedConnection = async () => {
    if (!data.connectionId) return;
    setTesting(true); setTestOk(false);
    try {
      const response = await fetch(`/api/database/connections/${encodeURIComponent(data.connectionId)}/ping`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!body.reachable) throw new Error(body.error || 'Connection failed');
      setTestOk(true); toast.success('Connection successful');
    } catch (error: any) { toast.error(error.message || 'Connection failed'); }
    finally { setTesting(false); }
  };

  const saveConnection = async (connection: any) => {
    try {
      const response = await fetch('/api/database/connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(connection) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not save connection');
      await loadConnections();
      onUpdate({ connectionId: body.id, connectionName: connection.name });
      setShowConnectionForm(false); toast.success('Connection saved and selected');
    } catch (error: any) { toast.error(error.message); }
  };

  const toggleDocument = (id: string) => {
    const current = Array.isArray(data.documentIds) ? data.documentIds : [];
    onUpdate({ documentIds: current.includes(id) ? current.filter((value: string) => value !== id) : [...current, id] });
  };

  return <div className="space-y-4">
    {data.migrationWarning && <div className="flex gap-2 rounded-lg border p-3 text-[11px]" style={{ borderColor: 'var(--semantic-warning)', color: 'var(--semantic-warning)' }}><AlertTriangle size={14} className="shrink-0" />{data.migrationWarning}</div>}
    <div>
      <label className={fieldClasses.label} style={FIELD_STYLES.label}>Data Source</label>
      <ThemedSelect value={dataSource} onValueChange={value => onUpdate({ dataSource: value, migrationWarning: undefined })}>
        <ThemedSelectTrigger><ThemedSelectValue placeholder="Select a data source" /></ThemedSelectTrigger>
        <ThemedSelectContent><ThemedSelectItem value="postgres">PostgreSQL</ThemedSelectItem><ThemedSelectItem value="documents">Uploaded Documents</ThemedSelectItem></ThemedSelectContent>
      </ThemedSelect>
    </div>

    {dataSource === 'postgres' && <div className="space-y-4">
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Saved Connection</label>
        <ThemedSelect value={data.connectionId || ''} onValueChange={selectConnection}>
          <ThemedSelectTrigger><ThemedSelectValue placeholder="Select a PostgreSQL connection" /></ThemedSelectTrigger>
          <ThemedSelectContent>{connections.map(connection => <ThemedSelectItem key={connection.id} value={connection.id}>{connection.name} — {connection.host}/{connection.database}</ThemedSelectItem>)}</ThemedSelectContent>
        </ThemedSelect>
        {data.connectionId && connections.length > 0 && !connections.some(connection => connection.id === data.connectionId) && <p className="mt-1 text-[10px]" style={{ color: 'var(--semantic-warning)' }}>The saved connection no longer exists. Select or create another connection.</p>}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setShowConnectionForm(true)} className="flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1.5 text-[11px]" style={{ borderColor: 'var(--border-300)', color: 'var(--text-300)' }}><Plus size={12} />Add connection</button>
          <button type="button" disabled={!data.connectionId || testing} onClick={testSavedConnection} className="flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] disabled:opacity-40" style={{ borderColor: 'var(--border-300)', color: testOk ? 'var(--semantic-success)' : 'var(--text-300)' }}>{testing ? <Loader2 size={12} className="animate-spin" /> : testOk ? <CheckCircle2 size={12} /> : null}Test Connection</button>
        </div>
      </div>
      <div>
        <label className={fieldClasses.label} style={FIELD_STYLES.label}>Read-only SQL</label>
        <VariableAutocomplete value={data.sql || ''} onChange={sql => onUpdate({ sql })} multiline rows={7} upstreamNodes={upstreamNodes} placeholder={'SELECT id, name FROM customers\nWHERE status = {{input.status}}'} />
        <p className="mt-1 text-[10px]" style={FIELD_STYLES.helperText}>Values are sent as PostgreSQL parameters. Identifiers cannot be templated.</p>
      </div>
      <div className="grid grid-cols-2 gap-2"><NumberField label="Maximum Rows" value={data.maxRows ?? 100} min={1} max={1000} onChange={maxRows => onUpdate({ maxRows })} /><NumberField label="Timeout (seconds)" value={data.timeoutSeconds ?? 30} min={1} max={30} onChange={timeoutSeconds => onUpdate({ timeoutSeconds })} /></div>
      <div><label className={fieldClasses.label} style={FIELD_STYLES.label}>Output Format</label><ThemedSelect value={data.outputFormat || 'rows'} onValueChange={outputFormat => onUpdate({ outputFormat })}><ThemedSelectTrigger><ThemedSelectValue /></ThemedSelectTrigger><ThemedSelectContent><ThemedSelectItem value="rows">Rows</ThemedSelectItem><ThemedSelectItem value="first-row">First row</ThemedSelectItem><ThemedSelectItem value="scalar">Scalar</ThemedSelectItem><ThemedSelectItem value="json">JSON string</ThemedSelectItem></ThemedSelectContent></ThemedSelect></div>
      <SwitchRow label="Include column metadata" checked={data.includeColumns !== false} onChange={includeColumns => onUpdate({ includeColumns })} />
      <SwitchRow label="Allow this database query in shared chat" checked={data.allowSharedChat === true} onChange={allowSharedChat => onUpdate({ allowSharedChat })} />
      <p className="rounded-lg border p-2 text-[10px]" style={{ borderColor: 'var(--border-200)', color: 'var(--text-400)' }}>Use a dedicated read-only account. Credentials remain encrypted in Database Explorer and never enter workflow JSON.</p>
    </div>}

    {dataSource === 'documents' && <div className="space-y-4">
      <div><label className={fieldClasses.label} style={FIELD_STYLES.label}>Documents</label><div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-2" style={{ borderColor: 'var(--border-200)' }}>{documents.length === 0 && <p className="text-[11px]" style={FIELD_STYLES.helperText}>No uploaded documents. Empty selection searches all documents.</p>}{documents.map(document => <label key={document.id} className="flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" checked={(data.documentIds || []).includes(document.id)} onChange={() => toggleDocument(document.id)} />{document.name}</label>)}</div>{missingDocumentIds.length > 0 && <p className="mt-1 text-[10px]" style={{ color: 'var(--semantic-warning)' }}>{missingDocumentIds.length} selected document(s) were deleted and will be ignored.</p>}</div>
      <div><label className={fieldClasses.label} style={FIELD_STYLES.label}>Search Query</label><VariableAutocomplete value={data.query || ''} onChange={query => onUpdate({ query })} multiline rows={3} upstreamNodes={upstreamNodes} placeholder="What information are you looking for?" /></div>
      <div className="grid grid-cols-2 gap-2"><NumberField label="Top K" value={data.topK ?? 5} min={1} max={20} onChange={topK => onUpdate({ topK })} /><NumberField label="Minimum Score" value={data.minScore ?? 0} min={0} max={1} step={0.05} onChange={minScore => onUpdate({ minScore })} /></div>
      <div><label className={fieldClasses.label} style={FIELD_STYLES.label}>Output Format</label><ThemedSelect value={data.documentOutputFormat || 'combined-text'} onValueChange={documentOutputFormat => onUpdate({ documentOutputFormat })}><ThemedSelectTrigger><ThemedSelectValue /></ThemedSelectTrigger><ThemedSelectContent><ThemedSelectItem value="combined-text">Combined text</ThemedSelectItem><ThemedSelectItem value="chunks">Chunks</ThemedSelectItem></ThemedSelectContent></ThemedSelect></div>
      <SwitchRow label="Include metadata" checked={data.includeMetadata !== false} onChange={includeMetadata => onUpdate({ includeMetadata })} />
    </div>}
    <DatabaseConnectForm isOpen={showConnectionForm} onClose={() => setShowConnectionForm(false)} onSave={connection => void saveConnection(connection)} />
  </div>;
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return <div><label className={fieldClasses.label} style={FIELD_STYLES.label}>{label}</label><input type="number" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} className={fieldClasses.input} style={FIELD_STYLES.input} /></div>;
}
function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3"><label className="text-xs" style={FIELD_STYLES.label}>{label}</label><ThemedSwitch checked={checked} onCheckedChange={onChange} /></div>;
}
