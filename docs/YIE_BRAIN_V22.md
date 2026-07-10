# YIE Brain v22 — Self-Learning Scoring Engine

Pemilik: zhoniandre-lab  
Otak Arsitek: Arena Agent  
Tanggal: 10 Juli 2026  
Misi: Mesin bisa mikir sendiri, data-based, bukan chatbot.

---

## 1. Audit v21.23

**Yang sudah kuat:**
- scoreTitle(): Search + Browse + Algo + Quality + Unique + Gap + FormatBoost
- Reality Filter kompetitor, relevance scoring per niche
- Pattern mining judul, patternBornFit
- Memory M1: history riset di localStorage
- Memory M2: savePerformanceResult(CTR, impressions, views, AVD)
- learningBoostForTitle(): delta -20..+16 dari CTR historis

**Kelemahan v21 yang diperbaiki di v22:**
1. learningBoost flat. CTR 8% dan CTR 5% bedanya cuma 6 poin. Tidak ada confidence / sample size.
2. Tidak ada time decay. Hasil CTR 3 bulan lalu bobotnya sama dengan kemarin.
3. Tidak ada Channel DNA. Bobot Search/Browse/Unique sama untuk semua niche. Padahal Family Song butuh Hook emosional lebih berat dari DJ.
4. Uniqueness vs kompetitor sudah ada, tapi penalty serp masih linear. Perlu harsh penalty kalau sim > 0.82.
5. Gap boost hanya hitung kata, belum hitung phrase long-tail 3-4 kata.
6. Psychology hook score masih rule-based sederhana, belum pakai bank CTR yang belajar.
7. Tidak ada confidence penalty kalau data kompetitor tipis (<3 video qualified).

v22 memperbaiki 7 titik ini, tetap 100% data-based, 0% ngarang.

---

## 2. Arsitektur YIE Brain v22

```
Input: keyword, angle, qualified_competitors, patterns, memory
  │
  ├─ Data Brain v22
  │   searchScore, browseScore, algoScore
  │   uniqueness_v2 (harsh sim penalty)
  │   gapScore_v2 (phrase long-tail + gap words)
  │   confidencePenalty (data tipis = skor turun)
  │
  ├─ Psychology Brain v22
  │   hookScore_v2 (bank hook CTR, lever: guilt/regret/longing/curiosity)
  │   thumbFitScore (judul ↔ thumbnail hook match)
  │   emotionSpecificity (spesifik > generik)
  │
  └─ Memory Brain v22
      Bayesian CTR learning
      timeDecay 30 hari half-life
      channelDNA weights per niche
      sampleSize confidence
      ────────────────↓
      Final Score v22
```

Prinsip tetap: **AI tidak boleh jadi otak utama. AI tidak boleh ngarang angka. AI tidak boleh bilang pasti viral.**

---

## 3. Formula Scoring v22

### 3.1 Learning Boost V2 — Bayesian CTR

```
prior_ctr = 4.5%   // baseline YouTube search CTR
prior_n   = 5      // kekuatan prior, = 5 video

observed_ctr = avgCtr dari memory
n_samples    = jumlah hasil studio yang mirip
age_days     = umur hasil terbaru

weight = n_samples / (n_samples + prior_n)
time_decay = 0.5 ^ (age_days / 30)   // half-life 30 hari

bayes_ctr = weight * observed_ctr + (1-weight) * prior_ctr
bayes_ctr *= time_decay

delta:
  bayes_ctr >= 8.0%  → +22
  bayes_ctr >= 5.5%  → +14
  bayes_ctr >= 3.5%  → +4
  bayes_ctr >= 2.0%  → -4
  bayes_ctr > 0      → -18
  + bonus jika n_samples >= 3: +3
  + penalty jika recent_fail (CTR <3% dalam 14 hari): -8

delta di-clamp -24 .. +26
```

Beda vs v21: ada prior, ada confidence dari sample size, ada time decay, ada recent fail guard.

### 3.2 Channel DNA Weights

Bobot Search/Browse/Unique/Gap/Hook beda per niche. Ini yang bikin mesin "punya pola pikir sendiri".

| Niche | search | browse | unique | gap | hook | quality |
|-------|--------|--------|--------|-----|------|---------|
| family / story_song | 0.12 | 0.20 | 0.18 | 0.10 | 0.14 | 0.07 |
| horror | 0.11 | 0.22 | 0.16 | 0.09 | 0.16 | 0.06 |
| dj | 0.20 | 0.14 | 0.12 | 0.08 | 0.10 | 0.06 |
| general | 0.14 | 0.17 | 0.15 | 0.10 | 0.10 | 0.07 |

