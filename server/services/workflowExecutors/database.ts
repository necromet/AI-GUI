import { executeReadOnlyQuery, parameterizeSqlTemplates } from '../databaseConnectionService.js';
import { substituteVariables } from './variables.js';

export async function executeDatabaseNode(data: Record<string, any>, state: any): Promise<any> {
  if (data.dataSource === 'postgres') return executePostgres(data, state);
  if (data.dataSource === 'documents') return executeDocuments(data, state);
  return { error: 'Select PostgreSQL or Documents before running this node.' };
}

async function executePostgres(data: Record<string, any>, state: any): Promise<any> {
  if (!data.connectionId) return { error: 'Select a saved PostgreSQL connection.' };
  if (!String(data.sql || '').trim()) return { error: 'Enter a read-only SQL query.' };
  try {
    const parameterized = parameterizeSqlTemplates(String(data.sql), state);
    const result = await executeReadOnlyQuery(data.connectionId, parameterized.text, parameterized.values, {
      maxRows: data.maxRows,
      timeoutMs: Number(data.timeoutSeconds || 30) * 1000,
    });
    const format = data.outputFormat || 'rows';
    const selected = format === 'first-row'
      ? (result.rows[0] ?? null)
      : format === 'scalar'
        ? (result.rows[0] ? Object.values(result.rows[0])[0] ?? null : null)
        : format === 'json'
          ? JSON.stringify(result.rows)
          : result.rows;
    return {
      data: selected,
      ...(data.includeColumns === false ? {} : { columns: result.columns }),
      rowCount: result.rowCount,
      truncated: result.truncated,
      executionTime: result.executionTime,
    };
  } catch (error: any) {
    return { error: error.message || 'PostgreSQL query failed.' };
  }
}

async function executeDocuments(data: Record<string, any>, state: any): Promise<any> {
  const rawQuery = String(data.query || '');
  const query = substituteVariables(rawQuery, state).trim();
  if (!query || /\{\{[^}]+\}\}/.test(query)) return { error: 'Document search query is empty or contains unresolved variables.' };
  try {
    const rag = await import('../ragService.js');
    const chunks = await rag.retrieveRelevantChunks(query, {
      topK: Math.max(1, Math.min(Number(data.topK) || 5, 20)),
      documentIds: Array.isArray(data.documentIds) ? data.documentIds : [],
      minScore: Math.max(0, Math.min(Number(data.minScore) || 0, 1)),
    });
    const includeMetadata = data.includeMetadata !== false;
    const outputChunks = chunks.map(chunk => includeMetadata ? {
      text: chunk.text,
      score: chunk.score,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      startIndex: chunk.startIndex,
      endIndex: chunk.endIndex,
    } : { text: chunk.text });
    const combined = chunks.map(chunk => chunk.text).join('\n\n');
    return {
      data: data.documentOutputFormat === 'chunks' ? outputChunks : combined,
      content: combined,
      chunks: outputChunks,
      count: chunks.length,
    };
  } catch (error: any) {
    return { error: `Document retrieval failed: ${error.message}` };
  }
}
