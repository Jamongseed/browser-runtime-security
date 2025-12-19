(function () {
  const sessionId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2);

  function nowSeverityFromDelta(scoreDelta) {
    if (scoreDelta >= 50) return "HIGH";
    if (scoreDelta >= 25) return "MEDIUM";
    return "LOW";
  }

  function sendEvent(payload) {
    fetch("http://localhost:8080/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  function log(type, data, meta) {
    const payload = {
      type,
      data: data || {},
      sessionId,
      ruleId: meta && meta.ruleId ? meta.ruleId : type,
      evidence: meta && meta.evidence ? meta.evidence : {},
      scoreDelta: meta && typeof meta.scoreDelta === "number" ? meta.scoreDelta : 0,
      severity: meta && meta.severity ? meta.severity : nowSeverityFromDelta(meta && typeof meta.scoreDelta === "number" ? meta.scoreDelta : 0),
      targetOrigin: meta && meta.targetOrigin ? meta.targetOrigin : "",
      origin: location.origin,
      page: location.href,
      ua: navigator.userAgent,
      ts: Date.now(),
    };
    console.log("[BRS]", type, payload);
    sendEvent(payload);
  }

  function toAbsUrl(raw) {
    if (!raw) return "";
    try {
      return new URL(raw, location.href).href;
    } catch {
      return raw;
    }
  }

  function getOrigin(url) {
    if (!url) return "";
    try {
      return new URL(url).origin;
    } catch {
      return "";
    }
  }

  function isCrossSite(absUrl) {
    const o = getOrigin(absUrl);
    return !!o && o !== location.origin;
  }

  function injectPageHooks() {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("page_hook.js");
    s.async = false;
    (document.documentElement || document.head).appendChild(s);
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.__BRS__ !== true) return;

    const t = d.type;
    const info = d.data || {};

    if (t === "SUSP_ATOB_CALL") {
      log("SUSP_ATOB_CALL", info, {
        ruleId: "OBFUSCATION_ATOB",
        scoreDelta: 10,
        evidence: { len: info.len },
      });
      return;
    }

    if (t === "SUSP_FUNCTION_CALL") {
      log("SUSP_FUNCTION_CALL", info, {
        ruleId: "DYNAMIC_CODE_FUNCTION",
        scoreDelta: 25,
        severity: "MEDIUM",
        evidence: { argc: info.argc },
      });
      return;
    }

    if (t === "HOOK_ERROR") {
      log("HOOK_ERROR", info, {
        ruleId: "PAGE_HOOK_ERROR",
        scoreDelta: 0,
        severity: "LOW",
        evidence: info,
      });
      return;
    }

    log(t, info, { ruleId: t, scoreDelta: 0, evidence: info });
  });

  injectPageHooks();

  const mo = new MutationObserver((mutList) => {
    for (const m of mutList) {
      for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;

        if (n.tagName === "SCRIPT") {
          const src = n.getAttribute("src") || "";
          const abs = toAbsUrl(src);
          const crossSite = isCrossSite(abs);
          const targetOrigin = getOrigin(abs);
          const scoreDelta = crossSite ? 20 : 5;
          log("DYN_SCRIPT_INSERT", { src, abs, crossSite }, {
            ruleId: crossSite ? "DYN_SCRIPT_INSERT_CROSS_SITE" : "DYN_SCRIPT_INSERT_SAME_SITE",
            scoreDelta,
            severity: crossSite ? "MEDIUM" : "LOW",
            targetOrigin,
            evidence: { src, abs, crossSite, targetOrigin },
          });
        }

        if (n.tagName === "IFRAME") {
          const src = n.getAttribute("src") || "";
          const abs = toAbsUrl(src);
          const crossSite = isCrossSite(abs);
          const targetOrigin = getOrigin(abs);
          const style = (n.getAttribute("style") || "").toLowerCase();
          const hidden =
            style.includes("left: -9999") ||
            style.includes("display: none") ||
            style.includes("visibility: hidden");
          const scoreDelta = (hidden ? 25 : 10) + (crossSite ? 10 : 0);
          log("DYN_IFRAME_INSERT", { src, abs, crossSite, hidden }, {
            ruleId: hidden ? "HIDDEN_IFRAME_INSERT" : "IFRAME_INSERT",
            scoreDelta,
            severity: scoreDelta >= 35 ? "HIGH" : scoreDelta >= 20 ? "MEDIUM" : "LOW",
            targetOrigin,
            evidence: { src, abs, crossSite, hidden, targetOrigin },
          });
        }
      }
    }
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });

  function reportForm(form, via) {
    if (!(form instanceof HTMLFormElement)) return;

    const actionAttr = form.getAttribute("action") || "";
    const actionResolved = form.action || "";
    const targetOrigin = getOrigin(actionResolved);

    try {
      const a = new URL(actionResolved);
      const mismatch = a.origin !== location.origin;
      const scoreDelta = mismatch ? 50 : 5;

      log("FORM_SUBMIT", {
        via,
        actionAttr,
        actionResolved,
        actionOrigin: a.origin,
        pageOrigin: location.origin,
        mismatch,
      }, {
        ruleId: mismatch ? "FORM_ACTION_MISMATCH" : "FORM_ACTION_MATCH",
        scoreDelta,
        severity: mismatch ? "HIGH" : "LOW",
        targetOrigin,
        evidence: {
          via,
          actionAttr,
          actionResolved,
          actionOrigin: a.origin,
          pageOrigin: location.origin,
          mismatch,
        },
      });
    } catch {
      log("FORM_SUBMIT", { via, actionAttr, actionResolved, parse: "fail" }, {
        ruleId: "FORM_ACTION_PARSE_FAIL",
        scoreDelta: 10,
        severity: "MEDIUM",
        targetOrigin,
        evidence: { via, actionAttr, actionResolved },
      });
    }
  }

  document.addEventListener(
    "submit",
    (e) => {
      reportForm(e.target, "submit");
    },
    true
  );

  document.addEventListener(
    "click",
    (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      const submitEl = el.closest('button[type="submit"], input[type="submit"]');
      if (!submitEl) return;
      const form = submitEl.closest("form");
      if (!form) return;
      reportForm(form, "click");
    },
    true
  );

  log("SENSOR_READY", { origin: location.origin }, {
    ruleId: "SENSOR_READY",
    scoreDelta: 0,
    severity: "LOW",
    evidence: { origin: location.origin, sessionId },
    targetOrigin: location.origin,
  });
})();

