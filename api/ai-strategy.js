/**
 * POST /api/ai-strategy
 * AI Strategy Review — reads engine evidence, does NOT invent metrics.
 * Uses multi-provider LLM router (IAMHC → Groq → Gemini → OpenRouter).
 */

const { setCors, readJson } = require('./_lib/iamhc');
const {
  callLLM,
  envConfig,
  anyProviderConfigured,
  extractJsonObject,
} = require('./_lib/llm-router');

function asArray(v) {
  return Array.isArray(v) ? v : [];
}
function asObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}
function levelFromScore(n) {
  n = Number(n) || 0;
  if (n >= 80) return 'kuat';
  if (n >= 65) return 'cukup kuat';
  if (n >= 50) return 'sedang';
  return 'lemah';
}

function normalizeInput(body) {
  const fd = asObject(body.finalDecision) || asObject(body.final_decision) || {};
  const scores = asObject(body.scores) || {};
  const finalTitle =
    body.finalTitle || body.final_title || body.title || fd.title || '';
  const keyword = body.keyword || body.seed || fd.keyword || '';
  const angle = body.angle || fd.angle || keyword;
  const hasCore = !!(
    finalTitle ||
    fd.title ||
    fd.score != null ||
    scores.final != null
  );

  return {
    ok: hasCore,
    keyword,
    angle,
    niche: body.niche || fd.niche || '',
    language: body.language || body.lang || 'id',
    region: body.region || '',
    finalTitle,
    description: body.description || '',
    tags: body.tags || '',
    thumbnailHook: body.thumbnailHook || body.thumbnail_hook || fd.hook || '',
    scores: {
      final: scores.final ?? fd.score ?? null,
      search: scores.search ?? fd.search ?? null,
      browse: scores.browse ?? fd.browse ?? null,
      algorithm: scores.algorithm ?? fd.algo ?? null,
      patternBorn: scores.patternBorn ?? fd.patternBorn ?? null,
      creatorHook: scores.creatorHook ?? fd.creatorHook ?? null,
      quality: scores.quality ?? fd.quality ?? null,
      languageFit: scores.languageFit ?? fd.languageFit ?? null,
      intentFit: scores.intentFit ?? fd.intentFit ?? null,
      opportunity: scores.opportunity ?? fd.opportunity ?? null,
    },
    metrics: body.metrics || {},
    qualifiedCompetitors: asArray(body.qualifiedCompetitors),
    rejectedCompetitors: asArray(body.rejectedCompetitors),
    patterns: asArray(body.patterns),
    candidateTitles: asArray(body.candidateTitles),
    manualCalibration: asArray(body.manualCalibration),
    notes: body.notes || '',
    engineFacts: body.engineFacts || null,
  };
}

function normalizeStrategyResult(rawObj, input) {
  const x = asObject(rawObj) || {};
  const altsSrc = asArray(x.title_alternatives).length
    ? asArray(x.title_alternatives)
    : asArray(x.alternative_titles);
  const alts = altsSrc.map((a, i) => {
    if (typeof a === 'string') {
      return { role: i === 0 ? 'PRIMARY ALT' : 'ALT', title: a, reason: '' };
    }
    return {
      role: a.role || (i === 0 ? 'PRIMARY ALT' : 'ALT'),
      title: a.title || '',
      reason: a.reason || a.why || '',
    };
  });

  const why = asArray(x.why_title).length
    ? asArray(x.why_title)
    : [x.title_critique, x.strategic_verdict].filter(Boolean);

  const plan = asArray(x.first_24h_plan).length
    ? asArray(x.first_24h_plan)
    : asArray(x.action_plan);

  const toStrategy = (v, score) => {
    const o = asObject(v);
    if (o) {
      return {
        score_label: o.score_label || levelFromScore(score),
        explanation: o.explanation || o.summary || o.text || '',
        keywords_to_keep: asArray(o.keywords_to_keep),
        keywords_to_avoid: asArray(o.keywords_to_avoid),
        hook_direction: o.hook_direction || o.hook || '',
      };
    }
    return {
      score_label: levelFromScore(score),
      explanation: String(v || ''),
      keywords_to_keep: [],
      keywords_to_avoid: [],
      hook_direction: '',
    };
  };

  const toThumb = (v, prompt) => {
    const o = asObject(v);
    if (o) {
      return {
        hook_text: o.hook_text || o.hook || input.thumbnailHook || '',
        visual_prompt: o.visual_prompt || o.prompt || prompt || '',
        color_direction: o.color_direction || o.color || '',
        composition: o.composition || '',
        ctr_reason: o.ctr_reason || o.reason || '',
      };
    }
    const s = String(v || '');
    return {
      hook_text: input.thumbnailHook || '',
      visual_prompt: prompt || s,
      color_direction: '',
      composition: '',
      ctr_reason: s,
    };
  };

  const toRisk = (v) => {
    const o = asObject(v);
    if (o) {
      return {
        risk_level: o.risk_level || o.level || 'sedang',
        main_risk: o.main_risk || o.risk || o.summary || '',
        mitigation: o.mitigation || o.fix || '',
      };
    }
    return { risk_level: 'sedang', main_risk: String(v || ''), mitigation: '' };
  };

  const strategic_title =
    x.strategic_title ||
    x.recommended_title ||
    (alts[0] && alts[0].title) ||
    input.finalTitle ||
    '';

  const strategic_verdict =
    x.strategic_verdict || x.verdict_label || x.verdict || 'Layak Test';

  let confidence = x.confidence;
  if (confidence == null) {
    const f = Number(input.scores.final) || 0;
    const o = Number(input.scores.opportunity) || f;
    confidence = Math.round(f * 0.7 + o * 0.3);
  }

  let agree = x.agree_with_engine_title;
  if (agree == null) {
    const a = String(strategic_title || '').toLowerCase().trim();
    const b = String(input.finalTitle || '').toLowerCase().trim();
    agree =
      !a ||
      !b ||
      a === b ||
      a.includes(b.slice(0, 18)) ||
      b.includes(a.slice(0, 18));
  }

  return {
    strategic_verdict,
    confidence,
    agree_with_engine_title: !!agree,
    strategic_title,
    why_title: why,
    title_alternatives: alts,
    search_strategy: toStrategy(x.search_strategy, input.scores.search),
    browse_strategy: toStrategy(x.browse_strategy, input.scores.browse),
    thumbnail_strategy: toThumb(x.thumbnail_strategy, x.thumbnail_prompt || ''),
    opening_hook: x.opening_hook || '',
    script_outline: asArray(x.script_outline),
    upload_time_advice: x.upload_time_advice || x.upload_time || '',
    first_24h_plan: plan,
    risk_assessment: toRisk(x.risk_assessment || x.risk || ''),
    data_gaps: asArray(x.data_gaps),
  };
}

