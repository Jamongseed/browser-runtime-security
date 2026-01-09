import { createDispatcher } from "./sinks/dispatcher.js";
import { createHttpSink } from "./sinks/httpSink.js";
import { createLocalStorageSink } from "./sinks/localStorageSink.js";
import { createBadgeSink } from "./sinks/badgeSink.js";
import { createNotificationSink } from "./sinks/notificationSink.js";
import { generateReportHash } from "./utils/crypto.js";
import { updateTabSession, removeTabSession } from "./utils/sessionManager.js";
import { getOrCreateInstallId, initInstallId } from "./utils/installIdManager.js";

import "./dump_fetcher.js";

initInstallId();

const CONFIG = {
  API_ENDPOINT: "http://localhost:8080/events",
  DUMPS_ENDPOINT: "http://localhost:8080/dumps",
  // API_ENDPOINT: "https://tatnbs1wq5.execute-api.ap-northeast-2.amazonaws.com/prod/events",
  USE_SERVER_DASHBOARD: false,
  AWS_DASHBOARD_URL: "",
  LOCAL_DASHBOARD_PATH: "local_dashboard/dashboard.html",
};

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
  CONFIG.USE_SERVER_DASHBOARD && CONFIG.AWS_DASHBOARD_URL
    ? CONFIG.AWS_DASHBOARD_URL
    : chrome.runtime.getURL(CONFIG.LOCAL_DASHBOARD_PATH);

// dispatcher 생성
const dispatcher = createDispatcher([
  createHttpSink({
    url: CONFIG.API_ENDPOINT,
    targets: ["HIGH", "MEDIUM"],
  }),
  createLocalStorageSink({
    maxLogCount: 200,
    targets: ["HIGH", "MEDIUM", "LOW"],
  }),
  createBadgeSink(),
  createNotificationSink({
    dashboardUrl: DASHBOARD_URL,
  }),
]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

        await postJsonWithRetry(CONFIG.DUMPS_ENDPOINT, dumpEvent);
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

      const enrichedData = {
        ...inputData,
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
  await chrome.storage.local.set({ tabSessions: {} });
  console.log("[BRS] Extension installed. Session map initialized.");
});