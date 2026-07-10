# YouTube Intelligence Engine v22.0

**Data-based YouTube strategy software** — bukan chatbot.

```
YouTube Suggest + YouTube API
        ↓
Reality Filter + Pattern Mining + Scoring
        ↓
Final Decision  (OTAK UTAMA = DATA)
        ↓
AI Strategy Review  (kritik & paket strategi)
        ↓
AI Polish  (haluskan copy)
        ↓
Upload Pack siap eksekusi
```

## Fitur
- Keyword-first engine multi-angle
- YouTube Suggest + Data API
- Reality filter kompetitor
- Pattern mining judul
- Scoring Search / Browse / Algorithm / Hook
- Final Decision + Upload Pack + Thumbnail Brain
- AI Strategy Review (Qwen / fallback)
- AI Polish Pack (step-flash / fallback)
- AI Thumbnail Generator (image generations)
- YIE Brain v22 — self-learning scoring + memory (M1 + M2)

## Struktur file (copy-paste ke GitHub)

```
youtube-intelligence-engine/
├── index.html                 # UI + engine (frontend)
├── js/
│   └── yie-brain-v22.js       # v22 self-learning scoring engine
├── package.json
├── vercel.json
├── .env.example
├── README.md
├── docs/
│   ├── AI_ROUTER.md           # routing model AI
│   ├── MACHINE_MEMORY.md      # memori M1 + M2
│   ├── MARKET_COMPASS.md      # cara baca kompas pasar
│   └── YIE_BRAIN_V22.md       # spesifikasi v22
└── api/
    ├── _lib/iamhc.js          # shared AI client
    ├── youtube.js
    ├── suggest.js
    ├── ai-test.js
    ├── ai-strategy.js
    ├── ai-polish.js
    └── ai-thumb.js            # generate thumbnail image
```

## Environment Variables (Vercel)

| Key | Contoh |
|-----|--------|
| `YOUTUBE_API_KEY` | key Google Cloud YouTube Data API v3 |
| `IAMHC_API_KEY` | key dari api.iamhc.cn |
| `IAMHC_BASE_URL` | `https://api.iamhc.cn/v1` |
| `IAMHC_MODEL` | `step-3.5-flash` |
| `IAMHC_STRATEGY_MODEL` | `Qwen3.6-35B-A3B` |
| `IAMHC_FALLBACK_MODEL` | `MiniMax-M2.7` |

## Deploy cepat
1. Buat/isi repo GitHub `youtube-intelligence-engine`
2. Upload semua file di folder ini (timpa yang lama)
3. Pastikan project Vercel terhubung ke repo
4. Set env variables
5. Redeploy
6. Test:
   - Buka site → isi keyword → **Cari Angle & Riset**
   - Klik **🧠 AI Strategy Review**
   - Klik **✨ AI Polish Pack**
   - Buka `/api/ai-test` → harus ada `reply` tidak kosong

## Aturan produk
- AI **tidak** boleh jadi otak utama
- AI **tidak** boleh mengarang angka
- AI **tidak** boleh bilang “pasti viral”
- Jangan hapus fitur data engine demi chatbot
