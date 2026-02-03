const statusEl = document.getElementById("status");
const INJECT_SRC = "http://localhost:4000/loader.js";
const REINJECT_COOLDOWN_MS = 2500;

let lastInjectAt = 0;

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function injectOnce() {
  const now = Date.now();

  if (now - lastInjectAt < REINJECT_COOLDOWN_MS) {
    console.log("재주입 쿨다운 중입니다.");
    return;
  }
  lastInjectAt = now;

  const s = document.createElement("script");
  s.src = `${INJECT_SRC}?ts=${now}`;
  s.async = true;
  s.onload = () => setStatus("Loader loaded (stage2 should run)");
  s.onerror = () => setStatus("Loader load error");
  document.head.appendChild(s);

  setStatus("Injecting loader.js …");
}

const obs = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const n of m.removedNodes) {
      if (n && n.nodeType === 1 && n.id === "adWidgetContainer") {
        setStatus("Ad closed detected → injecting …");
        injectOnce();
      }

      if (n && n.nodeType === 1 && n.id === "pocH_stage2") {
        setStatus("Stage2 removed detected → reinjecting …");
        window.postMessage(
          {
            __BRS__: true,
            type: "PERSISTENCE_REINJECT",
            data: {
              reason: "stage2_removed",
              markerId: "pocH_stage2",
              injectSrc: INJECT_SRC,
              cooldownMs: REINJECT_COOLDOWN_MS,
              ts: Date.now()
            }
          },
          "*"
        );
        injectOnce();
      }
    }
  }
});
document.addEventListener("DOMContentLoaded", () => {
  setStatus("Ready. (waiting for ad close)");
  obs.observe(document.documentElement, { childList: true, subtree: true });
});

