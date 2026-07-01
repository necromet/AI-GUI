import { Router, Request, Response } from 'express';
import { chatCompletion, streamChatCompletion, ChatMessage } from '../services/mimoService';

const router = Router();

router.post('/generate-image', async (req: Request, res: Response) => {
  try {
    const { prompt, size = '1024x1024', n = 1 } = req.body;

    if (!prompt) {
      res.status(400).json({ error: 'Missing required field: prompt' });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
      return;
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt,
        n,
        size,
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: errorText });
      return;
    }

    const data = await response.json();
    const images = (data.data || []).map((img: any) => ({
      b64_json: img.b64_json,
      revised_prompt: img.revised_prompt,
    }));

    res.json({ images });
  } catch (error: any) {
    console.error('[stitch/generate-image] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-html', async (req: Request, res: Response) => {
  try {
    const { boardDescription, layout, prompt: userPrompt, model, provider, stream, isReasoning, currentHtml, history } = req.body;

    const layoutDims: Record<string, string> = {
      '16:9': '1920x1080',
      '1:1': '1080x1080',
      '9:16': '1080x1920',
    };
    const dims = layoutDims[layout] || '1920x1080';

    const isFollowUp = !!currentHtml;

    const systemPrompt = isFollowUp
      ? `You are an expert HTML/CSS code editor. The user has an existing HTML file and wants modifications.
You will receive the current HTML and a modification request.
Apply ONLY the requested changes. Preserve all existing design, content, and structure that isn't affected.
Output the COMPLETE modified HTML file (not just the changed parts).
Output ONLY raw HTML starting with <!DOCTYPE html>.`
      : `You are an expert HTML/CSS designer. Generate a single self-contained HTML file based on the user's description.

Output ONLY the raw HTML code. No markdown fences, no explanation. The HTML must be complete with inline CSS, ready to render in an iframe.

Layout: ${layout} (${dims}px)
${boardDescription ? `Description: ${boardDescription}` : ''}

Rules:
- The entire design must fit within the given layout dimensions
- Include a viewport meta tag
- Make it visually polished with modern CSS (flexbox, grid where appropriate)
- All images should use placeholder gradients or SVG patterns if no actual URLs are provided
- Ensure text is readable and well-sized
- Output ONLY valid HTML starting with <!DOCTYPE html>`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    const userContent = currentHtml
      ? `Current HTML:\n\`\`\`html\n${currentHtml}\n\`\`\`\n\nModification request: ${userPrompt || 'Make improvements'}`
      : (userPrompt || 'Generate a clean, modern HTML layout');

    messages.push({ role: 'user', content: userContent });

    if (stream) {
      const response = await streamChatCompletion(
        {
          model: model || 'mimo-v2.5',
          messages,
          stream: true,
          thinking: isReasoning ? { type: 'enabled' } : { type: 'disabled' },
        },
        provider || 'mimo',
      );

      if (!response.ok) {
        const errorText = await response.text();
        res.status(response.status).json({ error: errorText });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

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
      const data = await chatCompletion(
        {
          model: model || 'mimo-v2.5',
          messages,
          stream: false,
          thinking: { type: 'disabled' },
        },
        provider || 'mimo',
      );

      let html = data.choices?.[0]?.message?.content?.trim() || '';

      html = html.replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '');

      if (!html || !/<!doctype/i.test(html)) {
        res.status(500).json({ error: 'Failed to generate valid HTML' });
        return;
      }

      res.json({ html });
    }
  } catch (error: any) {
    console.error('[stitch/generate-html] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
