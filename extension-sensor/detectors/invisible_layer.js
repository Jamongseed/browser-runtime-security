//poc-b-invisible-layer-detector.js
(function () {
  function num(v, d = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function safeZIndex(z) {
    if (!z || z === "auto") return 0;
    const n = parseInt(z, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function isInternal(el) {
    try {
      if (!el || el.nodeType !== 1) return false;
      if (el.getAttribute && el.getAttribute("data-brs-internal") === "1") return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function getStyle(el) {
    try { return window.getComputedStyle(el); } catch { return null; }
  }

  function areaRatio(rect) {
    const vw = Math.max(1, window.innerWidth || 1);
    const vh = Math.max(1, window.innerHeight || 1);
    const w = Math.max(0, Math.min(rect.width, vw));
    const h = Math.max(0, Math.min(rect.height, vh));
    return (w * h) / (vw * vh);
  }

  function isLikelyInvisibleOverlay(el) {
    if (!el || !(el instanceof HTMLElement)) return null;
    if (isInternal(el)) return null;

    const st = getStyle(el);
    if (!st) return null;

    if (st.display === "none" || st.visibility === "hidden") return null;
    if (st.pointerEvents === "none") return null;

    const pos = st.position || "";
    if (pos !== "fixed" && pos !== "absolute") return null;

    const rect = el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return null;

    const ar = areaRatio(rect);
    if (ar < 0.15) return null;

    const opacity = num(st.opacity, 1);
    const z = safeZIndex(st.zIndex);

    const transparent = opacity <= 0.05;
    const highZ = z >= 1000;

    if (!transparent) return null;

    return {
      tag: el.tagName,
      id: el.id || "",
      cls: (el.className && String(el.className).slice(0, 120)) || "",
      position: pos,
      zIndex: z,
      opacity,
      areaRatio: ar,
      rect: {
        x: Math.round(rect.x), y: Math.round(rect.y),
        w: Math.round(rect.width), h: Math.round(rect.height)
      },
      flags: { transparent, highZ }
    };
  }

  function findOverlayFromNode(node) {
    if (!(node instanceof HTMLElement)) return null;

    const direct = isLikelyInvisibleOverlay(node);
    if (direct) return { el: node, info: direct };

    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
    let count = 0;
    while (walker.nextNode()) {
      const el = walker.currentNode;
      const hit = isLikelyInvisibleOverlay(el);
      if (hit) return { el, info: hit };
      count++;
      if (count > 80) break;
    }
    return null;
  }

  function start(sendLog, ruleEngine) {
    if (typeof sendLog !== "function") return;

    function applyRule(type, data, baseMeta) {
      try {
        if (!ruleEngine) return baseMeta;
        const matched = ruleEngine.match({ type, data, ctx: {} });
        return matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;
      } catch (_) {
        return baseMeta;
      }
    }

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const n of m.addedNodes) {
          const found = findOverlayFromNode(n);
          if (!found) continue;

          const data = {
            reason: "INSERT",
            ...found.info
          };

          const baseMeta = {
            ruleId: "INVISIBLE_LAYER_INSERT",
            scoreDelta: 25,
            severity: "MEDIUM",
            targetOrigin: location.origin,
            evidence: data
          };

          const meta = applyRule("INVISIBLE_LAYER_DETECTED", data, baseMeta);
          sendLog("INVISIBLE_LAYER_DETECTED", data, meta);
        }
      }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });

    function onPointerDown(e) {
      try {
        const t = e.target;
        const hit = isLikelyInvisibleOverlay(t);
        if (!hit) return;

        const data = {
          reason: "POINTERDOWN",
          x: Math.round(e.clientX),
          y: Math.round(e.clientY),
          ...hit
        };

        const baseMeta = {
          ruleId: "INVISIBLE_LAYER_CLICK",
          scoreDelta: 60,
          severity: "HIGH",
          targetOrigin: location.origin,
          evidence: data
        };

        const meta = applyRule("INVISIBLE_LAYER_DETECTED", data, baseMeta);
        sendLog("INVISIBLE_LAYER_DETECTED", data, meta);
      } catch (_) {}
    }

    document.addEventListener("pointerdown", onPointerDown, true);
  }

  window.BRS_Detectors = window.BRS_Detectors || {};
  window.BRS_Detectors.invisibleLayer = { start };
})();