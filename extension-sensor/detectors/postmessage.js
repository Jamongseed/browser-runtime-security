(function () {
  function start(sendLog, ruleEngine) {
    if (typeof sendLog !== "function") return;

    function applyRule(type, data, baseMeta) {
      try {
        if (!ruleEngine) return baseMeta;
        const matched = ruleEngine.match({ type, data, ctx: {} });
        return matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;
      } catch (_) {
        return baseMeta;
      }
    }

    window.addEventListener("message", (e) => {
      try {
        const origin = e.origin || "";
        const data = e.data || {};

        if (origin !== "http://localhost:4000") return;
        if (data.type !== "AD_INTERACTION") return;
        if (data.action !== "ARM_FORM_SWAP") return;

        const eventData = {
          origin,
          type: data.type,
          action: data.action,
          payload: data.payload || null
        };

        const baseMeta = {
          ruleId: "THIRDPARTY_WIDGET_ARMED",
          scoreDelta: 15,
          severity: "MEDIUM",
          targetOrigin: origin,
          evidence: eventData
        };

        const meta = applyRule("THIRDPARTY_POSTMESSAGE_ARM", eventData, baseMeta);
        sendLog("THIRDPARTY_POSTMESSAGE_ARM", eventData, meta);
      } catch (_) {}
    }, true);
  }

  window.BRS_Detectors = window.BRS_Detectors || {};
  window.BRS_Detectors.postMessage = { start };
})();
