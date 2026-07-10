/**
 * YIE Brain v22 — Self-Learning Scoring Engine
 * Data-based YouTube strategy, bukan chatbot.
 * 
 * Pemilik: zhoniandre-lab
 * Otak Arsitek: Arena Agent
 * 
 * Cara pakai di index.html:
 * <script src="/js/yie-brain-v22.js"></script>
 * const USE_V22 = true;
 * function scoreTitle(title, a, mem) {
 *   if (USE_V22 && window.YIE22) return YIE22.scoreTitleV2(title, a, mem);
 *   // fallback v21 original
 * }
 */

(function(global){
'use strict';

const YIE22 = {};
const VERSION = '22.0';

// --- utils (safe, tidak bentrok dengan global index.html) ---
function norm22(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^\p{L}0-9\s]/gu,' ').replace(/\s+/g,' ').trim() }
function tok22(s){ const stop=new Set('yang dan di ke dari ini itu untuk dengan pada ada akan jadi bisa tidak tak nya se ber me ter per kan lah pun atau karena agar sebagai dalam saat ketika the of and in to a is are was were be for on by an it this that you your our new full video official lyrics lirik part episode shorts short و في من على إلى الى عن هذا هذه ذلك تلك مع أن ان كان كانت هو هي لا ما كل uchun bilan va yoki ham bu shu bir edi bor yoq juda'.split(' ')); return norm22(s).split(' ').filter(w=>w.length>1&&!stop.has(w)) }
function clamp22(n){ return Math.max(0,Math.min(100,Math.round(n))) }
function sim22(a,b){ let A=new Set(tok22(a)), B=new Set(tok22(b)); if(!A.size||!B.size) return 0; let i=0; A.forEach(x=>B.has(x)&&i++); return i / new Set([...A,...B]).size }

// --- Channel DNA ---
function channelDNA(nicheId, formatId){
  // Bobot Search/Browse/Unique/Gap/Hook/Quality per niche
  const base = { search:0.14, browse:0.17, unique:0.15, gap:0.10, hook:0.10, quality:0.07 };
  if(nicheId==='family' || formatId==='story_song'){
    return { search:0.12, browse:0.20, unique:0.18, gap:0.10, hook:0.14, quality:0.07, label:'Family/Story Song - Browse+Emotion first' };
  }
  if(nicheId==='horror'){
    return { search:0.11, browse:0.22, unique:0.16, gap:0.09, hook:0.16, quality:0.06, label:'Horror - CTR/Curiosity first' };
  }
  if(nicheId==='dj'){
    return { search:0.20, browse:0.14, unique:0.12, gap:0.08, hook:0.10, quality:0.06, label:'DJ - Search first' };
  }
  return {...base, label:'General'};
}

// --- Memory Brain v22 : Bayesian CTR learning ---
function getBrain22(){
  try{
    const raw = localStorage.getItem('yie_brain_v1');
    if(!raw) return {researches:[], results:[]};
    return JSON.parse(raw);
  }catch(e){ return {researches:[], results:[]} }
}

function titlePerformanceStatsV22(title){
  const b = getBrain22();
  const nt = norm22(title);
  if(!nt) return null;
  const rows=[];
  (b.results||[]).forEach(res=>{
    const tnorm = norm22(res.title||'');
    if(!tnorm) return;
    const s = sim22(nt, tnorm);
    if(s >= 0.55) rows.push({...res, _sim:s});
  });
  if(!rows.length) return null;
  let wSum=0, ctr=0, imp=0, avd=0, ageSum=0, n=0;
  const now = Date.now();
  rows.forEach(r=>{
    const age_days = Math.max(0, Math.round((now - (+r.time||now))/864e5));
    const time_decay = Math.pow(0.5, age_days / 30); // half-life 30 hari
    const w = r._sim * time_decay;
    if(r.ctr!=null && r.ctr!=='') ctr += (+r.ctr) * w;
    if(r.impressions!=null && r.impressions!=='') imp += (+r.impressions) * w;
    if(r.avdSec!=null && r.avdSec!=='') avd += (+r.avdSec) * w;
    ageSum += age_days * w;
    wSum += w; n++;
  });
  if(wSum<=0) return {n:rows.length};
  return {
    n,
    avgCtr: ctr / wSum,
    avgImp: imp / wSum,
    avgAvd: avd / wSum,
    avgAgeDays: ageSum / wSum,
    samples: rows.slice(0,5)
  };
}

