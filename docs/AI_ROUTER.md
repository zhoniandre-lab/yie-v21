# AI Multi-Provider Router (v21.16)

## Tujuan
AI Strategy / Polish **tidak mati** kalau 1 provider error.
Primary tetap **IAMHC** (balance kamu). Fallback resmi dari katalog free LLM.

## Arsitektur
```
YouTube Data Engine (otak skor)  ← TIDAK diganti
        ↓
AI Workers (strategy / polish)
        ↓
LLM Router
  1. IAMHC
  2. Groq
  3. Gemini
  4. OpenRouter
```

Image generate **tetap** `IAMHC_IMAGE_MODEL` (endpoint beda).

## File
- `api/_lib/llm-router.js` — router
- `api/ai-strategy.js` — pakai router role=strategy
- `api/ai-polish.js` — pakai router role=polish
- `api/ai-test.js` — tes provider mana yang aktif

## Env minimal
```
YOUTUBE_API_KEY=...
IAMHC_API_KEY=...
IAMHC_IMAGE_MODEL=step-image-edit-2
```

## Env disarankan (tahan banting)
```
GROQ_API_KEY=...
GEMINI_API_KEY=...
# opsional
OPENROUTER_API_KEY=...
```

## Cara daftar cepat
1. **Groq** → https://console.groq.com → API Keys
2. **Gemini** → https://aistudio.google.com → Get API key
3. **OpenRouter** → https://openrouter.ai → Keys

## Test setelah deploy
Buka:
```
https://DOMAIN-KAMU/api/ai-test
```
Harus:
```json
{
  "ok": true,
  "provider": "iamhc|groq|gemini|openrouter",
  "reply": "...",
  "providersConfigured": [...]
}
```

## Prinsip produk
- Data YouTube + rumus = hakim
- AI = tenaga kerja (review/polish)
- Free provider = cadangan, bukan fondasi
- Jangan abuse free tier
