const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';

export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return getTFIDFEmbedding(text);
  }

  try {
    const response = await fetch(OPENAI_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      console.error(`Embedding API error ${response.status}, falling back to TF-IDF`);
      return getTFIDFEmbedding(text);
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || getTFIDFEmbedding(text);
  } catch (err) {
    console.error('Embedding error, falling back to TF-IDF:', err);
    return getTFIDFEmbedding(text);
  }
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return texts.map(t => getTFIDFEmbedding(t));
  }

  try {
    const response = await fetch(OPENAI_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
      }),
    });

    if (!response.ok) {
      console.error(`Embedding API error ${response.status}, falling back to TF-IDF`);
      return texts.map(t => getTFIDFEmbedding(t));
    }

    const data = await response.json();
    const embeddings = data.data?.map((d: any) => d.embedding) || [];
    if (embeddings.length === texts.length) return embeddings;
    return texts.map(t => getTFIDFEmbedding(t));
  } catch (err) {
    console.error('Embedding error, falling back to TF-IDF:', err);
    return texts.map(t => getTFIDFEmbedding(t));
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function getTFIDFEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }
  const vocab = Object.keys(freq).sort();
  return vocab.map(w => freq[w] / words.length);
}

export function cosineSimilarityTFIDF(a: number[], b: number[]): number {
  return cosineSimilarity(a, b);
}
