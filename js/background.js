// background.js - DeutschLens Service Worker (Manifest V3)
//
// 역할:
//   1. 아이콘/배지 관리
//   2. 모든 외부 API 호출 처리 (Content Script 대신 수행)
//      → Background Service Worker는 페이지 CSP의 영향을 받지 않아 신뢰성이 높음

// ─── 캐시 (서비스 워커 인스턴스가 유지되는 동안 보존) ────────────────────────
const WORD_CACHE  = {};  // { "Hund__ko": result }
const TRANS_CACHE = {};  // { "de_ko_Hund": "개" }

// ─── 아이콘 ───────────────────────────────────────────────────────────────────

function drawIcon(size, enabled) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const h = Math.floor(size / 3);
  const r = size * 0.12;

  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = enabled ? '#1a1a1a' : '#555';
  ctx.fillRect(0, 0, size, h);
  ctx.fillStyle = enabled ? '#DD0000' : '#888';
  ctx.fillRect(0, h, size, h);
  ctx.fillStyle = enabled ? '#FFCE00' : '#aaa';
  ctx.fillRect(0, h * 2, size, size);

  ctx.fillStyle = 'white';
  ctx.font = `bold ${Math.floor(size * 0.62)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = size * 0.08;
  ctx.fillText('D', size / 2, size / 2 + size * 0.02);
  return ctx.getImageData(0, 0, size, size);
}

async function setIcon(enabled) {
  try {
    await chrome.action.setIcon({
      imageData: {
        16: drawIcon(16, enabled),
        32: drawIcon(32, enabled),
        48: drawIcon(48, enabled),
        128: drawIcon(128, enabled),
      }
    });
  } catch (e) { /* OffscreenCanvas 미지원 환경 무시 */ }
}

async function updateBadge(count) {
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
}

// ─── 라이프사이클 ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const { dcEnabled, dcWordList } = await chrome.storage.local.get(['dcEnabled', 'dcWordList']);
  await setIcon(dcEnabled !== false);
  await updateBadge((dcWordList || []).length);
});

chrome.runtime.onStartup.addListener(async () => {
  const { dcEnabled, dcWordList } = await chrome.storage.local.get(['dcEnabled', 'dcWordList']);
  await setIcon(dcEnabled !== false);
  await updateBadge((dcWordList || []).length);
});

// ─── 메시지 핸들러 ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DC_UPDATE_BADGE') {
    updateBadge(msg.count);
  }
  if (msg.type === 'DC_SET_ICON') {
    setIcon(msg.enabled);
  }
  // Content Script에서 단어 조회 요청
  if (msg.type === 'DC_FETCH_WORD') {
    fetchWordInfo(msg.word, msg.lang || 'ko')
      .then(result => sendResponse({ ok: true, data: result }))
      .catch(err  => sendResponse({ ok: false, error: String(err) }));
    return true; // 비동기 응답을 위해 true 반환 (필수)
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 단어 조회 로직 (이전 wiktionary.js에서 이전)
// Service Worker 컨텍스트에서는 document가 없으므로 regex 기반 HTML 파싱 사용
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchWordInfo(word, targetLang = 'ko') {
  const clean = cleanWord(word);
  if (!clean || clean.length < 2) return null;

  const cacheKey = `${clean}__${targetLang}`;
  if (cacheKey in WORD_CACHE) return WORD_CACHE[cacheKey];

  // 시도할 대소문자 변형: 원본 → 첫글자 대문자 → 전체 소문자
  const variants = [...new Set([
    clean,
    clean[0].toUpperCase() + clean.slice(1),
    clean.toLowerCase(),
  ])];

  let grammar = null;
  let enDefs  = [];

  for (const variant of variants) {
    // REST API(정의)와 Wikitext API(문법)를 병렬 요청
    const [defs, gram] = await Promise.all([
      tryRESTDefinitions(variant),
      tryWikitextGrammar(variant),
    ]);

    if (defs.length > 0 || gram) {
      enDefs  = defs;
      grammar = gram;
      break;
    }
  }

  if (enDefs.length === 0 && !grammar) {
    WORD_CACHE[cacheKey] = null;
    return null;
  }

  const result = {
    word: clean,
    pos:            grammar?.pos            || null,
    gender:         grammar?.gender         || null,
    article:        grammar?.article        || null,
    plural:         grammar?.plural         || null,
    genitive:       grammar?.genitive       || null,
    verb3sg:        grammar?.verb3sg        || null,
    verbPast:       grammar?.verbPast       || null,
    verbParticiple: grammar?.verbParticiple || null,
    definitions:    enDefs,
    translationLang: 'en',
  };

  // 한국어 번역
  if (targetLang === 'ko') {
    const koDefs = await translateToKorean(clean, enDefs);
    if (koDefs.length > 0) {
      result.definitions     = koDefs;
      result.translationLang = 'ko';
      WORD_CACHE[cacheKey] = result; // 번역 성공 시에만 캐시
    } else {
      // 번역 실패: 영어로 폴백하되 캐시하지 않음 (다음 조회 시 재시도)
      result.translationLang = 'en_fallback'; // 폴백 표시
    }
    return result;
  }

  WORD_CACHE[cacheKey] = result;
  return result;
}

// ─── 1. Wiktionary REST API (영어 정의) ──────────────────────────────────────

async function tryRESTDefinitions(word) {
  try {
    const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return [];

    const data = await res.json();

    // "de" 키 우선, 없으면 language === "German" 인 항목 탐색
    let entries = [];
    if (Array.isArray(data['de']) && data['de'].length > 0) {
      entries = data['de'];
    } else {
      for (const val of Object.values(data)) {
        if (Array.isArray(val)) {
          const german = val.filter(e => e.language === 'German');
          if (german.length > 0) { entries = german; break; }
        }
      }
    }

    if (entries.length === 0) return [];

    return entries
      .flatMap(e => (e.definitions || []).map(d => stripHtml(d.definition || '')))
      .filter(d => d && d.length > 1)
      .slice(0, 3);

  } catch (e) {
    console.warn('[DC] REST API error for', word, e.message);
    return [];
  }
}

// ─── 2. Wiktionary Wikitext API (문법: 성별·복수형·동사 변화) ─────────────────

async function tryWikitextGrammar(word) {
  try {
    const url =
      `https://en.wiktionary.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(word)}` +
      `&prop=revisions&rvprop=content&rvslots=main` +
      `&format=json&origin=*`;

    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return null;

    const data  = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || 'missing' in page) return null;

    const wikitext = page?.revisions?.[0]?.slots?.main?.['*'];
    if (!wikitext) return null;

    return parseGrammarFromWikitext(wikitext);

  } catch (e) {
    console.warn('[DC] Wikitext API error for', word, e.message);
    return null;
  }
}

