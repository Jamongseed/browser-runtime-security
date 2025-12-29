(() => {
  const send = (type, data) => {
    window.postMessage({ __BRS__: true, type, data }, "*");
  };

  // const getStack = () => {
  //   try {
  //     const stack = new Error().stack || "";
      
  //     const lines = stack.split("\n");

  //     const callerLine = lines.find(line => 
  //       line.includes("at ") && 
  //       !line.includes("getStack") &&
  //       !line.includes("window.") && 
  //       !line.includes("<anonymous>") 
  //     );

  //     return callerLine ? callerLine.trim() : stack.slice(0, 300);

  //   } catch (e) {
  //     return "unknown";
  //   }
  // };

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

  console.log("[BRS_HOOK] Monitoring injection complete.");
})();