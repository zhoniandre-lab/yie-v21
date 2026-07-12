/**
 * YIE Audience Brain v23 — non-breaking rule-based audience intelligence.
 * Inspired by KYA audience framework: Audience → Problem → Solution → Content → Title → Thumbnail → Upload → CTA → Analysis → Repeat.
 *
 * Important product rule:
 * - This module does NOT replace YIE scoring engine.
 * - It adds audience context, CTA, device/readability advice, content angles, and risk notes.
 * - No external API, no AI calls, no invented YouTube metrics.
 */

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}0-9\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr || []) {
    const v = String(x || '').trim();
    const k = norm(v);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function clamp(n, min = 0, max = 100) {
  n = Number(n);
  if (!Number.isFinite(n)) n = 0;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function tokenize(s) {
  const stop = new Set(
    'yang dan di ke dari ini itu untuk dengan pada ada akan jadi bisa tidak tak nya se ber me ter per kan lah pun atau karena agar sebagai dalam saat ketika the of and in to a is are was were be for on by an it this that you your our new full video official lyrics lirik'.split(
      ' '
    )
  );
  return norm(s)
    .split(' ')
    .filter((w) => w.length > 1 && !stop.has(w));
}

const INTENTS = {
  story_song: {
    label: 'Cerita jadi lagu / lagu emosional',
    keys: ['cerita jadi lagu', 'lagu sedih', 'lirik sedih', 'lagu ibu', 'lagu ayah', 'musik sedih'],
    audience: 'penonton emosional yang mencari lagu/cerita menyentuh',
    age: '18-45',
    device: 'HP',
    goal: ['healing', 'menangis lega', 'mengenang orang tua/keluarga', 'mendengar lagu sampai selesai'],
    fears: ['kehilangan orang tua', 'terlambat meminta maaf', 'rindu yang tidak tersampaikan'],
    desires: ['tersentuh', 'merasa dipahami', 'mendapat ruang untuk meluapkan emosi'],
    ctas: ['Tulis satu doa untuk ibu/ayah di komentar', 'Dengarkan sampai akhir jika pernah merasakan ini', 'Share ke orang yang sedang rindu keluarganya'],
    thumb: 'wajah emosi besar, air mata, cahaya hangat, ruang teks kanan, jangan horor/DJ',
    upload: '18:00-22:00, terutama malam Jumat/Sabtu/Minggu saat orang lebih emosional dan santai',
  },
  family: {
    label: 'Keluarga emosional',
    keys: ['ibu', 'ayah', 'mama', 'bunda', 'orang tua', 'anak', 'rindu', 'maaf', 'doa', 'sedih'],
    audience: 'remaja/dewasa yang dekat dengan tema keluarga, rindu, maaf, dan penyesalan',
    age: '18-45',
    device: 'HP',
    goal: ['healing', 'refleksi', 'mencari cerita yang menyentuh'],
    fears: ['kehilangan', 'menyesal terlambat sadar', 'tidak sempat membahagiakan orang tua'],
    desires: ['menangis lega', 'lebih menghargai keluarga', 'merasa tidak sendirian'],
    ctas: ['Komentar satu kalimat untuk ibu/ayah', 'Kirim video ini ke orang yang kamu sayang', 'Subscribe untuk kisah keluarga menyentuh'],
    thumb: 'close-up ekspresi sedih/menyesal, warna hangat, teks pendek 2-4 kata',
    upload: '18:00-22:00 WIB, akhir pekan biasanya lebih cocok untuk konten emosional',
  },
  horror: {
    label: 'Horor / cerita mistis',
    keys: ['hantu', 'horor', 'horror', 'mistis', 'angker', 'pocong', 'kuntilanak', 'rumah kosong', 'ghost', 'haunted'],
    audience: 'penonton yang mencari rasa takut, penasaran, dan cerita malam',
    age: '16-35',
    device: 'HP + TV',
    goal: ['hiburan malam', 'rasa penasaran', 'cerita seram sebelum tidur'],
    fears: ['sendirian malam hari', 'suara misterius', 'rumah kosong', 'sosok tak terlihat'],
    desires: ['tegang', 'penasaran sampai akhir', 'mendapat twist cerita'],
    ctas: ['Komentar kalau kamu berani nonton sendirian', 'Subscribe untuk cerita horor malam berikutnya', 'Share ke teman yang takut gelap'],
    thumb: 'kontras gelap, siluet, pintu/suara, mata takut, teks larangan seperti JANGAN BUKA',
    upload: '20:00-23:30, cocok malam hari saat mood horor naik',
  },
  dj: {
    label: 'DJ / remix',
    keys: ['dj', 'remix', 'full bass', 'jedag', 'jedug', 'tiktok', 'nonstop', 'bass'],
    audience: 'pendengar musik remix yang butuh beat untuk aktivitas, santai, party, atau perjalanan',
    age: '13-34',
    device: 'HP + speaker/headset',
    goal: ['musik', 'teman aktivitas', 'party', 'mencari sound viral'],
    fears: ['beat kurang nendang', 'audio pecah', 'judul tidak sesuai isi'],
    desires: ['bass kuat', 'versi viral', 'durasi enak diputar ulang'],
    ctas: ['Komentar request DJ berikutnya', 'Subscribe untuk remix full bass terbaru', 'Putar pakai headset/speaker biar bass terasa'],
    thumb: 'neon, speaker, DJ booth, warna cyan/magenta, teks FULL BASS/VIRAL',
    upload: '16:00-22:00, Jumat-Minggu cocok untuk musik hiburan',
  },
  tutorial: {
    label: 'Tutorial / edukasi praktis',
    keys: ['cara', 'tutorial', 'tips', 'belajar', 'how to', 'pemula', 'buat', 'setting'],
    audience: 'pemula yang butuh solusi cepat dan jelas',
    age: '17-40',
    device: 'HP + laptop',
    goal: ['belajar', 'menyelesaikan masalah', 'mengikuti langkah praktis'],
    fears: ['bingung', 'takut salah langkah', 'buang waktu'],
    desires: ['langsung bisa', 'panduan singkat', 'hasil terlihat'],
    ctas: ['Simpan video ini untuk dipraktikkan', 'Komentar bagian yang masih bingung', 'Subscribe untuk tutorial praktis berikutnya'],
    thumb: 'visual jelas, before-after, angka langkah, teks besar maksimal 4 kata',
    upload: '07:00-10:00 atau 19:00-21:00 saat orang mencari solusi',
  },
  muslim: {
    label: 'Muslim / religi',
    keys: ['murottal', 'quran', 'alquran', 'doa', 'sholawat', 'dzikir', 'muslim', 'islam', 'rezeki', 'toko sepi'],
    audience: 'penonton muslim yang mencari ketenangan, doa, murottal, atau suasana religius',
    age: '18-55',
    device: 'HP + speaker/toko/TV',
    goal: ['religi', 'healing', 'ketenangan', 'diputar di rumah/usaha'],
    fears: ['hati gelisah', 'usaha sepi', 'rumah/toko terasa berat'],
    desires: ['tenang', 'berkah', 'semangat ibadah', 'suasana damai'],
    ctas: ['Putar setiap pagi sebelum mulai aktivitas', 'Tulis Aamiin jika ikut berdoa', 'Share ke keluarga atau teman yang butuh ketenangan'],
    thumb: 'cahaya hangat, mushaf/masjid/toko damai, jangan klaim berlebihan',
    upload: '04:30-07:00, 11:30-13:00, atau 18:00-21:00',
  },
  facts: {
    label: 'Fakta unik / wawasan ringan',
    keys: ['fakta', 'unik', 'jarang diketahui', 'misteri dunia', 'pengetahuan', 'tubuh manusia'],
    audience: 'pelajar dan penonton umum yang ingin hiburan singkat plus wawasan',
    age: '13-35',
    device: 'HP',
    goal: ['hiburan singkat', 'menambah wawasan', 'bahan obrolan'],
    fears: ['bosan', 'konten terlalu berat', 'informasi bertele-tele'],
    desires: ['cepat paham', 'terkejut', 'dapat fakta baru'],
    ctas: ['Share ke teman yang suka fakta unik', 'Komentar fakta nomor berapa yang paling kaget', 'Subscribe untuk fakta singkat lainnya'],
    thumb: 'angka besar, objek jelas, warna kontras, teks 2-4 kata',
    upload: '12:00-14:00 atau 18:00-21:00',
  },
  motivation: {
    label: 'Motivasi harian / self improvement',
    keys: ['motivasi', 'produktif', 'malas', 'overthinking', 'mental', 'percaya diri', 'disiplin', 'sukses'],
    audience: 'pelajar/pekerja yang ingin semangat, produktif, dan tidak menunda',
    age: '18-35',
    device: 'HP',
    goal: ['motivasi', 'belajar', 'menata hidup'],
    fears: ['gagal', 'malas terus', 'tidak berkembang', 'overthinking'],
    desires: ['mulai bergerak', 'percaya diri', 'hidup lebih terarah'],
    ctas: ['Tulis satu target kecilmu hari ini', 'Simpan video ini saat kamu butuh semangat', 'Subscribe untuk motivasi harian'],
    thumb: 'ekspresi fokus, meja/jam/catatan, teks singkat seperti MULAI 5 MENIT',
    upload: '05:30-08:00 atau 19:00-21:00',
  },
  general: {
    label: 'General / belum spesifik',
    keys: [],
    audience: 'penonton umum sesuai keyword yang diketik',
    age: '15-40',
    device: 'HP',
    goal: ['hiburan', 'informasi', 'mencari jawaban cepat'],
    fears: ['konten tidak relevan', 'judul tidak sesuai isi'],
    desires: ['jawaban jelas', 'hiburan ringan', 'konten mudah dipahami'],
    ctas: ['Komentar pendapatmu', 'Subscribe untuk konten berikutnya', 'Share jika bermanfaat'],
    thumb: 'subjek utama jelas, teks besar, kontras tinggi, jangan terlalu ramai',
    upload: '18:00-21:00 sebagai default awal, lalu validasi dari analytics channel',
  },
};

function detectIntent(input = {}) {
  const text = norm([
    input.seed,
    input.keyword,
    input.angle,
    input.niche,
    input.nicheNote,
    input.format,
    input.finalTitle,
    input.title,
  ].join(' '));

  if (/cerita jadi lagu|lagu sedih|lirik sedih|lagu ibu|lagu ayah/.test(text)) return 'story_song';
  const scores = {};
  Object.entries(INTENTS).forEach(([id, cfg]) => {
    scores[id] = 0;
    (cfg.keys || []).forEach((k) => {
      const nk = norm(k);
      if (nk && text.includes(nk)) scores[id] += nk.split(' ').length > 1 ? 18 : 10;
    });
  });
  if (/ibu|ayah|mama|bunda|rindu|maaf|menyesal|anak/.test(text) && !/dj|remix|bass/.test(text)) {
    scores.family = (scores.family || 0) + 24;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] <= 0) return 'general';
  return best[0];
}

function inferRegion(region = 'ID', language = 'id') {
  const r = String(region || 'ID').toUpperCase();
  const map = {
    ID: { country: 'Indonesia', language: 'Bahasa Indonesia', culture: 'lokal Indonesia', timezone: 'WIB/WITA/WIT' },
    US: { country: 'United States', language: 'English', culture: 'US/global', timezone: 'US timezones' },
    GB: { country: 'United Kingdom', language: 'English', culture: 'UK/global', timezone: 'GMT/BST' },
    SA: { country: 'Saudi Arabia', language: 'Arabic', culture: 'Arab/Muslim', timezone: 'AST' },
    AE: { country: 'United Arab Emirates', language: 'Arabic/English', culture: 'Arab/global', timezone: 'GST' },
    GLOBAL: { country: 'Global', language: language || 'multi-language', culture: 'global', timezone: 'varied' },
  };
  return map[r] || { country: r, language: language || 'id', culture: 'lokal target', timezone: 'sesuai negara target' };
}

function deviceAdvice(device) {
  const d = norm(device);
  if (d.includes('hp') || d.includes('mobile') || d.includes('phone')) {
    return ['teks thumbnail besar', 'opening 3 detik harus jelas', 'jangan pakai detail kecil', 'kontras tinggi'];
  }
  if (d.includes('tv')) return ['visual besar dan sinematik', 'judul jangan terlalu kecil di thumbnail', 'audio harus bersih'];
  if (d.includes('laptop')) return ['struktur jelas', 'detail boleh lebih lengkap', 'chapter/outline membantu'];
  return ['mobile-first', 'teks besar', 'visual jelas', 'pembukaan cepat'];
}

function ctaForAction(action, cfg) {
  const a = norm(action || 'comment');
  if (a.includes('subscribe')) return `Subscribe untuk ${cfg.label.toLowerCase()} berikutnya`;
  if (a.includes('share')) return cfg.ctas.find((x) => /share|kirim/i.test(x)) || 'Share ke teman yang butuh konten ini';
  if (a.includes('like')) return 'Like jika konten ini terasa relate atau bermanfaat';
  if (a.includes('playlist')) return 'Lanjutkan ke playlist agar alurnya tidak putus';
  if (a.includes('comment') || a.includes('komentar')) return cfg.ctas[0];
  return cfg.ctas[0];
}

function buildProblems(cfg, input) {
  const explicit = asList(input.problems || input.masalah);
  return uniq([...explicit, ...(cfg.fears || [])]).slice(0, 6);
}

function asList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string') return v.split(/[,\n;]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

function buildContentIdeas(cfg, input, intentId) {
  const seed = String(input.seed || input.keyword || input.angle || '').trim() || cfg.label;
  const lang = input.language || 'id';
  const base = cap(seed);
  const ideas = [];
  const add = (problem, solution, content, title, thumbnail, cta, score) => {
    ideas.push({ problem, solution, content, title_seed: title, thumbnail, cta, audience_score: clamp(score) });
  };

  if (intentId === 'story_song' || intentId === 'family') {
    add('rindu/penyesalan kepada orang tua', 'buat konten yang memberi ruang emosi', `Cerita emosional dari sudut pandang anak/orang tua: ${base}`, `Maaf Ibu, Aku Terlambat Mengerti`, 'wajah menangis, cahaya hangat, teks TERLAMBAT MINTA MAAF', cfg.ctas[0], 92);
    add('butuh lagu sedih yang relate', 'pakai hook lagu + cerita', `${base} dibuat sebagai cerita jadi lagu`, `${base} | Cerita Jadi Lagu`, 'cover art emosional, ruang teks kanan', cfg.ctas[1] || cfg.ctas[0], 88);
  } else if (intentId === 'horror') {
    add('ingin sensasi takut/penasaran', 'bangun misteri dari awal', `Cerita horor dengan opening suara/pintu: ${base}`, `Jangan Buka Pintu Setelah Tengah Malam`, 'pintu gelap, siluet, teks JANGAN BUKA', cfg.ctas[0], 91);
    add('mencari kisah seram singkat', 'buat twist akhir', `${base} dengan twist di 30 detik terakhir`, `Suara Itu Datang dari Rumah Kosong`, 'rumah kosong, cahaya biru dingin', cfg.ctas[1], 86);
  } else if (intentId === 'dj') {
    add('butuh musik enak diputar', 'tekankan bass/viral/nonstop', `${base} versi full bass`, `${base} Full Bass Viral`, 'neon DJ, speaker, teks FULL BASS', cfg.ctas[0], 88);
    add('mencari remix terbaru', 'pakai tahun/trend', `DJ/remix trend dari ${base}`, `DJ ${base} Viral TikTok`, 'warna cyan magenta, efek energi', cfg.ctas[1], 84);
  } else if (intentId === 'tutorial') {
    add('bingung mulai dari mana', 'beri langkah praktis', `Tutorial step-by-step: ${base}`, `Cara ${base} untuk Pemula`, 'before-after, angka 1-2-3, teks besar', cfg.ctas[0], 90);
    add('ingin hasil cepat', 'beri checklist', `Checklist cepat agar ${base} berhasil`, `3 Kesalahan Saat ${base}`, 'ikon warning + contoh jelas', cfg.ctas[1], 84);
  } else if (intentId === 'muslim') {
    add('hati gelisah/ingin tenang', 'beri audio/visual religi yang damai', `${base} untuk ketenangan`, `${base} Penenang Hati`, 'cahaya hangat, mushaf/masjid/toko damai', cfg.ctas[0], 88);
    add('butuh diputar saat aktivitas/usaha', 'beri instruksi pemakaian', `${base} diputar pagi/sore`, `${base} untuk Suasana Tenang`, 'toko/rumah damai, tidak berlebihan klaim', cfg.ctas[1], 82);
  } else if (intentId === 'facts') {
    add('butuh hiburan singkat berwawasan', 'buat daftar fakta cepat', `Fakta singkat tentang ${base}`, `7 Fakta ${base} yang Jarang Diketahui`, 'angka besar + objek jelas', cfg.ctas[0], 86);
    add('ingin sesuatu yang mengejutkan', 'mulai dari fakta paling aneh', `${base} dari sudut yang mengejutkan`, `${base}: Nomor 3 Bikin Kaget`, 'ekspresi kaget + visual kontras', cfg.ctas[1], 80);
  } else if (intentId === 'motivation') {
    add('malas/overthinking', 'beri aksi kecil', `Motivasi langkah kecil dari ${base}`, `Mulai 5 Menit, Hidupmu Bisa Berubah`, 'meja/jam/catatan, teks MULAI 5 MENIT', cfg.ctas[0], 88);
    add('ingin lebih percaya diri', 'beri framework singkat', `${base} untuk mental lebih kuat`, `Kamu Diam, Tapi Mentalmu Kuat`, 'wajah tenang + cahaya fokus', cfg.ctas[1], 82);
  } else {
    add('audiens masih umum', 'spesifikkan masalah utama', `Konten menjawab kebutuhan: ${base}`, `${base} yang Jarang Dibahas`, 'subjek utama jelas, teks 2-4 kata', cfg.ctas[0], 70);
    add('intent belum tajam', 'pakai long-tail dari keyword lab', `Angle long-tail untuk ${base}`, `Kenapa ${base} Banyak Dicari?`, 'visual pertanyaan + objek utama', cfg.ctas[1], 68);
  }

  // Language note without trying to translate all content.
  return ideas.map((x) => ({ ...x, language: lang }));
}

function cap(s) {
  return String(s || '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function buildScores(cfg, input, intentId) {
  const text = norm([input.seed, input.keyword, input.angle, input.finalTitle, input.title].join(' '));
  const keywordTokens = tokenize(text);
  const matched = (cfg.keys || []).filter((k) => text.includes(norm(k))).length;
  const hasSpecific = keywordTokens.length >= 3;
  const metrics = input.metrics || {};

  const audienceFit = clamp(55 + matched * 10 + (intentId !== 'general' ? 15 : 0) + (hasSpecific ? 8 : -5));
  const problemClarity = clamp(50 + buildProblems(cfg, input).length * 7 + (hasSpecific ? 10 : 0));
  const deviceFit = clamp(70 + (String(cfg.device).includes('HP') ? 10 : 0));
  const ctaFit = clamp(input.expectedAction || input.cta ? 88 : 72);
  const dataConfidence = clamp(
    45 +
      (metrics.reality || 0) * 0.2 +
      (metrics.confidence || 0) * 0.25 +
      (Array.isArray(input.qualifiedCompetitors) ? Math.min(20, input.qualifiedCompetitors.length * 3) : 0)
  );
  const total = clamp(audienceFit * 0.32 + problemClarity * 0.24 + deviceFit * 0.16 + ctaFit * 0.12 + dataConfidence * 0.16);

  return { total, audienceFit, problemClarity, deviceFit, ctaFit, dataConfidence };
}

function analyzeAudience(input = {}) {
  const language = input.language || input.lang || 'id';
  const region = input.region || 'ID';
  const geo = inferRegion(region, language);
  const intentId = detectIntent(input);
  const cfg = INTENTS[intentId] || INTENTS.general;
  const expectedAction = input.expectedAction || input.action || 'comment';
  const problems = buildProblems(cfg, input);
  const desires = uniq([...(asList(input.desires || input.keinginan)), ...(cfg.desires || [])]).slice(0, 6);
  const goals = uniq([...(asList(input.goals || input.tujuan)), ...(cfg.goal || [])]).slice(0, 6);
  const device = input.device || cfg.device || 'HP';
  const cta = input.cta || ctaForAction(expectedAction, cfg);
  const scores = buildScores(cfg, input, intentId);
  const contentIdeas = buildContentIdeas(cfg, input, intentId);

  const profile = {
    intent_id: intentId,
    intent_label: cfg.label,
    one_sentence: `Target utama: ${cfg.audience}. Masalah utama: ${problems[0] || 'belum spesifik'}. Solusi konten: buat video yang langsung menjawab emosi/kebutuhan itu.`,
    cards: {
      geografi: {
        negara: geo.country,
        bahasa: geo.language,
        budaya: geo.culture,
        zona_waktu: geo.timezone,
        region,
      },
      demografi: {
        usia: input.age || cfg.age,
        gender: input.gender || 'campuran / validasi dari analytics',
        pendidikan: input.education || 'umum',
        pekerjaan: input.job || 'pelajar, pekerja, kreator, atau penonton umum sesuai niche',
      },
      status_sosial: {
        pendapatan: input.income || 'beragam',
        daya_beli: input.buyingPower || 'sedang / belum divalidasi',
        lifestyle: input.lifestyle || cfg.label,
        minat: uniq([cfg.label, ...(goals || [])]).slice(0, 5),
      },
      perangkat: {
        utama: device,
        advice: deviceAdvice(device),
      },
      psikologi: {
        ketakutan: problems,
        keinginan: desires,
        emosi_dominan: inferDominantEmotion(intentId),
      },
      kebiasaan_menonton: {
        jam_online: input.watchTime || cfg.upload,
        durasi_awal: '3-8 detik pertama wajib kuat; validasi retensi dari YouTube Studio',
        aktivitas_saat_menonton: inferWatchActivity(intentId),
      },
      tujuan_menonton: goals,
      action_yang_diharapkan: {
        primary: expectedAction,
        cta,
        secondary: cfg.ctas.slice(0, 3),
      },
    },
  };

  return {
    ok: true,
    version: '23.0-audience-brain',
    input_summary: {
      seed: input.seed || input.keyword || '',
      angle: input.angle || '',
      title: input.finalTitle || input.title || '',
      language,
      region,
    },
    scores,
    profile,
    strategy_flow: {
      siapa: profile.one_sentence,
      masalah: problems[0] || 'Belum tajam — isi masalah audiens dulu',
      keinginan: desires[0] || 'Belum tajam',
      solusi: solutionForIntent(intentId),
      konten: contentIdeas[0]?.content || '',
      judul: contentIdeas[0]?.title_seed || input.finalTitle || input.title || '',
      thumbnail: cfg.thumb,
      upload: cfg.upload,
      cta,
      monetisasi_awal: monetizationHint(intentId),
      analisa_ulang: ['CTR', 'retensi 30 detik pertama', 'komentar sesuai emosi audiens', 'impressions vs klik', 'ulang pola yang menang'],
    },
    content_ideas: contentIdeas,
    checklist: buildChecklist(profile, scores),
    risks: buildRisks(intentId, scores, input),
    data_gaps: [
      'Demografi real channel perlu divalidasi dari YouTube Analytics.',
      'CTR dan retensi kompetitor tidak tersedia di API publik.',
      'Jam upload terbaik harus diuji dari histori channel sendiri.',
    ],
  };
}

function inferDominantEmotion(intentId) {
  return (
    {
      story_song: 'haru, rindu, penyesalan',
      family: 'rindu, maaf, haru',
      horror: 'takut, penasaran, tegang',
      dj: 'semangat, hype, energi',
      tutorial: 'bingung → lega',
      muslim: 'tenang, berharap, religius',
      facts: 'penasaran, terkejut',
      motivation: 'lelah → semangat',
      general: 'penasaran / kebutuhan cepat',
    }[intentId] || 'penasaran'
  );
}

function inferWatchActivity(intentId) {
  return (
    {
      story_song: 'sendiri, malam hari, pakai headset, sambil healing',
      family: 'sendiri/keluarga, sering malam hari',
      horror: 'malam hari, sendirian atau bareng teman',
      dj: 'sambil aktivitas, perjalanan, kerja, santai, party',
      tutorial: 'sambil praktik di HP/laptop',
      muslim: 'diputar di rumah, toko, perjalanan, atau saat ibadah ringan',
      facts: 'scroll santai, istirahat, sekolah/kampus',
      motivation: 'pagi sebelum aktivitas atau malam saat refleksi',
      general: 'scroll santai atau mencari jawaban cepat',
    }[intentId] || 'scroll santai'
  );
}

function solutionForIntent(intentId) {
  return (
    {
      story_song: 'buat cerita/lagu yang langsung menyentuh masalah emosi audiens, dengan hook kuat sejak awal',
      family: 'angkat konflik keluarga yang spesifik lalu beri ruang refleksi/haru',
      horror: 'bangun rasa takut dari objek sederhana, jaga misteri sampai akhir',
      dj: 'beri audio yang sesuai janji judul: bass, viral, nonstop, atau mood tertentu',
      tutorial: 'beri langkah praktis, contoh visual, dan hasil akhir yang jelas',
      muslim: 'beri suasana tenang dan arahan pemakaian tanpa klaim berlebihan',
      facts: 'beri fakta singkat, visual jelas, dan urutan yang bikin penasaran',
      motivation: 'beri langkah kecil yang bisa dilakukan hari ini',
      general: 'perjelas masalah audiens sebelum membuat konten',
    }[intentId] || 'perjelas masalah audiens sebelum membuat konten'
  );
}

function monetizationHint(intentId) {
  return (
    {
      story_song: 'playlist lagu/cerita emosional, membership request lagu, digital product lirik/backsound bila legal',
      family: 'playlist kisah emosional, membership/supporter, kompilasi cerita',
      horror: 'playlist series horor, membership cerita malam, live premiere',
      dj: 'playlist remix, request remix, live set; pastikan hak cipta aman',
      tutorial: 'affiliate tools, template, kelas, konsultasi',
      muslim: 'playlist murottal/dzikir, donasi/support; hindari klaim spiritual berlebihan',
      facts: 'Shorts funnel ke long-form, sponsorship edukasi ringan',
      motivation: 'ebook/checklist, komunitas, coaching ringan',
      general: 'tentukan niche dulu agar monetisasi lebih jelas',
    }[intentId] || 'tentukan niche dulu agar monetisasi lebih jelas'
  );
}

function buildChecklist(profile, scores) {
  const c = profile.cards;
  return [
    { item: 'Negara/bahasa target jelas', ok: !!c.geografi.negara && !!c.geografi.bahasa },
    { item: 'Usia target jelas', ok: !!c.demografi.usia },
    { item: 'Perangkat utama jelas', ok: !!c.perangkat.utama },
    { item: 'Masalah/ketakutan audiens jelas', ok: (c.psikologi.ketakutan || []).length >= 2 },
    { item: 'Keinginan audiens jelas', ok: (c.psikologi.keinginan || []).length >= 2 },
    { item: 'Tujuan menonton jelas', ok: (c.tujuan_menonton || []).length >= 1 },
    { item: 'CTA sesuai aksi yang diharapkan', ok: !!c.action_yang_diharapkan.cta },
    { item: 'Audience score layak', ok: scores.total >= 65 },
  ];
}

function buildRisks(intentId, scores, input) {
  const risks = [];
  if (scores.total < 65) risks.push({ level: 'sedang', issue: 'Profil audiens belum cukup tajam.', mitigation: 'Isi niche/catatan audiens dan masalah utama lebih spesifik.' });
  if (intentId === 'general') risks.push({ level: 'tinggi', issue: 'Niche/intent masih terlalu umum.', mitigation: 'Mulai dari siapa audiensnya, bukan dari konten yang ingin dibuat.' });
  if (!input.finalTitle && !input.title) risks.push({ level: 'rendah', issue: 'Judul final belum masuk.', mitigation: 'Setelah engine memilih judul, jalankan Audience Brain ulang untuk CTA/thumbnail lebih presisi.' });
  if (intentId === 'dj') risks.push({ level: 'sedang', issue: 'Risiko hak cipta musik.', mitigation: 'Pastikan audio/remix aman dan tidak melanggar copyright.' });
  if (intentId === 'muslim') risks.push({ level: 'sedang', issue: 'Risiko klaim berlebihan.', mitigation: 'Hindari janji pasti rezeki/penyembuhan; gunakan bahasa menenangkan dan etis.' });
  return risks;
}

module.exports = {
  analyzeAudience,
  detectIntent,
  inferRegion,
  deviceAdvice,
  INTENTS,
};
