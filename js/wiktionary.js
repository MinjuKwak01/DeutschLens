// wiktionary.js - DeutschLens Content Script 측 단어 조회
//
// 실제 API 호출은 Background Service Worker(background.js)에서 처리합니다.
// 흐름: content.js → fetchWordInfo() → sendMessage → background.js → API → sendResponse

const DC_WORD_CACHE = {};   // Content Script 측 로컬 캐시

/**
 * 독일어 단어 정보를 Background Service Worker에 요청합니다.
 * @param {string} word       - 독일어 단어
 * @param {string} targetLang - 'ko' 또는 'en'
 * @returns {Promise<object|null>}
 */
async function fetchWordInfo(word, targetLang = 'ko') {
  const clean = (word || '').replace(/[^a-zA-ZäöüÄÖÜß-]/g, '').trim();
  if (!clean || clean.length < 2) return null;

  const cacheKey = `${clean}__${targetLang}`;
  if (cacheKey in DC_WORD_CACHE) return DC_WORD_CACHE[cacheKey];

  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { type: 'DC_FETCH_WORD', word: clean, lang: targetLang },
      response => {
        if (chrome.runtime.lastError) {
          // Service Worker가 아직 시작 중일 때 재시도 (1회)
          console.warn('[DC] sendMessage error:', chrome.runtime.lastError.message, '— retrying…');
          setTimeout(() => {
            chrome.runtime.sendMessage(
              { type: 'DC_FETCH_WORD', word: clean, lang: targetLang },
              response2 => {
                const result = response2?.ok ? response2.data : null;
                // 한국어 번역 실패(en_fallback)는 캐시 안 함 → 다음 조회 시 재시도
                if (result?.translationLang !== 'en_fallback') {
                  DC_WORD_CACHE[cacheKey] = result;
                }
                resolve(result);
              }
            );
          }, 500);
          return;
        }

        const result = response?.ok ? response.data : null;
        if (result?.translationLang !== 'en_fallback') {
          DC_WORD_CACHE[cacheKey] = result;
        }
        resolve(result);
      }
    );
  });
}
