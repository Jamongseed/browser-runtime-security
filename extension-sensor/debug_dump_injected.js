(() => {
  const seenNorm = new Set();    
  const baselineNorm = new Set();
  const pending = new Map();
  let baselineReady = false;

  const toAbs = (raw) => {
    if (!raw) return "";
    try { return new URL(String(raw), location.href).href; } catch { return String(raw); }
  };

  const normalizeHttpUrl = (absUrl) => {
    try {
      const u = new URL(absUrl);
      // extension/internal 리소스는 제외
      if (u.protocol === "chrome-extension:" || u.protocol === "moz-extension:") return "";
      // query/hash 제거해서 "같은 파일"로 취급
      u.search = "";
      u.hash = "";
      return u.href;
    } catch {
      return "";
    }
  };

  const isDataOrBlob = (absUrl) => absUrl.startsWith("data:") || absUrl.startsWith("blob:");

  const sha256 = async (text) => {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const dumpChunks = (text, chunkSize = 2000) => {
    for (let i = 0; i < text.length; i += chunkSize) {
      console.log(text.slice(i, i + chunkSize));
    }
  };

  const fetchTextViaBackground = (url) => {
    return new Promise((resolve, reject) => {
      try {
        const rt = (globalThis.chrome && chrome.runtime) || (globalThis.browser && browser.runtime);
        if (!rt || !rt.sendMessage) {
          reject(new Error("runtime.sendMessage not available"));
          return;
        }

        rt.sendMessage({ action: "BRS_FETCH_TEXT", url }, (res) => {
          const err = (globalThis.chrome && chrome.runtime && chrome.runtime.lastError)
            ? chrome.runtime.lastError
            : null;

          if (err) { reject(new Error(String(err.message || err))); return; }
          if (!res || !res.ok) { reject(new Error(String((res && res.err) || "no response"))); return; }

          resolve(res);
        });
      } catch (e) {
        reject(e);
      }
    });
  };

  const saveLastDump = (payload) => {
    globalThis.__BRS_LAST_DUMP__ = payload;
    try { window.__BRS_LAST_DUMP__ = payload; } catch (_) {}
  };

  // (추가) background로 dump 저장 요청
  const sendDumpToBackground = (payload) => {
    try {
      const rt = (globalThis.chrome && chrome.runtime) || (globalThis.browser && browser.runtime);
      if (!rt || !rt.sendMessage) return;
      rt.sendMessage({ action: "BRS_SAVE_DUMP", payload }, (res) => {
        const err = (globalThis.chrome && chrome.runtime && chrome.runtime.lastError)
          ? chrome.runtime.lastError
          : null;
        if (err) {
          console.warn("[BRS_DUMP] BRS_SAVE_DUMP sendMessage error:", String(err.message || err));
          return;
        }
        if (res && res.ok === false) {
          console.warn("[BRS_DUMP] BRS_SAVE_DUMP rejected:", String(res.err || "unknown"));
        }
      });
    } catch (e) {
      console.warn("[BRS_DUMP] BRS_SAVE_DUMP send failed:", String(e && e.message ? e.message : e));
    }
  };

  const dumpDataUrl = async (absUrl) => {
    console.group("[BRS_DUMP] data: URL script");
    console.log(absUrl.slice(0, 300));
    console.groupEnd();
    saveLastDump({ url: absUrl, kind: "data:", preview: absUrl.slice(0, 300) });
  };

  const dumpBlobUrl = async (absUrl) => {
    console.group("[BRS_DUMP] blob: URL script (best-effort)");
    console.log("url:", absUrl);

    try {
      const r = await fetch(absUrl, { cache: "no-store" });
      const ct = r.headers.get("content-type") || "";
      const text = await r.text();
      const h = await sha256(text);

      console.log("status:", r.status);
      console.log("content-type:", ct);
      console.log("length:", text.length);
      console.log("sha256:", h);

      console.group("[BRS_DUMP] body (chunked)");
      dumpChunks(text, 2000);
      console.groupEnd();

      saveLastDump({ url: absUrl, sha256: h, length: text.length, contentType: ct, text, via: "page-fetch(blob)" });
      console.log("[BRS_DUMP] saved to __BRS_LAST_DUMP__");
    } catch (e) {
      console.warn("[BRS_DUMP] blob fetch failed:", String(e && e.message ? e.message : e));
    }

    console.groupEnd();
  };

  const dumpHttpUrl = async (absUrl) => {
    const norm = normalizeHttpUrl(absUrl);
    if (!norm) return;

    if (baselineNorm.has(norm)) return;

    if (seenNorm.has(norm)) return;
    seenNorm.add(norm);

    console.group("[BRS_DUMP] fetching script (via background)");
    console.log("url:", absUrl);
    console.log("norm:", norm);

    try {
      const res = await fetchTextViaBackground(absUrl);

      const ct = String(res.contentType || "");
      const text = String(res.text || "");
      const h = await sha256(text);

      console.log("status:", res.status);
      console.log("content-type:", ct);
      console.log("length:", text.length);
      console.log("sha256:", h);

      console.group("[BRS_DUMP] body (chunked)");
      dumpChunks(text, 2000);
      console.groupEnd();

      saveLastDump({ url: absUrl, norm, sha256: h, length: text.length, contentType: ct, text, via: "background-fetch" });
      console.log("[BRS_DUMP] saved to __BRS_LAST_DUMP__");

      // (추가) collector로 저장되게 background로 던짐
      let targetOrigin = "";
      try { targetOrigin = new URL(absUrl).origin; } catch (_) {}
      sendDumpToBackground({
        url: absUrl,
        norm,
        sha256: h,
        length: text.length,
        contentType: ct,
        via: "background-fetch",
        text,
        page: location.href,
        origin: location.origin,
        targetOrigin,
      });
    } catch (e) {
      console.error("[BRS_DUMP] bg fetch failed:", String(e && e.message ? e.message : e));
    }

    console.groupEnd();
  };

  const handleScriptUrl = (absUrl) => {
    if (!absUrl) return;

    if (absUrl.startsWith("chrome-extension://") || absUrl.startsWith("moz-extension://")) return;

    if (!baselineReady) {
      // baseline 준비 전이면 큐에만 쌓아둠
      if (isDataOrBlob(absUrl)) {
        // data/blob은 baseline 개념이 애매해서, baseline 준비 후에도 처리 가능하지만
        // 일단 pending에 담아둠(아래 flushPending에서 처리)
        pending.set(absUrl, absUrl);
        return;
      }
      const norm = normalizeHttpUrl(absUrl);
      if (norm) pending.set(norm, absUrl);
      return;
    }

    if (absUrl.startsWith("data:")) { dumpDataUrl(absUrl); return; }
    if (absUrl.startsWith("blob:")) { dumpBlobUrl(absUrl); return; }
    dumpHttpUrl(absUrl);
  };

  const observeAddedScripts = (root) => {
    if (!root) return;

    if (root.nodeType === 1 && String(root.tagName) === "SCRIPT") {
      const abs = toAbs(root.getAttribute("src") || root.src || "");
      handleScriptUrl(abs);
      return;
    }

    if (root.querySelectorAll) {
      const scripts = root.querySelectorAll("script[src]");
      for (const s of scripts) {
        const abs = toAbs(s.getAttribute("src") || "");
        handleScriptUrl(abs);
      }
    }
  };

  const buildBaseline = () => {
    baselineNorm.clear();
    try {
      document.querySelectorAll("script[src]").forEach((s) => {
        const abs = toAbs(s.getAttribute("src") || "");
        const norm = normalizeHttpUrl(abs);
        if (norm) baselineNorm.add(norm);
      });
    } catch (_) {}
    console.log("[BRS_DUMP] baseline scripts:", baselineNorm.size);
  };

  const flushPending = () => {
    // pending key가 norm이거나 data/blob URL 자체일 수 있음
    for (const [k, abs] of pending.entries()) {
      if (abs.startsWith("data:")) dumpDataUrl(abs);
      else if (abs.startsWith("blob:")) dumpBlobUrl(abs);
      else dumpHttpUrl(abs);
    }
    pending.clear();
  };

  const startObserver = () => {
    try {
      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          if (!m || !m.addedNodes) continue;
          for (const n of m.addedNodes) observeAddedScripts(n);
        }
      });
      mo.observe(document.documentElement || document, { childList: true, subtree: true });
    } catch (e) {
      console.warn("[BRS_DUMP] failed to start MutationObserver:", String(e && e.message ? e.message : e));
    }
  };

  startObserver();

  const onReady = () => {
    try {
      buildBaseline();
      baselineReady = true;
      flushPending();
      console.log("[BRS_DUMP] debug_dump_injected.js loaded (dynamic scripts: dump non-baseline only)");
    } catch (e) {
      console.warn("[BRS_DUMP] baseline init failed:", String(e && e.message ? e.message : e));
    }
  };

  if (document.readyState === "interactive" || document.readyState === "complete") {
    onReady();
  } else {
    document.addEventListener("DOMContentLoaded", onReady, { once: true });
  }
})();