// popup.js - DeutschLens Toolbar Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  const toggle      = document.getElementById('toggle-switch');
  const toggleLabel = document.getElementById('toggle-label');
  const wordCountEl = document.getElementById('word-count');
  const btnWordlist = document.getElementById('btn-wordlist');
  const langTabs    = document.querySelectorAll('.lang-tab');

  // ── 초기 상태 로드 ────────────────────────────────────────────

  chrome.storage.local.get(['dcEnabled', 'dcWordList', 'dcLang'], res => {
    setToggleState(res.dcEnabled !== false);

    const count = (res.dcWordList || []).length;
    wordCountEl.textContent = count;

    setActiveLang(res.dcLang || 'ko');
  });

  // ── On/Off 토글 ───────────────────────────────────────────────

  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    setToggleState(enabled);
    chrome.storage.local.set({ dcEnabled: enabled });

    sendToActiveTab({ type: 'DC_TOGGLE', enabled });
    chrome.runtime.sendMessage({ type: 'DC_SET_ICON', enabled }).catch(() => {});
  });

  // ── 번역 언어 토글 (한국어 / English) ────────────────────────

  langTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      setActiveLang(lang);
      chrome.storage.local.set({ dcLang: lang });
      sendToActiveTab({ type: 'DC_LANG_CHANGE', lang });
    });
  });

  // ── 단어장 열기 ───────────────────────────────────────────────

  btnWordlist.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('html/wordlist.html') });
    window.close();
  });

  // ── Storage 변경 감지 (다른 탭에서 단어 저장 시 카운트 갱신) ──

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.dcWordList) {
      wordCountEl.textContent = (changes.dcWordList.newValue || []).length;
    }
  });

  // ── 헬퍼 ──────────────────────────────────────────────────────

  function setToggleState(enabled) {
    toggle.checked = enabled;
    toggleLabel.textContent = enabled ? 'ON' : 'OFF';
    document.body.classList.toggle('disabled', !enabled);
  }

  function setActiveLang(lang) {
    langTabs.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  }

  function sendToActiveTab(msg) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
      }
    });
  }
});
