import { Router } from 'express';
import * as workflowDB from '../db/workflows.js';
import { nanoid } from 'nanoid';

const router = Router();

router.get('/mcp-servers', async (_req, res) => {
  try {
    const servers = await workflowDB.getMCPServers();
    res.json(servers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mcp/registry', async (_req, res) => {
  try {
    const servers = await workflowDB.getAllMCPServers();
    res.json(servers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mcp', async (req, res) => {
  try {
    const { name, url, description, authType, accessToken, headers } = req.body;
    const server = await workflowDB.createMCPServer({
      id: `mcp_${nanoid(10)}`,
      name, url, description, authType, accessToken, headers,
    });
    res.json(server);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/mcp/:id', async (req, res) => {
  try {
    const server = await workflowDB.updateMCPServer(req.params.id, req.body);
    if (!server) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(server);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/mcp/:id', async (req, res) => {
  try {
    await workflowDB.deleteMCPServer(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mcp/test', async (req, res) => {
  try {
    const { url, headers } = req.body;
    if (!url) { res.status(400).json({ error: 'URL required' }); return; }
    const { testConnection } = await import('../services/mcpService.js');
    const result = await testConnection(url, headers);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
