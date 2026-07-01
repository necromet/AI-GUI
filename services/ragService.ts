const API_BASE = '/api';

export interface RAGDocument {
  id: string;
  name: string;
  type: string;
  chunkCount: number;
  createdAt: string;
}

export interface RAGSource {
  index: number;
  text: string;
  documentId: string;
}

export async function uploadDocument(file: File): Promise<RAGDocument> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/rag/documents`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      errorMsg = parsed.error || errorText;
    } catch {}
    throw new Error(`Upload error ${response.status}: ${errorMsg}`);
  }

  const data = await response.json();
  return data.document;
}

export async function listDocuments(): Promise<RAGDocument[]> {
  const response = await fetch(`${API_BASE}/rag/documents`);
  if (!response.ok) {
    throw new Error(`List error ${response.status}`);
  }
  const data = await response.json();
  return data.documents || [];
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/rag/documents/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Delete error ${response.status}`);
  }
}

export interface RAGStreamChunk {
  text: string;
  thinkingText?: string;
  sources?: RAGSource[];
}

export async function* queryRAG(
  query: string,
  history: { role: string; content: string }[],
  model?: string,
  provider?: string,
  signal?: AbortSignal,
): AsyncGenerator<RAGStreamChunk> {
  const response = await fetch(`${API_BASE}/rag/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      messages: history,
      model,
      provider,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RAG query error ${response.status}: ${errorText}`);
  }

  const sourcesHeader = response.headers.get('X-RAG-Sources');
  let sources: RAGSource[] | undefined;
  if (sourcesHeader) {
    try { sources = JSON.parse(sourcesHeader); } catch {}
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  if (signal?.aborted) {
    reader.cancel();
    throw new DOMException('Aborted', 'AbortError');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  const abortPromise = new Promise<never>((_, reject) => {
    signal?.addEventListener('abort', () => {
      reader.cancel();
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });

  let firstChunk = true;

  while (true) {
    const { done, value } = await Promise.race([reader.read(), abortPromise]);
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;

        if (content || reasoning) {
          yield {
            text: content || '',
            thinkingText: reasoning || undefined,
            sources: firstChunk ? sources : undefined,
          };
          firstChunk = false;
        }
      } catch {
        // skip malformed
      }
    }
  }
}
