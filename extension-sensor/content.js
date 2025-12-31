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
        const baseMeta = {
          ruleId: d.mismatch ? "PHISHING_FORM_MISMATCH" : "FORM_ACTION_MATCH",
          scoreDelta: d.mismatch ? 50 : 5,
          severity: d.mismatch ? "HIGH" : "LOW",
          targetOrigin: d.actionOrigin || ""
        };

        const matched2 = ruleEngine ? ruleEngine.match({ type: "FORM_SUBMIT", data: d, ctx: {} }) : null;
        const meta2 = matched2 ? ruleEngine.apply(matched2, baseMeta) : baseMeta;

        reporter.send("FORM_SUBMIT", d, meta2);
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

    if (ruleEngine && typeof ruleEngine.load === "function") {
      try { await ruleEngine.load(); } catch (_) {}
    }

    const reporterFactory = window.BRS_Reporter && window.BRS_Reporter.createReporter;
    const reporter = reporterFactory ? reporterFactory() : {
      sessionId: `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      send: function (type, data, meta) {
        try { chrome.runtime.sendMessage({ action: "REPORT_THREAT", data: { type, data, meta } }); } catch (_) {}
      }
    };

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

    // page_hook 브릿지 + hook 주입
    startPageHookBridge(ruleEngine, reporter);
    startHooks();

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