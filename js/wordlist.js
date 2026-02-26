// wordlist.js - DeutschLens 단어장 페이지 로직

(function () {
  'use strict';

  let allWords = [];
  let currentQuery = '';

  const listEl = document.getElementById('wl-list');
  const emptyEl = document.getElementById('wl-empty');
  const noResultsEl = document.getElementById('wl-no-results');
  const statEl = document.getElementById('stat-total');
  const searchInput = document.getElementById('search-input');
  const btnExport = document.getElementById('btn-export');
  const btnClearAll = document.getElementById('btn-clear-all');

  // ── 초기 로드 ───────────────────────────────────────────────

  chrome.storage.local.get(['dcWordList'], res => {
    allWords = res.dcWordList || [];
    render();
  });

  // Storage 변경 감지 (다른 탭에서 저장 시)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.dcWordList) {
      allWords = changes.dcWordList.newValue || [];
      render();
    }
  });

  // ── 검색 ────────────────────────────────────────────────────

  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value.trim().toLowerCase();
    render();
  });

  // ── 내보내기 (CSV) ───────────────────────────────────────────

  btnExport.addEventListener('click', () => {
    if (allWords.length === 0) return;

    const headers = ['단어', '관사', '뜻', '저장 날짜', '문맥'];
    const rows = allWords.map(w => [
      w.word,
      w.article || '',
      (w.definitions || []).join(' / '),
      new Date(w.savedAt).toLocaleDateString('ko-KR'),
      (w.context || '').replace(/"/g, '""'),
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DeutschLens_단어장_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── 전체 삭제 ────────────────────────────────────────────────

  btnClearAll.addEventListener('click', () => {
    if (allWords.length === 0) return;
    if (!confirm(`저장된 단어 ${allWords.length}개를 모두 삭제할까요?`)) return;
    chrome.storage.local.set({ dcWordList: [] }, () => {
      allWords = [];
      render();
    });
  });

  // ── 렌더링 ──────────────────────────────────────────────────

  function render() {
    const filtered = currentQuery
      ? allWords.filter(w =>
          w.word.toLowerCase().includes(currentQuery) ||
          (w.definitions || []).some(d => d.toLowerCase().includes(currentQuery)) ||
          (w.article || '').toLowerCase().includes(currentQuery)
        )
      : allWords;

    // 통계 업데이트
    statEl.textContent = `${allWords.length}개 저장됨`;

    // 상태 표시 제어
    listEl.innerHTML = '';
    emptyEl.style.display = 'none';
    noResultsEl.style.display = 'none';

    if (allWords.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }

    if (filtered.length === 0) {
      noResultsEl.style.display = 'block';
      return;
    }

    filtered.forEach((entry, idx) => {
      listEl.appendChild(createCard(entry, allWords.indexOf(entry)));
    });
  }

  function createCard(entry, realIdx) {
    const card = document.createElement('div');

    const gender = entry.gender;
    const badgeClass = gender === 'm' ? 'wl-badge-m'
                     : gender === 'f' ? 'wl-badge-f'
                     : gender === 'n' ? 'wl-badge-n'
                     : 'wl-badge-unknown';
    const badgeText = gender === 'm' ? 'der'
                    : gender === 'f' ? 'die'
                    : gender === 'n' ? 'das'
                    : '?';
    const cardClass = gender ? `wl-card card-${gender}` : 'wl-card';
    card.className = cardClass;

    const dateStr = entry.savedAt
      ? new Date(entry.savedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      : '';

    const articleHtml = entry.article
      ? `<span class="wl-article">${escHtml(entry.article)}</span>` : '';

    const contextHtml = entry.context
      ? `<div class="wl-context" title="${escAttr(entry.context)}">
           "${escHtml(entry.context)}"
         </div>` : '';

    // 뜻 렌더링: 새 형식(definitionsKo + definitionsEn) 또는 구형식(definitions)
    let defsHtml;
    if ('definitionsKo' in entry || 'definitionsEn' in entry) {
      const koText = (entry.definitionsKo || []).join('; ');
      const enText = (entry.definitionsEn || []).join('; ');
      const rows = [];
      if (koText) rows.push(`<div class="wl-defs-row"><span class="wl-defs-lang">KO</span><span class="wl-defs-text">${escHtml(koText)}</span></div>`);
      if (enText) rows.push(`<div class="wl-defs-row"><span class="wl-defs-lang">EN</span><span class="wl-defs-text">${escHtml(enText)}</span></div>`);
      defsHtml = rows.length > 0
        ? `<div class="wl-defs-block">${rows.join('')}</div>`
        : `<div class="wl-defs-block wl-defs-empty">—</div>`;
    } else {
      // 구형식 호환 (단일 definitions)
      const text = (entry.definitions || []).join('; ') || '—';
      defsHtml = `<div class="wl-defs-block"><div class="wl-defs-row"><span class="wl-defs-text">${escHtml(text)}</span></div></div>`;
    }

    card.innerHTML = `
      <div class="wl-card-top">
        <span class="wl-badge ${badgeClass}">${badgeText}</span>
        <div class="wl-word-group">
          <span class="wl-word">${escHtml(entry.word)}</span>
          ${articleHtml}
        </div>
        <div class="wl-card-meta">
          <span class="wl-date">${escHtml(dateStr)}</span>
          <button class="wl-delete" data-idx="${realIdx}" title="삭제">✕</button>
        </div>
      </div>
      ${defsHtml}
      ${contextHtml}
    `;

    card.querySelector('.wl-delete').addEventListener('click', e => {
      const idx = parseInt(e.currentTarget.dataset.idx, 10);
      deleteWord(idx);
    });

    return card;
  }

  function deleteWord(idx) {
    allWords.splice(idx, 1);
    chrome.storage.local.set({ dcWordList: allWords }, render);

    // badge 업데이트
    chrome.runtime.sendMessage({ type: 'DC_UPDATE_BADGE', count: allWords.length }).catch(() => {});
  }

  // ── 유틸 ────────────────────────────────────────────────────

  function escHtml(str) {
    const el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
  }

  function escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

})();
