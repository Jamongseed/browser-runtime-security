(function () {
  function safeStr(v, max = 500) {
    try {
      const s = String(v ?? "");
      return s.length > max ? s.slice(0, max) : s;
    } catch (_) {
      return "";
    }
  }

  function toAbsUrl(raw) {
    if (!raw) return "";
    try { return new URL(String(raw), location.href).href; } catch (_) { return String(raw); }
  }

  function tryOrigin(url) {
    try { return new URL(url).origin; } catch (_) { return ""; }
  }

  function applyRule(ruleEngine, type, data, baseMeta) {
    try {
      if (!ruleEngine) return baseMeta;
      const matched = ruleEngine.match({ type, data, ctx: {} });
      return matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;
    } catch (_) {
      return baseMeta;
    }
  }

  function pickAnchor(t) {
    try {
      const el = t && t.nodeType === 1 ? t : null;
      if (!el) return null;
      return el.closest ? el.closest("a") : null;
    } catch (_) {
      return null;
    }
  }

  function selectorHint(a) {
    try {
      if (!a) return "a";
      const id = a.id ? ("#" + a.id) : "";
      const cls = a.className ? String(a.className).trim().split(/\s+/).filter(Boolean)[0] : "";
      const c = cls ? ("." + cls) : "";
       return "a" + id + c;
    } catch (_) {
      return "a";
    }
  }

  function start(sendLog, ruleEngine) {
    if (typeof sendLog !== "function") return;

    let active = null;

    function cleanup() {
      try { if (active && active.mo) active.mo.disconnect(); } catch (_) {}
      try { if (active && active.finalizeId) clearTimeout(active.finalizeId); } catch (_) {}
      try { if (active && active.killId) clearTimeout(active.killId); } catch (_) {}
      active = null;
    }

    function arm(a, downType) {
      try {
        if (!a || String(a.tagName || "").toUpperCase() !== "A") return;

        if (active && active.el === a && active.downType === "pointerdown") {
          if (downType === "mousedown" && (Date.now() - active.downAt) < 60) return;
        }

        cleanup();

        const oldHrefRaw = safeStr(a.getAttribute("href") || "", 800);
        const oldHrefAbs = toAbsUrl(oldHrefRaw);
        const oldTargetOrigin = tryOrigin(oldHrefAbs) || location.origin;

        active = {
          el: a,
          downType: safeStr(downType, 24),
          downAt: Date.now(),
          oldHrefRaw,
          oldHrefAbs,
          oldTargetOrigin,
          firstChangeAt: 0,
          newHrefRaw: "",
          newHrefAbs: "",
          newTargetOrigin: "",
          crossOriginChanged: false,
          reverted: false,
          revertAt: 0,
          emitted: false,
          mo: null,
          finalizeId: null,
          killId: null
        };

        const mo = new MutationObserver(() => {
          try {
            if (!active || active.el !== a) return;

            const curRaw = safeStr(a.getAttribute("href") || "", 800);
            const curAbs = toAbsUrl(curRaw);
            const curOrigin = tryOrigin(curAbs) || location.origin;

            const sameAsOld = (curAbs && active.oldHrefAbs) ? (curAbs === active.oldHrefAbs) : (curRaw === active.oldHrefRaw);

            if (!active.firstChangeAt) {
              if (sameAsOld) return;
              active.firstChangeAt = Date.now();
              active.newHrefRaw = curRaw;
              active.newHrefAbs = curAbs;
              active.newTargetOrigin = curOrigin;
              active.crossOriginChanged = !!(active.oldTargetOrigin && curOrigin && active.oldTargetOrigin !== curOrigin);

              active.finalizeId = setTimeout(() => {
                try {
                  if (!active || active.emitted) return;
                  const delta = active.firstChangeAt ? (active.firstChangeAt - active.downAt) : null;
                  const within50ms = (typeof delta === "number") && delta >= 0 && delta <= 50;
                  const within200ms = (typeof delta === "number") && delta >= 0 && delta <= 200;
                  const revertMs = active.reverted && active.revertAt ? (active.revertAt - active.firstChangeAt) : null;

                  const d = {
                    tag: "A",
                    id: safeStr(a.id || "", 120),
                    cls: safeStr(a.className || "", 200),
                    selectorHint: selectorHint(a),
                    textHead: safeStr((a.textContent || "").trim(), 120),

                    pageUrl: safeStr(location.href, 800),
                    pageOrigin: safeStr(location.origin, 200),

                    oldHrefRaw: active.oldHrefRaw,
                    oldHrefAbs: active.oldHrefAbs,
                    oldTargetOrigin: safeStr(active.oldTargetOrigin, 200),

                    newHrefRaw: active.newHrefRaw,
                    newHrefAbs: active.newHrefAbs,
                    newTargetOrigin: safeStr(active.newTargetOrigin, 200),

                    triggerInput: active.downType,
                    deltaMsFromDown: delta,
                    within50ms,
                    within200ms,

                    crossOriginChanged: !!active.crossOriginChanged,
                    reverted: !!active.reverted,
                    revertMs
                  };

                  const baseMeta = {
                    ruleId: "LINK_HREF_SWAP",
                    scoreDelta: 10,
                    severity: "LOW",
                    targetOrigin: safeStr(active.newTargetOrigin || "", 200),
                    evidence: d
                  };

                  const meta = applyRule(ruleEngine, "LINK_HREF_SWAP_DETECTED", d, baseMeta);
                  sendLog("LINK_HREF_SWAP_DETECTED", d, meta);
                  active.emitted = true;
                } catch (_) {
                } finally {
                  cleanup();
                }
              }, 550);
            } else {
              if (!active.reverted && sameAsOld) {
                active.reverted = true;
                active.revertAt = Date.now();
              }
            }
          } catch (_) {}
        });

        active.mo = mo;
        try { mo.observe(a, { attributes: true, attributeFilter: ["href"], attributeOldValue: true }); } catch (_) {}

        active.killId = setTimeout(() => cleanup(), 1200);
      } catch (_) {}
    }

    document.addEventListener("pointerdown", (e) => {
      try {
        const a = pickAnchor(e && e.target);
        if (!a) return;
        arm(a, "pointerdown");
      } catch (_) {}
    }, true);

    document.addEventListener("mousedown", (e) => {
      try {
        const a = pickAnchor(e && e.target);
        if (!a) return;
        arm(a, "mousedown");
      } catch (_) {}
    }, true);
  }

  window.BRS_Detectors = window.BRS_Detectors || {};
  window.BRS_Detectors.linkHrefSwap = { start };
})();