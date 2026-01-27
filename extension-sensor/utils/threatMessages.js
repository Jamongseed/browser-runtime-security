let messagesCache = null;

// JSON 파일 로드 및 캐싱
async function ensureMessagesLoaded() {
  if (messagesCache) return messagesCache;

  try {
    const url = chrome.runtime.getURL("rulesets/default-v1.json");
    const response = await fetch(url);
    const data = await response.json();

    // 전체 JSON 중 "messages" 객체만 캐싱
    messagesCache = data.messages || {};
  } catch (err) {
    console.error("[BRS] Failed to load threat messages:", err);
    messagesCache = {};
  }
  return messagesCache;
}

export async function getThreatMessage(ruleId, type = "title") {
  const cache = await ensureMessagesLoaded();

  // 브라우저 언어에 따라 한국어 또는 영어 불러오는 로직
  // 한국어만 쓰고 있어서 일단 주석처리
  // let uiLang = 'ko';
  // try {
  //   if (chrome.i18n && chrome.i18n.getUILanguage) {
  //     uiLang = chrome.i18n.getUILanguage().startsWith('en') ? 'en' : 'ko';
  //   }
  // } catch (_) {}

  // const localeSet = msgSet[uiLang] || msgSet["en"] || {};
  
  const lang = 'ko'
  const msgSet = cache[ruleId] ||  {};

  const localeSet = msgSet[lang] || {};
  const text = localeSet[type];

  if (text) return text;

  if (type === "title") return ruleId;

  return "현재 페이지에서 의심스러운 동작이 감지되었습니다."
}