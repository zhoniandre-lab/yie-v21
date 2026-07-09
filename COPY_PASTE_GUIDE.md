# 📋 COPY-PASTE GUIDE — YouTube Intelligence Engine v21

Ikuti urutan ini. Jangan loncat.

---

## STEP 1 — Siapkan folder di laptop / HP

Buat folder:
```
youtube-intelligence-engine/
```

Isi persis seperti ini:

```
youtube-intelligence-engine/
├── index.html
├── package.json
├── vercel.json
├── .env.example
├── README.md
├── COPY_PASTE_GUIDE.md
├── docs/
│   └── ROADMAP.md
└── api/
    ├── _lib/
    │   └── iamhc.js
    ├── youtube.js
    ├── suggest.js
    ├── ai-test.js
    ├── ai-strategy.js
    └── ai-polish.js
```

> Di Arena workspace, semua file sudah ada di folder  
> `/home/user/youtube-intelligence-engine/`  
> Download / copy semuanya ke repo GitHub kamu.

---

## STEP 2 — Env di Vercel (penting)

Vercel → Project → **Settings** → **Environment Variables**

Tambah / pastikan:

| Name | Value |
|------|--------|
| `YOUTUBE_API_KEY` | (key YouTube kamu) |
| `IAMHC_API_KEY` | (key IAMHC kamu) |
| `IAMHC_BASE_URL` | `https://api.iamhc.cn/v1` |
| `IAMHC_MODEL` | `step-3.5-flash` |
| `IAMHC_STRATEGY_MODEL` | `Qwen3.6-35B-A3B` |
| `IAMHC_FALLBACK_MODEL` | `MiniMax-M2.7` |

Centang Production + Preview. Save.

---

## STEP 3 — Push ke GitHub

Opsi A — GitHub website:
1. Buka repo `youtube-intelligence-engine`
2. Upload file (timpa `index.html` + folder `api/`)
3. Commit

Opsi B — Git CLI:
```bash
cd youtube-intelligence-engine
git add .
git commit -m "v21 full rebuild: engine + AI strategy/polish fix"
git push
```

Vercel akan auto-deploy.

---

## STEP 4 — Test setelah deploy

### 4.1 API test
Buka di browser:
```
https://DOMAIN-KAMU/api/ai-test
```
Harus: `"ok": true` dan `"reply"` **tidak kosong**.

### 4.2 Engine test
1. Buka homepage
2. Keyword contoh: `cerita hantu`
3. Angle: 3, Video: 5 (hemat kuota)
4. Klik **🚀 Cari Angle & Riset**
5. Tunggu Final Decision muncul

### 4.3 AI Strategy
Klik **🧠 AI Strategy Review**  
Harus muncul: verdict, strategic title, alternatif, plan 24 jam.

### 4.4 AI Polish
Klik **✨ AI Polish Pack**  
Harus muncul: polished title, description, tags, hook.

---

## STEP 5 — Kalau error

| Error | Arti | Fix |
|-------|------|-----|
| `YOUTUBE_API_KEY belum diset` | Env kosong | Isi di Vercel + Redeploy |
| `IAMHC_API_KEY belum diset` | Env kosong | Isi di Vercel + Redeploy |
| `Data engine tidak lengkap` | Payload lama | Pastikan `index.html` v21 sudah ter-upload |
| `AI content kosong` | Model/parser | Pastikan `api/_lib/iamhc.js` + fallback model ter-upload |
| Quota YouTube | Limit API | Kurangi angle/video, tunggu reset kuota |

---

## Tombol penting di app

| Tombol | Fungsi |
|--------|--------|
| 🚀 Cari Angle & Riset | Jalankan data engine |
| 👀 Preview Angle | Preview lokal tanpa API |
| 🧪 Demo | Mode demo offline |
| 🧠 AI Strategy Review | AI baca hasil engine |
| ✨ AI Polish Pack | AI poles upload pack |
| 📋 Copy Pack | Copy paket final |

---

## Jangan lakukan
- Jangan ubah jadi chatbot
- Jangan hapus Reality Filter / Scoring
- Jangan taruh API key di `index.html`
- Jangan commit `.env` berisi key asli
