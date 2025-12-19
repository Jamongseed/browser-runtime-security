(function () {
  function sendEvent(type, data) {
    fetch("http://localhost:8080/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        data,
        origin: location.origin,
        page: location.href,
        ua: navigator.userAgent,
        ts: Date.now(),
      }),
    }).catch(() => {});
  }

  function log(type, data) {
    console.log("[BRS]", type, data);
    sendEvent(type, data);
  }

  function toAbsUrl(raw) {
    if (!raw) return "";
    try {
      return new URL(raw, location.href).href;
    } catch {
      return raw;
    }
  }

  function isCrossSite(absUrl) {
    if (!absUrl) return false;
    try {
      return new URL(absUrl).origin !== location.origin;
    } catch {
      return false;
    }
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
    log(d.type, d.data || {});
  });

  injectPageHooks();

  const mo = new MutationObserver((mutList) => {
    for (const m of mutList) {
      for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;

        if (n.tagName === "SCRIPT") {
          const src = n.getAttribute("src") || "";
          const abs = toAbsUrl(src);
          log("DYN_SCRIPT_INSERT", { src, abs, crossSite: isCrossSite(abs) });
        }

        if (n.tagName === "IFRAME") {
          const src = n.getAttribute("src") || "";
          const abs = toAbsUrl(src);
          const style = (n.getAttribute("style") || "").toLowerCase();
          const hidden =
            style.includes("left: -9999") ||
            style.includes("display: none") ||
            style.includes("visibility: hidden");
          log("DYN_IFRAME_INSERT", { src, abs, crossSite: isCrossSite(abs), hidden });
        }
      }
    }
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });

  function reportForm(form, via) {
    if (!(form instanceof HTMLFormElement)) return;
    const actionAttr = form.getAttribute("action") || "";
    const actionResolved = form.action || "";
    try {
      const a = new URL(actionResolved);
      const mismatch = a.origin !== location.origin;
      log("FORM_SUBMIT", {
        via,
        actionAttr,
        actionResolved,
        actionOrigin: a.origin,
        pageOrigin: location.origin,
        mismatch,
      });
    } catch {
      log("FORM_SUBMIT", { via, actionAttr, actionResolved, parse: "fail" });
    }
  }

  document.addEventListener(
    "submit",
    (e) => {
      reportForm(e.target, "submit");
      //e.preventDefault();
      //log("SUBMIT_BLOCKED_FOR_DEBUG", { note: "navigation prevented" });
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

  log("SENSOR_READY", { origin: location.origin });
})();

