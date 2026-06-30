import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  streamChatCompletion,
  chatCompletion,
  detectLanguage,
  buildLanguageInstruction,
  getProviderConfig,
  ChatMessage,
} from '../services/mimoService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/completions', async (req: Request, res: Response) => {
  try {
    const {
      model,
      messages,
      stream = true,
      max_tokens,
      systemInstruction,
      provider,
      search,
      think,
      language,
    } = req.body;

    if (!model || !messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Missing required fields: model, messages' });
      return;
    }

    const apiMessages: ChatMessage[] = [];

    const detectedLang = language || detectLanguage(messages[messages.length - 1]?.content || '');
    const langInstruction = buildLanguageInstruction(detectedLang);

    if (systemInstruction) {
      apiMessages.push({ role: 'system', content: `${systemInstruction}\n\n${langInstruction}` });
    } else {
      apiMessages.push({ role: 'system', content: langInstruction });
    }

    for (const msg of messages) {
      const role = msg.role === 'model' ? 'assistant' : msg.role;
      if (msg.attachments && msg.attachments.length > 0) {
        const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const att of msg.attachments) {
          content.push({ type: 'image_url', image_url: { url: att.data } });
        }
        apiMessages.push({ role, content });
      } else {
        apiMessages.push({ role, content: msg.content });
      }
    }

    const body: any = {
      model,
      messages: apiMessages,
      stream,
    };
    if (max_tokens && max_tokens > 0) body.max_tokens = max_tokens;
    if (search) body.tools = [{ type: 'web_search', max_keyword: 3, force_search: true }];
    if (think !== undefined) body.thinking = { type: think ? 'enabled' : 'disabled' };

    if (stream) {
      const response = await streamChatCompletion(body, provider);

      if (!response.ok) {
        const errorText = await response.text();
        res.status(response.status).json({ error: errorText });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Detected-Language', detectedLang);

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
      } catch (err) {
        // client disconnected
      } finally {
        res.end();
      }
    } else {
      const data = await chatCompletion(body, provider);
      res.setHeader('X-Detected-Language', detectedLang);
      res.json(data);
    }
  } catch (error: any) {
    console.error('[chat] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/title', async (req: Request, res: Response) => {
  try {
    const { userMessage, assistantResponse, provider } = req.body;

    if (!userMessage) {
      res.status(400).json({ error: 'Missing userMessage' });
      return;
    }

    const detectedLang = detectLanguage(userMessage);
    const langInstruction = buildLanguageInstruction(detectedLang);

    const data = await chatCompletion(
      {
        model: 'mimo-v2.5',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that generates concise, descriptive titles for conversations. Create a title that is 3-7 words long and captures the main topic of the conversation. Do not use quotes or punctuation except hyphens. Return only the title text.\n\n${langInstruction}`,
          },
          {
            role: 'user',
            content: `Based on this conversation, generate a short, descriptive title (3-7 words):\n\nUser: ${userMessage.substring(0, 200)}\n\nAssistant: ${(assistantResponse || '').substring(0, 200)}`,
          },
        ],
        stream: false,
        thinking: { type: 'disabled' },
      },
      provider,
    );

    let title = data.choices?.[0]?.message?.content?.trim() || '';
    title = title.replace(/["']/g, '');

    if (!title || title.length > 100) {
      title = userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
    }

    res.json({ title, detectedLanguage: detectedLang });
  } catch (error: any) {
    console.error('[chat/title] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/tts', async (req: Request, res: Response) => {
  try {
    const { model, text, voice, style, provider } = req.body;

    if (!model || !text) {
      res.status(400).json({ error: 'Missing required fields: model, text' });
      return;
    }

    const messages: ChatMessage[] = [];
    if (style) messages.push({ role: 'user', content: style });
    messages.push({ role: 'assistant', content: text });

    const data = await chatCompletion(
      {
        model,
        messages,
        stream: false,
        audio: { format: 'mp3' },
        ...(voice ? { audio: { format: 'mp3', voice } } : {}),
      } as any,
      provider,
    );

    const audioBase64 = data.choices?.[0]?.message?.audio?.data;
    if (!audioBase64) {
      res.status(500).json({ error: 'No audio data in response' });
      return;
    }

    res.json({ audio: audioBase64, format: 'mp3' });
  } catch (error: any) {
    console.error('[chat/tts] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/transcribe', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Missing audio file' });
      return;
    }

    const model = req.body.model;
    const provider = req.body.provider;
    const { key, base } = getProviderConfig(provider);

    const formData = new FormData();
    formData.append('model', model);
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append('file', blob, req.file.originalname);

    const response = await fetch(`${base}/audio/transcriptions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}` },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: errorText });
      return;
    }

    const data = await response.json();
    res.json({ text: data.text || '' });
  } catch (error: any) {
    console.error('[chat/transcribe] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
