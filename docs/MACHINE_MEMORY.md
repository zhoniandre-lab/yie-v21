# Machine Memory M1+M2

## M1 — History & "pernah dibuat"
- Setiap Engine Judul menyimpan snapshot riset ke `localStorage` key `yie_brain_v1`
- Isi: seed, angle, format, metrics, top titles+skor, kompetitor ringkas, hook, waktu
- UI menampilkan history + banner jika keyword/angle mirip pernah dianalisis

## M2 — Belajar dari YouTube Studio
- Form input: impressions, CTR%, views, AVD detik, notes
- Disimpan di `results[]`
- `learningBoostForTitle()` menyesuaikan skor judul mirip:
  - CTR tinggi historis → bonus
  - CTR lemah historis → penalti
  - AVD pendek → penalti retensi
  - Baru disarankan → penalti ulang

## Batas jujur
- Memori di **browser device ini** (bukan cloud multi-device)
- Bukan mencuri analytics kompetitor
- Belajar dari **data channel kamu** yang kamu input

## Export / hapus
- Export JSON dari panel Memori
- Hapus memori = clear localStorage brain key