function learningBoostV2(title){
  const st = titlePerformanceStatsV22(title);
  if(!st || !st.n) return {delta:0, why:null, stats:null};

  // Bayesian CTR
  const prior_ctr = 4.5;
  const prior_n = 5;
  const n = st.n;
  const observed = st.avgCtr || 0;
  const weight = n / (n + prior_n);
  const bayes_ctr = weight * observed + (1-weight) * prior_ctr;
  
  // time decay sudah masuk di stats (avgAgeDays)
  let delta = 0;
  const why = [];

  if(bayes_ctr >= 8.0){ delta += 22; why.push(`CTR Bayes tinggi ~${bayes_ctr.toFixed(1)}%`); }
  else if(bayes_ctr >= 5.5){ delta += 14; why.push(`CTR Bayes oke ~${bayes_ctr.toFixed(1)}%`); }
  else if(bayes_ctr >= 3.5){ delta += 4; why.push(`CTR Bayes sedang ~${bayes_ctr.toFixed(1)}%`); }
  else if(bayes_ctr >= 2.0){ delta -= 4; why.push(`CTR Bayes rendah ~${bayes_ctr.toFixed(1)}%`); }
  else { delta -= 18; why.push(`CTR Bayes lemah ~${bayes_ctr.toFixed(1)}%`); }

  // sample confidence bonus
  if(n >= 3){ delta += 3; why.push(`n=${n} sampel, confidence naik`); }

  // recent fail guard
  try{
    const b = getBrain22();
    const recent_fail = (b.results||[]).slice(0,12).some(r=>{
      const age = (Date.now() - (+r.time||0))/864e5;
      if(age > 14) return false;
      const s = sim22(title, r.title||'');
      return s >= 0.60 && (r.ctr!=null && +r.ctr < 3.0);
    });
    if(recent_fail){ delta -= 8; why.push('Fail CTR <3% dalam 14 hari terakhir, mirip judul'); }
  }catch(e){}

  // AVD guard
  if(st.avgAvd != null && st.avgAvd > 0 && st.avgAvd < 25){
    delta -= 5; why.push('AVD historis pendek');
  }

  delta = Math.max(-24, Math.min(26, Math.round(delta)));
  return {delta, why: why.join(' · '), stats:st, bayes_ctr};
}

// --- Gap Score v2 ---
function gapWordsV2(a){
  // kompatibel dengan gapWords() di index.html
  try{
    if(typeof gapWords === 'function') return gapWords(a);
  }catch(e){}
  // fallback sederhana
  const comps = norm22((a.qualified||a.videos||[]).slice(0,20).map(v=>v.title).join(' '));
  const cand = [...new Set([...tok22(a.keyword||''), ...tok22(a.seed||'')])];
  return cand.filter(w=>w.length>2 && !comps.includes(w)).slice(0,10);
}

function gapPhrasesV2(a){
  // long-tail 2-4 kata dari patterns.signals yang jarang di kompetitor
  const comps = norm22((a.qualified||a.videos||[]).slice(0,15).map(v=>v.title).join(' '));
  const phrases = [];
  try{
    const sig = (a.patterns && a.patterns.signals) || [];
    sig.forEach(s=>{
      const w = String(s).split(/\s+/).length;
      if(w >= 2 && w <= 4 && !comps.includes(norm22(s))){
        phrases.push(s);
      }
    });
  }catch(e){}
  return [...new Set(phrases)].slice(0,8);
}

function gapScoreV2(a){
  const gw = gapWordsV22(a);
  const gp = gapPhrasesV22(a);
  return {words: gw, phrases: gp, count_words: gw.length, count_phrases: gp.length};
}
function gapWordsV22(a){ return gapWordsV2(a); }
function gapPhrasesV22(a){ return gapPhrasesV2(a); }

// --- Uniqueness v2 ---
function uniquenessV2(title, comps){
  comps = comps || [];
  let maxSim = 0;
  comps.slice(0,12).forEach(v=>{ maxSim = Math.max(maxSim, sim22(title, v.title||'')); });
  const unique = clamp22(98 - maxSim * 85);
  let serpPenalty = 0;
  if(maxSim >= 0.85) serpPenalty = 32;
  else if(maxSim >= 0.72) serpPenalty = 20;
  else if(maxSim >= 0.60) serpPenalty = 10;
  const bonus = maxSim < 0.45 ? 4 : 0;
  return {unique, maxSim, serpPenalty, bonus};
}

