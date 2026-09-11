import * as workflowDB from '../db/workflows.js';

export function parseWorkflow(row: any) {
  const nodesRaw = typeof row.nodes === 'string' ? row.nodes : JSON.stringify(row.nodes);
  const edgesRaw = typeof row.edges === 'string' ? row.edges : JSON.stringify(row.edges);
  const tagsRaw = typeof row.tags === 'string' ? row.tags : JSON.stringify(row.tags || '[]');
  return {
    id: row.id,
    customId: row.custom_id,
    name: row.name,
    description: row.description,
    category: row.category,
    tags: JSON.parse(tagsRaw),
    nodes: JSON.parse(nodesRaw),
    edges: JSON.parse(edgesRaw),
    isTemplate: row.is_template === true || row.is_template === 1,
    isPublic: row.is_public === true || row.is_public === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getApiKeys(): Promise<Record<string, string>> {
  const keys: Record<string, string> = {};

  if (process.env.ANTHROPIC_API_KEY) keys.anthropic = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY) keys.openai = process.env.OPENAI_API_KEY;
  if (process.env.GROQ_API_KEY) keys.groq = process.env.GROQ_API_KEY;
  if (process.env.FIRECRAWL_API_KEY) keys.firecrawl = process.env.FIRECRAWL_API_KEY;
  if (process.env.ARCADE_API_KEY) keys.arcade = process.env.ARCADE_API_KEY;
  if (process.env.MIMO_API_KEY) keys.mimo = process.env.MIMO_API_KEY;
  if (process.env.MIMO_DIRECT_API_KEY) keys['mimo-direct'] = process.env.MIMO_DIRECT_API_KEY;
  if (process.env.DEEPSEEK_API_KEY) keys.deepseek = process.env.DEEPSEEK_API_KEY;

  try {
    const dbKeys = await workflowDB.getUserLLMKeys();
    for (const k of dbKeys) {
      try {
        keys[k.provider] = Buffer.from(k.encrypted_key, 'base64').toString('utf-8');
      } catch {}
    }
  } catch {}

  return keys;
}

export function generateExportCode(workflow: any): string {
  const nodes = workflow.nodes || [];
  const edges = workflow.edges || [];

  return `// Generated workflow: ${workflow.name}
// Exported at: ${new Date().toISOString()}

import { createEngine } from './workflowEngine';

const nodes = ${JSON.stringify(nodes, null, 2)};
const edges = ${JSON.stringify(edges, null, 2)};

const engine = createEngine(nodes, edges);

async function run(input) {
  for await (const event of engine.executeStream(input)) {
    console.log(event.type, event.nodeId || '', event.data || '');
    if (event.type === 'completed') return event.state;
    if (event.type === 'error') throw new Error(event.error);
  }
}

run({ input: 'Your input here' }).then(console.log).catch(console.error);
`;
}
