// background.js (MV3 service worker)

const MAX_LOG_COUNT = 50;
const LOCAL_SAVE_TARGETS = ["HIGH", "MEDIUM"];

const AWS_EVENTS_URL =
  "https://81rdme5tpd.execute-api.ap-southeast-2.amazonaws.com/prod/events";

// 실패/재시도용 큐 키
const FAILED_QUEUE_KEY = "failedAwsQueue";
const MAX_FAILED_QUEUE = 500;

// 네트워크 정책
const FETCH_TIMEOUT_MS = 5000;
const MAX_RETRY = 3;
const RETRY_BASE_DELAY_MS = 600;

// ---- utils ----
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    // 여기서 clear (finally 말고 여기서!)
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);

    // AbortError는 "네트워크 실패"로만 취급
    if (err.name === "AbortError") {
      const e = new Error("FETCH_TIMEOUT");
      e.cause = err;
      throw e;
    }
    throw err;
  }
}


async function transmitThreatOnce(threat) {
  const res = await fetchWithTimeout(
    AWS_EVENTS_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(threat),
    },
    FETCH_TIMEOUT_MS
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP_${res.status}: ${text}`);
  }

  // ✅ body까지 읽어야 진짜 성공
  await res.text(); // or res.json()
}

async function transmitThreatWithRetry(threat) {
  let lastErr = null;
  for (let i = 0; i < MAX_RETRY; i++) {
    try {
      await transmitThreatOnce(threat);
      return { ok: true };
    } catch (e) {
      lastErr = e;
      // 간단한 지수 백오프(+약간의 지터)
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, i) + Math.floor(Math.random() * 200);
      await sleep(delay);
    }
  }
  return { ok: false, err: lastErr };
}

function enqueueFailed(threat) {
  chrome.storage.local.get({ [FAILED_QUEUE_KEY]: [] }, (result) => {
    let q = result[FAILED_QUEUE_KEY] || [];
    q.push({ threat, queuedAt: Date.now() });

    if (q.length > MAX_FAILED_QUEUE) q = q.slice(-MAX_FAILED_QUEUE);
    chrome.storage.local.set({ [FAILED_QUEUE_KEY]: q });
  });
}

// 주기적으로 실패 큐 재전송
async function flushFailedQueue(limit = 20) {
  const data = await chrome.storage.local.get({ [FAILED_QUEUE_KEY]: [] });
  const q = data[FAILED_QUEUE_KEY] || [];
  if (!q.length) return;

  const remain = [];
  const toSend = q.slice(0, limit);
  const rest = q.slice(limit);

  for (const item of toSend) {
    const { ok } = await transmitThreatWithRetry(item.threat);
    if (!ok) remain.push(item); // 계속 실패하면 남김
  }

  const newQueue = remain.concat(rest);
  await chrome.storage.local.set({ [FAILED_QUEUE_KEY]: newQueue });
}

// 알람 기반으로 주기 플러시
chrome.runtime.onInstalled.addListener(() => {
  // 1분마다 실패 큐 재시도
  chrome.alarms.create("flushFailedAwsQueue", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flushFailedAwsQueue") {
    flushFailedQueue().catch(() => {});
  }
});

// ---- main message handler ----
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action !== "REPORT_THREAT") return;

  const threat = message.data;

  // content.js에서 SENSOR_READY도 올라오는데, 이건 배지 초기화용으로만 사용
  if (threat.type === "SENSOR_READY") {
    if (sender?.tab?.id != null) chrome.action.setBadgeText({ text: "", tabId: sender.tab.id });
    return;
  }

  // 배지 표시
  if (sender?.tab?.id != null) {
    if (threat.severity === "HIGH") {
      chrome.action.setBadgeText({ text: "!!!", tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
    } else if (threat.severity === "MEDIUM") {
      chrome.action.setBadgeText({ text: "WARN", tabId: sender.tab.id });
      chrome.action.setBadgeBackgroundColor({ color: "#FFA500" });
    }
  }

  // 1) AWS 전송(실패 시 큐 적재)
  (async () => {
    const { ok, err } = await transmitThreatWithRetry(threat);
    if (!ok) {
      console.error("Failed to transmit threat data (queued):", err);
      enqueueFailed(threat);
    }
  })();

  // 2) 로컬 저장(기존 로직 유지)
  if (LOCAL_SAVE_TARGETS.includes(threat.severity)) {
    chrome.storage.local.get({ threatLogs: [] }, (result) => {
      let logs = result.threatLogs;
      logs.push(threat);
      if (logs.length > MAX_LOG_COUNT) logs = logs.slice(-MAX_LOG_COUNT);
      chrome.storage.local.set({ threatLogs: logs });
    });
  }
});