// --- Psychology Hook v2 ---
function psychologyHookScoreV2(title, a){
  // fallback ke creatorHookScore kalau ada di global
  let base = 48;
  try{
    if(typeof creatorHookScore === 'function'){
      base = creatorHookScore(title, a);
    }
  }catch(e){}
  
  const n = norm22(title);
  let delta = 0;

  // emotion specificity bonus
  if(/anakmu menangis|jangan pergi|terlambat minta maaf|dengar sampai habis|air mata ibu|rindu yang membunuh|ibu di mana/.test(n)) delta += 14;
  // generic penalty - keras
  if(/^(maaf ibu|rindu ibu|big hook|maafkan aku ibu)$/i.test(String(title).trim())) delta -= 35;
  // story_song must look like song
  const fmt = (a.format && a.format.id) || (global.CONTENT_FORMAT && global.CONTENT_FORMAT.id) || '';
  if(fmt === 'story_song'){
    if(/lagu|lirik|nangis|dengar|cerita jadi lagu/.test(n)) delta += 8;
    if(/dj|remix|bass|hantu|horor/.test(n)) delta -= 22;
  }
  return clamp22(base + delta);
}

// --- Main scoreTitle v22 ---
function scoreTitleV2(title, a, mem){
  // a = angle object dari analyzeAngle()
  // mem = getMemory() array, untuk memoryPenalty legacy
  
  // --- helper fallbacks kalau fungsi global belum ada ---
  const safeCall = (fnName, fallback, ...args)=>{
    try{ if(typeof global[fnName] === 'function') return global[fnName](...args); }catch(e){}
    return fallback;
  };
  
  const nt = norm22(title);
  const kwTok = tok22(a.keyword||'');
  const terms = tok22(title);
  const cover = kwTok.length ? kwTok.filter(k=>terms.some(t=>t.includes(k)||k.includes(t))).length / kwTok.length : 0.4;

  // Ambil metrik dari fungsi global kalau ada, kalau tidak pakai default aman
  const titleQuality = safeCall('titleQuality', 82, title);
  const languageFit = safeCall('languageFit', 85, title, a.lang||'id');
  const intentFit = safeCall('intentFitScore', 65, title, a);
  const nicheFit = safeCall('nicheTitleFit', 65, title, a);
  const patternFit = safeCall('patternFitScore', 55, title, a);
  const patternBorn = safeCall('patternBornFit', 55, title, a);
  const ctrScore = safeCall('ctrScore', 55, title, a);

  // Uniqueness v2
  const comps = a.qualified || a.videos || [];
  const uniq = uniquenessV2(title, comps);

  // Gap v2
  const gap = gapScoreV2(a);
  const gapBoost = clamp22(gap.count_words * 10 + gap.count_phrases * 16 + (title.split(/\s+/).length>=4 && title.split(/\s+/).length<=12 ? 6 : 0));

  // Psychology Hook v2
  const hookScore = psychologyHookScoreV2(title, a);

  // Format boost
  let formatBoost = 0;
  const fmt = (a.format && a.format.id) || (global.CONTENT_FORMAT && global.CONTENT_FORMAT.id) || 'auto';
  if(fmt === 'story_song'){
    if(/lagu|lirik|cerita jadi lagu|dengar|nyanyi|musik/.test(nt)) formatBoost = 18;
    else formatBoost = -8;
    if(/dj|remix|bass|jedag|hantu|horor/.test(nt)) formatBoost = -24;
  }
  if(fmt === 'horror_story'){
    if(/hantu|horor|seram|mistis|pintu|suara/.test(nt)) formatBoost = 16;
    else if(/lagu|dj/.test(nt)) formatBoost = -14;
  }

  // Memory penalty legacy
  let memoryPenalty = 0;
  try{
    mem = mem || [];
    if(mem.some(m=>norm22(m.title)===nt)) memoryPenalty = 14;
  }catch(e){}

  const languagePenalty = languageFit < 50 ? 38 : 0;

  // Channel DNA weights
  const dna = channelDNA(a.niche && a.niche.id, fmt);
  
  // Component scores
  const search = clamp22(cover*34 + nicheFit*0.16 + languageFit*0.07 + intentFit*0.18 + patternBorn*0.07 + hookScore*0.05 + gapBoost*0.10 - uniq.serpPenalty*0.15);
  const browse = clamp22(ctrScore*0.24 + hookScore*0.18 + uniq.unique*0.24 + patternFit*0.08 + patternBorn*0.08 + titleQuality*0.05 + intentFit*0.05 + gapBoost*0.06 - uniq.serpPenalty*0.12);
  const algo = clamp22(search*0.20 + browse*0.30 + (a.metrics.demand||0)*0.14 + (a.metrics.low||0)*0.14 + (a.metrics.fresh||0)*0.07 + patternBorn*0.05 + uniq.unique*0.08 + hookScore*0.04);

  // Learning boost v22
  const learn = learningBoostV2(title);
  
  // Confidence penalty - data kompetitor tipis
  const qualified_n = (a.qualified || []).length;
  let confidencePenalty = 0;
  if(qualified_n >= 5) confidencePenalty = 0;
  else if(qualified_n >= 3) confidencePenalty = 5;
  else if(qualified_n >= 1) confidencePenalty = 14;
  else confidencePenalty = 28;

  // Final score dengan DNA weights
  let score = 
    search * dna.search +
    browse * dna.browse +
    algo * 0.14 +
    titleQuality * 0.07 +
    uniq.unique * dna.unique +
    (a.metrics.demand||0) * 0.06 +
    languageFit * 0.03 +
    intentFit * 0.08 +
    patternBorn * 0.05 +
    hookScore * dna.hook +
    gapBoost * dna.gap +
    formatBoost +
    (learn.delta || 0) -
    memoryPenalty -
    languagePenalty -
    uniq.serpPenalty * 0.35 +
    uniq.bonus -
    confidencePenalty;

  score = clamp22(score);

  // Reasons - bisa diaudit
  const reasons = [];
  reasons.push({c: uniq.unique>=65?'good':uniq.unique>=50?'yellow':'bad', t:`Uniqueness v22 ${uniq.unique}/100 (max sim ${Math.round(uniq.maxSim*100)}%)`});
  reasons.push({c: gapBoost>=20?'good':'info', t:`Gap v2 ${gapBoost}/100 — words: ${gap.words.join(', ')||'-'} | phrases: ${gap.phrases.join(', ')||'-'}`});
  if(formatBoost) reasons.push({c: formatBoost>0?'good':'bad', t:`Format channel boost ${formatBoost}`});
  if(learn.delta) reasons.push({c: learn.delta>=0?'good':'bad', t:`Memory v22: ${learn.why} (Δ ${learn.delta>=0?'+':''}${learn.delta})`});
  if(confidencePenalty) reasons.push({c:'yellow', t:`Data kompetitor tipis (${qualified_n} video) — confidence penalty -${confidencePenalty}`});
  reasons.push({c:'info', t:`DNA ${dna.label} — Search×${dna.search} Browse×${dna.browse} Hook×${dna.hook}`});
  reasons.push({c:'info', t:`Score ${score} · Search ${search} · Browse ${browse} · Pattern ${patternBorn} · Hook ${hookScore} · Quality ${titleQuality}`});

  // Pack - fallback ke makePack global kalau ada
  let pack = {desc:'', tags:'', hook:''};
  try{ if(typeof global.makePack === 'function') pack = global.makePack(title, a); }catch(e){}

  return {
    title,
    score, search, browse, algo,
    quality: titleQuality,
    langFit: languageFit,
    intentFit,
    patternBorn,
    hookScore,
    unique: uniq.unique,
    maxCompSim: uniq.maxSim,
    gapBoost,
    formatBoost,
    strategy: (typeof global.titleStrategy === 'function' ? global.titleStrategy(search,browse,hookScore,a) : 'Search + Browse Hybrid'),
    strategyTag: null,
    desc: pack.desc,
    tags: pack.tags,
    hook: pack.hook,
    reasons,
    // v22 meta
    v22: true,
    dna: dna.label,
    learningDelta: learn.delta || 0,
    learningWhy: learn.why || '',
    confidencePenalty,
    gap_words: gap.words,
    gap_phrases: gap.phrases
  };
}

// --- exports ---
YIE22.VERSION = VERSION;
YIE22.scoreTitleV2 = scoreTitleV2;
YIE22.learningBoostV2 = learningBoostV2;
YIE22.psychologyHookScoreV2 = psychologyHookScoreV2;
YIE22.channelDNA = channelDNA;
YIE22.gapScoreV2 = gapScoreV2;
YIE22.uniquenessV2 = uniquenessV2;
YIE22.titlePerformanceStatsV22 = titlePerformanceStatsV22;

global.YIE22 = YIE22;

console.log('[YIE Brain v22] loaded - Self-Learning Scoring Engine');

})(typeof window !== 'undefined' ? window : globalThis);
