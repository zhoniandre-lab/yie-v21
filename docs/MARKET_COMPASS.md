# Kompas Pasar YIE — Cara Baca Otak Mesin

## Prinsip
Software ini **bukan chatbot**. Angka KPI adalah **kompas**, bukan ramalan views.

## Kartu KPI

### Demand (0–100)
Proxy perhatian pasar dari performa kompetitor (VPM/views/age).
- Tinggi = banyak perhatian
- Rendah = sepi

### Ruang Lawan (ex Low Competition)
`100 - competition`
- **Tinggi** = longgar (lebih mudah bagi channel kecil)
- **Rendah / 0** = **sangat padat** (bukan “gampang”)
- Demand tinggi + Ruang Lawan 0 = basah tapi sesak → diferensiasi wajib

### Celah Pola (Pattern Gap)
Ruang untuk judul/pola yang belum penuh di SERP.
- Tinggi = masih bisa beda
- Rendah = pola jenuh

### Kebaruan (Freshness)
Berapa banyak video relatif baru di sampel.
- Rendah = didominasi konten lama / pasar terasa tua

### Proxy Perhatian
Estimasi skala perhatian dari kompetitor.
- Bukan janji views channel kamu
- Bukan Google Ads volume

### Filter Nyata (Reality)
Seberapa relevan kompetitor yang lolos filter intent/niche.

## Data Gaps AI (AVD / CTR thumb / demografi)
Memang **tidak tersedia** di YouTube Data API publik.
Ini kejujuran sistem, bukan bug “belum keisi”.
Otak YIE tetap jalan dari: Suggest + kompetitor + scoring.

## Keputusan cepat
1. Demand tinggi + Ruang longgar → eksekusi
2. Demand tinggi + Ruang padat → eksekusi dengan long-tail + SimComp rendah
3. Demand rendah + Ruang longgar → hati-hati sepi
4. Demand rendah + Ruang padat → ganti angle
