import { createDispatcher } from "./sinks/dispatcher.js";
import { createHttpSink } from "./sinks/httpSink.js";
import { createLocalStorageSink } from "./sinks/localStorageSink.js";
import { createBadgeSink } from "./sinks/badgeSink.js";
import { createNotificationSink } from "./sinks/notificationSink.js";
import { generateReportHash, stableHash32 } from "./utils/crypto.js";
import { updateTabSession, removeTabSession } from "./utils/sessionManager.js";
import { getOrCreateInstallId, initInstallId } from "./utils/installIdManager.js";
import { SYSTEM_CONFIG, STORAGE_KEYS } from "./config.js";

import "./dump_fetcher.js";

initInstallId();

// chain/incident helpers
const INCIDENT_TTL_MS = 30_000;
const dumpIndex = new Map();      // key: `${tabId}|${norm}` -> { sha256, ts }
const incidentByTab = new Map();  // key: tabId -> { incidentId, startedAt, lastSeenAt, scriptId, reinjectCount, norm }

function normalizeUrl(u) {
  const s = String(u || "");
  return s.split("#")[0].split("?")[0];
}

function pickScriptUrlFromEvent(inputData) {
  const d = inputData?.data || {};
  // 우선순위: norm/abs/src/url/injectSrc 등
  return d.norm || d.abs || d.src || d.url || d.injectSrc || "";
}

// ---- dumps 전송용(간단 재시도) ----
const FETCH_TIMEOUT_MS = 5000;
const MAX_RETRY = 3;
const RETRY_BASE_DELAY_MS = 600;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    if (e?.name === "AbortError") throw new Error("FETCH_TIMEOUT");
    throw e;
  }
}

