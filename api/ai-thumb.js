/**
 * POST /api/ai-thumb
 * Generate high-CTR thumbnail IMAGE via IAMHC.
 * - Baca intent keyword + kompetitor (jangan ngarang di luar jalur)
 * - Prefer base64 agar browser tidak kena CORS/403 URL eksternal
 */

const {
  callWithFallback,
  envConfig,
  setCors,
  readJson,
  extractJsonObject,
} = require('./_lib/iamhc');

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function detectIntent(seed = '', angle = '', title = '', niche = '') {
  const t = `${seed} ${angle} ${title} ${niche}`.toLowerCase();
  if (/(sebelum.*lahir|lahir tanpa|pergi sebelum|meninggal sebelum)/.test(t)) {
    return {
      id: 'loss_before_birth',
      label: 'Kehilangan sebelum lahir',
      searcher_goal: 'Orang mencari cerita/lagu emosional tentang ibu yang tiada sebelum anak lahir',
      visual:
        'soft memory of mother figure, empty cradle or soft light silhouette, emotional longing, not horror, not DJ',
      avoid: 'ghost jump scare, club neon, funny meme face, horror blood',
    };
  }
  if (/(rindu ibu|kangen ibu|miss mom|rindu mama)/.test(t)) {
    return {
      id: 'longing_mother',
      label: 'Rindu ibu',
      searcher_goal: 'Orang mencari lagu/cerita rindu ibu yang menyentuh',
      visual:
        'adult child missing mother, warm memory light, soft tears or quiet emotion, intimate portrait mood',
      avoid: 'horror, party, DJ, random clickbait monster',
    };
  }
  if (/(maaf ibu|ampuni|menyesal|sorry mom)/.test(t)) {
    return {
      id: 'apology_mother',
      label: 'Maaf ke ibu',
      searcher_goal: 'Orang mencari cerita penyesalan/maaf kepada ibu',
      visual: 'emotional apology atmosphere, warm dim light, sincere facial emotion',
      avoid: 'horror, comedy exaggeration, neon club',
    };
  }
  if (/(dj|remix|full bass|jedag|jedug|nonstop|club mix)/.test(t)) {
    return {
      id: 'dj_remix',
      label: 'DJ / Remix',
      searcher_goal: 'Orang mencari DJ remix full bass / viral untuk diputar',
      visual: 'DJ booth, neon bass energy, club lights, speaker glow',
      avoid: 'sad family story, horror house',
    };
  }
  if (/(hantu|horor|horror|ghost|haunted|mistis|rumah kosong)/.test(t)) {
    return {
      id: 'horror',
      label: 'Horror',
      searcher_goal: 'Orang mencari cerita horor/suara misterius/rumah angker',
      visual: 'dark empty house, silhouette, moonlight, suspense fog',
      avoid: 'cute family, DJ neon party',
    };
  }
  if (/(ibu|ayah|family|mother|father|sedih|doa)/.test(t)) {
    return {
      id: 'family_emotion',
      label: 'Family emotional',
      searcher_goal: 'Orang mencari cerita keluarga emosional',
      visual: 'cinematic family emotion, warm amber light, intimate storytelling',
      avoid: 'horror gore, DJ party',
    };
  }
  return {
    id: 'general',
    label: 'General',
    searcher_goal: 'Orang mencari konten sesuai keyword yang diketik di YouTube',
    visual: 'clear main subject, dramatic lighting, high contrast thumbnail subject',
    avoid: 'off-topic random elements, unreadable clutter',
  };
}

function summarizeCompetitors(list) {
  return asArray(list)
    .slice(0, 8)
    .map((v, i) => {
      const title = v.title || v.normTitle || '';
      const views = v.views != null ? v.views : '';
      const ch = v.channel || v.channelTitle || '';
      return `${i + 1}. ${title}${views !== '' ? ` | views:${views}` : ''}${ch ? ` | ${ch}` : ''}`;
    })
    .filter((x) => x.length > 3);
}

