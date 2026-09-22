/**
 * Built-in workflow templates
 */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  estimatedTime: string;
  tags: string[];
  nodes: any[];
  edges: any[];
}

export function getBuiltinTemplates(): WorkflowTemplate[] {
  return [
    {
      id: 'tpl_simple_scraper',
      name: 'Simple Web Scraper',
      description: 'Scrape any website and get an AI summary',
      category: 'scraping',
      difficulty: 'beginner',
      estimatedTime: '2 min',
      tags: ['firecrawl', 'scraping', 'ai'],
      nodes: [
        { id: 'start_1', type: 'start', position: { x: 0, y: 100 }, data: { nodeType: 'start', label: 'Start', color: '#34d399', icon: 'play', inputVariables: [{ name: 'url', type: 'string', required: true, description: 'URL to scrape' }] } },
        { id: 'scrape_1', type: 'mcp', position: { x: 250, y: 100 }, data: { nodeType: 'mcp', label: 'Scrape URL', color: '#fbbf24', icon: 'wrench', mcpAction: 'scrape', scrapeUrl: '{{url}}' } },
        { id: 'agent_1', type: 'agent', position: { x: 500, y: 100 }, data: { nodeType: 'agent', label: 'Summarize', color: '#818cf8', icon: 'bot', model: 'mimo-v2.5', systemPrompt: 'Summarize the following web content in a concise, informative way.', userPrompt: '{{lastOutput}}', maxTokens: 2048 } },
        { id: 'end_1', type: 'end', position: { x: 750, y: 100 }, data: { nodeType: 'end', label: 'End', color: '#f87171', icon: 'square' } },
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'scrape_1' },
        { id: 'e2', source: 'scrape_1', target: 'agent_1' },
        { id: 'e3', source: 'agent_1', target: 'end_1' },
      ],
    },
    {
      id: 'tpl_agent_firecrawl',
      name: 'Agent with Firecrawl',
      description: 'AI agent with Firecrawl MCP tools for web research',
      category: 'ai',
      difficulty: 'intermediate',
      estimatedTime: '5 min',
      tags: ['agent', 'firecrawl', 'mcp'],
      nodes: [
        { id: 'start_1', type: 'start', position: { x: 0, y: 100 }, data: { nodeType: 'start', label: 'Start', color: '#34d399', icon: 'play', inputVariables: [{ name: 'query', type: 'string', required: true, description: 'Research query' }] } },
        { id: 'agent_1', type: 'agent', position: { x: 300, y: 100 }, data: { nodeType: 'agent', label: 'Research Agent', color: '#818cf8', icon: 'bot', model: 'mimo-v2.5', systemPrompt: 'You are a research assistant. Use the available tools to find and analyze information. Provide comprehensive, well-sourced answers.', userPrompt: '{{query}}', maxTokens: 4096, mcpTools: [{ name: 'firecrawl_scrape', description: 'Scrape a URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } } } }, { name: 'firecrawl_search', description: 'Search the web', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } }] } },
        { id: 'end_1', type: 'end', position: { x: 600, y: 100 }, data: { nodeType: 'end', label: 'End', color: '#f87171', icon: 'square' } },
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'agent_1' },
        { id: 'e2', source: 'agent_1', target: 'end_1' },
      ],
    },
    {
      id: 'tpl_data_pipeline',
      name: 'Data Pipeline',
      description: 'Fetch data, transform it, and output structured results',
      category: 'data',
      difficulty: 'intermediate',
      estimatedTime: '3 min',
      tags: ['data', 'transform', 'http'],
      nodes: [
        { id: 'start_1', type: 'start', position: { x: 0, y: 100 }, data: { nodeType: 'start', label: 'Start', color: '#34d399', icon: 'play', inputVariables: [{ name: 'apiUrl', type: 'string', required: true, description: 'API endpoint URL' }] } },
        { id: 'http_1', type: 'http', position: { x: 250, y: 100 }, data: { nodeType: 'http', label: 'Fetch Data', color: '#94a3b8', icon: 'globe', method: 'GET', url: '{{apiUrl}}' } },
        { id: 'transform_1', type: 'transform', position: { x: 500, y: 100 }, data: { nodeType: 'transform', label: 'Transform', color: '#60a5fa', icon: 'code', code: 'const data = typeof input === "string" ? JSON.parse(input) : input;\nreturn { processed: true, count: Array.isArray(data) ? data.length : 1, data };' } },
        { id: 'end_1', type: 'end', position: { x: 750, y: 100 }, data: { nodeType: 'end', label: 'End', color: '#f87171', icon: 'square' } },
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'http_1' },
        { id: 'e2', source: 'http_1', target: 'transform_1' },
        { id: 'e3', source: 'transform_1', target: 'end_1' },
      ],
    },
    {
      id: 'tpl_approval_flow',
      name: 'Approval Workflow',
      description: 'Generate content, get human approval, then publish',
      category: 'workflow',
      difficulty: 'advanced',
      estimatedTime: '5 min',
      tags: ['approval', 'human-in-the-loop'],
      nodes: [
        { id: 'start_1', type: 'start', position: { x: 0, y: 100 }, data: { nodeType: 'start', label: 'Start', color: '#34d399', icon: 'play', inputVariables: [{ name: 'topic', type: 'string', required: true, description: 'Content topic' }] } },
        { id: 'agent_1', type: 'agent', position: { x: 250, y: 100 }, data: { nodeType: 'agent', label: 'Generate Content', color: '#818cf8', icon: 'bot', model: 'mimo-v2.5', systemPrompt: 'Write a professional blog post about the given topic.', userPrompt: '{{topic}}', maxTokens: 4096 } },
        { id: 'approval_1', type: 'user-approval', position: { x: 500, y: 100 }, data: { nodeType: 'user-approval', label: 'Review', color: '#ec4899', icon: 'user-check', message: 'Review the generated content before publishing.' } },
        { id: 'end_1', type: 'end', position: { x: 750, y: 100 }, data: { nodeType: 'end', label: 'End', color: '#f87171', icon: 'square' } },
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'agent_1' },
        { id: 'e2', source: 'agent_1', target: 'approval_1' },
        { id: 'e3', source: 'approval_1', target: 'end_1', sourceHandle: 'approve', label: 'approve' },
        { id: 'e4', source: 'approval_1', target: 'end_1', sourceHandle: 'reject', label: 'reject' },
      ],
    },
    {
      id: 'tpl_conditional',
      name: 'Conditional Router',
      description: 'Route input through different paths based on conditions',
      category: 'logic',
      difficulty: 'intermediate',
      estimatedTime: '3 min',
      tags: ['logic', 'conditional', 'routing'],
      nodes: [
        { id: 'start_1', type: 'start', position: { x: 0, y: 150 }, data: { nodeType: 'start', label: 'Start', color: '#34d399', icon: 'play', inputVariables: [{ name: 'input', type: 'string', required: true, description: 'Input to classify' }] } },
        { id: 'ifelse_1', type: 'if-else', position: { x: 250, y: 150 }, data: { nodeType: 'if-else', label: 'Classify', color: '#fb923c', icon: 'git-branch', condition: 'input.toLowerCase().includes("help") || input.includes("?")' } },
        { id: 'agent_1', type: 'agent', position: { x: 500, y: 50 }, data: { nodeType: 'agent', label: 'Helpful Response', color: '#818cf8', icon: 'bot', model: 'mimo-v2.5', systemPrompt: 'Provide a helpful, detailed response.', userPrompt: '{{input}}' } },
        { id: 'agent_2', type: 'agent', position: { x: 500, y: 250 }, data: { nodeType: 'agent', label: 'General Response', color: '#818cf8', icon: 'bot', model: 'mimo-v2.5', systemPrompt: 'Respond concisely.', userPrompt: '{{input}}' } },
        { id: 'end_1', type: 'end', position: { x: 750, y: 150 }, data: { nodeType: 'end', label: 'End', color: '#f87171', icon: 'square' } },
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'ifelse_1' },
        { id: 'e2', source: 'ifelse_1', target: 'agent_1', sourceHandle: 'if', label: 'true' },
        { id: 'e3', source: 'ifelse_1', target: 'agent_2', sourceHandle: 'else', label: 'false' },
        { id: 'e4', source: 'agent_1', target: 'end_1' },
        { id: 'e5', source: 'agent_2', target: 'end_1' },
      ],
    },
    {
      id: 'tpl_loop_research',
      name: 'Iterative Research',
      description: 'Search and scrape multiple pages in a loop, then synthesize',
      category: 'scraping',
      difficulty: 'advanced',
      estimatedTime: '10 min',
      tags: ['loop', 'research', 'firecrawl'],
      nodes: [
        { id: 'start_1', type: 'start', position: { x: 0, y: 150 }, data: { nodeType: 'start', label: 'Start', color: '#34d399', icon: 'play', inputVariables: [{ name: 'topic', type: 'string', required: true, description: 'Research topic' }] } },
        { id: 'mcp_1', type: 'mcp', position: { x: 200, y: 150 }, data: { nodeType: 'mcp', label: 'Search', color: '#fbbf24', icon: 'wrench', mcpAction: 'search', searchQuery: '{{topic}}' } },
        { id: 'transform_1', type: 'transform', position: { x: 400, y: 150 }, data: { nodeType: 'transform', label: 'Extract URLs', color: '#60a5fa', icon: 'code', code: 'const results = Array.isArray(input) ? input : input?.data || [];\nreturn { urls: results.map((r) => r.url || r).slice(0, 5), index: 0 };' } },
        { id: 'while_1', type: 'while', position: { x: 600, y: 150 }, data: { nodeType: 'while', label: 'Loop', color: '#c084fc', icon: 'repeat', condition: 'iteration < (variables.urls || []).length', maxIterations: 10 } },
        { id: 'mcp_2', type: 'mcp', position: { x: 800, y: 50 }, data: { nodeType: 'mcp', label: 'Scrape Page', color: '#fbbf24', icon: 'wrench', mcpAction: 'scrape', scrapeUrl: '{{urls[{{index}}]}}' } },
        { id: 'agent_1', type: 'agent', position: { x: 1000, y: 150 }, data: { nodeType: 'agent', label: 'Synthesize', color: '#818cf8', icon: 'bot', model: 'mimo-v2.5', systemPrompt: 'Synthesize the research into a comprehensive summary.', userPrompt: '{{lastOutput}}' } },
        { id: 'end_1', type: 'end', position: { x: 1200, y: 150 }, data: { nodeType: 'end', label: 'End', color: '#f87171', icon: 'square' } },
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'mcp_1' },
        { id: 'e2', source: 'mcp_1', target: 'transform_1' },
        { id: 'e3', source: 'transform_1', target: 'while_1' },
        { id: 'e4', source: 'while_1', target: 'mcp_2', sourceHandle: 'continue', label: 'continue' },
        { id: 'e5', source: 'while_1', target: 'agent_1', sourceHandle: 'break', label: 'break' },
        { id: 'e6', source: 'agent_1', target: 'end_1' },
        { id: 'e7', source: 'mcp_2', target: 'while_1' },
      ],
    },
    {
      id: 'tpl_arcade_google_doc',
      name: 'Publish to Google Docs',
      description: 'Create a Google Doc through Arcade with resumable authorization',
      category: 'automation',
      difficulty: 'intermediate',
      estimatedTime: '4 min',
      tags: ['arcade', 'google-docs', 'authorization'],
      nodes: [
        { id: 'start_1', type: 'start', position: { x: 0, y: 100 }, data: { nodeType: 'start', label: 'Start', inputVariables: [{ name: 'title', type: 'string', required: true, description: 'Document title' }, { name: 'content', type: 'string', required: true, description: 'Document content' }, { name: 'user_id', type: 'string', required: true, description: 'Stable Arcade authorization user ID' }] } },
        { id: 'arcade_1', type: 'arcade', position: { x: 280, y: 100 }, data: { nodeType: 'arcade', label: 'Create Google Doc', arcadeTool: 'GoogleDocs.CreateDocumentFromText@4.3.1', arcadeUserId: '{{input.user_id}}', arcadeInput: { title: '{{input.title}}', text_content: '{{input.content}}' } } },
        { id: 'end_1', type: 'end', position: { x: 560, y: 100 }, data: { nodeType: 'end', label: 'End' } },
      ],
      edges: [
        { id: 'e1', source: 'start_1', target: 'arcade_1' },
        { id: 'e2', source: 'arcade_1', target: 'end_1' },
      ],
    },
  ];
}
