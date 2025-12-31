(function () {
  function toAbsUrl(raw) {
    if (!raw) return "";
    try { return new URL(raw, location.href).href; } catch { return raw; }
  }

  function getOrigin(url) {
    try { return new URL(url).origin; } catch { return ""; }
  }

  function isCrossSite(targetOrigin) {
    return targetOrigin && targetOrigin !== location.origin;
  }

  function isInternalNode(el) {
    if (!el || !(el instanceof HTMLElement)) return false;

    // 우리가 inject할 때 붙이는 마커
    if (el.getAttribute && el.getAttribute("data-brs-internal") === "1") return true;

    // src가 확장 리소스면 내부로 간주
    const src = (el.getAttribute && el.getAttribute("src")) || "";
    if (src.startsWith("chrome-extension://") || src.startsWith("moz-extension://")) return true;

    return false;
  }

  function start(sendLog, ruleEngine) {
    // (추가) 초기 스캔: 이미 DOM에 존재하는 script/iframe도 1회 감지
    try {
      // SCRIPT 초기 스캔
      document.querySelectorAll("script[src]").forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.tagName !== "SCRIPT") return;
        if (isInternalNode(n)) return;

        const src = n.getAttribute("src");
        if (!src) return;

        const abs = toAbsUrl(src);
        if (abs.startsWith("chrome-extension://") || abs.startsWith("moz-extension://")) return;

        const targetOrigin = getOrigin(abs);
        const crossSite = isCrossSite(targetOrigin);

        const baseMeta = {
          ruleId: crossSite ? "DYN_SCRIPT_INSERT_CROSS_SITE" : "DYN_SCRIPT_INSERT_SAME_SITE",
          scoreDelta: crossSite ? 20 : 5,
          severity: "LOW",
          targetOrigin,
          evidence: { src, abs, crossSite, targetOrigin, phase: "initial_scan" }
        };

        const matched = ruleEngine ? ruleEngine.match({ type: "DYN_SCRIPT_INSERT", data: { src, abs, crossSite }, ctx: {} }) : null;
        const meta = matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;

        sendLog("DYN_SCRIPT_INSERT", { src, abs, crossSite }, meta);
      });

      // IFRAME 초기 스캔
      document.querySelectorAll("iframe").forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.tagName !== "IFRAME") return;
        if (isInternalNode(n)) return;

        const src = n.src || n.getAttribute("src") || "";
        const abs = toAbsUrl(src);
        if (abs.startsWith("chrome-extension://") || abs.startsWith("moz-extension://")) return;

        const targetOrigin = getOrigin(abs);
        const crossSite = isCrossSite(targetOrigin);

        const style = (n.getAttribute("style") || "").toLowerCase();
        const hidden =
          n.hidden ||
          style.includes("display: none") ||
          style.includes("visibility: hidden") ||
          style.includes("opacity: 0") ||
          (n.width == 0 || n.height == 0) ||
          style.includes("left: -") || style.includes("top: -");

        const scoreDelta = (hidden ? 25 : 10) + (crossSite ? 10 : 0);

        const baseMeta = {
          ruleId: hidden ? "HIDDEN_IFRAME_INSERT" : "IFRAME_INSERT",
          scoreDelta,
          severity: scoreDelta >= 35 ? "HIGH" : scoreDelta >= 20 ? "MEDIUM" : "LOW",
          targetOrigin,
          evidence: { src, abs, crossSite, hidden, targetOrigin, phase: "initial_scan" }
        };

        const matched = ruleEngine ? ruleEngine.match({ type: "DYN_IFRAME_INSERT", data: { src, abs, crossSite, hidden }, ctx: {} }) : null;
        const meta = matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;

        sendLog("DYN_IFRAME_INSERT", { src, abs, crossSite, hidden }, meta);
      });
    } catch (_) {}

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;

          // SCRIPT 감지
          if (n.tagName === "SCRIPT") {
            if (isInternalNode(n)) continue;

            const src = n.getAttribute("src");
            if (!src) continue;

            const abs = toAbsUrl(src);
            if (abs.startsWith("chrome-extension://") || abs.startsWith("moz-extension://")) continue;

            const targetOrigin = getOrigin(abs);
            const crossSite = isCrossSite(targetOrigin);

            const baseMeta = {
              ruleId: crossSite ? "DYN_SCRIPT_INSERT_CROSS_SITE" : "DYN_SCRIPT_INSERT_SAME_SITE",
              scoreDelta: crossSite ? 20 : 5,
              severity: "LOW",
              targetOrigin,
              evidence: { src, abs, crossSite, targetOrigin }
            };

            const matched = ruleEngine ? ruleEngine.match({ type: "DYN_SCRIPT_INSERT", data: { src, abs, crossSite }, ctx: {} }) : null;
            const meta = matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;

            sendLog("DYN_SCRIPT_INSERT", { src, abs, crossSite }, meta);
          }

          // IFRAME 감지
          if (n.tagName === "IFRAME") {
            if (isInternalNode(n)) continue;

            const src = n.src || n.getAttribute("src") || "";
            const abs = toAbsUrl(src);
            if (abs.startsWith("chrome-extension://") || abs.startsWith("moz-extension://")) continue;

            const targetOrigin = getOrigin(abs);
            const crossSite = isCrossSite(targetOrigin);

            const style = (n.getAttribute("style") || "").toLowerCase();
            const hidden =
              n.hidden ||
              style.includes("display: none") ||
              style.includes("visibility: hidden") ||
              style.includes("opacity: 0") ||
              (n.width == 0 || n.height == 0) ||
              style.includes("left: -") || style.includes("top: -");

            const scoreDelta = (hidden ? 25 : 10) + (crossSite ? 10 : 0);

            const baseMeta = {
              ruleId: hidden ? "HIDDEN_IFRAME_INSERT" : "IFRAME_INSERT",
              scoreDelta,
              severity: scoreDelta >= 35 ? "HIGH" : scoreDelta >= 20 ? "MEDIUM" : "LOW",
              targetOrigin,
              evidence: { src, abs, crossSite, hidden, targetOrigin }
            };

            const matched = ruleEngine ? ruleEngine.match({ type: "DYN_IFRAME_INSERT", data: { src, abs, crossSite, hidden }, ctx: {} }) : null;
            const meta = matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;

            sendLog("DYN_IFRAME_INSERT", { src, abs, crossSite, hidden }, meta);
          }
        }
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.BRS_Detectors = window.BRS_Detectors || {};
  window.BRS_Detectors.domMutation = { start };
})();
