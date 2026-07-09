/**
 * GET/POST /api/ai-test
 * Smoke test multi-provider LLM router
 */

const { setCors } = require('./_lib/iamhc');
const {
  callLLM,
  envConfig,
  anyProviderConfigured,
  listConfiguredProviders,
} = require('./_lib/llm-router');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const cfg = envConfig();
    const providers = listConfiguredProviders();

    if (!anyProviderConfigured()) {
      return res.status(500).json({
        ok: false,
        message: 'Belum ada provider AI yang dikonfigurasi.',
        error:
          'Set minimal satu: IAMHC_API_KEY / GROQ_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY',
        providers: [],
      });
    }

    const prompt =
      'Jawab singkat dalam bahasa Indonesia: API AI sudah aktif atau belum? Jawab 1 kalimat saja.';

    const out = await callLLM({
      role: 'test',
      temperature: 0.2,
      timeoutMs: 45000,
      messages: [
        { role: 'system', content: 'Jawab singkat dan jelas.' },
        { role: 'user', content: prompt },
      ],
    });

    return res.status(200).json({
      ok: true,
      message: out.text
        ? 'AI router berhasil dipanggil.'
        : 'Router merespons tapi content kosong.',
      provider: out.provider,
      model: out.model,
      prompt,
      reply: out.text || '',
      usage: out.usage,
      empty: !out.text,
      tried: out.tried || [],
      providersConfigured: providers,
      flags: {
        iamhc: cfg.iamhc,
        groq: cfg.groq,
        gemini: cfg.gemini,
        openrouter: cfg.openrouter,
      },
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: e.message || String(e),
      message: 'AI router gagal dipanggil.',
      tried: e.tried || [],
      providersConfigured: listConfiguredProviders(),
    });
  }
};
