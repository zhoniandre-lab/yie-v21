/**
 * POST /api/ai-thumb
 * Generate high-CTR thumbnail IMAGE via IAMHC (OpenAI-compatible images API)
 * + optional AI prompt rewrite locked to engine evidence.
 *
 * Body:
 * {
 *   title, hook, niche, angle, language,
 *   prompt?, style?,
 *   scores?, metrics?
 * }
 *
 * Env:
 *   IAMHC_API_KEY
 *   IAMHC_BASE_URL=https://api.iamhc.cn/v1
 *   IAMHC_IMAGE_MODEL=  (contoh: flux, flux-schnell, dall-e-3, gpt-image-1, qwen-image, dll — sesuai market IAMHC)
 *   IAMHC_MODEL=        (untuk rewrite prompt teks)
 */

const {
  callWithFallback,
  envConfig,
  setCors,
  readJson,
  extractJsonObject,
} = require('./_lib/iamhc');

function nicheStylePack(niche = '', angle = '', title = '') {
  const t = `${niche} ${angle} ${title}`.toLowerCase();
  if (/dj|remix|bass|jedag|tiktok|party|club/.test(t)) {
    return {
      style: 'neon club',
      palette: 'cyan, magenta, deep purple, black',
      subject:
        'DJ booth energy, glowing speakers, bass waves, neon fog, night party atmosphere',
      emotion: 'hype, powerful, loud',
    };
  }
  if (/hantu|horor|horror|ghost|haunted|mistis|seram|scary|rеб|رعب/.test(t)) {
    return {
      style: 'cinematic horror',
      palette: 'cold blue, black, pale moonlight, desaturated teal',
      subject:
        'dark hallway or empty house, silhouette, moonlight through window, eerie fog, high tension',
      emotion: 'fear, curiosity, suspense',
    };
  }
  if (/ibu|ayah|family|sedih|maaf|rindu|mother|father|emotional/.test(t)) {
    return {
      style: 'emotional cinematic',
      palette: 'warm amber, soft gold, gentle shadows',
      subject:
        'emotional family moment, soft light on face, memory atmosphere, intimate storytelling',
      emotion: 'touching, heartfelt, nostalgic',
    };
  }
  return {
    style: 'cinematic youtube thumbnail',
    palette: 'high contrast teal and orange',
    subject: 'clear main subject with dramatic lighting and depth',
    emotion: 'curiosity and urgency',
  };
}

