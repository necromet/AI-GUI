import { Router } from 'express';
import { getApiKeys } from './workflowHelpers.js';

const router = Router();

router.post('/execute-agent', async (req, res) => {
  try {
    const { nodeData, state } = req.body;
    const { executeAgentNode } = await import('../services/workflowExecutors/agent.js');
    const result = await executeAgentNode(nodeData, state || { variables: {}, chatHistory: [] }, await getApiKeys());
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/execute-mcp', async (req, res) => {
  try {
    const { nodeData, state } = req.body;
    const { executeMCPNode } = await import('../services/workflowExecutors/mcp.js');
    const result = await executeMCPNode(nodeData, state || { variables: {}, chatHistory: [] }, await getApiKeys());
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/execute-firecrawl', async (req, res) => {
  try {
    const { action, url, query, limit } = req.body;
    const firecrawlService = await import('../services/firecrawlService.js');
    let result;
    switch (action) {
      case 'scrape': result = await firecrawlService.scrape(url); break;
      case 'search': result = await firecrawlService.search(query, { limit }); break;
      case 'crawl': result = await firecrawlService.crawl(url, { limit }); break;
      case 'map': result = await firecrawlService.mapSite(url); break;
      default: result = { error: `Unknown action: ${action}` };
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