function extractVisualCuesFromTitles(titles) {
  const joined = titles.join(' ').toLowerCase();
  const cues = [];
  if (/ibu|mama|bunda|mother|mom/.test(joined)) cues.push('mother figure / maternal emotion');
  if (/rindu|kangen|miss|longing/.test(joined)) cues.push('longing / missing atmosphere');
  if (/maaf|sorry|ampun|menyesal/.test(joined)) cues.push('apology / regret emotion');
  if (/lahir|born/.test(joined)) cues.push('birth / beginning of life memory');
  if (/lagu|song|music/.test(joined)) cues.push('musical storytelling mood (not DJ club unless explicit)');
  if (/rumah|house|pintu|door|suara|sound/.test(joined)) cues.push('house / door / sound mystery cues');
  if (/dj|bass|remix|neon/.test(joined)) cues.push('neon bass / remix energy');
  if (!cues.length) cues.push('match dominant competitor emotional theme');
  return cues;
}

function buildHighCtrPrompt({
  title,
  hook,
  niche,
  angle,
  seed,
  language,
  intent,
  competitorTitles,
  userPrompt,
  patterns,
}) {
  const hookText = (hook || '').trim();
  const comps = competitorTitles.slice(0, 6);
  const cues = extractVisualCuesFromTitles(comps.concat([title, angle, seed]));
  return [
    `YouTube thumbnail BACKGROUND image, 16:9, ultra sharp, high contrast, click-worthy.`,
    `IMPORTANT: Stay on-intent. This is NOT a random pretty image.`,
    `Searcher intent (like a real YouTube user typing this query): ${intent.searcher_goal}`,
    `Intent label: ${intent.label}`,
    `Keyword/seed: ${seed || angle || ''}`,
    `Winning title context: ${title || ''}`,
    `Angle: ${angle || ''}`,
    `Niche: ${niche || ''}`,
    `Main visual direction: ${intent.visual}`,
    `Visual cues from competitor titles (study them, do not copy logos/faces exactly): ${cues.join('; ')}`,
    comps.length
      ? `Competitor title patterns to respect:\n${comps.map((t) => `- ${t}`).join('\n')}`
      : 'Competitor list thin: stay strictly on keyword intent.',
    patterns && patterns.length
      ? `Title patterns mined: ${patterns.map((p) => p.label || p).slice(0, 5).join(', ')}`
      : '',
    userPrompt ? `Creator extra direction (only if on-intent): ${userPrompt}` : '',
    `Avoid completely: ${intent.avoid}`,
    `Composition for high CTR:`,
    `- large subject LEFT/CENTER, clean RIGHT space for big text overlay`,
    `- exaggerated readable emotion if person appears`,
    `- strong contrast, no clutter, no watermark, no YouTube UI`,
    `- DO NOT write long text in image; hook will be overlaid later: "${hookText || 'HOOK'}"`,
    `Photoreal or premium cinematic illustration, 4k detail, 16:9.`,
    language === 'ar' ? 'Use culturally fitting visuals if relevant.' : '',
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
      temperature: 0.4,
      timeoutMs: 45000,
      messages: [
        {
          role: 'system',
          content:
            'You design on-intent high-CTR YouTube thumbnail image prompts from competitor evidence. Output JSON only. Never invent view counts. Never go off-topic from searcher intent. Prefer visual composition; big text is overlaid later.',
        },
        {
          role: 'user',
          content: `Buat prompt gambar thumbnail yang TAAT INTENT + baca kompetitor.
Evidence:
${JSON.stringify(evidence)}

Prompt dasar:
${basePrompt}

Output JSON:
{
  "image_prompt":"English detailed visual prompt, on-intent",
  "hook_text":"MAX 4 WORDS UPPERCASE",
  "composition_note":"1 sentence",
  "ctr_reason":"1-2 sentences, no guaranteed viral claim",
  "on_intent_check":"why this stays on the searcher goal"
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
      on_intent_check: parsed.on_intent_check || '',
      model_text: out.model,
    };
  } catch {
    return {
      image_prompt: basePrompt,
      hook_text: evidence.hook || '',
      composition_note: '',
      ctr_reason: '',
      on_intent_check: '',
      model_text: null,
    };
  }
}

async function fetchUrlAsBase64(imageUrl, apiKey) {
  const headerVariants = [
    {
      'User-Agent': 'Mozilla/5.0 (compatible; YIE/21.1)',
      Accept: 'image/*,*/*',
    },
    {
      'User-Agent': 'Mozilla/5.0 (compatible; YIE/21.1)',
      Accept: 'image/*,*/*',
      Authorization: `Bearer ${apiKey}`,
    },
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://api.iamhc.cn/',
    },
  ];

  let lastErr = null;
  for (const headers of headerVariants) {
    try {
      const r = await fetch(imageUrl, { headers });
      if (!r.ok) {
        lastErr = new Error(`Fetch image HTTP ${r.status}`);
        continue;
      }
      const ctype = (r.headers.get('content-type') || 'image/png').split(';')[0];
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 100) {
        lastErr = new Error('Image terlalu kecil / kosong');
        continue;
      }
      return {
        b64: buf.toString('base64'),
        mime: ctype.startsWith('image/') ? ctype : 'image/png',
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Tidak bisa unduh image URL ke base64');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isConcurrencyError(msg = '') {
  return /concurrency|rate limit|too many|limit:\s*\d+/i.test(String(msg));
}


async function generateImage({ prompt, model, baseUrl, apiKey, size = '1024x1024' }) {
  const url = `${String(baseUrl).replace(/\/$/, '')}/images/generations`;
  // Satu request per attempt. Kalau concurrency: tunggu lalu coba lagi (serial, tidak parallel).
  const maxAttempts = Math.max(1, Math.min(8, parseInt(process.env.IAMHC_IMAGE_MAX_ATTEMPTS || '6', 10) || 6));
  const waitSec = Math.max(5, Math.min(25, parseInt(process.env.IAMHC_IMAGE_WAIT_SEC || '12', 10) || 12));
  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: size || '1024x1024',
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg =
          data?.error?.message || data?.error || data?.message || `Image HTTP ${r.status}`;
        lastErr = new Error(String(msg));
        lastErr.concurrency = isConcurrencyError(msg);
        if (lastErr.concurrency && attempt < maxAttempts) {
          await sleep(waitSec * 1000);
          continue;
        }
        throw lastErr;
      }

      const item = data?.data?.[0] || data?.images?.[0] || data?.result?.[0] || data;
      let b64 =
        item?.b64_json ||
        item?.base64 ||
        item?.image_base64 ||
        (typeof item?.image === 'string' &&
        item.image.length > 200 &&
        !item.image.startsWith('http')
          ? item.image
          : null);
      let mime = 'image/png';
      const imageUrl =
        item?.url ||
        item?.image_url ||
        data?.url ||
        (typeof item?.image === 'string' && item.image.startsWith('http')
          ? item.image
          : null);

      if (!b64 && imageUrl) {
        try {
          const got = await fetchUrlAsBase64(imageUrl, apiKey);
          b64 = got.b64;
          mime = got.mime || mime;
        } catch (e) {
          return {
            type: 'url',
            value: imageUrl,
            mime,
            raw: data,
            model,
            attempts: attempt,
            warning:
              'Image URL tidak bisa di-proxy ke base64. Browser mungkin gagal load (CORS/403).',
          };
        }
      }

      if (b64) {
        const clean = String(b64).replace(/^data:image\/\w+;base64,/, '');
        return {
          type: 'b64',
          value: clean,
          mime,
          raw: data,
          model,
          source_url: imageUrl || null,
          attempts: attempt,
        };
      }
      throw new Error('Image API merespons tapi tidak ada url/base64');
    } catch (e) {
      lastErr = e;
      if (e && e.concurrency && attempt < maxAttempts) {
        await sleep(waitSec * 1000);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('Gagal generate image setelah antre');
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
    const seed = body.seed || body.keyword || '';
    const angle = body.angle || '';
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
      'step-image-edit-2';

    const competitors = asArray(body.qualifiedCompetitors || body.competitors);
    const competitorTitles = competitors
      .map((v) => v.title || '')
      .filter(Boolean)
      .concat(asArray(body.competitorTitles).map(String));
    const patterns = asArray(body.patterns);
    const intent = detectIntent(
      seed,
      angle,
      title,
      `${body.niche || ''} ${body.nicheNote || ''} ${body.contentFormat || ''}`
    );
    // format lock from client
    if (String(body.contentFormat || body.nicheNote || '').match(/story_song|cerita jadi lagu|lagu sedih|lirik/i)) {
      intent.id = 'longing_mother';
      intent.label = 'Cerita jadi lagu / emosional';
      intent.searcher_goal =
        'Orang mencari lagu/cerita-jadi-lagu emosional (bukan DJ remix, bukan horor)';
      intent.visual =
        'emotional song storytelling, mother/child memory, soft cinematic light, music mood without DJ club neon';
      intent.avoid = 'DJ neon club, horror ghost, funny meme, random off-topic';
    }

    const basePrompt = buildHighCtrPrompt({
      title,
      hook,
      niche: body.niche || '',
      angle,
      seed,
      language: body.language || 'id',
      intent,
      competitorTitles,
      userPrompt: body.prompt || body.direction || '',
      patterns,
    });

    const evidence = {
      seed,
      angle,
      title,
      hook,
      niche: body.niche || '',
      language: body.language || 'id',
      intent,
      scores: body.scores || {},
      metrics: body.metrics || {},
      competitor_titles: competitorTitles.slice(0, 8),
      competitor_summary: summarizeCompetitors(competitors).slice(0, 8),
      patterns: patterns.slice(0, 6),
      rules: [
        'Jangan keluar jalur dari intent pencarian YouTube user',
        'Baca kompetitor sebagai pola visual/emosi, jangan mengarang metrik',
        'Jangan klaim pasti viral / high CTR terjamin',
      ],
    };

    // Default: SKIP text rewrite (hemat + hindari delay). Set skipRewrite:false jika mau polish prompt.
    const doRewrite = body.skipRewrite === false;
    const rewritten = !doRewrite
      ? {
          image_prompt: basePrompt,
          hook_text: hook,
          composition_note: 'subject left/center, text space right',
          ctr_reason: 'On-intent emotion + clean text space.',
          on_intent_check: intent.searcher_goal,
          model_text: null,
        }
      : await rewritePromptWithTextModel(basePrompt, evidence, cfg);

    // Prefer explicit client prompt box (user-edited / AI-polished) when long enough
    const clientPrompt = String(body.prompt || body.direction || '').trim();
    const finalPrompt =
      clientPrompt.length > 40 ? clientPrompt : (rewritten.image_prompt || basePrompt);
    const img = await generateImage({
      prompt: finalPrompt,
      model: imageModel,
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      size: '1024x1024',
    });

    return res.status(200).json({
      ok: true,
      model_image: img.model,
      model_text: rewritten.model_text,
      result: {
        image_type: img.type,
        image: img.value,
        mime: img.mime || 'image/png',
        prompt_used: finalPrompt,
        hook_text: rewritten.hook_text || hook,
        composition_note: rewritten.composition_note || '',
        ctr_reason: rewritten.ctr_reason || '',
        on_intent_check: rewritten.on_intent_check || intent.searcher_goal,
        intent,
        competitors_used: competitorTitles.slice(0, 8),
        warning: img.warning || null,
        note:
          'Thumbnail taat intent + kompetitor. AI = background; hook teks ditimpa canvas engine.',
      },
    });
  } catch (e) {
    const msg = e.message || String(e);
    const concurrency = /concurrency|rate limit|too many|limit:\s*\d+/i.test(msg);
    return res.status(502).json({
      ok: false,
      error: msg,
      code: concurrency ? 'CONCURRENCY' : 'IMAGE_FAIL',
      retryAfterSec: concurrency ? 15 : 0,
      hint: concurrency
        ? 'Antrian image IAMHC penuh. App akan auto-antre di client. Jangan buka banyak tab generate.'
        : 'Set IAMHC_IMAGE_MODEL=step-image-edit-2.',
    });
  }
};

module.exports.config = { maxDuration: 60 };