// ─── Wikitext 파싱 ────────────────────────────────────────────────────────────

function parseGrammarFromWikitext(wikitext) {
  const germanSection = extractGermanSection(wikitext);
  if (!germanSection) return null;

  const result = {
    pos: null, gender: null, article: null,
    plural: null, genitive: null,
    verb3sg: null, verbPast: null, verbParticiple: null,
  };

  const nounMatch = germanSection.match(/\{\{de-noun\|([^}]+)\}\}/);
  const verbMatch = germanSection.match(/\{\{de-verb(?:\s*\|([^}]*))?\}\}/);

  if (nounMatch) {
    result.pos = 'noun';
    parseNounTemplate(nounMatch[1], result);
  } else if (verbMatch) {
    result.pos = 'verb';
    if (verbMatch[1]) parseVerbTemplate(verbMatch[1], result);
  } else if (/===\s*Adjective\s*===/.test(germanSection)) {
    result.pos = 'adjective';
  } else if (/===\s*Adverb\s*===/.test(germanSection)) {
    result.pos = 'adverb';
  } else if (/===\s*Preposition\s*===/.test(germanSection)) {
    result.pos = 'preposition';
  } else {
    return null;
  }

  return result;
}

/**
 * 줄 단위 파싱으로 == German == 섹션 추출 (정규식보다 훨씬 안정적)
 */
function extractGermanSection(wikitext) {
  const lines = wikitext.split('\n');
  let inGerman = false;
  const collected = [];

  for (const line of lines) {
    // ==LangName== 형식의 레벨-2 헤더 감지
    const h2 = line.match(/^==\s*([^=]+?)\s*==\s*$/);
    if (h2) {
      if (inGerman) break;                         // 다음 언어 섹션 시작 → 종료
      if (h2[1].trim() === 'German') inGerman = true;
      continue;
    }
    if (inGerman) collected.push(line);
  }

  return inGerman ? collected.join('\n') : null;
}

