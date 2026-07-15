import { getDatabase } from '../db';
import { getEmbedding, getEmbeddings, cosineSimilarity } from './embeddingService';

export interface RAGChunk {
  id: string;
  documentId: string;
  text: string;
  embedding: number[];
  startIndex: number;
  endIndex: number;
}

export interface RAGDocument {
  id: string;
  name: string;
  type: string;
  chunkCount: number;
  createdAt: string;
}

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function chunkText(text: string): { text: string; startIndex: number; endIndex: number }[] {
  const chunks: { text: string; startIndex: number; endIndex: number }[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push({
      text: text.substring(start, end),
      startIndex: start,
      endIndex: end,
    });
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

export async function addDocument(name: string, type: string, content: string): Promise<RAGDocument> {
  const db = getDatabase();
  const docId = generateId();
  const textChunks = chunkText(content);
  const embeddings = await getEmbeddings(textChunks.map(c => c.text));

  const insertChunk = db.prepare(
    'INSERT INTO rag_chunks (id, document_id, text, embedding, start_index, end_index) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertDoc = db.prepare(
    'INSERT INTO rag_documents (id, name, type, chunk_count) VALUES (?, ?, ?, ?)'
  );

  const insertAll = db.transaction(() => {
    insertDoc.run(docId, name, type, textChunks.length);
    for (let i = 0; i < textChunks.length; i++) {
      insertChunk.run(
        generateId(),
        docId,
        textChunks[i].text,
        JSON.stringify(embeddings[i]),
        textChunks[i].startIndex,
        textChunks[i].endIndex
      );
    }
  });
  insertAll();

  return {
    id: docId,
    name,
    type,
    chunkCount: textChunks.length,
    createdAt: new Date().toISOString(),
  };
}

export function listDocuments(): RAGDocument[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM rag_documents ORDER BY created_at DESC').all() as any[];
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    chunkCount: r.chunk_count,
    createdAt: r.created_at,
  }));
}

export function deleteDocument(docId: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM rag_documents WHERE id = ?').run(docId);
  return result.changes > 0;
}

export async function retrieveRelevantChunks(query: string, topK: number = 5): Promise<RAGChunk[]> {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM rag_chunks').all() as any[];
  if (rows.length === 0) return [];

  const queryEmbedding = await getEmbedding(query);

  const chunks: RAGChunk[] = rows.map(r => ({
    id: r.id,
    documentId: r.document_id,
    text: r.text,
    embedding: JSON.parse(r.embedding),
    startIndex: r.start_index,
    endIndex: r.end_index,
  }));

  const scored = chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => s.chunk);
}

export function buildRAGSystemPrompt(chunks: RAGChunk[]): string {
  if (chunks.length === 0) {
    return 'You are a helpful assistant. Answer the user based on your general knowledge.';
  }

  const context = chunks
    .map((c, i) => `[Source ${i + 1}]: ${c.text}`)
    .join('\n\n');

  return `You are a helpful assistant with access to the following retrieved context. Use this context to answer the user's question. If the context doesn't contain relevant information, say so and answer based on your general knowledge. Always cite your sources when using retrieved context.

RETRIEVED CONTEXT:
${context}`;
}
