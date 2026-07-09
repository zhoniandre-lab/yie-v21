# v20.2 Fix Notes — AI Strategy Review

Tanggal: 2026-07-09

## Apa yang sudah dibuktikan di live site
- `/api/youtube` & `/api/suggest` jalan.
- `/api/ai-strategy` **hanya menerima** payload yang punya `finalDecision`.
- UI lama mengirim `finalTitle` + `scores` → ditolak `400 Data engine tidak lengkap`.
- Response API flat (`alternative_titles`, strategy string, `action_plan`) tidak cocok renderer UI nested.

## Perbaikan di `index.html` (v20.2)
1. Payload tombol **🧠 AI Strategy Review** sekarang menyertakan:
   ```js
   finalDecision: {
     title, score, search, browse, algo, strategy, hook, angle, ...
   }
   ```
2. Ditambah `normalizeAIStrategyResult()` supaya UI bisa render:
   - schema nested ideal, **atau**
   - schema flat dari API live sekarang
3. Alias field:
   - `alternative_titles` → `title_alternatives`
   - `action_plan` → `first_24h_plan`
   - strategy string → object `{score_label, explanation, ...}`
   - thumbnail string/prompt → object hook/visual

## File API baru (siap push)
- `api/ai-strategy.js` — input normalizer + JSON schema ketat + parser content kosong + fallback model
- `api/ai-polish.js` — polish robust, tidak boleh `ok:true` dengan field kosong

## Env Vercel yang disarankan
```
YOUTUBE_API_KEY=...
IAMHC_API_KEY=...
IAMHC_BASE_URL=https://api.iamhc.cn/v1
IAMHC_MODEL=step-3.5-flash
IAMHC_STRATEGY_MODEL=Qwen3.6-35B-A3B
IAMHC_FALLBACK_MODEL=MiniMax-M2.7
```

## Cara deploy
1. Ganti `index.html` di repo dengan versi v20.2
2. Timpa/tambah `api/ai-strategy.js` & `api/ai-polish.js`
3. Push ke GitHub (Vercel auto-deploy)
4. Test:
   - Jalankan riset keyword
   - Klik **AI Strategy Review** → harus muncul verdict + alternatif + plan
   - Klik **AI Polish Pack** → title/desc/tags terisi

## Yang belum dikerjakan (sengaja)
- Redesign UI total (tunggu fitur stabil)
- Multi-platform TikTok/FB
- AI sebagai otak scoring (dilarang by design)
