/**
 * Shared IAMHC OpenAI-compatible client
 * Handles empty content, reasoning models, JSON extraction, fallbacks.
 */

function extractTextFromChatCompletion(data) {
  const choice = data?.choices?.[0] || {};
  const msg = choice.message || choice.delta || {};
  const content = msg.content;

  if (typeof content === 'string' && content.trim()) return content.trim();

  if (Array.isArray(content)) {
    const joined = content
      .map((p) => {
        if (typeof p === 'string') return p;
        if (p?.text) return typeof p.text === 'string' ? p.text : p.text?.value || '';
        if (p?.type === 'text' && p?.text) return typeof p.text === 'string' ? p.text : '';
        if (p?.type === 'output_text') return p?.text || p?.content || '';
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
    if (joined) return joined;
  }

  // reasoning models sometimes only fill reasoning_content with embedded JSON
  if (typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
    const r = msg.reasoning_content.trim();
    if (r.includes('{') && r.includes('}')) return r;
  }

  if (typeof choice.text === 'string' && choice.text.trim()) return choice.text.trim();
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  if (typeof data?.reply === 'string' && data.reply.trim()) return data.reply.trim();
  if (typeof data?.result === 'string' && data.result.trim()) return data.result.trim();
  return '';
}

function extractJsonObject(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(s);
  } catch {}
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {}
  }
  return null;
}

async function callChat({
  model,
  messages,
  temperature = 0.4,
  baseUrl,
  apiKey,
  timeoutMs = 90000,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${String(baseUrl || '').replace(/\/$/, '')}/chat/completions`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, temperature, messages }),
      signal: controller.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg =
        data?.error?.message ||
        data?.error ||
        data?.message ||
        `HTTP ${r.status}`;
      const err = new Error(String(msg));
      err.status = r.status;
      err.data = data;
      throw err;
    }
    const text = extractTextFromChatCompletion(data);
    return {
      text,
      usage: data?.usage || null,
      raw: data,
      model,
      empty: !text,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callWithFallback({
  models,
  messages,
  temperature = 0.4,
  baseUrl,
  apiKey,
  timeoutMs = 90000,
}) {
  const list = (models || []).filter(Boolean);
  let lastErr = null;
  for (const model of list) {
    try {
      const out = await callChat({
        model,
        messages,
        temperature,
        baseUrl,
        apiKey,
        timeoutMs,
      });
      if (out.text) return out;
      lastErr = new Error(`Model ${model} mengembalikan content kosong`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Semua model AI gagal');
}

function envConfig() {
  return {
    apiKey: process.env.IAMHC_API_KEY || '',
    baseUrl: process.env.IAMHC_BASE_URL || 'https://api.iamhc.cn/v1',
    polishModel: process.env.IAMHC_MODEL || 'step-3.5-flash',
    strategyModel:
      process.env.IAMHC_STRATEGY_MODEL ||
      process.env.IAMHC_MODEL ||
      'Qwen3.6-35B-A3B',
    fallbackModel: process.env.IAMHC_FALLBACK_MODEL || 'MiniMax-M2.7',
  };
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    // Vercel sometimes already parses body
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return resolve(req.body);
    }
    if (typeof req.body === 'string' && req.body) {
      try {
        return resolve(JSON.parse(req.body));
      } catch {
        return reject(new Error('JSON tidak valid'));
      }
    }
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 2_000_000) reject(new Error('Payload terlalu besar'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON tidak valid'));
      }
    });
    req.on('error', reject);
  });
}

module.exports = {
  extractTextFromChatCompletion,
  extractJsonObject,
  callChat,
  callWithFallback,
  envConfig,
  setCors,
  readJson,
};
