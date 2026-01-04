function $(id) { return document.getElementById(id); }

const pageOriginEl = $("pageOrigin");
const swStateEl = $("swState");
const lastApiEl = $("lastApi");
const outEl = $("out");

const btnCheck = $("btnCheck");
const btnRaw = $("btnRaw");
const btnReset = $("btnReset");

pageOriginEl.textContent = location.origin;

function pretty(obj) {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
}

async function refreshSwState() {
  try {
    if (!("serviceWorker" in navigator)) {
      swStateEl.textContent = "not supported";
      return;
    }

    const regs = await navigator.serviceWorker.getRegistrations();
    if (!regs || regs.length === 0) {
      swStateEl.textContent = "not registered";
      return;
    }

    const reg = regs[0];
    const active = reg.active ? reg.active.scriptURL : null;
    swStateEl.textContent = active ? `registered (${active})` : "registered (no active)";
  } catch (e) {
    swStateEl.textContent = "error";
  }
}

async function callApi(path) {
  lastApiEl.textContent = path;

  const res = await fetch(path, {
    method: "GET",
    cache: "no-store",
    headers: { "Accept": "application/json" }
  });

  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

  const headerMark = res.headers.get("x-poc-sw") || "";
  const meta = {
    status: res.status,
    x_poc_sw: headerMark,
    from: headerMark ? "service_worker_modified" : "server_original"
  };

  outEl.textContent = pretty({ meta, body: parsed });
  await refreshSwState();
}

async function resetSw() {
  if (!("serviceWorker" in navigator)) return;

  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) {
    try { await r.unregister(); } catch (_) {}
  }

  outEl.textContent = "SW registrations cleared. (Reload page recommended)";
  await refreshSwState();
}

btnCheck?.addEventListener("click", () => callApi("/api/account"));
btnRaw?.addEventListener("click", () => callApi("/api/account-raw"));
btnReset?.addEventListener("click", resetSw);

refreshSwState();

