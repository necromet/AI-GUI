import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, Plus, Server, Trash2, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence } from 'framer-motion';
import FlyingConfirmCard, { type ConfirmCardRequest } from './FlyingConfirmCard';

interface MCPServerRecord {
  id: string;
  name: string;
  url: string;
  description?: string;
  connection_status?: string;
}

export default function AgentBuilderSettingsModal({ onClose }: { onClose: () => void }) {
  const [providers, setProviders] = useState<any[]>([]);
  const [servers, setServers] = useState<MCPServerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [keyProvider, setKeyProvider] = useState('openai');
  const [keyValue, setKeyValue] = useState('');
  const [savedKeys, setSavedKeys] = useState<any[]>([]);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmCardRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [configResponse, serversResponse, keysResponse] = await Promise.all([
        fetch('/api/workflows/config'),
        fetch('/api/workflows/mcp/registry'),
        fetch('/api/workflows/keys'),
      ]);
      if (!configResponse.ok || !serversResponse.ok || !keysResponse.ok) throw new Error('Could not load Agent Builder settings');
      const config = await configResponse.json();
      setProviders(config.providers || []);
      setServers(await serversResponse.json());
      setSavedKeys(await keysResponse.json());
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const testAndAdd = async () => {
    if (!name.trim() || !url.trim()) return;
    setTesting(true);
    try {
      const testResponse = await fetch('/api/workflows/mcp/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
      });
      const test = await testResponse.json();
      if (!testResponse.ok || test.error) throw new Error(test.error || 'Connection test failed');
      const response = await fetch('/api/workflows/mcp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, url, tools: test.tools || [] }),
      });
      if (!response.ok) throw new Error('Could not save MCP server');
      setName('');
      setUrl('');
      toast.success('MCP server connected');
      await load();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  };

  const requestRemoveServer = (server: MCPServerRecord, anchor: { x: number; y: number }) => {
    setConfirmRequest({
      title: 'Remove MCP server?',
      description: `${server.name} will be removed from the registry. Existing workflow references remain intact.`,
      confirmLabel: 'Remove server',
      anchor,
      onConfirm: async () => {
        setConfirmBusy(true);
        const response = await fetch(`/api/workflows/mcp/${server.id}`, { method: 'DELETE' });
        if (response.ok) await load();
        setConfirmBusy(false);
        setConfirmRequest(null);
      },
    });
  };

  const saveKey = async () => {
    if (!keyValue.trim()) return;
    const response = await fetch('/api/workflows/keys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: keyProvider, apiKey: keyValue.trim() }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      toast.error(body.error || 'Could not save key');
      return;
    }
    setKeyValue('');
    toast.success(`${keyProvider} key saved`);
    await load();
  };

  const requestRemoveKey = (key: any, anchor: { x: number; y: number }) => {
    setConfirmRequest({
      title: 'Remove provider key?',
      description: `The saved ${key.provider} credential will be removed. Workflows using it will stop until another key is configured.`,
      confirmLabel: 'Remove key',
      anchor,
      onConfirm: async () => {
        setConfirmBusy(true);
        const response = await fetch(`/api/workflows/keys/${key.id}`, { method: 'DELETE' });
        if (response.ok) await load();
        setConfirmBusy(false);
        setConfirmRequest(null);
      },
    });
  };

  const dedupedProviders = Array.from(new Map(providers.map(provider => [provider.provider, provider])).values());

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[680px] max-w-[calc(100vw-32px)] max-h-[80vh] rounded-xl border overflow-hidden flex flex-col" style={{ background: 'var(--bg-100)', borderColor: 'var(--border-300)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: 'var(--border-300)' }}>
          <Server size={16} style={{ color: 'var(--neon-color)' }} />
          <div className="flex-1"><div className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>Agent Builder Settings</div><div className="text-[10px]" style={{ color: 'var(--text-500)' }}>Provider availability and MCP registry</div></div>
          <button onClick={onClose} className="p-1.5 cursor-pointer" style={{ color: 'var(--text-500)' }}><X size={15} /></button>
        </div>
        {loading ? <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin" size={20} /></div> : (
          <div className="overflow-y-auto p-5 space-y-6">
            <section>
              <div className="flex items-center gap-2 mb-3"><KeyRound size={14} /><h3 className="text-xs font-semibold" style={{ color: 'var(--text-100)' }}>Provider keys</h3></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {dedupedProviders.map(provider => <div key={provider.provider} className="flex items-center gap-2 p-2.5 rounded-lg border" style={{ borderColor: 'var(--border-300)', color: 'var(--text-300)' }}>{provider.hasKey ? <CheckCircle2 size={13} className="text-green-400" /> : <XCircle size={13} className="text-red-400" />}<span className="text-[11px] capitalize">{provider.provider}</span></div>)}
              </div>
              <p className="text-[10px] mt-2" style={{ color: 'var(--text-500)' }}>Secrets stay server-side. Add missing providers through environment variables or the workflow key API.</p>
              {savedKeys.length > 0 && <div className="mt-3 space-y-1">{savedKeys.map(key => <div key={key.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border" style={{ borderColor: 'var(--border-300)' }}><span className="text-[11px] capitalize flex-1" style={{ color: 'var(--text-300)' }}>{key.provider} · {key.keyPrefix}</span><button onClick={event => requestRemoveKey(key, { x: event.clientX, y: event.clientY })} className="p-1 cursor-pointer text-red-400"><Trash2 size={12} /></button></div>)}</div>}
              <div className="grid grid-cols-[120px_1fr_auto] gap-2 mt-3">
                <select value={keyProvider} onChange={event => setKeyProvider(event.target.value)} className="px-2 py-2 text-xs rounded-lg border bg-transparent" style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)', background: 'var(--bg-100)' }}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="groq">Groq</option><option value="firecrawl">Firecrawl</option><option value="arcade">Arcade</option></select>
                <input type="password" value={keyValue} onChange={event => setKeyValue(event.target.value)} placeholder="API key" className="px-2.5 py-2 text-xs rounded-lg border bg-transparent" style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }} />
                <button onClick={saveKey} disabled={!keyValue.trim()} className="px-3 py-2 rounded-lg text-xs disabled:opacity-40 cursor-pointer" style={{ background: 'var(--neon-color)', color: '#000' }}>Save</button>
              </div>
            </section>
            <section>
              <h3 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-100)' }}>MCP servers</h3>
              <div className="space-y-2 mb-3">
                {servers.map(server => <div key={server.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'var(--border-300)' }}><Server size={13} style={{ color: 'var(--neon-color)' }} /><div className="min-w-0 flex-1"><div className="text-xs font-medium" style={{ color: 'var(--text-100)' }}>{server.name}</div><div className="text-[10px] truncate" style={{ color: 'var(--text-500)' }}>{server.url}</div></div><button onClick={event => requestRemoveServer(server, { x: event.clientX, y: event.clientY })} className="p-1.5 cursor-pointer text-red-400"><Trash2 size={13} /></button></div>)}
                {servers.length === 0 && <div className="text-[11px]" style={{ color: 'var(--text-500)' }}>No MCP servers configured.</div>}
              </div>
              <div className="grid grid-cols-[140px_1fr_auto] gap-2">
                <input value={name} onChange={event => setName(event.target.value)} placeholder="Server name" className="px-2.5 py-2 text-xs rounded-lg border bg-transparent" style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }} />
                <input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…/mcp" className="px-2.5 py-2 text-xs rounded-lg border bg-transparent" style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }} />
                <button onClick={testAndAdd} disabled={testing || !name.trim() || !url.trim()} className="px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer" style={{ background: 'var(--neon-color)', color: '#000' }}>{testing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}Add</button>
              </div>
            </section>
          </div>
        )}
      </div>
      <AnimatePresence>
        {confirmRequest && <FlyingConfirmCard {...confirmRequest} busy={confirmBusy} onCancel={() => !confirmBusy && setConfirmRequest(null)} />}
      </AnimatePresence>
    </div>
  );
}
