function $(id) { return document.getElementById(id); }

const form = $("loginForm");
const statusEl = $("status");

function setStatus(t) { if (statusEl) statusEl.textContent = t; }

const btnProgramSubmit = $("btnProgramSubmit") || $("btnSubmit");
const btnRequestSubmit = $("btnRequestSubmit") || $("btnRequest");

btnProgramSubmit?.addEventListener("click", () => {
  if (!form) return;
  setStatus("Calling form.submit() ...");
  form.submit();
});

btnRequestSubmit?.addEventListener("click", () => {
  if (!form) return;
  setStatus("Calling form.requestSubmit() ...");
  if (typeof form.requestSubmit === "function") form.requestSubmit();
  else setStatus("requestSubmit not supported in this browser");
});

form?.addEventListener("submit", (e) => {
  setStatus("submit event fired (user submit button)");
});

(() => {
  try {
    if (!form) return;

    const submitIsNative = (() => {
      try { return Function.prototype.toString.call(HTMLFormElement.prototype.submit).includes("[native code]"); }
      catch (_) { return "unknown"; }
    })();

    const reqIsNative = (() => {
      try {
        if (typeof HTMLFormElement.prototype.requestSubmit !== "function") return "N/A";
        return Function.prototype.toString.call(HTMLFormElement.prototype.requestSubmit).includes("[native code]");
      } catch (_) { return "unknown"; }
    })();

    setStatus(`Ready.  |  prototype.submit native = ${submitIsNative}  |  prototype.requestSubmit native = ${reqIsNative}`);
  } catch (_) {}
})();

