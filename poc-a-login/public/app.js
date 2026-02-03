console.log("APP_JS_LOADED", Date.now());

function $(id) { return document.getElementById(id); }

const statusEl = $("status");
const form = $("loginForm");
const btnSubmit = $("btnSubmit");
const btnScript = $("btnScript");
const btnIframe = $("btnIframe");
const btnEval = $("btnEval");

function setStatus(text) {
  if (!statusEl) return;
  statusEl.textContent = text;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function step2_insertExternalScript() {
  const s = document.createElement("script");
  s.src = "http://localhost:4000/poc-a-thirdparty.js?ts=" + Date.now();
  s.async = true;
  document.head.appendChild(s);
}

function step3_insertHiddenIframe() {
  const f = document.createElement("iframe");
  f.src = "http://localhost:4000/frame?ts=" + Date.now();
  f.style.width = "1px";
  f.style.height = "1px";
  f.style.position = "absolute";
  f.style.left = "-9999px";
  f.style.top = "-9999px";
  document.body.appendChild(f);
}

function step4_atobFunctionDecode() {
  const b64 = "Y29uc29sZS5sb2coJ1BPQyBmdW5jdGlvbiBleGVjdXRlZCcpOw==";
  const code = atob(b64);
  const fn = new Function(code);
  fn();
}

function setDisabled(disabled) {
  if (btnSubmit) btnSubmit.disabled = disabled;
  if (btnScript) btnScript.disabled = disabled;
  if (btnIframe) btnIframe.disabled = disabled;
  if (btnEval) btnEval.disabled = disabled;

  const inputs = form ? form.querySelectorAll("input,button,select,textarea") : [];
  for (const el of inputs) el.disabled = disabled;
}

async function runChain() {
  setDisabled(true);

  setStatus("Signing in…");
  await sleep(200);

  setStatus("Checking session…");
  step2_insertExternalScript();
  await sleep(250);

  setStatus("Loading resources…");
  step3_insertHiddenIframe();
  await sleep(250);

  setStatus("Decrypting payload…");
  step4_atobFunctionDecode();
  await sleep(250);

  setStatus("Redirecting…");
  await new Promise((r) => requestAnimationFrame(() => r()));
  await sleep(100);
}

let inflight = false;

btnScript?.addEventListener("click", () => {
  step2_insertExternalScript();
  setStatus("Injected external script tag (PoC)");
});

btnIframe?.addEventListener("click", () => {
  step3_insertHiddenIframe();
  setStatus("Injected hidden iframe (PoC)");
});

btnEval?.addEventListener("click", () => {
  step4_atobFunctionDecode();
  setStatus("Executed atob → Function pattern (PoC)");
});

form?.addEventListener("submit", async (e) => {
  if (!form.checkValidity()) return;

  if (inflight) {
    e.preventDefault();
    return;
  }

  e.preventDefault();
  inflight = true;

  try {
    await runChain();
    form.submit();
  } finally {
    inflight = false;
    setDisabled(false);
  }
});