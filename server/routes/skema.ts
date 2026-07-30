import { Router, Request, Response } from 'express';
import { chatCompletion, streamChatCompletion, ChatMessage } from '../services/mimoService';
import { analyzeImages } from '../services/agentService';
import { buildSpecSystemPrompt } from '../services/skemaSpecPrompt';
import * as skemaDb from '../db/skemaProjects';
import * as library from '../services/skemaLibraryService';
import { SEED_COMPONENTS } from '../data/seedComponents';

const router = Router();

router.get('/projects', async (_req: Request, res: Response) => {
  try {
    const projects = await skemaDb.getSkemaProjects();
    res.json({ projects });
  } catch (error: any) {
    console.error('[skema/projects GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const project = await skemaDb.getSkemaProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project });
  } catch (error: any) {
    console.error('[skema/projects/:id GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/projects/:id', async (req: Request, res: Response) => {
  try {
    const { title, description, project_type, boards_json, theme_json, full_design_spec_json, created_at, updated_at } = req.body;
    if (!title || boards_json === undefined) {
      res.status(400).json({ error: 'Missing required fields: title, boards_json' });
      return;
    }
    const now = new Date().toISOString();
    await skemaDb.saveSkemaProject({
      id: req.params.id,
      title,
      description,
      project_type: project_type || 'canvas',
      boards_json,
      theme_json: theme_json || null,
      full_design_spec_json: full_design_spec_json || null,
      created_at: created_at || now,
      updated_at: updated_at || now,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('[skema/projects/:id PUT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/projects/:id', async (req: Request, res: Response) => {
  try {
    await skemaDb.deleteSkemaProject(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[skema/projects/:id DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

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
    console.error('[skema/generate-image] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-spec', async (req: Request, res: Response) => {
  try {
    const { prompt, layout, projectType, slideCount, theme, images, model, provider, stream, currentSpec, referenceSpec } = req.body;

    if (!prompt) {
      res.status(400).json({ error: 'Missing required field: prompt' });
      return;
    }

    let imageAnalysis = '';
    if (images && images.length > 0) {
      imageAnalysis = await analyzeImages(images, model, provider);
    }

    const systemPrompt = buildSpecSystemPrompt({
      layout: layout || '4:5',
      projectType: projectType || 'ig-carousel',
      slideCount,
      images,
      imageAnalysis,
      currentSpec,
      referenceSpec,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    if (stream) {
      const response = await streamChatCompletion(
        {
          model: model || 'mimo-v2.5',
          messages,
          stream: true,
          thinking: { type: 'disabled' },
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
      } catch {
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

      let specText = data.choices?.[0]?.message?.content?.trim() || '';
      specText = specText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

      try {
        const spec = JSON.parse(specText);
        res.json({ spec });
      } catch {
        res.status(500).json({ error: 'Failed to generate valid JSON spec', raw: specText.substring(0, 1000) });
      }
    }
  } catch (error: any) {
    console.error('[skema/generate-spec] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-html', async (req: Request, res: Response) => {
  try {
    const { boardDescription, layout, prompt: userPrompt, model, provider, stream, isReasoning, currentHtml, history, projectType, images, slideNumber, totalSlides, referenceSlideHtml } = req.body;

    const layoutDims: Record<string, string> = {
      '16:9': '1920x1080',
      '1:1': '1080x1080',
      '9:16': '1080x1920',
      '4:5': '1080x1350',
    };
    const dims = layoutDims[layout] || '1920x1080';

    const isFollowUp = !!currentHtml;

    let imageAnalysis = '';
    if (images && images.length > 0) {
      imageAnalysis = await analyzeImages(images, model, provider);
    }

    let imagePrompt = '';
    if (images && images.length > 0) {
      const imageLines = images.map((img: any) => `- "${img.label}" \u2192 ${img.url}`).join('\n');
      imagePrompt = `\n\nAvailable images:\n${imageLines}\n\nUse these images with <img> tags. Use object-fit: cover for backgrounds. Do NOT use placeholder gradients when images are provided.`;
      if (imageAnalysis) {
        imagePrompt += `\n\nImage Analysis (from vision model — use this to inform your design):\n${imageAnalysis}`;
      }
    }

    let igPrompt = '';
    if (projectType === 'ig-carousel') {
      igPrompt = `\n\nINSTAGRAM CAROUSEL DESIGN RULES:\n- Mobile-first: large text, high contrast, bold typography\n- Minimum 24px body text, 32px+ headlines\n- Leave 5% safe margin on all edges\n- Vibrant, eye-catching colors for thumbnail views\n- Consistent typography, colors, layout across slides\n- 4:5 aspect ratio (1080\u00d71350px)`;
      if (slideNumber && totalSlides) {
        igPrompt += `\n- Slide ${slideNumber} of ${totalSlides}`;
        if (slideNumber === 1) igPrompt += `\n- First slide: hook attention with bold headline and striking visual`;
        else if (slideNumber === totalSlides) igPrompt += `\n- Last slide: strong CTA (Follow, Save, Comment, Share)`;
        else igPrompt += `\n- Middle slide: deliver one key point clearly`;
        if (slideNumber < totalSlides) igPrompt += `\n- Add subtle "swipe \u2192" indicator`;
      }
    } else if (projectType === 'ig-story') {
      igPrompt = `\n\nINSTAGRAM STORY/REEL DESIGN RULES:\n- Full-screen 9:16 (1080\u00d71920px)\n- Thumb-friendly mobile interaction\n- Text in center 80% (safe zone)\n- Min 28px body text, high contrast\n- Top 15% and bottom 20% are IG UI overlays \u2014 no content there`;
    }

    let referencePrompt = '';
    if (referenceSlideHtml && !isFollowUp) {
      referencePrompt = `\n\nREFERENCE (slide 1 HTML for visual consistency):\n\`\`\`html\n${referenceSlideHtml.substring(0, 6000)}\n\`\`\`\nMatch its colors, typography, spacing. This slide continues the narrative.`;
    }

    const systemPrompt = isFollowUp
      ? `You are an expert HTML/CSS code editor. The user has an existing HTML file and wants modifications.
You will receive the current HTML and a modification request.
Apply ONLY the requested changes. Preserve all existing design, content, and structure that isn't affected.
Output the COMPLETE modified HTML file (not just the changed parts).
Output ONLY raw HTML starting with <!DOCTYPE html>.${imagePrompt}${igPrompt}`
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
- Output ONLY valid HTML starting with <!DOCTYPE html>${imagePrompt}${igPrompt}${referencePrompt}`;

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
    console.error('[skema/generate-html] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/components', async (req: Request, res: Response) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const projectType = typeof req.query.projectType === 'string' ? req.query.projectType : undefined;
    const components = await library.listComponents({ category, projectType });
    res.json({ components });
  } catch (error: any) {
    console.error('[skema/components GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/components/:id', async (req: Request, res: Response) => {
  try {
    const component = await library.getComponent(req.params.id);
    if (!component) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    res.json({ component });
  } catch (error: any) {
    console.error('[skema/components/:id GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components', async (req: Request, res: Response) => {
  try {
    const { name, category, contentType, projectType, description, tags, content, specSnippet, thumbnail, isGlobal } = req.body;
    if (!name || !category || !contentType || !content) {
      res.status(400).json({ error: 'Missing required fields: name, category, contentType, content' });
      return;
    }
    const component = await library.addComponent({
      name,
      category,
      contentType,
      projectType: projectType || 'all',
      description: description || '',
      tags: tags || [],
      content,
      specSnippet,
      thumbnail,
      isGlobal: isGlobal !== false,
    });
    res.json({ component });
  } catch (error: any) {
    console.error('[skema/components POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/components/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await library.deleteComponent(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Component not found' });
      return;
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[skema/components/:id DELETE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components/search', async (req: Request, res: Response) => {
  try {
    const { query, projectType, topK = 5 } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Missing required field: query' });
      return;
    }
    const results = await library.searchComponents(query, projectType, topK);
    res.json({ components: results });
  } catch (error: any) {
    console.error('[skema/components/search POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components/reindex', async (req: Request, res: Response) => {
  try {
    const count = await library.reindexAll();
    res.json({ success: true, count });
  } catch (error: any) {
    console.error('[skema/components/reindex POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/components/seed', async (req: Request, res: Response) => {
  try {
    const existing = await library.listComponents();
    if (existing.length > 0) {
      res.json({ success: true, message: `Library already has ${existing.length} components. Skipped seeding.`, count: 0 });
      return;
    }

    let count = 0;
    for (const comp of SEED_COMPONENTS) {
      await library.addComponent(comp as any);
      count++;
    }

    res.json({ success: true, message: `Seeded ${count} components`, count });
  } catch (error: any) {
    console.error('[skema/components/seed POST] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
