/**
 * GET/POST /api/ai-test
 * Smoke test IAMHC gateway
 */

const {
  callWithFallback,
  envConfig,
  setCors,
  extractTextFromChatCompletion,
} = require('./_lib/iamhc');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const cfg = envConfig();
    if (!cfg.apiKey) {
      return res.status(500).json({ ok: false, error: 'IAMHC_API_KEY belum diset.' });
    }

    const prompt =
      'Jawab singkat dalam bahasa Indonesia: API AI sudah aktif atau belum? Jawab 1 kalimat saja.';

    const models = [cfg.polishModel, cfg.fallbackModel, cfg.strategyModel];
    const out = await callWithFallback({
      models,
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      temperature: 0.2,
      timeoutMs: 45000,
      messages: [
        { role: 'system', content: 'Jawab singkat dan jelas.' },
        { role: 'user', content: prompt },
      ],
    });

    // If fallback logic already ensured non-empty, still return raw fields
    return res.status(200).json({
      ok: true,
      message: out.text
        ? 'AI gateway berhasil dipanggil.'
        : 'Gateway merespons tapi content kosong (cek model/parser).',
      model: out.model,
      baseUrl: cfg.baseUrl,
      prompt,
      reply: out.text || '',
      usage: out.usage,
      empty: !out.text,
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: e.message || String(e),
      message: 'AI gateway gagal dipanggil.',
    });
  }
};
