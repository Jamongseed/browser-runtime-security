(() => {
  const send = (type, data) => {
    window.postMessage({ __BRS__: true, type, data }, "*");
  };

  try {
    const _eval = window.eval;
    window.eval = function (code) {
      send("SUSP_FUNCTION_CALL", { 
        func: "eval", 
        payload: String(code || "").slice(0, 100) 
      });
      return _eval.apply(this, arguments);
    };
  } catch (e) {
    send("HOOK_ERROR", { where: "eval", msg: e.message });
  }

  try {
    const _atob = window.atob;
    window.atob = function (str) {
      send("SUSP_ATOB_CALL", { 
        len: (str || "").length,
        preview: String(str || "").slice(0, 30)
      });
      return _atob.apply(this, arguments);
    };
  } catch (e) {
    send("HOOK_ERROR", { where: "atob", msg: e.message });
  }

  try {
    const _Function = window.Function;
    window.Function = function (...args) {
      send("SUSP_FUNCTION_CALL", { 
        func: "Function", 
        payload: args.join(", ").slice(0, 100) 
      });
      return _Function.apply(this, args);
    };

    window.Function.prototype = _Function.prototype;
  } catch (e) {
    send("HOOK_ERROR", { where: "Function", msg: e.message });
  }

  console.log("[BRS_HOOK] Monitoring injection complete.");
})();