function parseNounTemplate(raw, r) {
  const parts = raw.split('|');
  const g = (parts[0] || '').trim().toLowerCase();
  if      (g === 'm' || g === 'mf') applyGender('m', r);
  else if (g === 'f' || g === 'fm') applyGender('f', r);
  else if (g === 'n')               applyGender('n', r);

  let pos = 0;
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i].trim();
    if (!p) continue;
    if (p.includes('=')) {
      const idx = p.indexOf('=');
      const k = p.slice(0, idx).trim().toLowerCase();
      const v = p.slice(idx + 1).trim();
      if (k === 'g' || k === 'g1') {
        if (v === 'm') applyGender('m', r);
        else if (v === 'f') applyGender('f', r);
        else if (v === 'n') applyGender('n', r);
      }
      if (k === 'gen' || k === 'gen1') r.genitive = v;
      if (k === 'pl'  || k === 'pl1')  r.plural   = v;
    } else if (p !== '-' && p !== '+') {
      if (pos === 0) r.genitive = p;
      if (pos === 1) r.plural   = p;
      pos++;
    }
  }
  if (r.plural === '-') r.plural = null;
}

function parseVerbTemplate(raw, r) {
  for (const p of raw.split('|')) {
    if (!p.includes('=')) continue;
    const idx = p.indexOf('=');
    const k   = p.slice(0, idx).trim().toLowerCase();
    const v   = p.slice(idx + 1).trim();
    if (k === 'pres3s' || k === 'pres_3sg') r.verb3sg        = v;
    if (k === 'past'   || k === 'pret3s')   r.verbPast       = v;
    if (k === 'pp'     || k === 'perf')     r.verbParticiple = v;
  }
}

function applyGender(g, r) {
  r.gender  = g;
  r.article = g === 'm' ? 'der' : g === 'f' ? 'die' : 'das';
}

// ─── 3. MyMemory 한국어 번역 ──────────────────────────────────────────────────

async function translateToKorean(germanWord, enDefs) {
  const results = [];

  const direct = await callMyMemory(germanWord, 'de', 'ko');
  if (direct) results.push(direct);

  for (const def of enDefs.slice(0, 2)) {
    if (results.length >= 3) break;
    const t = await callMyMemory(def, 'en', 'ko');
    if (t && !results.includes(t)) results.push(t);
  }

  return results;
}

async function callMyMemory(text, from, to) {
  if (!text || text.length > 150) return null;
  const key = `${from}_${to}_${text}`;
  if (key in TRANS_CACHE) return TRANS_CACHE[key];

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    const res  = await fetchWithTimeout(url, 5000);
    if (!res.ok) { TRANS_CACHE[key] = null; return null; }

    const data       = await res.json();
    const translated = data?.responseData?.translatedText;

    if (
      !translated ||
      translated.trim().toLowerCase() === text.trim().toLowerCase() ||
      translated.includes('PLEASE SELECT TWO DISTINCT LANGUAGES') ||
      translated.includes('MYMEMORY WARNING') ||
      // 전부 대문자 ASCII 문자만 있는 경우 → 오류 메시지 (예: "ERROR")
      // 주의: 한국어/중국어 등 비라틴 문자는 toUpperCase()가 원본과 같아
      //       이 조건을 그대로 쓰면 유효한 번역을 오류로 잘못 판단함
      (/^[A-Z\s\d.,!?;:'"()\-]+$/.test(translated) && translated.length > 3)
    ) {
      TRANS_CACHE[key] = null;
      return null;
    }

    TRANS_CACHE[key] = translated;
    return translated;

  } catch {
    TRANS_CACHE[key] = null;
    return null;
  }
}

// ─── 공통 유틸 ────────────────────────────────────────────────────────────────

/**
 * HTML → 순수 텍스트 (Service Worker에는 document 없음 → regex 사용)
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')     // 태그 제거
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanWord(word) {
  return (word || '').replace(/[^a-zA-ZäöüÄÖÜß-]/g, '').trim();
}

async function fetchWithTimeout(url, ms) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}
