import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  streamChatCompletion,
  chatCompletion,
  detectLanguage,
  buildLanguageInstruction,
  ChatMessage,
} from '../services/mimoService';
import { addDocument, listDocuments, deleteDocument, retrieveRelevantChunks, buildRAGSystemPrompt } from '../services/ragService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/documents', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Missing file' });
      return;
    }

    const file = req.file;
    const name = file.originalname;
    const ext = name.split('.').pop()?.toLowerCase() || '';
    let content = '';

    if (ext === 'pdf') {
      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
        const textResult = await parser.getText();
        content = textResult.text;
        await parser.destroy();
      } catch (err: any) {
        res.status(500).json({ error: `Failed to parse PDF: ${err.message}` });
        return;
      }
    } else if (['txt', 'md', 'html', 'htm', 'json', 'csv', 'log'].includes(ext)) {
      content = file.buffer.toString('utf-8');
    } else {
      res.status(400).json({ error: `Unsupported file type: .${ext}. Supported: PDF, TXT, MD, HTML, JSON, CSV, LOG` });
      return;
    }

    if (!content.trim()) {
      res.status(400).json({ error: 'Document is empty or could not be parsed' });
      return;
    }

    const doc = await addDocument(name, ext, content);
    res.json({ document: doc });
  } catch (error: any) {
    console.error('[rag/documents] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/documents', async (_req: Request, res: Response) => {
  try {
    const docs = await listDocuments();
    res.json({ documents: docs });
  } catch (error: any) {
    console.error('[rag/documents] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/documents/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await deleteDocument(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[rag/documents/:id] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, messages, model, provider, systemInstruction, stream = true, max_tokens, systemPromptAppend } = req.body;

    if (!query && !messages?.length) {
      res.status(400).json({ error: 'Missing query or messages' });
      return;
    }

    const userQuery = query || messages?.[messages.length - 1]?.content || '';
    const chunks = await retrieveRelevantChunks(userQuery, 5);
    const ragPrompt = buildRAGSystemPrompt(chunks);

    const detectedLang = detectLanguage(userQuery);
    const langInstruction = buildLanguageInstruction(detectedLang);

    const apiMessages: ChatMessage[] = [];
    const fullSystem = [systemInstruction, ragPrompt, systemPromptAppend, langInstruction].filter(Boolean).join('\n\n');
    apiMessages.push({ role: 'system', content: fullSystem });

    const history = messages || [{ role: 'user', content: userQuery }];
    for (const msg of history) {
      const role = msg.role === 'model' ? 'assistant' : msg.role;
      apiMessages.push({ role, content: msg.content });
    }

    const sources = chunks.map((c, i) => ({
      index: i + 1,
      text: c.text.substring(0, 200),
      documentId: c.documentId,
    }));

    if (stream) {
      const response = await streamChatCompletion({
        model: model || 'mimo-v2.5',
        messages: apiMessages,
        stream: true,
        ...(max_tokens ? { max_tokens } : {}),
      }, provider);

      if (!response.ok) {
        const errorText = await response.text();
        res.status(response.status).json({ error: errorText });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-RAG-Sources', JSON.stringify(sources));

      const reader = (response.body as any)?.getReader();
      if (!reader) {
        res.status(500).json({ error: 'No response body from upstream' });
        return;
      }

      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch {
        // client disconnected
      } finally {
        res.end();
      }
    } else {
      const data = await chatCompletion({
        model: model || 'mimo-v2.5',
        messages: apiMessages,
        stream: false,
      }, provider);

      const answer = data.choices?.[0]?.message?.content || '';
      res.json({ answer, sources });
    }
  } catch (error: any) {
    console.error('[rag/query] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
