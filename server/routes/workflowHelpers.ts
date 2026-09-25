import * as workflowDB from '../db/workflows.js';
import { normalizeWorkflowGraph } from '../../lib/workflow/graph.js';

export function parseWorkflow(row: any) {
  const nodesRaw = typeof row.nodes === 'string' ? row.nodes : JSON.stringify(row.nodes);
  const edgesRaw = typeof row.edges === 'string' ? row.edges : JSON.stringify(row.edges);
  const tagsRaw = typeof row.tags === 'string' ? row.tags : JSON.stringify(row.tags || '[]');
  const normalized = normalizeWorkflowGraph(JSON.parse(nodesRaw), JSON.parse(edgesRaw));
  return {
    id: row.id,
    customId: row.custom_id,
    name: row.name,
    description: row.description,
    category: row.category,
    tags: JSON.parse(tagsRaw),
    nodes: normalized.nodes,
    edges: normalized.edges,
    isTemplate: row.is_template === true || row.is_template === 1,
    isPublic: row.is_public === true || row.is_public === 1,
    published: row.published === true || row.published === 1,
    endpointUrl: row.endpoint_url,
    apiKey: row.api_key,
    chatEnabled: row.chat_enabled === true || row.chat_enabled === 1,
    shareToken: row.share_token,
    sharePath: row.share_token ? `/share/${row.share_token}` : null,
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

import { Annotation, END, START, StateGraph, interrupt } from '@langchain/langgraph';

const nodes = ${JSON.stringify(nodes, null, 2)};
const edges = ${JSON.stringify(edges, null, 2)};

const State = Annotation.Root({
  variables: Annotation<Record<string, unknown>>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
  nodeResults: Annotation<Record<string, unknown>>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
});

async function executeNode(node: any, state: typeof State.State) {
  const type = node.data?.nodeType || node.type;
  if (type === 'start') return { variables: { input: state.variables.input } };
  if (type === 'end') return {};
  if (type === 'user-approval') {
    const decision = interrupt({ nodeId: node.id, message: node.data.message || 'Approve to continue?' });
    return { nodeResults: { [node.id]: { output: decision } } };
  }

  // Connect your agent, MCP, HTTP, transform, and extraction implementations here.
  throw new Error(\`Implement executor for node type: \${type}\`);
}

const graph = new StateGraph(State);
const executableNodes = nodes.filter((node: any) => (node.data?.nodeType || node.type) !== 'note');
const executableIds = new Set(executableNodes.map((node: any) => node.id));
const validEdges = edges.filter((edge: any) => executableIds.has(edge.source) && executableIds.has(edge.target));

for (const node of executableNodes) {
  const ends = [...new Set(validEdges.filter((edge: any) => edge.source === node.id).map((edge: any) => edge.target))];
  graph.addNode(node.id, (state: typeof State.State) => executeNode(node, state), ends.length > 1 ? { ends } : undefined);
}

const start = executableNodes.find((node: any) => (node.data?.nodeType || node.type) === 'start');
if (!start) throw new Error('Workflow needs a Start node');
graph.addEdge(START, start.id);

for (const node of executableNodes) {
  const type = node.data?.nodeType || node.type;
  const outgoing = validEdges.filter((edge: any) => edge.source === node.id);
  if (type === 'end') graph.addEdge(node.id, END);
  else if (type === 'if-else') graph.addConditionalEdges(node.id, (state: any) => state.nodeResults[node.id]?.output?.branch || 'if', Object.fromEntries(outgoing.map((edge: any) => [edge.sourceHandle, edge.target])));
  else if (type === 'while') graph.addConditionalEdges(node.id, (state: any) => state.nodeResults[node.id]?.output?.shouldContinue ? 'continue' : 'break', Object.fromEntries(outgoing.map((edge: any) => [edge.sourceHandle, edge.target])));
  else if (type === 'user-approval') graph.addConditionalEdges(node.id, (state: any) => state.nodeResults[node.id]?.output?.approved === false ? 'reject' : 'approve', Object.fromEntries(outgoing.map((edge: any) => [edge.sourceHandle, edge.target])));
  else for (const edge of outgoing) graph.addEdge(node.id, edge.target);
}

const app = graph.compile();

async function run(input) {
  return app.invoke({ variables: { input }, nodeResults: {} });
}

run({ input: 'Your input here' }).then(console.log).catch(console.error);
`;
}
