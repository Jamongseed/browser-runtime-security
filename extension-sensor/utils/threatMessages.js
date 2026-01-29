let loadPromise = null;

const RULESET_FILES = [
  "rulesets/default-v1.json",
  "rulesets/scoring-model-v1.json"
];

// JSON 파일 로드 및 캐싱
async function ensureMessagesLoaded() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    let combinedCache = {};

    try {
      const loadPromises = RULESET_FILES.map(async (fileName) => {
        try {
          const url = chrome.runtime.getURL(fileName);
          const response = await fetch(url);
          if (!response.ok) return null;
          const data = await response.json();
          return data.messages || {};
        } catch (e) {
          console.warn(`[BRS] Failed to load ruleset: ${fileName}`, e);
          return null;
        }
      });

      const results = await Promise.all(loadPromises);
      results.forEach(msgObj => {
        if (msgObj) {
          combinedCache = { ...combinedCache, ...msgObj };
        }
      });
    } catch (err) {
      console.error("[BRS] Error while merging rulesets:", err);
    }

    return combinedCache;
  })();

  return loadPromise;
}

export async function getThreatMessage(ruleId, type = "title", data = null) {
  if (ruleId === "INJECTED_SCRIPT_SCORE" && type === "oneLine" && data) {
    const { hits = [] } = data;
    const totalCount = hits.length;

    const primary = hits[0];

    if (primary) {
      const match = (primary.category || "").match(/\(([^)]+)\)/);
      const categoryName = match ? match[1].trim() : "의심 동작";

      return totalCount > 1
        ? `악성 스크립트 주입. ${categoryName} 외 ${totalCount - 1}가지 위험 행위가 발견되었습니다.`
        : `$악성 스크립트 주입. {categoryName} 정황이 감지되었습니다.`;
    }
  }

    if (ruleId === "INJECTED_SCRIPT_SCORE" && type === "title") {
      return "악성 스크립트 주입"
  }

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
  const msgSet = cache[ruleId] || {};

  const localeSet = msgSet[lang] || {};
  const text = localeSet[type];

  if (text) return text;

  if (type === "title") return ruleId;

  return "현재 페이지에서 의심스러운 동작이 감지되었습니다."
}