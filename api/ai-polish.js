/**
 * POST /api/ai-polish
 * Polish upload pack only. Never replace engine decision / invent metrics.
 * Multi-provider router: IAMHC → Groq → Gemini → OpenRouter
 */

const { setCors, readJson } = require('./_lib/iamhc');
const {
  callLLM,
  envConfig,
  anyProviderConfigured,
  extractJsonObject,
} = require('./_lib/llm-router');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJson(req);
    const title = body.title || body.finalTitle || '';
    if (!title) {
      return res.status(400).json({ ok: false, error: 'Title wajib diisi.' });
    }

    if (!anyProviderConfigured()) {
      return res.status(500).json({
        ok: false,
        error:
          'Tidak ada provider AI. Set IAMHC_API_KEY atau GROQ_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY',
        providers: envConfig().providers,
      });
    }

    const lang = body.language || 'id';
    const prompt = `Polish upload pack YouTube. Output JSON murni saja.

Input:
${JSON.stringify({
  title,
  description: body.description || '',
  tags: body.tags || '',
  language: lang,
  niche: body.niche || '',
  angle: body.angle || '',
  keyword: body.keyword || '',
  evidence: body.evidence || {},
})}

Schema:
{
  "status_label":"Layak Test|GO|HOLD",
  "polished_title":"...",
  "polished_description":"...",
  "clean_tags":"tag1, tag2",
  "thumbnail_hook":"HOOK PENDEK",
  "thumbnail_prompt":"prompt gambar English detail visual only",
  "opening_hook":"...",
  "script_outline":["..."],
  "upload_time_advice":"...",
  "why_this_will_work":["..."],
  "risk_note":"..."
}

Rules:
- Jangan ganti niche/angle.
- Jangan mengarang angka.
- Jangan bilang pasti viral.
- Bahasa field teks user-facing: ${lang === 'en' ? 'English' : 'Bahasa Indonesia'}.
- thumbnail_prompt tetap English untuk image model.`;

    const out = await callLLM({
      role: 'polish',
      temperature: 0.5,
      timeoutMs: 70000,
      messages: [
        {
          role: 'system',
          content:
            'You polish YouTube upload packs. Output valid JSON only. Do not invent metrics. Do not change niche/angle. Do not claim guaranteed virality.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const parsed = extractJsonObject(out.text) || {};
    const result = {
      status_label: parsed.status_label || 'Layak Test',
      polished_title: parsed.polished_title || title,
      polished_description:
        parsed.polished_description || body.description || '',
      clean_tags: parsed.clean_tags || body.tags || '',
      thumbnail_hook: parsed.thumbnail_hook || '',
      thumbnail_prompt: parsed.thumbnail_prompt || '',
      opening_hook: parsed.opening_hook || '',
      script_outline: Array.isArray(parsed.script_outline)
        ? parsed.script_outline
        : [],
      upload_time_advice: parsed.upload_time_advice || '',
      why_this_will_work: Array.isArray(parsed.why_this_will_work)
        ? parsed.why_this_will_work
        : [],
      risk_note:
        parsed.risk_note ||
        'Pantau CTR & retention 24-48 jam pertama. Ini bukan jaminan viral.',
    };

    if (!result.polished_title && !result.polished_description) {
      return res.status(502).json({
        ok: false,
        error: 'AI tidak mengembalikan teks polish yang bisa dipakai.',
        model: out.model,
        provider: out.provider,
        raw: String(out.text).slice(0, 1000),
        tried: out.tried || [],
      });
    }

    return res.status(200).json({
      ok: true,
      model: out.model,
      provider: out.provider,
      result,
      raw: out.text,
      usage: out.usage,
      tried: out.tried || [],
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message || String(e),
      tried: e.tried || [],
      providers: envConfig().providers,
    });
  }
};
