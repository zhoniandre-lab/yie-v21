/**
 * GET /api/suggest?keyword=...&language=id&region=ID&limit=25
 * YouTube Suggest / Google autocomplete for yt
 */

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = String(x || '')
      .toLowerCase()
      .trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(String(x).trim());
  }
  return out;
}

function localFallback(seed, lang) {
  const s = String(seed || '').trim();
  if (!s) return [];
  const year = new Date().getFullYear();
  const base = [
    s,
    `${s} terbaru`,
    `${s} ${year}`,
    `${s} viral`,
    `${s} kisah nyata`,
    `${s} full`,
    `${s} tutorial`,
  ];
  if (/dj|remix|bass/i.test(s)) {
    base.push(`${s} full bass`, `${s} viral tiktok`, `${s} nonstop`, `${s} jedag jedug`);
  }
  if (/hantu|horor|horror|ghost|haunted/i.test(s)) {
    base.push(
      `${s} rumah kosong`,
      `${s} rumah angker`,
      `${s} tengah malam`,
      `${s} suara misterius`
    );
  }
  if (lang === 'en') {
    return uniq([
      s,
      `${s} 2026`,
      `${s} viral`,
      `${s} true story`,
      `${s} full`,
      `best ${s}`,
    ]);
  }
  return uniq(base);
}

async function fetchYoutubeSuggest(seed, language, region) {
  // Google suggest endpoint used by YouTube autocomplete
  const u = new URL('https://suggestqueries.google.com/complete/search');
  u.searchParams.set('client', 'youtube');
  u.searchParams.set('ds', 'yt');
  u.searchParams.set('q', seed);
  u.searchParams.set('hl', language || 'id');
  if (region && region !== 'GLOBAL') u.searchParams.set('gl', region.toLowerCase());

  const r = await fetch(u.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; YouTubeIntelligenceEngine/21.0; +https://vercel.app)',
      Accept: 'application/json,text/javascript,*/*',
    },
  });
  if (!r.ok) throw new Error(`Suggest HTTP ${r.status}`);
  const text = await r.text();
  // Response often JSONP-like or JSON array: ["query", [["s1",0],...], ...]
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const m = text.match(/\((.*)\)\s*$/s);
    if (m) data = JSON.parse(m[1]);
    else throw new Error('Suggest parse gagal');
  }
  const items = Array.isArray(data?.[1]) ? data[1] : [];
  return items
    .map((row) => (Array.isArray(row) ? row[0] : row))
    .filter((x) => typeof x === 'string' && x.trim());
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const q = req.query || {};
    const keyword = String(q.keyword || q.q || '').trim();
    if (!keyword) {
      return res.status(400).json({ error: 'Parameter keyword wajib diisi.' });
    }
    const language = String(q.language || q.lang || 'id');
    const region = String(q.region || 'ID').toUpperCase();
    const limit = Math.max(1, Math.min(50, parseInt(q.limit || '30', 10) || 30));

    const year = new Date().getFullYear();
    const seeds = uniq([
      keyword,
      `${keyword} terbaru`,
      `${keyword} ${year}`,
      `${keyword} viral`,
      `${keyword} lagu`,
      `${keyword} sedih`,
      `${keyword} full`,
      `lagu ${keyword}`,
    ]).slice(0, 8);

    const sourceNotes = [];
    let all = [];

    for (const seed of seeds) {
      try {
        const list = await fetchYoutubeSuggest(seed, language, region);
        sourceNotes.push({
          seed,
          count: list.length,
          source: list.length ? 'youtube_suggest' : 'empty',
        });
        all.push(...list);
      } catch (e) {
        sourceNotes.push({
          seed,
          count: 0,
          source: 'error',
          error: e.message || String(e),
        });
      }
    }

    let suggestions = uniq(all).filter(
      (s) => s.toLowerCase() !== keyword.toLowerCase()
    );

    if (suggestions.length < 5) {
      const fb = localFallback(keyword, language);
      sourceNotes.push({ seed: keyword, count: fb.length, source: 'local_fallback' });
      suggestions = uniq([...suggestions, ...fb]).filter(
        (s) => s.toLowerCase() !== keyword.toLowerCase()
      );
    }

    suggestions = suggestions.slice(0, limit);

    return res.status(200).json({
      query: { keyword, language, region, limit },
      fetchedAt: new Date().toISOString(),
      note:
        'Suggestions berasal dari YouTube autocomplete/public suggest jika tersedia, dengan fallback lokal jika kosong.',
      sourceNotes,
      suggestions,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
