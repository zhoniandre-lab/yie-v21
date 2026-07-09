/**
 * Multi-provider LLM Router for YIE
 * Primary: IAMHC (punya balance + image terpisah)
 * Fallback: Groq → Gemini → OpenRouter (dari free-llm-api-resources)
 *
 * PENTING:
 * - Router ini untuk TEXT (strategy/polish/test), BUKAN image.
 * - Scoring YouTube tetap di engine data (index.html), AI tidak jadi otak utama.
 */

const {
  extractTextFromChatCompletion,
  extractJsonObject,
} = require('./iamhc');

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

/**
 * Build ordered provider chain by role.
 * role: 'strategy' | 'polish' | 'test'
 */
function getProviderChain(role = 'polish') {
  const chain = [];

  // 1) IAMHC — primary (kamu sudah pakai)
  if (process.env.IAMHC_API_KEY) {
    const polish = process.env.IAMHC_MODEL || 'step-3.5-flash';
    const strategy =
      process.env.IAMHC_STRATEGY_MODEL ||
      process.env.IAMHC_MODEL ||
      'Qwen3.6-35B-A3B';
    const fallback = process.env.IAMHC_FALLBACK_MODEL || 'MiniMax-M2.7';
    const models =
      role === 'strategy'
        ? uniq([strategy, fallback, polish])
        : uniq([polish, fallback, strategy]);
    chain.push({
      id: 'iamhc',
      label: 'IAMHC',
      baseUrl: process.env.IAMHC_BASE_URL || 'https://api.iamhc.cn/v1',
      apiKey: process.env.IAMHC_API_KEY,
      models,
    });
  }

  // 2) Groq — sangat cepat, bagus polish / fallback
  if (process.env.GROQ_API_KEY) {
    chain.push({
      id: 'groq',
      label: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
      models: uniq([
        process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
      ]),
    });
  }

  // 3) Google Gemini (OpenAI-compatible endpoint)
  if (process.env.GEMINI_API_KEY) {
    chain.push({
      id: 'gemini',
      label: 'Google Gemini',
      baseUrl:
        process.env.GEMINI_BASE_URL ||
        'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: process.env.GEMINI_API_KEY,
      models: uniq([
        process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        'gemini-2.0-flash',
      ]),
    });
  }

  // 4) OpenRouter free / paid models
  if (process.env.OPENROUTER_API_KEY) {
    chain.push({
      id: 'openrouter',
      label: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      models: uniq([
        process.env.OPENROUTER_MODEL ||
          'meta-llama/llama-3.3-70b-instruct:free',
        'google/gemma-3-27b-it:free',
      ]),
      extraHeaders: {
        'HTTP-Referer':
          process.env.OPENROUTER_SITE_URL || 'https://yie-v21.vercel.app',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'YouTube Intelligence Engine',
      },
    });
  }

  return chain;
}

function listConfiguredProviders() {
  return getProviderChain('test').map((p) => ({
    id: p.id,
    label: p.label,
    models: p.models,
    baseUrl: p.baseUrl,
  }));
}

async function callChatProvider({
  provider,
  model,
  messages,
  temperature = 0.4,
  timeoutMs = 90000,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${String(provider.baseUrl || '').replace(/\/$/, '')}/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
      ...(provider.extraHeaders || {}),
    };
    const r = await fetch(url, {
      method: 'POST',
      headers,
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
      err.provider = provider.id;
      err.model = model;
      err.data = data;
      throw err;
    }
    const text = extractTextFromChatCompletion(data);
    return {
      text,
      usage: data?.usage || null,
      raw: data,
      model,
      provider: provider.id,
      providerLabel: provider.label,
      empty: !text,
    };
  } catch (e) {
    if (e && e.name === 'AbortError') {
      const err = new Error(`Timeout ${provider.id}/${model}`);
      err.provider = provider.id;
      err.model = model;
      err.timeout = true;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call LLM with multi-provider fallback.
 * Tries each provider × model until non-empty text.
 */
async function callLLM({
  role = 'polish',
  messages,
  temperature = 0.4,
  timeoutMs = 90000,
}) {
  const chain = getProviderChain(role);
  if (!chain.length) {
    throw new Error(
      'Tidak ada provider AI. Set minimal satu: IAMHC_API_KEY / GROQ_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY'
    );
  }

  const tried = [];
  let lastErr = null;

  for (const provider of chain) {
    for (const model of provider.models) {
      try {
        const out = await callChatProvider({
          provider,
          model,
          messages,
          temperature,
          timeoutMs,
        });
        if (out.text && String(out.text).trim()) {
          return {
            ...out,
            tried,
            ok: true,
          };
        }
        lastErr = new Error(`${provider.id}/${model} content kosong`);
        tried.push(`${provider.id}/${model}:empty`);
      } catch (e) {
        lastErr = e;
        tried.push(
          `${provider.id}/${model}:${(e && e.message) || 'error'}`.slice(0, 120)
        );
      }
    }
  }

  const err =
    lastErr ||
    new Error('Semua provider AI gagal / mengembalikan content kosong');
  err.tried = tried;
  throw err;
}

/**
 * Backward-compatible wrapper used by older endpoints.
 * Still accepts models/baseUrl/apiKey (IAMHC-style), then continues to other providers.
 */
async function callWithFallback({
  models,
  messages,
  temperature = 0.4,
  baseUrl,
  apiKey,
  timeoutMs = 90000,
  role = 'polish',
}) {
  // If explicit baseUrl+apiKey given (legacy IAMHC path), try those models first
  if (apiKey && baseUrl && models && models.length) {
    const provider = {
      id: 'explicit',
      label: 'Explicit',
      baseUrl,
      apiKey,
      models: uniq(models),
    };
    const tried = [];
    let lastErr = null;
    for (const model of provider.models) {
      try {
        const out = await callChatProvider({
          provider,
          model,
          messages,
          temperature,
          timeoutMs,
        });
        if (out.text) return { ...out, tried };
        lastErr = new Error(`Model ${model} content kosong`);
        tried.push(`explicit/${model}:empty`);
      } catch (e) {
        lastErr = e;
        tried.push(`explicit/${model}:${e.message}`.slice(0, 100));
      }
    }
    // fall through to multi-provider (skip duplicate IAMHC if same key)
  }

  return callLLM({ role, messages, temperature, timeoutMs });
}

function envConfig() {
  const providers = listConfiguredProviders();
  return {
    // legacy IAMHC fields
    apiKey: process.env.IAMHC_API_KEY || '',
    baseUrl: process.env.IAMHC_BASE_URL || 'https://api.iamhc.cn/v1',
    polishModel: process.env.IAMHC_MODEL || 'step-3.5-flash',
    strategyModel:
      process.env.IAMHC_STRATEGY_MODEL ||
      process.env.IAMHC_MODEL ||
      'Qwen3.6-35B-A3B',
    fallbackModel: process.env.IAMHC_FALLBACK_MODEL || 'MiniMax-M2.7',
    // multi-provider
    hasAnyProvider: providers.length > 0,
    providers,
    groq: !!process.env.GROQ_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    iamhc: !!process.env.IAMHC_API_KEY,
  };
}

function anyProviderConfigured() {
  return getProviderChain('test').length > 0;
}

module.exports = {
  getProviderChain,
  listConfiguredProviders,
  callChatProvider,
  callLLM,
  callWithFallback,
  envConfig,
  anyProviderConfigured,
  extractJsonObject,
  extractTextFromChatCompletion,
};
