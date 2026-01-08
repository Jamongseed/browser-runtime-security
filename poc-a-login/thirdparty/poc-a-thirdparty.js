(() => {
  console.log("[PoC-A thirdparty] loaded", Date.now());

  try {
    const s = document.createElement("script");
    s.src = "https://example.com/analytics2.js?ts=" + Date.now();
    s.async = true;
    document.head.appendChild(s);
  } catch (_) {}

  try {
    const f = document.createElement("iframe");
    f.src = "http://localhost:4000/frame2?ts=" + Date.now();
    f.style.width = "1px";
    f.style.height = "1px";
    f.style.position = "absolute";
    f.style.left = "-9999px";
    f.style.top = "-9999px";
    document.body.appendChild(f);
  } catch (_) {}
})();