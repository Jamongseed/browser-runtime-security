(function () {
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
        } catch (_) {}

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
        } catch (_) {}

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
              } catch (_) {}
            }
          }
        } catch (_) {}

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
        } catch (_) {}

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

      reporter.send(type, eventData, meta);
    });
  }

  async function init() {
    const ruleEngine = window.BRS_RuleEngine || null;

    const reporterFactory = window.BRS_Reporter && window.BRS_Reporter.createReporter;
    const reporter = reporterFactory ? reporterFactory() : {
      sessionId: `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      send: function (type, data, meta) {
        try { chrome.runtime.sendMessage({ action: "REPORT_THREAT", data: { type, data, meta } }); } catch (_) {}
      }
    };

    // page_hook 브릿지 + hook 주입
    startPageHookBridge(ruleEngine, reporter);
    //startHooks();

    if (ruleEngine && typeof ruleEngine.load === "function") {
      try { await ruleEngine.load(); } catch (_) {}
    }

    // detectors 호출 (탐지 로직은 detectors/* 로 이동)
    const detectors = window.BRS_Detectors || {};

    const domMutation = detectors.domMutation;
    if (domMutation && typeof domMutation.start === "function") {
      try { domMutation.start(reporter.send, ruleEngine); } catch (_) {}
    }

    const formsDetector = detectors.forms;
    if (formsDetector && typeof formsDetector.start === "function") {
      try { formsDetector.start(reporter.send, ruleEngine); } catch (_) {}
    }

    const invisibleLayerDetector = detectors.invisibleLayer;
    if (invisibleLayerDetector && typeof invisibleLayerDetector.start === "function") {
      try { invisibleLayerDetector.start(reporter.send, ruleEngine); } catch (_) {}
    }

    const postMessageDetector = detectors.postMessage;
    if (postMessageDetector && typeof postMessageDetector.start === "function") {
      try { postMessageDetector.start(reporter.send, ruleEngine); } catch (_) {}
    }

    const linkHrefSwapDetector = detectors.linkHrefSwap;
    if (linkHrefSwapDetector && typeof linkHrefSwapDetector.start === "function") {
      try { linkHrefSwapDetector.start(reporter.send, ruleEngine); } catch (_) {}
    }
    
    const protoTamperDetector = detectors.formSubmitPrototypeTamper;
    if (protoTamperDetector && typeof protoTamperDetector.start === "function") {
      try { protoTamperDetector.start(reporter.send, ruleEngine); } catch (_) {}
    }

    const swPersistenceDetector = detectors.swPersistence;
    if (swPersistenceDetector && typeof swPersistenceDetector.start === "function") {
      try { swPersistenceDetector.start(reporter.send, ruleEngine); } catch (_) {}
    }

    const moDetector = detectors.mutationObserver;
    if (moDetector && typeof moDetector.start === "function") {
      try { moDetector.start(reporter.send, ruleEngine); } catch (_) {}
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

  init();
})();