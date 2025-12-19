(() => {
  const send = (type, data) => {
    window.postMessage({ __BRS__: true, type, data }, "*");
  };

  try {
    const _atob = window.atob;
    window.atob = function (...args) {
      send("SUSP_ATOB_CALL", { len: String(args[0] || "").length });
      return _atob.apply(this, args);
    };
  } catch (e) {
    send("HOOK_ERROR", { where: "atob", msg: String(e?.message || e) });
  }

  try {
    const _Function = window.Function;
    window.Function = function (...args) {
      send("SUSP_FUNCTION_CALL", { argc: args.length });
      return _Function.apply(this, args);
    };
  } catch (e) {
    send("HOOK_ERROR", { where: "Function", msg: String(e?.message || e) });
  }
})();

