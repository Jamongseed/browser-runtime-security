// src/features/common/query.js

export function buildQuery(params = {}) {
  const sp = new URLSearchParams();

  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) {
      if (v.length === 0) return;
      sp.set(k, v.join(","));
      return;
    }
    const s = String(v).trim();
    if (!s) return;
    sp.set(k, s);
  });

  const q = sp.toString();
  return q ? `?${q}` : "";
}

export function parseQuery(search) {
  const sp = new URLSearchParams(search || "");
  const start = sp.get("start") || "";
  const end = sp.get("end") || "";
  const sevRaw = sp.get("sev") || "";
  const sev = sevRaw ? sevRaw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean) : [];
  const domain = sp.get("domain") || "";
  const domainNot = sp.get("domainNot") || "";
  const ruleId = sp.get("ruleId") || "";
  const ruleIdNot = sp.get("ruleIdNot") || "";
  const installId = sp.get("installId") || "";

  return { start, end, sev, domain, domainNot, ruleId, ruleIdNot, installId };
}
