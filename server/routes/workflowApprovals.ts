import { Router } from 'express';
import * as workflowDB from '../db/workflows.js';

const router = Router();

router.get('/approval/:approvalId', async (req, res) => {
  try {
    const approval = await workflowDB.getApproval(req.params.approvalId);
    if (!approval) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(approval);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/approval/:approvalId/resume', async (req, res) => {
  try {
    const { approved } = req.body;
    const approval = await workflowDB.respondApproval(
      req.params.approvalId,
      approved ? 'approved' : 'rejected'
    );
    if (!approval) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ success: true, status: approved ? 'approved' : 'rejected' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
