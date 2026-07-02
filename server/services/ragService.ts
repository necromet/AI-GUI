import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
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

interface StoredData {
  documents: RAGDocument[];
  chunks: RAGChunk[];
}

const DATA_DIR = resolve(process.cwd(), 'data');
const DATA_FILE = resolve(DATA_DIR, 'rag_chunks.json');
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

let inMemoryStore: StoredData = { documents: [], chunks: [] };
let isLoaded = false;

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore() {
  if (isLoaded) return;
  if (existsSync(DATA_FILE)) {
    try {
      const raw = readFileSync(DATA_FILE, 'utf-8');
      inMemoryStore = JSON.parse(raw);
    } catch {
      inMemoryStore = { documents: [], chunks: [] };
    }
  }
  isLoaded = true;
}

function saveStore() {
  ensureDataDir();
  writeFileSync(DATA_FILE, JSON.stringify(inMemoryStore), 'utf-8');
}

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
  loadStore();

  const docId = generateId();
  const textChunks = chunkText(content);

  const embeddings = await getEmbeddings(textChunks.map(c => c.text));

  const chunks: RAGChunk[] = textChunks.map((c, i) => ({
    id: generateId(),
    documentId: docId,
    text: c.text,
    embedding: embeddings[i],
    startIndex: c.startIndex,
    endIndex: c.endIndex,
  }));

  const doc: RAGDocument = {
    id: docId,
    name,
    type,
    chunkCount: chunks.length,
    createdAt: new Date().toISOString(),
  };

  inMemoryStore.documents.push(doc);
  inMemoryStore.chunks.push(...chunks);
  saveStore();

  return doc;
}

export function listDocuments(): RAGDocument[] {
  loadStore();
  return inMemoryStore.documents;
}

export function deleteDocument(docId: string): boolean {
  loadStore();
  const idx = inMemoryStore.documents.findIndex(d => d.id === docId);
  if (idx === -1) return false;
  inMemoryStore.documents.splice(idx, 1);
  inMemoryStore.chunks = inMemoryStore.chunks.filter(c => c.documentId !== docId);
  saveStore();
  return true;
}

export async function retrieveRelevantChunks(query: string, topK: number = 5): Promise<RAGChunk[]> {
  loadStore();

  if (inMemoryStore.chunks.length === 0) return [];

  const queryEmbedding = await getEmbedding(query);

  const scored = inMemoryStore.chunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => s.chunk);
}

export function buildRAGSystemPrompt(chunks: RAGChunk[], userQuery: string): string {
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
