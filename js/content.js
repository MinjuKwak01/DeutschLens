// content.js - DeutschLens Main Content Script
// 명사 성별 컬러링 + 1-클릭 팝업 + 단어 저장 기능

(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  let isEnabled = false;
  let currentLang = 'ko'; // 기본값: 한국어
  let popup = null;
  let mutationObserver = null;

  // ─── Init ────────────────────────────────────────────────────────────────────

  chrome.storage.local.get(['dcEnabled', 'dcLang'], function (res) {
    isEnabled   = res.dcEnabled !== false; // 기본값: 활성화
    currentLang = res.dcLang || 'ko';
    if (isEnabled) startColoring();
    setupEventListeners();
    setupMutationObserver();
  });

  // 팝업(toolbar)에서 메시지 수신
  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.type === 'DC_TOGGLE') {
      isEnabled = msg.enabled;
      if (isEnabled) {
        startColoring();
      } else {
        removeColoring();
        hidePopup();
      }
    }
    if (msg.type === 'DC_LANG_CHANGE') {
      currentLang = msg.lang;
      // 열려 있는 팝업이 있으면 같은 단어를 새 언어로 다시 로드
      const wordEl = popup?.querySelector('#dc-popup-word');
      if (wordEl) {
        const word = wordEl.textContent;
        const gender = popup.querySelector('#dc-popup-badge')?.dataset?.gender || null;
        showPopup(word, gender, null, null);
      }
    }
  });

  // ─── Noun Coloring ───────────────────────────────────────────────────────────

  function startColoring() {
    if (!document.body) return;
    processSubtree(document.body);
  }

  function removeColoring() {
    // 색상 span을 원래 텍스트 노드로 복원
    document.querySelectorAll('.dc-noun').forEach(span => {
      const text = document.createTextNode(span.textContent);
      span.parentNode?.replaceChild(text, span);
    });
    // 처리 마커 제거
    document.querySelectorAll('[data-dc-processed]').forEach(el => {
      el.removeAttribute('data-dc-processed');
    });
  }

  function processSubtree(rootNode) {
    const walker = document.createTreeWalker(
      rootNode,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const el = node.parentElement;
          if (!el) return NodeFilter.FILTER_REJECT;

          const tag = el.tagName?.toLowerCase();
          if (['script', 'style', 'input', 'textarea', 'select',
               'code', 'pre', 'math', 'svg', 'noscript'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          // 이미 처리된 영역 건너뜀
          if (el.closest('[data-dc-processed]')) return NodeFilter.FILTER_REJECT;
          // 팝업 내부 건너뜀
          if (el.closest('#dc-popup')) return NodeFilter.FILTER_REJECT;
          // 내용이 너무 짧으면 건너뜀
          if (node.textContent.trim().length < 3) return NodeFilter.FILTER_SKIP;

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    processChunks(nodes, 0);
  }

  function processChunks(nodes, idx) {
    const CHUNK = 40;
    const end = Math.min(idx + CHUNK, nodes.length);

    for (let i = idx; i < end; i++) {
      if (nodes[i].isConnected) processTextNode(nodes[i]);
    }

    if (end < nodes.length) {
      const next = () => processChunks(nodes, end);
      if (window.requestIdleCallback) {
        requestIdleCallback(next, { timeout: 2000 });
      } else {
        setTimeout(next, 30);
      }
    }
  }

  function processTextNode(textNode) {
    const text = textNode.textContent;
    if (!text || text.trim().length < 2) return;

    const parent = textNode.parentElement;
    if (!parent || parent.hasAttribute('data-dc-processed')) return;

    const matches = findNounsInText(text);
    if (matches.length === 0) return;

    // fragment로 교체
    const fragment = buildFragment(text, matches);
    parent.setAttribute('data-dc-processed', 'true');
    parent.replaceChild(fragment, textNode);
  }

  /**
   * 텍스트에서 독일어 명사 위치와 성별을 찾습니다.
   */
  function findNounsInText(text) {
    const matches = [];

    // ① 관사 + 명사 패턴 (예: "der Hund", "die Katze")
    const articleNounRe = /\b(der|die|das|dem|den|des|ein|eine|einen|einem|einer|eines)\s+([A-ZÄÖÜ][a-zäöüß]{1,}(?:-[A-Za-zÄÖÜäöüß]+)*)\b/g;
    let m;
    while ((m = articleNounRe.exec(text)) !== null) {
      const article = m[1].toLowerCase();
      const noun = m[2];
      const start = m.index + m[1].length + 1; // 명사 시작 위치
      const end = start + noun.length;
      const gender = resolveGender(article, noun);
      if (gender) matches.push({ start, end, word: noun, gender });
    }

    // ② 단독 명사 (사전에 있는 경우)
    const standaloneRe = /\b([A-ZÄÖÜ][a-zäöüß]{2,}(?:-[A-Za-zÄÖÜäöüß]+)*)\b/g;
    while ((m = standaloneRe.exec(text)) !== null) {
      const noun = m[1];
      const start = m.index;
      const end = start + noun.length;

      // 이미 매치된 범위와 겹치는지 확인
      if (matches.some(x => start < x.end && end > x.start)) continue;

      const gender = GERMAN_NOUNS[noun];
      if (gender) matches.push({ start, end, word: noun, gender });
    }

    // 시작 위치 기준 정렬 후 겹침 제거
    matches.sort((a, b) => a.start - b.start);
    const cleaned = [];
    for (const m of matches) {
      if (cleaned.length === 0 || m.start >= cleaned[cleaned.length - 1].end) {
        cleaned.push(m);
      }
    }
    return cleaned;
  }

  /**
   * 관사 → 성별 추론 (사전 우선)
   */
  function resolveGender(article, noun) {
    const dict = GERMAN_NOUNS[noun];
    if (dict) return dict;

    switch (article) {
      case 'die':
      case 'eine':
      case 'einer':
        return 'f'; // 여성 (단수) — 복수 die는 이 단계에서 걸러지기 어려움
      case 'das':
        return 'n'; // 중성
      case 'der':
        return 'm'; // 남성 주격 (가장 일반적인 경우)
      default:
        return null; // 모호한 형태는 표시하지 않음
    }
  }

  /**
   * 하이라이트 span이 삽입된 DocumentFragment 생성
   */
  function buildFragment(text, matches) {
    const frag = document.createDocumentFragment();
    let lastIdx = 0;

    for (const match of matches) {
      if (match.start > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, match.start)));
      }

      const span = document.createElement('span');
      const gClass = match.gender === 'm' ? 'dc-masc'
                   : match.gender === 'f' ? 'dc-fem' : 'dc-neut';
      span.className = `dc-noun ${gClass}`;
      span.dataset.dcWord = match.word;
      span.dataset.dcGender = match.gender;
      span.title = `${genderToArticle(match.gender)} ${match.word}`;
      span.textContent = text.slice(match.start, match.end);
      frag.appendChild(span);

      lastIdx = match.end;
    }

    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    return frag;
  }

  // ─── MutationObserver (동적 콘텐츠 처리) ────────────────────────────────────

  function setupMutationObserver() {
    if (!document.body) return;
    mutationObserver = new MutationObserver(mutations => {
      if (!isEnabled) return;
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node.id !== 'dc-popup') {
            setTimeout(() => processSubtree(node), 600);
          }
        }
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Event Listeners ─────────────────────────────────────────────────────────

  function setupEventListeners() {
    // 더블클릭: 하이라이트된 명사 span
    document.addEventListener('dblclick', e => {
      if (!isEnabled) return;
      const span = e.target.closest('.dc-noun');
      if (span) {
        e.preventDefault();
        e.stopPropagation();
        showPopup(span.dataset.dcWord, span.dataset.dcGender, span);
      }
    });

    // 마우스업: 텍스트 선택
    document.addEventListener('mouseup', e => {
      if (!isEnabled) return;
      if (popup?.contains(e.target)) return;

      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;

        const raw = sel.toString().trim();
        if (raw.length < 2 || raw.length > 50 || /\n/.test(raw)) return;

        // 단어만 추출 (특수문자 제외)
        const word = raw.replace(/[^a-zA-ZäöüÄÖÜß-]/g, '').trim();
        if (word.length < 2) return;

        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect.width && !rect.height) return;

        showPopup(word, null, null, rect);
      }, 60);
    });

    // ESC: 팝업 닫기
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hidePopup();
    });

    // 팝업 외부 클릭: 닫기
    document.addEventListener('click', e => {
      if (popup && !popup.contains(e.target) && !e.target.closest('.dc-noun')) {
        hidePopup();
      }
    });
  }

  // ─── Popup ───────────────────────────────────────────────────────────────────

  function showPopup(word, knownGender, triggerEl, selectionRect) {
    hidePopup();

    popup = document.createElement('div');
    popup.id = 'dc-popup';
    popup.innerHTML = `
      <div id="dc-popup-header">
        <span id="dc-popup-word">${escHtml(word)}</span>
        <span id="dc-popup-badge" style="display:none"></span>
        <button id="dc-popup-save" title="단어장에 저장">☆</button>
        <button id="dc-popup-close" title="닫기">✕</button>
      </div>
      <div id="dc-popup-loading">검색 중…</div>
      <div id="dc-popup-body" style="display:none"></div>
      <div id="dc-popup-error" style="display:none">
        사전에 항목이 없거나 변화형일 수 있습니다.<br>
        <span style="font-size:11px;color:#cbd5e1">기본형(Grundform)으로 다시 시도해보세요.</span>
      </div>
    `;
    document.body.appendChild(popup);

    // 버튼 이벤트
    popup.querySelector('#dc-popup-close').addEventListener('click', hidePopup);
    popup.querySelector('#dc-popup-save').addEventListener('click', () => {
      saveWord(word);
    });

    // 이미 저장된 단어인지 확인
    isWordSaved(word).then(saved => {
      const btn = popup?.querySelector('#dc-popup-save');
      if (btn && saved) { btn.textContent = '★'; btn.classList.add('dc-saved'); }
    });

    // 알려진 성별이 있으면 즉시 표시
    if (knownGender) renderBadge(knownGender);

    // 위치 설정
    positionPopup(triggerEl, selectionRect);

    // API 호출 — 현재 언어 설정(currentLang) 전달
    fetchWordInfo(word, currentLang)
      .then(info => {
        if (!popup) return;
        popup.querySelector('#dc-popup-loading').style.display = 'none';
        const body  = popup.querySelector('#dc-popup-body');
        const errEl = popup.querySelector('#dc-popup-error');

        // 내장 사전에서도 성별 보충
        const dictGender = GERMAN_NOUNS[word] || GERMAN_NOUNS[word.toLowerCase()];

        if (info && (info.definitions.length > 0 || info.pos || info.gender)) {
          const effectiveGender = info.gender || dictGender;
          if (effectiveGender && !knownGender) renderBadge(effectiveGender);
          body.innerHTML = buildPopupBody(info);
          body.style.display = 'block';
        } else {
          // 정의는 없어도 사전 성별 정보는 표시
          if (dictGender && !knownGender) renderBadge(dictGender);
          errEl.style.display = 'block';
        }
      })
      .catch(() => {
        if (!popup) return;
        popup.querySelector('#dc-popup-loading').style.display = 'none';
        popup.querySelector('#dc-popup-error').style.display = 'block';
      });
  }

  function renderBadge(gender) {
    const badge = popup?.querySelector('#dc-popup-badge');
    if (!badge) return;
    const map = { m: { text: 'der', cls: 'dc-badge-m' }, f: { text: 'die', cls: 'dc-badge-f' }, n: { text: 'das', cls: 'dc-badge-n' } };
    const info = map[gender] || { text: '?', cls: '' };
    badge.textContent = info.text;
    badge.className = info.cls;
    badge.dataset.gender = gender; // 재열람 시 사용
    badge.style.display = 'inline-block';
  }

  function buildPopupBody(info) {
    let html = '';

    // 뜻 — 언어에 맞는 라벨 표시
    const isFallback = info.translationLang === 'en_fallback';
    const defsLabel = info.translationLang === 'ko'
      ? '뜻 (한국어)'
      : isFallback
        ? 'Bedeutung <span class="dc-fallback-note">번역 실패 · 영어로 표시</span>'
        : 'Bedeutung (EN)';
    if (info.definitions.length > 0) {
      html += `
        <div class="dc-section">
          <div class="dc-label">${defsLabel}</div>
          <ul class="dc-defs">
            ${info.definitions.map(d => `<li>${escHtml(d)}</li>`).join('')}
          </ul>
        </div>`;
    }

    // 명사 문법 정보
    if (info.pos === 'noun') {
      const rows = [];
      if (info.article) {
        rows.push(`<div class="dc-gram-item">
          <span class="dc-label">Artikel</span>
          <span class="dc-val">${escHtml(info.article)} ${escHtml(info.word)}</span>
        </div>`);
      }
      if (info.genitive) {
        rows.push(`<div class="dc-gram-item">
          <span class="dc-label">Genitiv</span>
          <span class="dc-val">${escHtml(info.genitive)}</span>
        </div>`);
      }
      if (info.plural) {
        rows.push(`<div class="dc-gram-item">
          <span class="dc-label">Plural</span>
          <span class="dc-val">die ${escHtml(info.plural)}</span>
        </div>`);
      }
      if (rows.length > 0) {
        html += `<div class="dc-section"><div class="dc-gram-row">${rows.join('')}</div></div>`;
      }
    }

    // 동사 문법 정보
    if (info.pos === 'verb') {
      const rows = [];
      if (info.verb3sg) rows.push(`<div class="dc-gram-item"><span class="dc-label">3. Sg. Präs.</span><span class="dc-val">${escHtml(info.verb3sg)}</span></div>`);
      if (info.verbPast) rows.push(`<div class="dc-gram-item"><span class="dc-label">Präteritum</span><span class="dc-val">${escHtml(info.verbPast)}</span></div>`);
      if (info.verbParticiple) rows.push(`<div class="dc-gram-item"><span class="dc-label">Partizip II</span><span class="dc-val">${escHtml(info.verbParticiple)}</span></div>`);
      if (rows.length > 0) {
        html += `<div class="dc-section"><div class="dc-gram-row">${rows.join('')}</div></div>`;
      }
    }

    // POS 배지
    if (info.pos) {
      const posLabels = { noun: 'Substantiv', verb: 'Verb', adjective: 'Adjektiv', adverb: 'Adverb', preposition: 'Präposition' };
      html += `<div class="dc-footer-bar"><span class="dc-pos-badge">${posLabels[info.pos] || info.pos}</span></div>`;
    }

    return html;
  }

  function positionPopup(triggerEl, selectionRect) {
    if (!popup) return;
    const PAD = 10;
    const W = 290;
    const vw = window.innerWidth;

    let x, y;

    if (triggerEl) {
      const r = triggerEl.getBoundingClientRect();
      x = r.left + window.scrollX;
      y = r.bottom + window.scrollY + PAD;
    } else if (selectionRect) {
      x = selectionRect.left + window.scrollX;
      y = selectionRect.bottom + window.scrollY + PAD;
    } else {
      x = vw / 2 - W / 2 + window.scrollX;
      y = window.scrollY + 100;
    }

    // 뷰포트 오른쪽 초과 방지
    if (x + W > window.scrollX + vw - PAD) x = window.scrollX + vw - W - PAD;
    if (x < window.scrollX + PAD) x = window.scrollX + PAD;

    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;

    // 뷰포트 아래로 벗어나는 경우 위에 표시
    requestAnimationFrame(() => {
      if (!popup) return;
      const r = popup.getBoundingClientRect();
      if (r.bottom > window.innerHeight - PAD) {
        const refRect = triggerEl ? triggerEl.getBoundingClientRect()
                      : (selectionRect || { top: y - window.scrollY });
        popup.style.top = `${refRect.top + window.scrollY - r.height - PAD}px`;
      }
    });
  }

  function hidePopup() {
    if (popup) { popup.remove(); popup = null; }
  }

  // ─── Word Saving ─────────────────────────────────────────────────────────────

  function getContextSentence(word) {
    try {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        const container = sel.getRangeAt(0).commonAncestorContainer;
        const text = (container.textContent || '').replace(/\s+/g, ' ').trim();
        const idx = text.toLowerCase().indexOf(word.toLowerCase());
        if (idx !== -1) {
          // 문장 경계 탐색
          let start = text.lastIndexOf('.', idx);
          start = start === -1 ? 0 : start + 1;
          let end = text.indexOf('.', idx + word.length);
          end = end === -1 ? text.length : end + 1;
          return text.slice(start, end).trim().slice(0, 250);
        }
      }
    } catch (_) {}
    return '';
  }

  function saveWord(word) {
    chrome.storage.local.get(['dcWordList'], res => {
      const list = res.dcWordList || [];
      const exists = list.findIndex(w => w.word === word);
      const btn = popup?.querySelector('#dc-popup-save');

      if (exists !== -1) {
        // 이미 저장됨 → 제거 (토글)
        list.splice(exists, 1);
        chrome.storage.local.set({ dcWordList: list }, () => {
          if (btn) { btn.textContent = '☆'; btn.classList.remove('dc-saved'); }
          notifyBadge(list.length);
        });
        return;
      }

      const dictGender = GERMAN_NOUNS[word] || GERMAN_NOUNS[word.toLowerCase()];
      const context = getContextSentence(word);

      // DC_WORD_CACHE 키 형식: "${clean}__${lang}" (wiktionary.js 기준)
      const cleanW = word.replace(/[^a-zA-ZäöüÄÖÜß-]/g, '').trim();
      const cachedKo = DC_WORD_CACHE[`${cleanW}__ko`] || null;
      const cachedEn = DC_WORD_CACHE[`${cleanW}__en`] || null;

      // 버튼 즉시 반응
      if (btn) { btn.textContent = '★'; btn.classList.add('dc-saved'); btn.title = '저장됨!'; }

      // 캐시에 없는 언어만 추가 fetch
      const koPromise = cachedKo ? Promise.resolve(cachedKo) : fetchWordInfo(word, 'ko');
      const enPromise = cachedEn ? Promise.resolve(cachedEn) : fetchWordInfo(word, 'en');

      Promise.all([koPromise, enPromise]).then(([koInfo, enInfo]) => {
        const baseInfo = koInfo || enInfo || {};

        const entry = {
          word,
          article:       baseInfo.article || (dictGender ? genderToArticle(dictGender) : null),
          gender:        baseInfo.gender  || dictGender || null,
          // 한국어 번역 성공(translationLang === 'ko')일 때만 저장
          definitionsKo: koInfo?.translationLang === 'ko' ? (koInfo.definitions || []) : [],
          definitionsEn: enInfo?.definitions || [],
          context,
          savedAt: Date.now(),
        };

        list.unshift(entry);
        chrome.storage.local.set({ dcWordList: list }, () => notifyBadge(list.length));
      }).catch(() => {
        // API 실패 시 사전 정보만으로 저장
        const entry = {
          word,
          article:       dictGender ? genderToArticle(dictGender) : null,
          gender:        dictGender || null,
          definitionsKo: [],
          definitionsEn: [],
          context,
          savedAt: Date.now(),
        };
        list.unshift(entry);
        chrome.storage.local.set({ dcWordList: list }, () => notifyBadge(list.length));
      });
    });
  }

  function isWordSaved(word) {
    return new Promise(resolve => {
      chrome.storage.local.get(['dcWordList'], res => {
        resolve((res.dcWordList || []).some(w => w.word === word));
      });
    });
  }

  function notifyBadge(count) {
    chrome.runtime.sendMessage({ type: 'DC_UPDATE_BADGE', count }).catch(() => {});
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  function genderToArticle(g) {
    return g === 'm' ? 'der' : g === 'f' ? 'die' : g === 'n' ? 'das' : '?';
  }

  function escHtml(str) {
    const el = document.createElement('span');
    el.appendChild(document.createTextNode(str || ''));
    return el.innerHTML;
  }

})();
