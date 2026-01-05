(() => {
  const send = (type, data) => {
    try { window.postMessage({ __BRS__: true, type, data }, "*"); } catch (_) {}
  };

  const getStack = () => {
    try { return (new Error().stack || "").slice(0, 600); } catch (_) { return "unknown"; }
  };

  const toAbsUrl = (raw) => { try { return new URL(String(raw), location.href).href; } catch { return String(raw || ""); } };
  const getOrigin = (url) => { try { return new URL(url).origin; } catch { return ""; } };
  const isCrossSite = (targetOrigin) => targetOrigin && targetOrigin !== location.origin;

  let protoPatched = false;

  try {
    if (!navigator || !navigator.serviceWorker) {
      send("BRS_SW_BOOT_READY", { ok: true, protoPatched: false, reason: "no_serviceWorker" });
      return;
    }

    const proto = ServiceWorkerContainer && ServiceWorkerContainer.prototype;
    if (proto && typeof proto.register === "function" && !proto.register.__BRS_PATCHED__) {
      const orig = proto.register;

      function patched(scriptURL, options) {
        try {
          const stack = getStack();
          const abs = toAbsUrl(scriptURL);
          const targetOrigin = getOrigin(abs);
          const scope = (options && typeof options.scope === "string") ? options.scope : "";

          send("SW_REGISTER", {
            scriptURL: String(scriptURL || ""),
            abs,
            scope,
            targetOrigin,
            crossSite: isCrossSite(targetOrigin),
            stack,
            evidence: { stack },
          });
        } catch (_) {}

        return orig.apply(this, arguments);
      }

      try { Object.defineProperty(patched, "__BRS_PATCHED__", { value: true }); } catch (_) { patched.__BRS_PATCHED__ = true; }
      try { Object.defineProperty(orig, "__BRS_ORIG__", { value: orig }); } catch (_) {}

      proto.register = patched;
      protoPatched = true;
    }

    send("BRS_SW_BOOT_READY", { ok: true, protoPatched });
  } catch (e) {
    send("HOOK_ERROR", { where: "page_hook_sw_boot", msg: String((e && e.message) || e) });
    send("BRS_SW_BOOT_READY", { ok: false, protoPatched });
  }
})();