async function postJsonWithRetry(url, bodyObj) {
  let lastErr = null;

  for (let i = 0; i < MAX_RETRY; i++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyObj),
          keepalive: true,
        },
        FETCH_TIMEOUT_MS
      );

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} ${t}`.trim());
      }
      return;
    } catch (e) {
      lastErr = e;
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, i);
      await sleep(delay);
    }
  }

  throw lastErr;
}

// ---- dashboard url ----
const DASHBOARD_URL =
  SYSTEM_CONFIG.USE_SERVER_DASHBOARD && SYSTEM_CONFIG.AWS_DASHBOARD_URL
    ? SYSTEM_CONFIG.AWS_DASHBOARD_URL
    : chrome.runtime.getURL(SYSTEM_CONFIG.LOCAL_DASHBOARD_PATH);

// dispatcher 생성
const dispatcher = createDispatcher([
  createHttpSink({
    url: SYSTEM_CONFIG.API_ENDPOINT,
    targets: ["LOW", "MEDIUM", "HIGH"],
  }),
  createLocalStorageSink({
    maxLogCount: 200,
    targets: ["LOW", "MEDIUM", "HIGH"],
  }),
  createBadgeSink(),
  createNotificationSink({
    dashboardUrl: DASHBOARD_URL,
  }),
]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 화이트리스트 업데이트 요청 처리
  if (message.action === "UPDATE_WHITELIST") {
    const newWhitelist = message.data || [];
    
    // 크롬 저장소에 저장
  chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: newWhitelist }, () => {
    if (chrome.runtime.lastError) {
      console.error("[BRS] Save error:", chrome.runtime.lastError);
      sendResponse({ status: "error", message: "Failed to save to storage" });
    } else {
      console.log(`[BRS] Whitelist updated: ${newWhitelist.length} domains`);
      sendResponse({ status: "success" });
    }
  });

    return true;
  }

  // 1) 덤프 저장 (2번 코드 합침)
  if (message.action === "BRS_SAVE_DUMP") {
    (async () => {
      try {
        const payload = message.payload || {};

        const sha256 = String(payload.sha256 || "");
        const text = String(payload.text || "");
        const url = String(payload.url || "");
        const norm = String(payload.norm || "");

        if (!sha256 || !text) {
          sendResponse({ ok: false, err: "missing sha256/text" });
          return;
        }

        const tabId = sender?.tab?.id ?? null;
        const installId = await getOrCreateInstallId();
        // dumpIndex 업데이트 (scriptId 매칭용)
        if (tabId != null && norm && sha256) {
          dumpIndex.set(`${tabId}|${norm}`, { sha256, ts: Date.now() });

          const inc = incidentByTab.get(tabId);
          if (inc) {
            if (!inc.norm || inc.norm === norm) inc.norm = norm;
            inc.scriptId = sha256;
            incidentByTab.set(tabId, inc);
          }
        }

        const MAX_CHARS = 200_000;
        const clipped = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

        const dumpEvent = {
          type: "SCRIPT_DUMP",
          ts: Date.now(),
          tabId,
          installId,
          page: payload.page || sender?.tab?.url || "",
          origin: payload.origin || "",
          targetOrigin: payload.targetOrigin || "",
          data: {
            url,
            norm,
            sha256,
            length: payload.length ?? text.length,
            contentType: payload.contentType || "",
            via: payload.via || "",
            truncated: text.length > MAX_CHARS,
            text: clipped,
          },
        };

        await postJsonWithRetry(SYSTEM_CONFIG.DUMPS_ENDPOINT, dumpEvent);
        sendResponse({ ok: true });
      } catch (e) {
        console.error("[BRS] dump transmit failed:", e);
        sendResponse({ ok: false, err: String(e?.message || e) });
      }
    })();

    return true;
  }

  if (message.action !== "REPORT_THREAT") return false;

  (async () => {
    try {
      const inputData = message.data;
      const tabId = sender.tab ? sender.tab.id : null;
      const installId = await getOrCreateInstallId();

      if (!tabId && inputData.type !== "SENSOR_READY") {
        console.warn("[BRS] Message received without tabId");
        sendResponse({ ok: false, error: "Missing tabId" });
        return;
      }

      // tabId <-> sessionId 매핑
      if (tabId && inputData.sessionId) {
        await updateTabSession(tabId, inputData.sessionId);
      }

      let reportId = null;
      if (inputData.type !== "SENSOR_READY") {
        reportId = await generateReportHash(inputData.sessionId, inputData.ts);
      }

      // incidentId / scriptId / reinjectCount enrichment
      let chain = null;
      if (tabId != null && inputData.type !== "SENSOR_READY") {
        const now = Date.now();
        const norm = normalizeUrl(pickScriptUrlFromEvent(inputData));

        // scriptId: dump sha256 우선, 없으면 norm 기반 stable hash
        let scriptId = null;
        const hit = norm ? dumpIndex.get(`${tabId}|${norm}`) : null;
        if (hit?.sha256) scriptId = String(hit.sha256);
        else if (norm) scriptId = await stableHash32(norm);

        // incident: tabId 기준 30초 윈도우(데모용)
        let inc = incidentByTab.get(tabId);
        const expired = !inc || (now - inc.lastSeenAt > INCIDENT_TTL_MS);
        if (expired) {
          const incidentId = await stableHash32(`${installId}:${tabId}:${now}`);
          inc = {
            incidentId,
            startedAt: now,
            lastSeenAt: now,
            scriptId: scriptId || null,
            reinjectCount: 0,
            norm: norm || ""
          };
        } else {
          inc.lastSeenAt = now;
          if (scriptId) inc.scriptId = scriptId; // 최신 scriptId로 갱신
          if (norm) inc.norm = norm;
        }

        if (inputData.type === "PERSISTENCE_REINJECT") {
          inc.reinjectCount = (inc.reinjectCount || 0) + 1;
        }

        incidentByTab.set(tabId, inc);

        chain = {
          incidentId: inc.incidentId,
          scriptId: inc.scriptId,
          norm: inc.norm,
          reinjectCount: inc.reinjectCount,
          startedAt: inc.startedAt
        };
      }

      const mergedData = {
        ...(inputData.data || {}),
        ...(chain ? { chain } : {})
      };

      const enrichedData = {
        ...inputData,
        data: mergedData,
        evidence: mergedData,
        installId,
        reportId,
        tabId,
        browserUrl: sender.tab?.url,
      };

      const result = await dispatcher.dispatch(enrichedData, { sender });
      sendResponse({ ok: true, result });
    } catch (err) {
      console.error("[BRS] Background Process Error:", err);
      sendResponse({ ok: false, error: err.message });
    }
  })();

  return true;
});

// 탭 세션 정보 삭제
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabSession(tabId);
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ [STORAGE_KEYS.TAB_SESSIONS]: {} });
  console.log("[BRS] Extension installed. Session map initialized.");
});