(function () {
  function _makeSessionId() {
    try {
      if (typeof crypto !== "undefined" && crypto && crypto.randomUUID) {
        return crypto.randomUUID();
      }
    } catch (_) {}
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function _getSeverity(scoreDelta) {
    if (scoreDelta >= 50) return "HIGH";
    if (scoreDelta >= 25) return "MEDIUM";
    return "LOW";
  }

  function createReporter(opts) {
    const sessionId = (opts && opts.sessionId) ? opts.sessionId : _makeSessionId();

    function send(type, data, meta) {
      const m = meta || {};
      const scoreDelta = m.scoreDelta || 0;

      const payload = {
        type,
        ruleId: m.ruleId || type,
        sessionId,
        ts: Date.now(),

        page: location.href,
        origin: location.origin,
        targetOrigin: m.targetOrigin || "",
        ua: navigator.userAgent,

        severity: m.severity || _getSeverity(scoreDelta),
        scoreDelta,

        data: data || {},
        evidence: m.evidence || {}
      };

      console.log(`[BRS] ${type}`, payload);

      try {
        chrome.runtime.sendMessage({ action: "REPORT_THREAT", data: payload });
      } catch (e) {
        console.debug("[BRS] sendMessage failed:", String(e?.message || e));
      }
    }

    return { sessionId, send };
  }

  window.BRS_Reporter = { createReporter };
})();
