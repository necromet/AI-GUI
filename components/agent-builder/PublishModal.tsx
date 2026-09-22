import { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, Globe, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  workflowId: string;
  workflowName: string;
  onClose: () => void;
}

export default function PublishModal({ workflowId, workflowName, onClose }: Props) {
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [testInput, setTestInput] = useState('Hello from Agent Builder');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if already published
    fetch(`/api/workflows/${workflowId}`)
      .then(r => r.json())
      .then(data => {
        if (data.published) {
          setPublished(true);
          setEndpointUrl(data.endpointUrl || `${window.location.origin}/api/workflows/${workflowId}/execute`);
          setApiKey(data.apiKey || '');
        }
      })
      .catch(() => {});

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [workflowId, onClose]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/publish`, { method: 'POST' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setPublished(true);
      setEndpointUrl(data.endpointUrl || `${window.location.origin}/api/workflows/${workflowId}/execute`);
      setApiKey(data.apiKey || '');
      toast.success('Workflow published');
    } catch (err: any) {
      toast.error('Publish failed: ' + err.message);
    } finally {
      setPublishing(false);
    }
  }, [workflowId]);

  const handleUnpublish = useCallback(async () => {
    try {
      await fetch(`/api/workflows/${workflowId}/unpublish`, { method: 'POST' });
      setPublished(false);
      setEndpointUrl('');
      setApiKey('');
      toast.success('Workflow unpublished');
    } catch (err: any) {
      toast.error('Unpublish failed: ' + err.message);
    }
  }, [workflowId]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  }, []);

  const curlExample = `curl -X POST ${endpointUrl} \\
  -H "Content-Type: application/json" \\
  ${apiKey ? `-H "Authorization: Bearer ${apiKey}" \\\n  ` : ''}-d '{"input": "your input here"}'`;

  const curlStreamExample = `curl -X POST ${endpointUrl.replace(/\/execute$/, '/execute-stream')} \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  ${apiKey ? `-H "Authorization: Bearer ${apiKey}" \\\n  ` : ''}-d '{"input": "your input here", "stream": true}'`;

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: testInput }),
      });
      const body = await response.json();
      setTestResult(body);
      if (!response.ok) throw new Error(body.error || 'Test failed');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  }, [workflowId, testInput]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        ref={ref}
        className="rounded-xl border shadow-2xl w-[500px] max-h-[80vh] overflow-y-auto"
        style={{ borderColor: 'var(--border-300)', backgroundColor: 'var(--bg-100)' }}
      >
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-300)' }}>
          <Globe size={18} style={{ color: 'var(--neon-color)' }} />
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-100)' }}>Publish Workflow</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-500)' }}>
              {published ? 'Workflow is live and accessible via API' : 'Create an API endpoint for this workflow'}
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!published ? (
            <div className="text-center py-4">
              <p className="text-xs mb-4" style={{ color: 'var(--text-300)' }}>
                Publish "{workflowName}" to make it accessible via a REST API endpoint.
                External tools can call this endpoint to execute the workflow.
              </p>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-2 rounded text-sm font-medium cursor-pointer disabled:opacity-40"
                style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-300)' }}>Endpoint URL</label>
                <div className="flex gap-2">
                  <code
                    className="flex-1 px-3 py-2 text-[11px] rounded-lg border font-mono truncate"
                    style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)', backgroundColor: 'var(--bg-200)' }}
                  >
                    {endpointUrl}
                  </code>
                  <button
                    onClick={() => copyToClipboard(endpointUrl)}
                    className="p-2 rounded-lg border cursor-pointer"
                    style={{ borderColor: 'var(--border-300)', color: 'var(--text-400)' }}
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              {apiKey && (
                <div>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-300)' }}>API Key</label>
                  <div className="flex gap-2">
                    <code
                      className="flex-1 px-3 py-2 text-[11px] rounded-lg border font-mono"
                      style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)', backgroundColor: 'var(--bg-200)' }}
                    >
                      {apiKey.slice(0, 12)}...{apiKey.slice(-4)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(apiKey)}
                      className="p-2 rounded-lg border cursor-pointer"
                      style={{ borderColor: 'var(--border-300)', color: 'var(--text-400)' }}
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-300)' }}>cURL Example</label>
                <div className="relative">
                  <pre
                    className="px-3 py-2 text-[10px] rounded-lg border font-mono overflow-x-auto"
                    style={{ borderColor: 'var(--border-300)', color: 'var(--text-300)', backgroundColor: 'var(--bg-200)' }}
                  >
                    {curlExample}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(curlExample)}
                    className="absolute top-2 right-2 p-1 rounded cursor-pointer"
                    style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
                  >
                    <Copy size={10} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-300)' }}>Streaming Example</label>
                <div className="relative">
                  <pre
                    className="px-3 py-2 text-[10px] rounded-lg border font-mono overflow-x-auto"
                    style={{ borderColor: 'var(--border-300)', color: 'var(--text-300)', backgroundColor: 'var(--bg-200)' }}
                  >
                    {curlStreamExample}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(curlStreamExample)}
                    className="absolute top-2 right-2 p-1 rounded cursor-pointer"
                    style={{ backgroundColor: 'var(--bg-300)', color: 'var(--text-500)' }}
                  >
                    <Copy size={10} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-300)' }}>Test endpoint</label>
                <div className="flex gap-2">
                  <input value={testInput} onChange={event => setTestInput(event.target.value)} className="flex-1 px-3 py-2 text-xs rounded-lg border bg-transparent" style={{ borderColor: 'var(--border-300)', color: 'var(--text-100)' }} />
                  <button onClick={handleTest} disabled={testing} className="px-3 py-2 rounded-lg text-xs cursor-pointer disabled:opacity-40" style={{ backgroundColor: 'var(--neon-color)', color: '#000' }}>{testing ? 'Running…' : 'Run'}</button>
                </div>
                {testResult && <pre className="mt-2 px-3 py-2 text-[10px] rounded-lg border font-mono overflow-auto max-h-40" style={{ borderColor: 'var(--border-300)', color: 'var(--text-300)', backgroundColor: 'var(--bg-200)' }}>{JSON.stringify(testResult, null, 2)}</pre>}
              </div>

              <button
                onClick={handleUnpublish}
                className="flex items-center gap-1.5 text-[11px] cursor-pointer"
                style={{ color: '#f87171' }}
              >
                <XCircle size={12} />
                Unpublish
              </button>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t flex justify-end" style={{ borderColor: 'var(--border-300)' }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs cursor-pointer"
            style={{ color: 'var(--text-400)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