function buildPrompt(input) {
  const compact = {
    keyword: input.keyword,
    angle: input.angle,
    niche: input.niche,
    language: input.language,
    region: input.region,
    finalTitle: input.finalTitle,
    thumbnailHook: input.thumbnailHook,
    scores: input.scores,
    metrics: input.metrics,
    qualifiedCompetitors: input.qualifiedCompetitors.slice(0, 8),
    rejectedCompetitors: input.rejectedCompetitors.slice(0, 5),
    patterns: input.patterns.slice(0, 6),
    candidateTitles: input.candidateTitles.slice(0, 6),
    notes: input.notes,
    engineFacts: input.engineFacts,
  };

  return `Kamu adalah AI Strategy Reviewer untuk YouTube Intelligence Engine.
BUKAN chatbot. BUKAN pengganti scoring engine.
Tugas: baca evidence engine, kritik strategi, beri verdict, alternatif judul, search/browse/thumbnail strategy, first 24h plan.

ATURAN KERAS:
1. Jangan mengarang angka views/search volume yang tidak ada di evidence.
2. Jangan bilang "pasti viral" / "dijamin" / "100%".
3. Kalau data tipis, bilang risk + data_gaps.
4. Output HARUS JSON murni (tanpa markdown, tanpa penjelasan di luar JSON).
5. Bahasa output: ${input.language === 'en' ? 'English' : 'Bahasa Indonesia'}.
6. Hormati engineFacts bila ada (saturasi, gap_words, top_competitors).

Schema output yang WAJIB:
{
  "strategic_verdict": "string singkat verdict",
  "confidence": 0-100,
  "agree_with_engine_title": true,
  "strategic_title": "judul strategis final",
  "why_title": ["alasan1","alasan2"],
  "title_alternatives": [{"role":"PRIMARY ALT","title":"...","reason":"..."}],
  "search_strategy": {
    "score_label":"kuat|cukup kuat|sedang|lemah",
    "explanation":"...",
    "keywords_to_keep":["..."],
    "keywords_to_avoid":["..."]
  },
  "browse_strategy": {
    "score_label":"kuat|cukup kuat|sedang|lemah",
    "explanation":"...",
    "hook_direction":"..."
  },
  "thumbnail_strategy": {
    "hook_text":"HOOK PENDEK",
    "visual_prompt":"prompt gambar",
    "color_direction":"...",
    "composition":"...",
    "ctr_reason":"..."
  },
  "opening_hook":"kalimat opening 1-2 kalimat",
  "script_outline":["beat1","beat2","beat3"],
  "upload_time_advice":"saran jam/hari",
  "first_24h_plan":["aksi1","aksi2","aksi3"],
  "risk_assessment": {"risk_level":"rendah|sedang|tinggi","main_risk":"...","mitigation":"..."},
  "data_gaps":["..."]
}

EVIDENCE ENGINE (JSON):
${JSON.stringify(compact)}`;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = await readJson(req);
    const input = normalizeInput(body);
    if (!input.ok) {
      return res.status(400).json({
        ok: false,
        error: 'Data engine tidak lengkap.',
        need: 'finalDecision atau finalTitle + scores',
      });
    }

    if (!anyProviderConfigured()) {
      return res.status(500).json({
        ok: false,
        error:
          'Tidak ada provider AI. Set IAMHC_API_KEY atau GROQ_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY',
        providers: envConfig().providers,
      });
    }

    const prompt = buildPrompt(input);
    const out = await callLLM({
      role: 'strategy',
      temperature: 0.4,
      timeoutMs: 90000,
      messages: [
        {
          role: 'system',
          content:
            'You are a strict YouTube strategy reviewer. Output valid JSON only. Never invent metrics. Never claim guaranteed virality. Stay bound to provided engine evidence.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const parsed = extractJsonObject(out.text);
    if (!parsed) {
      const fallbackResult = normalizeStrategyResult(
        {
          strategic_verdict: 'TEST DULU',
          strategic_title: input.finalTitle,
          why_title: [String(out.text).slice(0, 500)],
          first_24h_plan: [
            'Pantau CTR 24 jam pertama',
            'Jangan klaim pasti viral',
          ],
        },
        input
      );
      return res.status(200).json({
        ok: true,
        model: out.model,
        provider: out.provider,
        result: fallbackResult,
        raw: out.text,
        usage: out.usage,
        tried: out.tried || [],
        warning:
          'AI tidak mengembalikan JSON valid; hasil dinormalisasi dari teks.',
      });
    }

    const result = normalizeStrategyResult(parsed, input);
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
