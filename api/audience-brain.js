/**
 * GET/POST /api/audience-brain
 * Non-breaking Audience Intelligence endpoint for YIE v23 add-on.
 *
 * This route is intentionally separate from the core engine so it cannot break
 * index.html, YIE22 scoring, YouTube API, or AI routes.
 */

const { setCors, readJson } = require('./_lib/iamhc');
const { analyzeAudience } = require('./_lib/audience-brain');

function queryToInput(q = {}) {
  return {
    seed: q.seed || q.keyword || q.q || '',
    keyword: q.keyword || q.q || q.seed || '',
    angle: q.angle || '',
    finalTitle: q.finalTitle || q.title || '',
    title: q.title || '',
    niche: q.niche || '',
    nicheNote: q.nicheNote || q.note || '',
    format: q.format || '',
    language: q.language || q.lang || 'id',
    region: q.region || 'ID',
    device: q.device || '',
    age: q.age || '',
    expectedAction: q.action || q.expectedAction || q.ctaAction || 'comment',
    cta: q.cta || '',
    problems: q.problems || q.masalah || '',
    desires: q.desires || q.keinginan || '',
    goals: q.goals || q.tujuan || '',
  };
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let input;
    if (req.method === 'GET') {
      input = queryToInput(req.query || {});
    } else if (req.method === 'POST') {
      input = await readJson(req);
    } else {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const result = analyzeAudience(input || {});
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
};
