function $(id) { return document.getElementById(id); }

$("btnScript").addEventListener("click", () => {
  const s = document.createElement("script");
  s.src = "https://example.com/analytics.js?ts=" + Date.now();
  s.async = true;
  document.head.appendChild(s);

  alert("Injected <script src=...> (PoC)");
});

$("btnIframe").addEventListener("click", () => {
  const f = document.createElement("iframe");
  f.src = "https://example.com/frame?ts=" + Date.now();
  f.style.width = "1px";
  f.style.height = "1px";
  f.style.position = "absolute";
  f.style.left = "-9999px";
  f.style.top = "-9999px";
  document.body.appendChild(f);

  alert("Injected hidden <iframe> (PoC)");
});

$("btnEval").addEventListener("click", () => {
  // harmless payload: just logs to console
  const b64 = "Y29uc29sZS5sb2coJ1BPQyBmdW5jdGlvbiBleGVjdXRlZCcpOw==";
  const code = atob(b64);

  const fn = new Function(code);
  fn();

  alert("Executed atob → Function pattern (PoC)");
});

