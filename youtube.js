/**
 * GET /api/youtube?keyword=...&region=ID&language=id&max=5&order=relevance
 * YouTube Data API v3 — search + video stats + channel stats
 */

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function clampInt(n, min, max, fallback) {
  const x = parseInt(n, 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

async function ytGet(path, params, key) {
  const u = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') u.searchParams.set(k, String(v));
  });
  u.searchParams.set('key', key);
  const r = await fetch(u.toString());
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `YouTube API HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      return res.status(500).json({ error: 'YOUTUBE_API_KEY belum diset di Vercel.' });
    }

    const q = req.query || {};
    const keyword = String(q.keyword || q.q || '').trim();
    if (!keyword) {
      return res.status(400).json({ error: 'Parameter keyword wajib diisi.' });
    }

    const region = String(q.region || 'ID').toUpperCase();
    const language = String(q.language || q.lang || 'id');
    const maxResults = clampInt(q.max || q.maxResults || q.limit, 1, 25, 5);
    const order = String(q.order || 'relevance');

    const searchParams = {
      part: 'snippet',
      type: 'video',
      q: keyword,
      maxResults,
      order,
      relevanceLanguage: language,
    };
    if (region && region !== 'GLOBAL') searchParams.regionCode = region;

    const search = await ytGet('search', searchParams, key);
    const ids = (search.items || [])
      .map((it) => it?.id?.videoId)
      .filter(Boolean);

    if (!ids.length) {
      return res.status(200).json({
        query: { keyword, region, language, order, maxResults },
        fetchedAt: new Date().toISOString(),
        pageInfo: search.pageInfo || { totalResults: 0, resultsPerPage: 0 },
        quotaCostEstimate: 'search.list ~100 unit',
        videos: [],
      });
    }

    const videosData = await ytGet(
      'videos',
      {
        part: 'snippet,statistics,contentDetails',
        id: ids.join(','),
      },
      key
    );

    const channelIds = [
      ...new Set(
        (videosData.items || [])
          .map((v) => v?.snippet?.channelId)
          .filter(Boolean)
      ),
    ];

    let channelMap = {};
    if (channelIds.length) {
      const channels = await ytGet(
        'channels',
        {
          part: 'snippet,statistics',
          id: channelIds.join(','),
        },
        key
      );
      (channels.items || []).forEach((c) => {
        channelMap[c.id] = {
          id: c.id,
          title: c.snippet?.title || '',
          publishedAt: c.snippet?.publishedAt || '',
          subscriberCount: Number(c.statistics?.subscriberCount || 0),
          hiddenSubscriberCount: !!c.statistics?.hiddenSubscriberCount,
          videoCount: Number(c.statistics?.videoCount || 0),
          viewCount: Number(c.statistics?.viewCount || 0),
        };
      });
    }

    const videos = (videosData.items || []).map((v) => {
      const sn = v.snippet || {};
      const st = v.statistics || {};
      const ch = channelMap[sn.channelId] || {
        id: sn.channelId,
        title: sn.channelTitle || '',
        subscriberCount: 0,
        hiddenSubscriberCount: false,
        videoCount: 0,
        viewCount: 0,
      };
      return {
        id: v.id,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        title: sn.title || '',
        description: sn.description || '',
        publishedAt: sn.publishedAt || '',
        channelId: sn.channelId || '',
        channelTitle: sn.channelTitle || ch.title || '',
        channel: ch,
        thumbnails: sn.thumbnails || {},
        viewCount: Number(st.viewCount || 0),
        likeCount: Number(st.likeCount || 0),
        commentCount: Number(st.commentCount || 0),
        duration: v.contentDetails?.duration || '',
      };
    });

    return res.status(200).json({
      query: { keyword, region, language, order, maxResults },
      fetchedAt: new Date().toISOString(),
      pageInfo: search.pageInfo || {
        totalResults: videos.length,
        resultsPerPage: videos.length,
      },
      quotaCostEstimate:
        'search.list sekitar 100 unit + videos.list 1 unit + channels.list 1 unit',
      videos,
    });
  } catch (e) {
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    return res.status(status).json({
      error: e.message || String(e),
      details: e.data?.error || undefined,
    });
  }
};
