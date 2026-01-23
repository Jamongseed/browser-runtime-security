import { runWithLock } from "../utils/lock.js";
import {
  STORAGE_KEYS,
  SYSTEM_CONFIG,
  SINK_CONFIG,
  LOCK_KEYS,
  ALARM_KEYS
} from '../config.js';

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

async function pushToQueue(items) {
  const itemsArray = Array.isArray(items) ? items : [items];
  if (itemsArray.length === 0) return;

  return runWithLock(LOCK_KEYS.HTTP_QUEUE, async () => {
    let { [STORAGE_KEYS.FAILED_QUEUE]: queue } = await chrome.storage.local.get({ [STORAGE_KEYS.FAILED_QUEUE]: [] });

    const newQueue = queue.concat(itemsArray);

    const finalQueue = newQueue.length > SINK_CONFIG.HTTP_MAX_QUEUE_SIZE
      ? newQueue.slice(-SINK_CONFIG.HTTP_MAX_QUEUE_SIZE)
      : newQueue;

    await chrome.storage.local.set({ [STORAGE_KEYS.FAILED_QUEUE]: finalQueue });
  });
}

async function flushFailedQueue(url) {
  try {

    const { [STORAGE_KEYS.FAILED_QUEUE]: queue = [] } = await chrome.storage.local.get({ [STORAGE_KEYS.FAILED_QUEUE]: [] });
    if (queue.length === 0) return;

    const BATCH_SIZE = SINK_CONFIG.HTTP_BATCH_SIZE;
    const toSend = queue.slice(0, BATCH_SIZE);
    const successIds = [];
    const fatalIds = [];

    for (const item of toSend) {
      const rid = item.payload.reportId;

      if (Date.now() - item.failedAt > SINK_CONFIG.HTTP_LOG_EXPIRY_MS) {
        fatalIds.push(rid);
        continue;
      }

      try {
        await transmitWithRetry(url, item.payload);
        successIds.push(rid);
      } catch (e) {
        if (e.isFatal) fatalIds.push(rid);
      }
    }

    const targetsToRemove = [...successIds, ...fatalIds];
    if (targetsToRemove.length > 0) {
      await runWithLock(LOCK_KEYS.HTTP_QUEUE, async () => {
        let { [STORAGE_KEYS.FAILED_QUEUE]: currentQueue = [] } = await chrome.storage.local.get({ [STORAGE_KEYS.FAILED_QUEUE]: [] });

        const updatedQueue = currentQueue.filter(item => !targetsToRemove.includes(item.payload.reportId));
        await chrome.storage.local.set({ [STORAGE_KEYS.FAILED_QUEUE]: updatedQueue });
        console.log(`[BRS] Queue cleaned: ${successIds.length} sent, ${fatalIds.length} dropped.`);
      });
    }
  } catch (err) {
    console.error("[BRS] flushFailedQueue encountered an error:", err);
  }
}

async function transmitWithRetry(url, threat) {
  // 서버가 reportId를 필수로 요구하는 경우가 있어서,
  // 일부 이벤트(SENSOR_READY 등)에서 reportId가 null이면 클라에서 채운다.
  if (threat && !threat.reportId) {
    const sid = threat.sessionId || "NO_SESSION";
    const ts = typeof threat.ts === "number" ? threat.ts : Date.now();
    // 너무 길 필요 없음. (멱등/중복방지용으로 충분)
    threat.reportId = `EVT#${sid}#${ts}#${threat.type || "NO_TYPE"}`;
  }
  
  let lastErr = null;

  // payload 사이즈에 따라 keepalive를 결정
  // 64KB 이상인데 keepalive가 true면 전송 실패
  const jsonBody = JSON.stringify(threat);

  // DEBUG: 서버 400(MISSING_REQUIRED_FIELD) 원인 확인용
  // - 콘솔에서 실제로 어떤 필드가 비었는지 바로 보이게 최소 핵심만 찍는다
  try {
    console.log("[BRS][HttpSink] outgoing keys:", Object.keys(threat || {}));
    console.log("[BRS][HttpSink] outgoing summary:", {
      type: threat?.type,
      ruleId: threat?.ruleId,
      severity: threat?.severity,
      reportId: threat?.reportId,
      sessionId: threat?.sessionId,
      ts: threat?.ts,
      installId: threat?.installId,
    });
  } catch (_) {}

  const encoder = new TextEncoder();
  const payloadSize = encoder.encode(jsonBody).length;
  const useKeepalive = payloadSize < 60 * 1024;

  for (let i = 0; i < SINK_CONFIG.HTTP_MAX_RETRY; i++) {
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: jsonBody,
          keepalive: useKeepalive
        },
        SINK_CONFIG.HTTP_FETCH_TIMEOUT_MS
      );
      const responseText = await res.text().catch(() => "");
      if (!res.ok) {
        if (res.status === 429 || res.status === 408 || res.status === 425 || res.status >= 500) {
          throw new Error(`HTTP ${res.status} (Retryable): ${responseText}`);
        }

        if (res.status >= 400 && res.status < 500) {
          const fatalErr = new Error(`HTTP Client Error ${res.status}: ${responseText}`);
          fatalErr.isFatal = true;
          throw fatalErr;
        }

        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      return;
    } catch (e) {
      lastErr = e;
      if (e.isFatal) throw e;
      const delay = SINK_CONFIG.HTTP_RETRY_BASE_DELAY_MS * Math.pow(2, i);
      await sleep(delay);
    }
  }
  throw lastErr;
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    if (alarm.name === ALARM_KEYS.RETRY_HTTP_LOGS) {
      const httpSinkUrl = SYSTEM_CONFIG.API_ENDPOINT;
      if (httpSinkUrl) {
        await flushFailedQueue(httpSinkUrl);
      }
    }
  } catch (err) {
    console.error(`[BRS] Alarm [${ALARM_KEYS.RETRY_HTTP_LOGS}] execution failed:`, err);
  }
});

export function createHttpSink({ targets } = []) {
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

  chrome.alarms.get(ALARM_KEYS.RETRY_HTTP_LOGS, (alarm) => {
    if (!alarm) chrome.alarms.create(ALARM_KEYS.RETRY_HTTP_LOGS, { periodInMinutes: 2 });
  });

  return {
    name: "HttpSink",
    shouldHandle(threat) {
      return !targets || targets.includes(threat.severity);
    },
    async send(threat) {
      const url = SYSTEM_CONFIG.API_ENDPOINT;
      try {
        await transmitWithRetry(url, threat);
        return { status: "sent" };
      } catch (err) {
        console.error(`[BRS] ${this.name} failed:`, err);

        if (err.isFatal) {
          console.warn("[BRS] Log dropped due to client error:", err.message);
          throw new Error(`HTTP Fatal Client Error: ${err.message}`);
        }

        let isQueued = false;
        try {
          await enqueueFailed(threat);
          isQueued = true;
        } catch (enqueueErr) {
          throw new Error(`Critical: Failed to queue log: ${enqueueErr.message}`);
        }

        if (isQueued) {
          throw new Error(`Queued for retry: ${err.message}`);
        }
      }
    }
  };
}