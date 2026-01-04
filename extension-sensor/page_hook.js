// page_hook.js
(() => {
  const send = (type, data) => {
    window.postMessage({ __BRS__: true, type, data }, "*");
  };

  // (복구) stack 수집: SW_REGISTER 이벤트에서 evidence.stack을 담기 위해 사용
  const getStack = () => {
    try {
      const stack = new Error().stack || "";

      const lines = stack.split("\n");

      const callerLine = lines.find(line =>
        line.includes("at ") &&
        !line.includes("getStack") &&
        !line.includes("window.") &&
        !line.includes("<anonymous>")
      );

      return callerLine ? callerLine.trim() : stack.slice(0, 300);

    } catch (e) {
      return "unknown";
    }
  };

  try {
    const _eval = window.eval;
    window.eval = function (code) {
      const strCode = String(code || "");
      send("SUSP_EVAL_CALL", { 
        len: strCode.length, 
        payload: strCode.slice(0, 100),
        // url: window.location.href,
        // stack: getStack()
      });
      return _eval.apply(this, arguments);
    };
  } catch (e) {
    send("HOOK_ERROR", { where: "eval", msg: String(e?.message || e) });
  }

  try {
    const _atob = window.atob;
    window.atob = function (encodedString) {
      const strEncoded = String(encodedString || "");
      send("SUSP_ATOB_CALL", { 
        len: strEncoded.length,
        payload: strEncoded.slice(0, 30),
        // url: window.location.href,
        // stack: getStack()
      });
      return _atob.apply(this, arguments);
    };
  } catch (e) {
    send("HOOK_ERROR", { where: "atob", msg: String(e?.message || e) });
  }

  try {
    const _Function = window.Function;
    window.Function = function (...args) {
      const strArgs = args.join(", ");
      send("SUSP_FUNCTION_CONSTRUCTOR_CALL", { 
        len: strArgs.length,
        payload: strArgs.slice(0, 100),
        // url: window.location.href,
        // stack: getStack()
      });
      return _Function.apply(this, args);
    };

    window.Function.prototype = _Function.prototype;
  } catch (e) {
    send("HOOK_ERROR", { where: "Function", msg: String(e?.message || e) });
  }

  // (추가) Network 후킹: sendBeacon / fetch 로 외부 유출(collect) 시그널을 런타임에서 포착
  //  - content.js에서 SUSP_NETWORK_CALL을 NETWORK_LEAK으로 매핑해 collector에 찍히게 된다
  try {
    const toAbsUrl = (raw) => {
      if (!raw) return "";
      try { return new URL(String(raw), location.href).href; } catch { return String(raw); }
    };
    const getOrigin = (url) => {
      try { return new URL(url).origin; } catch { return ""; }
    };
    const isCrossSite = (targetOrigin) => targetOrigin && targetOrigin !== location.origin;

    // (1) navigator.sendBeacon
    if (navigator && typeof navigator.sendBeacon === "function" && !navigator.sendBeacon.__BRS_PATCHED__) {
      const _sendBeacon = navigator.sendBeacon.bind(navigator);

      const patched = function (url, data) {
        try {
          const abs = toAbsUrl(url);
          const targetOrigin = getOrigin(abs);

          let size = 0;
          try {
            if (typeof data === "string") size = data.length;
            else if (data && typeof data.size === "number") size = data.size; // Blob
            else if (data && typeof data.byteLength === "number") size = data.byteLength; // ArrayBuffer
          } catch (_) {}

          send("SUSP_NETWORK_CALL", {
            api: "sendBeacon",
            url: String(url || ""),
            abs,
            targetOrigin,
            crossSite: isCrossSite(targetOrigin),
            size,
          });
        } catch (_) {}

        return _sendBeacon(url, data);
      };

      patched.__BRS_PATCHED__ = true;
      // configurable 여부는 브라우저마다 다를 수 있어서 try/catch로 방어
      try { navigator.sendBeacon = patched; } catch (_) {}
      try { Object.defineProperty(navigator.sendBeacon, "__BRS_PATCHED__", { value: true }); } catch (_) {}
    }

    // (2) window.fetch
    if (typeof window.fetch === "function" && !window.fetch.__BRS_PATCHED__) {
      const _fetch = window.fetch.bind(window);

      const patched = function (input, init) {
        try {
          const rawUrl = (typeof input === "string")
            ? input
            : (input && typeof input.url === "string" ? input.url : "");

          const abs = toAbsUrl(rawUrl);
          const targetOrigin = getOrigin(abs);

          send("SUSP_NETWORK_CALL", {
            api: "fetch",
            url: String(rawUrl || ""),
            abs,
            targetOrigin,
            crossSite: isCrossSite(targetOrigin),
            method: String((init && init.method) || (input && input.method) || "GET"),
            mode: String((init && init.mode) || (input && input.mode) || ""),
          });
        } catch (_) {}

        return _fetch(input, init);
      };

      patched.__BRS_PATCHED__ = true;
      window.fetch = patched;
      try { window.fetch.__BRS_PATCHED__ = true; } catch (_) {}
    }
  } catch (e) {
    send("HOOK_ERROR", { where: "network", msg: String(e?.message || e) });
  }

  // (추가) form.submit / form.requestSubmit 후킹: form.submit()은 submit 이벤트를 발생시키지 않아 content-script form detector가 놓치는 케이스 보완
  try {
    const getOrigin = (url) => {
      try { return new URL(url, location.href).origin; } catch { return ""; }
    };

    const ORIG_SUBMIT = HTMLFormElement.prototype.submit;

    if (ORIG_SUBMIT && !ORIG_SUBMIT.__BRS_PATCHED__) {
      // (추가) 감싸기 직전 ORIG_SUBMIT이 non-native면: 외부(서드파티) 선행 변조로 판별
      try {
        const _isNative = Function.prototype.toString.call(ORIG_SUBMIT).includes("[native code]");
        if (!_isNative) {
          send("FORM_PROTO_TAMPER", {
            prop: "submit",
            origIsNative: false,
            origHead: Function.prototype.toString.call(ORIG_SUBMIT).slice(0, 200),
          });
        }
      } catch (_) {}

      HTMLFormElement.prototype.submit = function () {
        try {
          const actionAttr = this.getAttribute("action") || "";
          const actionResolved = this.action || "";
          const actionOrigin = getOrigin(actionResolved);

          send("FORM_NATIVE_SUBMIT", {
            via: "native_submit",
            actionAttr,
            actionResolved,
            actionOrigin,
            pageOrigin: location.origin,
            mismatch: !!(actionOrigin && actionOrigin !== location.origin),
          });
        } catch (_) {}

        return ORIG_SUBMIT.apply(this, arguments);
      };

      HTMLFormElement.prototype.submit.__BRS_PATCHED__ = true;

      // (추가) BRS wrapper가 감싸기 직전의 원본 참조 저장 (외부 선행 변조 판별용)
      HTMLFormElement.prototype.submit.__BRS_ORIG__ = ORIG_SUBMIT;
      try {
        HTMLFormElement.prototype.submit.__BRS_ORIG_IS_NATIVE__ =
          Function.prototype.toString.call(ORIG_SUBMIT).includes("[native code]");
      } catch (_) {}
    }
  } catch (e) {
    send("HOOK_ERROR", { where: "HTMLFormElement.submit", msg: String(e?.message || e) });
  }

  try {
    const getOrigin = (url) => {
      try { return new URL(url, location.href).origin; } catch { return ""; }
    };

    const ORIG_REQ = HTMLFormElement.prototype.requestSubmit;

    if (typeof ORIG_REQ === "function" && !ORIG_REQ.__BRS_PATCHED__) {
      // (추가) 감싸기 직전 ORIG_REQ가 non-native면: 외부(서드파티) 선행 변조로 판별
      try {
        const _isNative = Function.prototype.toString.call(ORIG_REQ).includes("[native code]");
        if (!_isNative) {
          send("FORM_PROTO_TAMPER", {
            prop: "requestSubmit",
            origIsNative: false,
            origHead: Function.prototype.toString.call(ORIG_REQ).slice(0, 200),
          });
        }
      } catch (_) {}

      HTMLFormElement.prototype.requestSubmit = function () {
        try {
          const actionAttr = this.getAttribute("action") || "";
          const actionResolved = this.action || "";
          const actionOrigin = getOrigin(actionResolved);

          send("FORM_NATIVE_SUBMIT", {
            via: "requestSubmit",
            actionAttr,
            actionResolved,
            actionOrigin,
            pageOrigin: location.origin,
            mismatch: !!(actionOrigin && actionOrigin !== location.origin),
          });
        } catch (_) {}

        return ORIG_REQ.apply(this, arguments);
      };

      HTMLFormElement.prototype.requestSubmit.__BRS_PATCHED__ = true;

      // (추가) BRS wrapper가 감싸기 직전의 원본 참조 저장 (외부 선행 변조 판별용)
      HTMLFormElement.prototype.requestSubmit.__BRS_ORIG__ = ORIG_REQ;
      try {
        HTMLFormElement.prototype.requestSubmit.__BRS_ORIG_IS_NATIVE__ =
          Function.prototype.toString.call(ORIG_REQ).includes("[native code]");
      } catch (_) {}
    }
  } catch (e) {
    send("HOOK_ERROR", { where: "HTMLFormElement.requestSubmit", msg: String(e?.message || e) });
  }

  console.log("[BRS_HOOK] Monitoring injection complete.");
})();