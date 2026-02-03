(function () {
  function _makeSessionId() {
    try {
      if (typeof crypto !== "undefined" && crypto && crypto.randomUUID) {
        return crypto.randomUUID();
      }
    } catch (_) { }
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

      const d = data || {};

      // (추가) evidence 보강:
      //  - meta.evidence가 비어있고, data.stack 또는 data.evidence.stack이 있으면 evidence.stack으로 승격
      //  - page_hook에서 SW_REGISTER에 stack을 넣어 보내는 경우, content.js 변경 없이도 payload.evidence.stack이 채워질 수 있게 함
      let evidence = m.evidence || {};
      try {
        const hasEvidence =
          evidence && typeof evidence === "object" && Object.keys(evidence).length > 0;

        if (!hasEvidence) {
          const stackFromData =
            (d && typeof d === "object" && typeof d.stack === "string" && d.stack) ||
            (d && typeof d === "object" && d.evidence && typeof d.evidence.stack === "string" && d.evidence.stack) ||
            "";

          if (stackFromData) {
            evidence = { stack: String(stackFromData).slice(0, 2000) };
          }
        }
      } catch (_) { }

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

        data: d,
        evidence: evidence
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
