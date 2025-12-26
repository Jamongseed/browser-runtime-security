(function () {
  function getOrigin(url) {
    try { return new URL(url).origin; } catch { return ""; }
  }

  let lastClickForm = null;
  let lastClickTs = 0;

  function reportForm(sendLog, ruleEngine, form, via) {
    if (!(form instanceof HTMLFormElement)) return;

    const actionAttr = form.getAttribute("action") || "";
    const actionResolved = form.action;
    const actionOrigin = getOrigin(actionResolved);
    const mismatch = actionOrigin && actionOrigin !== location.origin;

    const data = {
      via,
      actionAttr,
      actionResolved,
      actionOrigin,
      pageOrigin: location.origin,
      mismatch
    };

    if (!actionOrigin) {
      sendLog("FORM_SUBMIT", {
        via,
        actionAttr,
        actionResolved,
        parse: "fail"
      }, {
        ruleId: "FORM_ACTION_PARSE_FAIL",
        scoreDelta: 10,
        severity: "MEDIUM",
        targetOrigin: "UNKNOWN",
        evidence: { via, actionAttr, actionResolved }
      });
      return;
    }

    const baseMeta = {
      ruleId: mismatch ? "PHISHING_FORM_MISMATCH" : "FORM_ACTION_MATCH",
      scoreDelta: mismatch ? 50 : 5,
      severity: mismatch ? "HIGH" : "LOW",
      targetOrigin: actionOrigin,
      evidence: data
    };

    const matched = ruleEngine ? ruleEngine.match({ type: "FORM_SUBMIT", data, ctx: {} }) : null;
    const meta = matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;

    sendLog("FORM_SUBMIT", data, meta);
  }

  function start(sendLog, ruleEngine) {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("button[type='submit'], input[type='submit']");
      if (btn && btn.form) {
        lastClickForm = btn.form;
        lastClickTs = Date.now();
      }
    }, true);

    document.addEventListener("submit", (e) => {
      const form = e.target;

      // 같은 phase에서 우리 리스너가 먼저 실행될 수 있으니,
      // 이벤트 핸들러 체인이 다 돈 뒤(페이지 코드가 preventDefault했는지 확정된 뒤)에 판단
      setTimeout(() => {
        if (e.defaultPrevented) return;

        let via = "submit";
        if (lastClickForm === form && (Date.now() - lastClickTs) < 1500) {
          via = "click";
        }

        reportForm(sendLog, ruleEngine, form, via);
      }, 0);
    }, false);
  }

  window.BRS_Detectors = window.BRS_Detectors || {};
  window.BRS_Detectors.forms = { start };
})();
