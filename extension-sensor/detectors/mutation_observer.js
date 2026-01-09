(function () {
  function safeStr(v, max = 500) {
    try {
      const s = String(v ?? "");
      return s.length > max ? s.slice(0, max) : s;
    } catch (_) {
      return "";
    }
  }

  function tryOrigin(url) {
    try { return new URL(url).origin; } catch (_) { return ""; }
  }

  function applyRule(ruleEngine, type, data, baseMeta) {
    try {
      if (!ruleEngine) return baseMeta;
      const matched = ruleEngine.match({ type, data, ctx: {} });
      return matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;
    } catch (_) {
      return baseMeta;
    }
  }

  function scoreRegister(data) {
    const opt = data && data.options ? data.options : {};
    const target = safeStr(data && data.targetDesc ? data.targetDesc : "", 120);

    let score = 6;
    if (opt && opt.subtree) score += 6;
    if (opt && opt.childList) score += 6;
    if (opt && opt.attributes) score += 3;

    if (target === "document" || target === "documentElement" || target === "body") score += 6;

    const sev = score >= 18 ? "MEDIUM" : "LOW";
    return { score, sev };
  }

  function scoreTrigger(data) {
    const sum = data && data.summary ? data.summary : {};
    const mc = Number(sum.mutationCount || 0);
    let score = 3;

    if (mc >= 50) score += 6;
    else if (mc >= 10) score += 3;

    const sev = score >= 9 ? "MEDIUM" : "LOW";
    return { score, sev };
  }

  function start(sendLog, ruleEngine) {
    if (typeof sendLog !== "function") return;

    const lastByKey = new Map();
    const now = () => Date.now();

    function dedupe(key, windowMs) {
      const t = lastByKey.get(key) || 0;
      const n = now();
      if (n - t < windowMs) return true;
      lastByKey.set(key, n);
      return false;
    }

    window.addEventListener("message", (e) => {
      try {
        const msg = e && e.data ? e.data : null;
        if (!msg || msg.__BRS_MO__ !== true) return;

        const type = safeStr(msg.type, 60);
        const d0 = msg.data || {};
        const pageOrigin = location.origin;

        if (type === "MO_REGISTER") {
          const initiatorUrl = safeStr(d0.initiatorUrl, 300);
          const initiatorOrigin = d0.initiatorOrigin ? safeStr(d0.initiatorOrigin, 120) : tryOrigin(initiatorUrl);
          const initiatorCrossSite =
            typeof d0.initiatorCrossSite === "boolean"
              ? d0.initiatorCrossSite
              : !!(initiatorOrigin && initiatorOrigin !== pageOrigin);

          const eventData = {
            observerId: safeStr(d0.observerId, 80),
            targetDesc: safeStr(d0.targetDesc, 140),
            options: d0.options || {},
            initiatorUrl,
            initiatorOrigin,
            initiatorCrossSite,
            stackHead: safeStr(d0.stackHead, 240),
            createdAt: Number(d0.createdAt || 0) || 0,
          };

          const ddKey =
            "R|" +
            eventData.observerId + "|" +
            eventData.targetDesc + "|" +
            JSON.stringify(eventData.options || {}).slice(0, 200) + "|" +
            eventData.initiatorOrigin;

          if (dedupe(ddKey, 800)) return;

          const s = scoreRegister(eventData);

          const baseMeta = {
            ruleId: "MUTATION_OBSERVER_REGISTER",
            scoreDelta: s.score,
            severity: s.sev,
            targetOrigin: initiatorOrigin || "",
            evidence: eventData
          };

          const meta = applyRule(ruleEngine, "MUTATION_OBSERVER_REGISTER", eventData, baseMeta);
          sendLog("MUTATION_OBSERVER_REGISTER", eventData, meta);
          return;
        }

        if (type === "MO_TRIGGER") {
          const initiatorUrl = safeStr(d0.initiatorUrl, 300);
          const initiatorOrigin = d0.initiatorOrigin ? safeStr(d0.initiatorOrigin, 120) : tryOrigin(initiatorUrl);
          const initiatorCrossSite =
            typeof d0.initiatorCrossSite === "boolean"
              ? d0.initiatorCrossSite
              : !!(initiatorOrigin && initiatorOrigin !== pageOrigin);

          const eventData = {
            observerId: safeStr(d0.observerId, 80),
            targetDesc: safeStr(d0.targetDesc, 140),
            summary: d0.summary || {},
            initiatorUrl,
            initiatorOrigin,
            initiatorCrossSite,
            stackHead: safeStr(d0.stackHead, 240),
            dtMs: (typeof d0.dtMs === "number" ? d0.dtMs : null),
          };

          const ddKey = "T|" + eventData.observerId + "|" + safeStr(eventData.targetDesc, 60);
          if (dedupe(ddKey, 300)) return;

          const s = scoreTrigger(eventData);

          const baseMeta = {
            ruleId: "MUTATION_OBSERVER_TRIGGER",
            scoreDelta: s.score,
            severity: s.sev,
            targetOrigin: initiatorOrigin || "",
            evidence: eventData
          };

          const meta = applyRule(ruleEngine, "MUTATION_OBSERVER_TRIGGER", eventData, baseMeta);
          sendLog("MUTATION_OBSERVER_TRIGGER", eventData, meta);
          return;
        }
      } catch (_) {}
    }, true);
  }

  window.BRS_Detectors = window.BRS_Detectors || {};
  window.BRS_Detectors.mutationObserver = { start };
})();