function buildHighCtrPrompt({ title, hook, niche, angle, language, stylePack, userPrompt }) {
  const hookText = (hook || '').trim();
  const lang = language || 'id';
  // Important: ask model for VISUAL only. Big readable text is overlaid later by canvas for CTR.
  return [
    `YouTube thumbnail background image, 16:9, ultra sharp, high contrast, click-worthy composition.`,
    `Main subject: ${stylePack.subject}.`,
    `Style: ${stylePack.style}, cinematic lighting, shallow depth of field, professional color grade.`,
    `Color palette: ${stylePack.palette}.`,
    `Emotion: ${stylePack.emotion}.`,
    `Topic context: ${title || angle || niche || 'youtube video'}.`,
    userPrompt ? `Extra direction: ${userPrompt}` : '',
    `Composition rules for high CTR:`,
    `- subject large and clear on LEFT or CENTER, leave clean space on RIGHT for big text overlay`,
    `- face emotion exaggerated if people appear (shock/fear/joy)`,
    `- strong contrast, no clutter, no tiny objects`,
    `- no watermark, no logo, no UI mockup`,
    `- DO NOT render long paragraphs of text`,
    hookText
      ? `- if any text appears, only a tiny optional short word near edge, never full sentence; primary text will be overlaid later: "${hookText}"`
      : `- avoid text in image`,
    `Aspect ratio 16:9, photoreal or premium cinematic illustration, 4k detail.`,
    lang === 'ar' ? 'Middle-east friendly visual cues if relevant.' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function rewritePromptWithTextModel(basePrompt, evidence, cfg) {
  try {
    const out = await callWithFallback({
      models: [cfg.polishModel, cfg.fallbackModel],
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      temperature: 0.5,
      timeoutMs: 45000,
      messages: [
        {
          role: 'system',
          content:
            'You write high-CTR YouTube thumbnail IMAGE prompts. Output JSON only. Never invent analytics metrics. Prefer visual composition over text-in-image.',
        },
        {
          role: 'user',
          content: `Perbaiki prompt gambar thumbnail biar high CTR.
Evidence engine (jangan dikarang):
${JSON.stringify(evidence)}

Prompt awal:
${basePrompt}

Output JSON:
{
  "image_prompt":"prompt final bahasa Inggris yang detail visual",
  "hook_text":"HOOK PENDEK MAX 4 KATA HURUF BESAR",
  "composition_note":"1 kalimat",
  "ctr_reason":"1-2 kalimat kenapa visual ini berpotensi CTR (tanpa klaim pasti viral)"
}`,
        },
      ],
    });
    const parsed = extractJsonObject(out.text) || {};
    return {
      image_prompt: parsed.image_prompt || basePrompt,
      hook_text: parsed.hook_text || evidence.hook || '',
      composition_note: parsed.composition_note || '',
      ctr_reason: parsed.ctr_reason || '',
      model_text: out.model,
    };
  } catch {
    return {
      image_prompt: basePrompt,
      hook_text: evidence.hook || '',
      composition_note: '',
      ctr_reason: '',
      model_text: null,
    };
  }
}

async function generateImage({ prompt, model, baseUrl, apiKey, size = '1792x1024' }) {
  const url = `${String(baseUrl).replace(/\/$/, '')}/images/generations`;
  const attempts = [
    // OpenAI style
    {
      model,
      prompt,
      n: 1,
      size,
      response_format: 'b64_json',
    },
    // Some gateways ignore response_format / use different size
    {
      model,
      prompt,
      n: 1,
      size: '1024x1024',
    },
    {
      model,
      prompt,
    },
  ];

  let lastErr = null;
  for (const body of attempts) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        lastErr = new Error(
          data?.error?.message || data?.error || data?.message || `Image HTTP ${r.status}`
        );
        continue;
      }
      const item = data?.data?.[0] || data?.images?.[0] || data?.result?.[0] || data;
      const b64 =
        item?.b64_json ||
        item?.base64 ||
        item?.image_base64 ||
        (typeof item?.image === 'string' && item.image.length > 200 && !item.image.startsWith('http')
          ? item.image
          : null);
      const imageUrl =
        item?.url ||
        item?.image_url ||
        data?.url ||
        (typeof item?.image === 'string' && item.image.startsWith('http') ? item.image : null);

      if (b64) {
        return { type: 'b64', value: b64, raw: data, model };
      }
      if (imageUrl) {
        return { type: 'url', value: imageUrl, raw: data, model };
      }
      lastErr = new Error('Image API merespons tapi tidak ada url/base64');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Gagal generate image');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJson(req);
    const title = body.title || body.finalTitle || '';
    const hook = body.hook || body.thumbnailHook || '';
    if (!title && !hook && !body.prompt) {
      return res.status(400).json({
        ok: false,
        error: 'Minimal title/hook/prompt diperlukan.',
      });
    }

    const cfg = envConfig();
    if (!cfg.apiKey) {
      return res.status(500).json({ ok: false, error: 'IAMHC_API_KEY belum diset.' });
    }

    const imageModel =
      process.env.IAMHC_IMAGE_MODEL ||
      process.env.IAMHC_IMG_MODEL ||
      'flux'; // user can override in Vercel env to exact market model name

    const stylePack = nicheStylePack(body.niche, body.angle, title);
    const basePrompt = buildHighCtrPrompt({
      title,
      hook,
      niche: body.niche || '',
      angle: body.angle || '',
      language: body.language || 'id',
      stylePack,
      userPrompt: body.prompt || body.direction || '',
    });

    const evidence = {
      title,
      hook,
      niche: body.niche || '',
      angle: body.angle || '',
      language: body.language || 'id',
      scores: body.scores || {},
      metrics: body.metrics || {},
    };

    const rewritten = body.skipRewrite
      ? {
          image_prompt: basePrompt,
          hook_text: hook,
          composition_note: 'left/center subject, right text space',
          ctr_reason: 'High contrast subject + clean text space.',
          model_text: null,
        }
      : await rewritePromptWithTextModel(basePrompt, evidence, cfg);

    const finalPrompt = rewritten.image_prompt || basePrompt;
    const img = await generateImage({
      prompt: finalPrompt,
      model: imageModel,
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      size: body.size || '1792x1024',
    });

    return res.status(200).json({
      ok: true,
      model_image: img.model,
      model_text: rewritten.model_text,
      result: {
        image_type: img.type, // b64 | url
        image: img.value,
        mime: 'image/png',
        prompt_used: finalPrompt,
        hook_text: rewritten.hook_text || hook,
        composition_note: rewritten.composition_note || '',
        ctr_reason: rewritten.ctr_reason || '',
        style_pack: stylePack,
        note:
          'Gambar AI = background high-CTR. Teks hook besar digambar engine di canvas agar lebih terbaca.',
      },
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: e.message || String(e),
      hint:
        'Pastikan IAMHC_IMAGE_MODEL di Vercel diisi nama model gambar yang tersedia di Model Market IAMHC. Endpoint yang dipakai: /v1/images/generations',
    });
  }
};
