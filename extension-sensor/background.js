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

// scoring model (script dump -> score)
const SCORING_MODEL_PATH = "rulesets/scoring-model-v1.json";
let scoringModelCache = null;

async function loadScoringModel() {
  if (scoringModelCache) return scoringModelCache;
  const url = chrome.runtime.getURL(SCORING_MODEL_PATH);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`SCORING_MODEL_LOAD_FAIL ${res.status}`);
  scoringModelCache = await res.json();
  return scoringModelCache;
}

function extractOriginsFromText(text) {
  const s = String(text || "");
  const re = /\b(?:https?|wss?):\/\/[^\s"'`)<>\]]+/gi;
  const origins = new Set();
  let m;
  while ((m = re.exec(s))) {
    try { origins.add(new URL(m[0]).origin); } catch (_) {}
  }
  return origins;
}

function parseRegexPattern(p) {
  const s = String(p || "");
  // allow "/.../flags" style strings
  if (s.length >= 2 && s[0] === "/" && s.lastIndexOf("/") > 0) {
    const last = s.lastIndexOf("/");
    const body = s.slice(1, last);
    const flags = s.slice(last + 1) || "i";
    return { body, flags };
  }
  // plain string => treat as body with default flags
  return { body: s, flags: "i" };
}

function matchSignal(text, sig) {
  const m = sig?.match || null;
  if (!m) return false;

  const raw = String(text || "");
  const caseSensitive = m.caseSensitive === true;
  const hay = caseSensitive ? raw : raw.toLowerCase();

  if (m.type === "special" && m.name === "MULTI_ORIGIN_URL_LITERALS") {
    const min = Number(m.minOrigins || m.min || 2) || 2;
    return extractOriginsFromText(raw).size >= min;
  }

  if (m.type === "substrAny") {
    const pats = Array.isArray(m.patterns) ? m.patterns : [];
    return pats.some((p) => {
      if (!p) return false;
      const needle = caseSensitive ? String(p) : String(p).toLowerCase();
      return needle && hay.includes(needle);
    });
  }

  if (m.type === "regexAny") {
    const pats = Array.isArray(m.patterns) ? m.patterns : [];
    return pats.some((p) => {
      try {
        const { body, flags } = parseRegexPattern(p);
        if (!body) return false;
        const re = new RegExp(body, caseSensitive ? flags.replace(/i/g, "") : flags);
        return re.test(raw);
      } catch (_) {
        return false;
      }
    });
  }

  return false;
}

function scoreScriptText(text, model) {
  const signals = Array.isArray(model?.signals) ? model.signals : [];
  const combos  = Array.isArray(model?.combos) ? model.combos : [];

  const hits = [];
  const hitIds = new Set();
  let score = 0;

  for (const sig of signals) {
    if (!sig?.id) continue;
    if (!matchSignal(text, sig)) continue;

    const s = Number(sig.score || 0) || 0;
    score += s;
    hitIds.add(sig.id);
    hits.push({
      id: sig.id,
      axis: sig.axis || null,
      category: sig.category || null,
      signal: sig.signal || null,
      score: s,
      reason: sig.reason || null
    });
  }

  // combos: enabled + requires[] all satisfied => add bonus
  const comboHits = [];
  let comboBonus = 0;
  for (const c of combos) {
    if (c?.enabled !== true) continue;
    const bonus = Number(c.bonus || 0) || 0;
    if (!bonus) continue;
    const req = Array.isArray(c.requires) ? c.requires : [];
    if (!req.length) continue;
    const ok = req.every((id) => hitIds.has(id));
    if (!ok) continue;
    comboBonus += bonus;
    comboHits.push({
      comboId: c.comboId || null,
      axis: c.axis || null,
      bonus,
      title: c.title || null,
      requires: req
    });
  }

  score += comboBonus;
  return { score, hits, comboBonus, comboHits };
}

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

        // compute SCRIPT_SCORE right before dump transmit
        let scriptScore = null;
        try {
          const model = await loadScoringModel();
          const { score, hits, comboBonus, comboHits } = scoreScriptText(clipped, model);
          const now = Date.now();

          // chain은 가능하면 tab incident 사용
          let chain = null;
          if (tabId != null) {
            const inc = incidentByTab.get(tabId);
            if (inc) {
              chain = {
                incidentId: inc.incidentId,
                scriptId: inc.scriptId || sha256 || null,
                norm: inc.norm || norm || "",
                reinjectCount: inc.reinjectCount || 0,
                startedAt: inc.startedAt
              };
            }
          }

          const scoreEvent = {
            type: "SCRIPT_SCORE",
            ruleId: "SCRIPT_SCORE",
            ts: now,
            sessionId: payload.sessionId || null,
            tabId,
            installId,
            reportId: await generateReportHash(payload.sessionId || installId, now),
            page: payload.page || sender?.tab?.url || "",
            origin: payload.origin || "",
            targetOrigin: payload.targetOrigin || "",
            severity: "LOW",
            scoreDelta: 0,
            data: {
              modelId: model.modelId || "scoring-model-v1",
              modelUpdatedAt: model.modelUpdatedAt || model.generatedAt || "",
              url,
              norm,
              sha256,
              length: payload.length ?? text.length,
              truncated: text.length > MAX_CHARS,
              score,
              hits,
              comboBonus: comboBonus || 0,
              comboHits: Array.isArray(comboHits) ? comboHits : [],
              ...(chain ? { chain } : {})
            },
            evidence: {
              modelId: model.modelId || "scoring-model-v1",
              modelUpdatedAt: model.modelUpdatedAt || model.generatedAt || "",
              score,
              hits,
              comboBonus: comboBonus || 0,
              comboHits: Array.isArray(comboHits) ? comboHits : [],
              url,
              norm,
              sha256,
              ...(chain ? { chain } : {})
            }
          };

          // ruleset(default-v1.json)이 SCRIPT_SCORE를 스코어링하지 않아도,
          // dispatcher가 sinks(localStorage/badge/notification/http)로 보낼 수 있게 직접 dispatch.
          try {
            await dispatcher.dispatch(scoreEvent, { sender });
          } catch (e) {
            console.warn("[BRS] SCRIPT_SCORE dispatch failed (non-fatal):", e?.message || e);
          }
          console.log("[BRS] SCRIPT_SCORE dispatched", { score, hitCount: hits.length, sha256, norm });
          scriptScore = { score, hitCount: hits.length, comboBonus: comboBonus || 0, comboHitCount: (comboHits || []).length };
        } catch (e) {
          console.warn("[BRS] SCRIPT_SCORE skipped:", e?.message || e);
        }

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
        sendResponse({ ok: true, scriptScore });
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