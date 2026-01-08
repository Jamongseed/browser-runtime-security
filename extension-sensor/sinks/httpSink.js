const FAILED_QUEUE_KEY = "failed_log_queue";
const ALARM_NAME = "retry_failed_logs";
const MAX_FAILED_QUEUE_SIZE = 100;
const FETCH_TIMEOUT_MS = 5000;
const MAX_RETRY = 3;
const RETRY_BASE_DELAY_MS = 600;
const QUEUE_LOCK = "brs_http_queue_lock";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 서버에 보내기 전 payload 재포장
function toServerPayload(threat) {
  const payload = { ...threat };

  // ID 매핑 (reportId -> eventId)
  if (payload.reportId) {
    payload.eventId = payload.reportId;
  } else {
    // ID가 없을 경우 비상용 생성
    payload.eventId = crypto.randomUUID();
  }

  return payload;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal, 
    });

    clearTimeout(id);
    return res;

  } catch (err) {
    clearTimeout(id);
    if (err.name === "AbortError") {
      throw new Error("FETCH_TIMEOUT");
    }
    throw err;
  }
}

async function popFromQueue(limit) {
  return navigator.locks.request(QUEUE_LOCK, async () => {
    let { [FAILED_QUEUE_KEY]: queue } = await chrome.storage.local.get({ [FAILED_QUEUE_KEY]: [] });
    
    if (!queue || queue.length === 0) return [];

    const toSend = queue.slice(0, limit);
    const remain = queue.slice(limit);

    await chrome.storage.local.set({ [FAILED_QUEUE_KEY]: remain });

    return toSend;
  });
}

async function pushToQueue(items) {
  const itemsArray = Array.isArray(items) ? items : [items];
  if (itemsArray.length === 0) return;

  return navigator.locks.request(QUEUE_LOCK, async () => {
    let { [FAILED_QUEUE_KEY]: queue } = await chrome.storage.local.get({ [FAILED_QUEUE_KEY]: [] });
    
    const newQueue = queue.concat(itemsArray);

    const finalQueue = newQueue.length > MAX_FAILED_QUEUE_SIZE 
      ? newQueue.slice(-MAX_FAILED_QUEUE_SIZE) 
      : newQueue;

    await chrome.storage.local.set({ [FAILED_QUEUE_KEY]: finalQueue });
  });
}

async function flushFailedQueue(url) {
  const toSend = await popFromQueue(5);
  
  if (toSend.length === 0) return;

  console.log(`[BRS] Processing ${toSend.length} items...`);

  const failedItems = [];
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  for (const item of toSend) {
    try {
      await transmitWithRetry(url, item.payload);
    } catch (e) {
      if (Date.now() - item.failedAt < ONE_DAY_MS) {
        failedItems.push(item);
      } else {
        console.debug("[BRS] Dropped expired log");
      }
    }
  }

  if (failedItems.length > 0) {
    console.log(`[BRS] Re-queuing ${failedItems.length} failed items.`);
    await pushToQueue(failedItems);
  }
}

async function transmitWithRetry(url, threat) {
  let lastErr = null;
  for (let i = 0; i < MAX_RETRY; i++) {
    try {
      const res = await fetchWithTimeout(
        url, 
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(threat),
          keepalive: true
        },
        FETCH_TIMEOUT_MS
      );
      const responseText = await res.text().catch(() => "");
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return;
    } catch (e) {
      lastErr = e;
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, i);
      await sleep(delay); 
    }
  }
  throw lastErr;
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    const { httpSinkUrl } = await chrome.storage.local.get("httpSinkUrl");
    if (httpSinkUrl) {
      await flushFailedQueue(httpSinkUrl); 
    }
  }
});

export function createHttpSink({ url, targets }) {
  if (url) {
    chrome.storage.local.set({ httpSinkUrl: url });
  }

  async function enqueueFailed(threat) {
    try {
      await pushToQueue({
        payload: threat,
        failedAt: Date.now()
      });
    } catch (err) {
      console.warn("[BRS] Failed to save log:", err);
    }
  }
  
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) chrome.alarms.create(ALARM_NAME, { periodInMinutes: 2 });
  });

  return {
    name: "HttpSink",
    shouldHandle(threat) {
      return !targets || targets.includes(threat.severity);
    },
    async send(threat) {
      try {
        await transmitWithRetry(url, threat);
        return { status: "sent" };
      } catch (e) {
        await enqueueFailed(threat);
        return { status: "queued", error: e.message };
      }
    }
  };
}