Sisanya: demand 0.06, langFit 0.03, intentFit 0.08

Family Song mementingkan Browse+Hook+Unique, karena di feed emosional menang. DJ mementingkan Search, karena orang memang search "DJ terbaru".

### 3.3 Uniqueness v2 — Harsh SERP penalty

```
maxSim = max cosine sim(title, competitor_top12)
unique = clamp(98 - maxSim*85)

serpPenalty:
  maxSim >= 0.85 → -32
  maxSim >= 0.72 → -20
  maxSim >= 0.60 → -10
  maxSim < 0.45  → bonus +4
```

v21 penalty max -28 di 0.82, v22 lebih galak di atas 0.85.

### 3.4 Gap Score v2

v21: hitung gap words saja.
v22: gap words + gap phrases (2-4 kata long-tail yang ada di suggest tapi jarang di judul kompetitor)

```
gap_words_hit * 10
+ gap_phrases_hit * 16
+ shape_bonus (4-12 kata = +6)
= gapBoost, clamp 0..100
```

### 3.5 Psychology Hook v2

Bank hook sudah ada di psychHookBank(). v22 menambahkan:
- CTR memory dari hook yang pernah dipakai
- emotionSpecificity: "ANAKMU MENANGIS" > "MAAF IBU"
- penalty generik keras: "MAAF IBU", "RINDU IBU", "BIG HOOK" = -35
- bonus niche-fit: story_song harus ada lagu/sedih/nangis/dengar

### 3.6 Confidence Penalty

Kalau data kompetitor tipis, skor otomatis turun biar jujur.

```
qualified_n:
  n >= 5 → 0
  n = 3-4 → -5
  n = 1-2 → -14
  n = 0   → -28
```

Ini masuk ke final score, bukan cuma warning.

---

## 4. Final Score v22

```
score = 
  search * W_search
+ browse * W_browse
+ algo   * 0.14
+ quality * 0.07
+ unique  * W_unique
+ demand * 0.06
+ langFit * 0.03
+ intentFit * 0.08
+ patternBorn * 0.05
+ hookScore * W_hook
+ gapBoost * W_gap
+ formatBoost
+ learningDelta_v2
- memoryPenalty
- languagePenalty
- serpPenalty_v2
+ confidencePenalty_dataTipis

clamp 0..100
```

W_xxx diambil dari Channel DNA table di atas.

---

## 5. File implementasi

- `js/yie-brain-v22.js` — engine drop-in, namespace `YIE22`
  - `YIE22.scoreTitleV2(title, a, mem)`
  - `YIE22.learningBoostV2(title)`
  - `YIE22.psychologyHookScoreV2(title, a)`
  - `YIE22.channelDNA(nicheId, formatId)`
  - `YIE22.gapScoreV2(a)`
  - `YIE22.uniquenessV2(title, comps)`

Engine ini bisa di-toggle di index.html:
```js
const USE_V22 = true;
function scoreTitle(...) {
  if (USE_V22 && window.YIE22) return YIE22.scoreTitleV2(...);
  // fallback v21
}
```

Zero breaking change untuk v21 yang live.

---

## 6. Roadmap integrasi

1. [x] Audit v21, tulis spec
2. [x] Buat `js/yie-brain-v22.js`
3. [x] Patch `index.html` — load yie-brain-v22.js, toggle USE_V22
4. [ ] Uji dengan keyword: "maafkan aku ibu", "cerita hantu", "dj terbaru"
5. [ ] Bandingkan skor v21 vs v22, pastikan judul generik turun, judul spesifik+beda naik
6. [ ] Commit ke branch `brain-v22`, merge ke main kalau stabil
7. [ ] Lanjut Psychology Hook Brain v2 — perluas bank hook + CTR memory

---

## 7. Aturan yang tetap dijaga

- AI tidak boleh jadi otak utama — scoring tetap di JS client, bukan di /api/ai-strategy
- AI tidak boleh mengarang angka — learningBoost hanya dari `localStorage yie_brain_v1.results`
- AI tidak boleh bilang pasti viral — semua verdict: GO / TEST / CARI ANGLE / HOLD
- Setiap judul ada alasan: Search, Browse, Unique, Gap, Hook, SimComp — bisa diaudit

Mesin ini mikir pakai data, psikologi manusia, dan memori channel sendiri. Bukan chatbot.

— Otak Arsitek YIE
