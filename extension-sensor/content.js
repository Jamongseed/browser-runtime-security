const STORAGE_KEYS = {
  WHITELIST: 'whitelist',
  NOTIFICATIONS: 'notification_settings',
  LOGS: 'brs_threat_logs',
  LAST_NOTI_TIME: 'lastNotiTime',
  TAB_SESSIONS: 'tabSessions',
  INSTALL_ID: "brs_installId",
  FAILED_QUEUE: "failed_log_queue",
  IS_ENABLED: "brs_is_enabled"
};

(function () {
  let currentTabId = null;

  // page_hook 주입
  function startHooks() {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("page_hook.js");
    s.setAttribute("data-brs-internal", "1");
    s.onload = function () { this.remove(); };
    (document.head || document.documentElement).appendChild(s);
  }

  // page_hook 브릿지 (window.postMessage 수신)
  function startPageHookBridge(ruleEngine, reporter) {
    window.addEventListener("message", (e) => {
      if (e.source !== window || !e.data.__BRS__) return;
      const { type, data } = e.data;

      // (추가) page_hook 인라인 스크립트 덤프 -> background(BRS_SAVE_DUMP)로 전달
      if (type === "INLINE_SCRIPT_DUMP") {
        try {
          const d = data || {};
          const sha256 = String(d.sha256 || "");
          const text = String(d.text || "");
          if (!sha256 || !text) return;

          const payload = {
            sessionId: reporter && reporter.sessionId ? reporter.sessionId : null,
            url: String(d.page || location.href),
            norm: `inline:${sha256}`,
            sha256,
            length: d.length ?? text.length,
            contentType: "application/javascript",
            via: "page-hook-inline",
            truncated: d.truncated === true,
            text,
            page: String(d.page || location.href),
            origin: String(d.origin || location.origin),
            targetOrigin: "",
            kind: String(d.kind || "inline-script"),
            op: String(d.op || ""),
            markerId: String(d.markerId || ""),
            dataPoc: String(d.dataPoc || ""),
          };

          chrome.runtime.sendMessage({ action: "BRS_SAVE_DUMP", payload }, () => {});
        } catch (_) {}
        return;
      }

      // (추가)XHR mirroring correlation state
      const XHR_MIRROR_WINDOW_MS = 8000;
      const XHR_MIRROR_THROTTLE_MS = 600;

      const corr = window.__BRS_XHR_MIRROR_CORR_STATE__ =
        window.__BRS_XHR_MIRROR_CORR_STATE__ || {
          seen: false,
          ts: 0,
          lastProto: null,     // PROTO_TAMPER(data)
          lastProtoMeta: null, // PROTO_TAMPER(meta)
          lastEmitTs: 0,
        };

      const isXhrProtoTamper = (d) => {
        try { return String(d && d.target || "").startsWith("XMLHttpRequest.prototype."); }
        catch (_) { return false; }
      };

      const bandFromScore = (s) => (s >= 7 ? "HIGH" : s >= 4 ? "MEDIUM" : "LOW");

      const computeSuspicion = (net, dtMs, protoMeta) => {
        let score = 0;
        score += 4; // 후킹 + crossSite 전송 조합 자체
        if (dtMs <= 1000) score += 2;
        else if (dtMs <= 3000) score += 1;

        const api = String(net && net.api || "");
        if (api === "fetch") score += 1;
        if (api === "sendBeacon") score += 1;

        const sev = String(protoMeta && protoMeta.severity || "");
        if (sev === "HIGH") score += 2;
        else if (sev === "MEDIUM") score += 1;

        const sh = String(net && (net.stackHead || net.initiatorLine || "") || "");
        if (sh && /XMLHttpRequest|xhr|open\W|send\W/i.test(sh)) score += 1;

        return score;
      };

      // (추가) form.submit/requestSubmit 후킹 이벤트를 기존 FORM_SUBMIT 이벤트로 변환
      if (type === "FORM_NATIVE_SUBMIT") {
        const d = data || {};

        // (추가) 상태 1bit + data 태그 (PROTO_TAMPER -> FORM_SUBMIT 연계)
        // - detector(form_submit_prototype_tamper.js)가 기록해 둔 공유 상태를 읽어 붙임
        // - ruleEngine.match 이전에 d.protoTamperSeen이 들어가야 "상태 기반 룰"이 매칭됨
        let _protoEvidence = null;
        try {
          const st = window.__BRS_FORM_PROTO_TAMPER_STATE__;
          if (st && st.seen) {
            d.protoTamperSeen = true;
            d.protoTamperProps = st.props || { submit: true, requestSubmit: true };
            d.protoTamperTs = st.ts || 0;

            _protoEvidence = {
              protoTamper: st.last || null,
              protoTamperTs: st.ts || 0,
              dtMs: st.ts ? (Date.now() - st.ts) : null,
            };
          }
        } catch (_) { }

        const baseMeta = {
          ruleId: d.mismatch ? "PHISHING_FORM_MISMATCH" : "FORM_ACTION_MATCH",
          scoreDelta: d.mismatch ? 50 : 5,
          severity: d.mismatch ? "HIGH" : "LOW",
          targetOrigin: d.actionOrigin || ""
        };

        // (추가) evidence 채우기 (FORM_SUBMIT_AFTER_PROTO_TAMPER에서 보여줄 근거)
        if (_protoEvidence) baseMeta.evidence = _protoEvidence;

        const matched2 = ruleEngine ? ruleEngine.match({ type: "FORM_SUBMIT", data: d, ctx: {} }) : null;
        const meta2 = matched2 ? ruleEngine.apply(matched2, baseMeta) : baseMeta;

        reporter.send("FORM_SUBMIT", d, meta2);
        return;
      }

      // (추가) page_hook에서 감지한 "폼 프로토타입 선행 변조" 이벤트를 PROTO_TAMPER로 변환
      if (type === "FORM_PROTO_TAMPER") {
        const d = data || {};

        const baseMeta = {
          ruleId: d.prop === "requestSubmit"
            ? "FORM_REQUESTSUBMIT_PROTOTYPE_TAMPER"
            : "FORM_SUBMIT_PROTOTYPE_TAMPER",
          scoreDelta: 30,
          severity: "MEDIUM",
          targetOrigin: location.origin
        };

        // (추가) 공유 상태 갱신: page_hook발 PROTO_TAMPER도 상관분석에 포함
        // - detector가 아직 돌지 않았거나(레이스), detector가 아닌 경로로 PROTO_TAMPER가 들어온 경우에도
        //   FORM_SUBMIT 시점에 protoTamperSeen/evidence가 채워지도록 1bit 상태를 여기서도 업데이트한다.
        try {
          const st = window.__BRS_FORM_PROTO_TAMPER_STATE__ = window.__BRS_FORM_PROTO_TAMPER_STATE__ || {
            seen: false,
            props: { submit: false, requestSubmit: false },
            ts: 0,
            last: null,
          };

          st.seen = true;
          if (d && (d.prop === "submit" || d.prop === "requestSubmit")) st.props[d.prop] = true;
          st.ts = Date.now();
          st.last = {
            type: "PROTO_TAMPER",
            ruleId: baseMeta.ruleId,
            data: d,
          };
        } catch (_) { }

        const matched2 = ruleEngine ? ruleEngine.match({ type: "PROTO_TAMPER", data: d, ctx: {} }) : null;
        const meta2 = matched2 ? ruleEngine.apply(matched2, baseMeta) : baseMeta;

        reporter.send("PROTO_TAMPER", d, meta2);
        return;
      }

      // (추가) SW register provenance 강화: 누가 register 했는지(initiator)를 stack에서 추출
      // - page_hook_sw_boot.js에서 SW_REGISTER를 postMessage로 보내면 여기서 수신됨
      // - SW 스크립트가 same-origin이어도, initiator가 cross-site(예: localhost:4000 SDK)이면 HIGH로 승격
      if (type === "SW_REGISTER") {
        const d = data || {};

        let initiatorUrl = "";
        let initiatorOrigin = "";
        let initiatorCrossSite = false;

        try {
          const stack = String(d.stack || (d.evidence && d.evidence.stack) || "");
          const lines = stack.split("\n").map(s => String(s).trim()).filter(Boolean);

          const httpLine = lines.find(l =>
            (l.includes("http://") || l.includes("https://")) &&
            !l.includes("chrome-extension://")
          );

          if (httpLine) {
            const m = httpLine.match(/https?:\/\/[^\s)]+/);
            if (m && m[0]) {
              initiatorUrl = String(m[0]).replace(/:\d+:\d+$/, "");
              try {
                initiatorOrigin = new URL(initiatorUrl).origin;
                initiatorCrossSite = !!(initiatorOrigin && initiatorOrigin !== location.origin);
              } catch (_) { }
            }
          }
        } catch (_) { }

        d.initiatorUrl = initiatorUrl;
        d.initiatorOrigin = initiatorOrigin;
        d.initiatorCrossSite = initiatorCrossSite;

        const baseMeta = initiatorCrossSite
          ? {
            ruleId: "SW_REGISTER_INITIATED_BY_CROSS_SITE_SCRIPT",
            scoreDelta: 80,
            severity: "HIGH",
            targetOrigin: initiatorOrigin || ""
          }
          : {
            ruleId: "SW_REGISTER",
            scoreDelta: 10,
            severity: "LOW",
            targetOrigin: (d && d.targetOrigin) ? d.targetOrigin : ""
          };

        let swScriptOrigin = "";
        try {
          const swAbs = String(d.abs || "");
          if (swAbs) swScriptOrigin = new URL(swAbs).origin;
        } catch (_) { }

        baseMeta.evidence = {
          stack: String(d.stack || (d.evidence && d.evidence.stack) || ""),
          initiatorUrl,
          initiatorOrigin,
          initiatorCrossSite,

          swScriptURL: String(d.scriptURL || ""),
          swAbs: String(d.abs || ""),
          swTargetOrigin: String(d.targetOrigin || ""),
          swScriptOrigin,
          swCrossSite: !!d.crossSite
        };

        const matched2 = ruleEngine ? ruleEngine.match({ type: "SW_REGISTER", data: d, ctx: {} }) : null;
        const meta2 = matched2 ? ruleEngine.apply(matched2, baseMeta) : baseMeta;

        reporter.send("SW_REGISTER", d, meta2);
        return;
      }

      // (추가) XHR PROTO_TAMPER 상관분석용 상태 갱신 (기존 전송은 그대로)
      if (type === "PROTO_TAMPER" && isXhrProtoTamper(data)) {
        try {
          corr.seen = true;
          corr.ts = Date.now();
          corr.lastProto = data || null;
        } catch (_) { }
      }

      let scoreDelta = 0;
      let ruleId = type;

      if (type === "SUSP_ATOB_CALL") { scoreDelta = 10; ruleId = "OBFUSCATION_ATOB"; }
      else if (type === "SUSP_EVAL_CALL") { scoreDelta = 25; ruleId = "DYNAMIC_CODE_EVAL"; }
      else if (type === "SUSP_FUNCTION_CONSTRUCTOR_CALL") { scoreDelta = 25; ruleId = "DYNAMIC_CODE_FUNCTION"; }
      else if (type === "SUSP_DOM_XSS") { scoreDelta = 40; ruleId = "DOM_XSS_INJECTION"; }
      else if (type === "SENSITIVE_DATA_ACCESS") { scoreDelta = 50; ruleId = "COOKIE_THEFT"; }
      else if (type === "SUSP_NETWORK_CALL") { scoreDelta = 15; ruleId = "NETWORK_LEAK"; }

      const eventData = data || {};
      const baseMeta = { ruleId, scoreDelta };

      const matched = ruleEngine ? ruleEngine.match({ type, data: eventData, ctx: {} }) : null;
      const meta = matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;

      // (추가) XHR PROTO_TAMPER meta 저장(룰 적용된 severity 반영)
      if (type === "PROTO_TAMPER" && isXhrProtoTamper(eventData)) {
        try { corr.lastProtoMeta = meta || null; } catch (_) { }
      }

      // (추가) XHR mirroring correlation: PROTO_TAMPER 이후 N초 이내 crossSite 전송이면 1회 시그널 emit
      if (type === "SUSP_NETWORK_CALL") {
        try {
          const net = eventData || {};
          if (net.crossSite === true && corr.seen && corr.ts) {
            const now = Date.now();
            const dtMs = now - corr.ts;

            if (dtMs >= 0 && dtMs <= XHR_MIRROR_WINDOW_MS) {
              if (now - (corr.lastEmitTs || 0) >= XHR_MIRROR_THROTTLE_MS) {

                const suspicionScore = computeSuspicion(net, dtMs, corr.lastProtoMeta);
                const suspicionBand = bandFromScore(suspicionScore);

                const ev = {
                  windowMs: XHR_MIRROR_WINDOW_MS,
                  dtMs,
                  proto: {
                    ts: corr.ts,
                    target: String(corr.lastProto && corr.lastProto.target || ""),
                    ruleId: String(corr.lastProtoMeta && corr.lastProtoMeta.ruleId || ""),
                    severity: String(corr.lastProtoMeta && corr.lastProtoMeta.severity || ""),
                  },
                  network: {
                    api: String(net.api || ""),
                    url: String(net.url || ""),
                    abs: String(net.abs || ""),
                    targetOrigin: String(net.targetOrigin || ""),
                    crossSite: !!net.crossSite,
                    method: String(net.method || ""),
                    mode: String(net.mode || ""),
                    size: net.size,
                  },
                  analysis: { suspicionScore, suspicionBand },
                  evidence: { stackHead: String(net.stackHead || net.initiatorLine || "") }
                };

                const baseMeta2 = {
                  ruleId: "XHR_MIRRORING_SUSPECT",
                  scoreDelta: 0,
                  severity: "LOW",
                  targetOrigin: String(net.targetOrigin || ""),
                  evidence: { dtMs, suspicionScore, suspicionBand }
                };

                const matched2 = ruleEngine ? ruleEngine.match({ type: "XHR_MIRRORING_SUSPECT", data: ev, ctx: {} }) : null;
                const meta2 = matched2 ? ruleEngine.apply(matched2, baseMeta2) : baseMeta2;

                reporter.send("XHR_MIRRORING_SUSPECT", ev, meta2);
                corr.lastEmitTs = now;
              }
            }
          }
        } catch (_) { }
      }

      reporter.send(type, eventData, meta);
    });
  }

  async function init() {
    // --- 토스트 알림 로직 추가 ---
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === "SHOW_TOAST") {
        renderShadowToast(message.data, 10000, currentTabId);
      }
    });

    try {
      // background.js에게 Tab ID 요청
      const response = await chrome.runtime.sendMessage({ action: "GET_MY_TAB_ID" });
      if (response && response.tabId) {
        currentTabId = response.tabId;
        // 토스트 알림은 페이지 이동 시 사리지기 때문에 
        // 해당 Tab ID에 10초 이내에 발생한 알림이 있으면 다시 띄움
        await checkAndRecoverToast(response.tabId);
      }
    }
    catch (err) {
      console.debug("[BRS] Toast recovery skipped or Context lost:", err.message);
    }
    // --- 토스트 알림 로직 ---
    try {
      const result = await new Promise((resolve, reject) => {
        // 타이머 안전 장치
        const timeoutId = setTimeout(() => {
          console.warn("[BRS] Storage access timed out. Proceeding with default settings.");
          resolve({});
        }, 2000);

        chrome.storage.local.get({
          [STORAGE_KEYS.WHITELIST]: [],
          [STORAGE_KEYS.IS_ENABLED]: true
        }, (res) => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          resolve(res || {});
        });
      });

      // 1. ON/OFF 확인 로직
      const isEnabled = result[STORAGE_KEYS.IS_ENABLED] !== false;

      if (!isEnabled) {
        console.log("[BRS] Monitoring OFF.");
        return;
      }

      // 2. 화이트리스트 확인 로직
      const currentDomain = window.location.hostname.replace(/^www\./, '').toLowerCase();

      const whitelist = result[STORAGE_KEYS.WHITELIST] || [];

      const isWhitelisted = whitelist.some(domain => {
        // 와일드카드 패턴인 경우 예) *.google.com
        if (domain.startsWith('*.')) {
          const actualDomain = domain.slice(2).toLowerCase();
          return currentDomain === actualDomain || currentDomain.endsWith('.' + actualDomain);
        }

        // 일반 도메인인 경우 예) google.com
        return currentDomain === domain;
      });

      if (isWhitelisted) {
        console.log(`[BRS] Whitelisted site. Disabling detector for: (${currentDomain})`);
        return;
      }

    } catch (e) {
      console.warn("Whitelist check failed. Proceeding with detection.", e);
    }

    const ruleEngine = window.BRS_RuleEngine || null;

    const reporterFactory = window.BRS_Reporter && window.BRS_Reporter.createReporter;
    const reporter = reporterFactory ? reporterFactory() : {
      sessionId: `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      send: function (type, data, meta) {
        try { chrome.runtime.sendMessage({ action: "REPORT_THREAT", data: { type, data, meta } }); } catch (_) { }
      }
    };

    try { window.__BRS_SESSION_ID__ = reporter.sessionId; } catch (_) {}
    
    // page_hook 브릿지 + hook 주입
    startPageHookBridge(ruleEngine, reporter);
    //startHooks();

    if (ruleEngine && typeof ruleEngine.load === "function") {
      try { await ruleEngine.load(); } catch (_) { }
    }

    // detectors 호출 (탐지 로직은 detectors/* 로 이동)
    const detectors = window.BRS_Detectors || {};

    const domMutation = detectors.domMutation;
    if (domMutation && typeof domMutation.start === "function") {
      try { domMutation.start(reporter.send, ruleEngine); } catch (_) { }
    }

    const formsDetector = detectors.forms;
    if (formsDetector && typeof formsDetector.start === "function") {
      try { formsDetector.start(reporter.send, ruleEngine); } catch (_) { }
    }

    const invisibleLayerDetector = detectors.invisibleLayer;
    if (invisibleLayerDetector && typeof invisibleLayerDetector.start === "function") {
      try { invisibleLayerDetector.start(reporter.send, ruleEngine); } catch (_) { }
    }

    const postMessageDetector = detectors.postMessage;
    if (postMessageDetector && typeof postMessageDetector.start === "function") {
      try { postMessageDetector.start(reporter.send, ruleEngine); } catch (_) { }
    }

    const linkHrefSwapDetector = detectors.linkHrefSwap;
    if (linkHrefSwapDetector && typeof linkHrefSwapDetector.start === "function") {
      try { linkHrefSwapDetector.start(reporter.send, ruleEngine); } catch (_) { }
    }

    const protoTamperDetector = detectors.formSubmitPrototypeTamper;
    if (protoTamperDetector && typeof protoTamperDetector.start === "function") {
      try { protoTamperDetector.start(reporter.send, ruleEngine); } catch (_) { }
    }

    const swPersistenceDetector = detectors.swPersistence;
    if (swPersistenceDetector && typeof swPersistenceDetector.start === "function") {
      try { swPersistenceDetector.start(reporter.send, ruleEngine); } catch (_) { }
    }

    const moDetector = detectors.mutationObserver;
    if (moDetector && typeof moDetector.start === "function") {
      try { moDetector.start(reporter.send, ruleEngine); } catch (_) { }
    }

    const xhrProtoTamperDetector = detectors.xhrPrototypeTamper;
    if (xhrProtoTamperDetector && typeof xhrProtoTamperDetector.start === "function") {
      try { xhrProtoTamperDetector.start(reporter.send, ruleEngine); } catch (_) { }
    }

    // SENSOR_READY
    const readyData = { origin: location.origin };
    const readyBaseMeta = {
      ruleId: "SENSOR_READY",
      scoreDelta: 0,
      severity: "LOW",
      targetOrigin: location.origin,
      evidence: { origin: location.origin, sessionId: reporter.sessionId }
    };

    const readyMatched = ruleEngine ? ruleEngine.match({ type: "SENSOR_READY", data: readyData, ctx: {} }) : null;
    const readyMeta = readyMatched ? ruleEngine.apply(readyMatched, readyBaseMeta) : readyBaseMeta;

    reporter.send("SENSOR_READY", readyData, readyMeta);
  }

  // --- 토스트 알림 함수 ---
  async function checkAndRecoverToast(tabId) {
    const storageKey = `pending_toast_${tabId}`;
    try {
      const res = await chrome.storage.local.get(storageKey);
      const data = res[storageKey];

      if (data && data.ts) {
        const passedMs = Date.now() - data.ts;
        const remainingMs = 10000 - passedMs;

        if (remainingMs > 0) {
          // 남은 시간 정보를 함께 넘김
          renderShadowToast(data, remainingMs, tabId);
        } else {
          await chrome.storage.local.remove(storageKey);
        }
      }
    } catch (err) {
      console.debug("[BRS] Storage recovery failed:", err.message);
    }

  }

  // Shadow DOM 렌더링 함수
  function renderShadowToast(data, displayMs = 10000, tabId = null) {
    const existingHost = document.getElementById('brs-toast-host');
    if (existingHost) existingHost.remove();

    const host = document.createElement('div');
    host.id = 'brs-toast-host';
    Object.assign(host.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      zIndex: '2147483647'
    });

    const root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      .toast-box {
        position: fixed; top: 20px; right: 20px;
        background: ${data.severity === 'HIGH' ? '#ff4d4f' : '#2f3542'};
        color: white; padding: 16px; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        font-family: sans-serif; cursor: pointer;
        animation: slideIn 0.3s ease-out;
        min-width: 250px; line-height: 1.5;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .close-btn {
        position: absolute;
        top: 5px;
        right: 10px;
        font-size: 18px;
        font-weight: bold;
        color: rgba(255, 255, 255, 0.6);
        cursor: pointer;
        transition: color 0.2s;
        line-height: 1;
      }
      .close-btn:hover {
        color: white;
      }
      .toast-box {
        position: relative;

      }
    `;

    const toast = document.createElement('div');
    toast.className = 'toast-box';
    toast.innerHTML = `
      <span class="close-btn" id="brs-close-btn">&times;</span>
      <strong>⚠️ 보안 위협 탐지</strong><br>${data.message}
    `;

    let timeoutId;

    const closeBtn = toast.querySelector('.close-btn');
    closeBtn.onclick = async (e) => {
      e.stopPropagation();

      if (timeoutId) clearTimeout(timeoutId);


      if (tabId) {
        try {
          await chrome.storage.local.remove(`pending_toast_${tabId}`);
        } catch (err) {
          console.debug("[BRS] Cleanup failed on manual close");
        }
      }

      host.remove();
    };

    toast.onclick = async () => {
      if (timeoutId) clearTimeout(timeoutId);
      try {
        const response = await chrome.runtime.sendMessage({
          action: "OPEN_DASHBOARD_FROM_TOAST",
          reportId: data.reportId
        });

        if (response && response.ok) {
          host.remove();
        } else {
          const label = toast.querySelector('.toast-label');
          if (label) label.textContent = "오류: 대시보드를 열 수 없습니다.";
          console.error("[BRS] Dashboard open failed:", response?.error);
        }
      } catch (err) {
        console.error("[BRS] Communication error:", err);
        host.remove();
      }
    };

    root.appendChild(style);
    root.appendChild(toast);
    document.body.appendChild(host);

    // 10초 후 자동 소멸
    timeoutId = setTimeout(async () => {
      if (host.parentNode) host.remove();
      if (tabId) {
        try {
          await chrome.storage.local.remove(`pending_toast_${tabId}`);
        } catch (_) { }
      }
    }, displayMs);
  }

  init();
})();