(function () {
  function toAbsUrl(raw) {
    if (!raw) return "";
    try { return new URL(raw, location.href).href; } catch { return raw; }
  }

  function getOrigin(url) {
    try { return new URL(url).origin; } catch { return ""; }
  }

  function isCrossSite(targetOrigin) {
    return targetOrigin && targetOrigin !== location.origin;
  }

  function isInternalNode(el) {
    if (!el || !(el instanceof HTMLElement)) return false;

    // 우리가 inject할 때 붙이는 마커
    if (el.getAttribute && el.getAttribute("data-brs-internal") === "1") return true;

    // src가 확장 리소스면 내부로 간주
    const src = (el.getAttribute && el.getAttribute("src")) || "";
    if (src.startsWith("chrome-extension://") || src.startsWith("moz-extension://")) return true;

    return false;
  }

  // (추가) page_hook.js가 SCRIPT/IFRAME의 src 설정 시점에 data-*로 부착한 initiator/stack 근거 읽기
  function readInitiatorEvidence(el) {
    try {
      if (!el || !(el instanceof HTMLElement)) {
        return {
          initiatorUrl: "",
          initiatorOrigin: "",
          initiatorCrossSite: false,
          initiatorStack: "",
          initiatorPhase: "",
          initAbs: "",
          targetCrossByHook: false,
          targetOriginByHook: ""
        };
      }

      const initiatorUrl = el.getAttribute("data-brs-init-url") || "";
      const initiatorOrigin = el.getAttribute("data-brs-init-origin") || "";
      const initiatorCrossSite = (el.getAttribute("data-brs-init-cross") || "") === "1";
      const initiatorStack = el.getAttribute("data-brs-init-stack") || "";
      const initiatorPhase = el.getAttribute("data-brs-init-phase") || "";
      const initAbs = el.getAttribute("data-brs-init-abs") || "";

      // (옵션) page_hook가 타겟 origin/cross를 부착한 경우(없으면 dom_mutation 계산값을 사용)
      const targetOriginByHook = el.getAttribute("data-brs-target-origin") || "";
      const targetCrossByHook = (el.getAttribute("data-brs-target-cross") || "") === "1";

      return {
        initiatorUrl,
        initiatorOrigin,
        initiatorCrossSite,
        initiatorStack,
        initiatorPhase,
        initAbs,
        targetCrossByHook,
        targetOriginByHook
      };
    } catch (_) {
      return {
        initiatorUrl: "",
        initiatorOrigin: "",
        initiatorCrossSite: false,
        initiatorStack: "",
        initiatorPhase: "",
        initAbs: "",
        targetCrossByHook: false,
        targetOriginByHook: ""
      };
    }
  }

  // (추가) 같은 노드/같은 abs에 대해 중복 로그 방지 (MutationObserver childList + attributes 대응용)
  function shouldSkipDuplicate(el, abs, kind) {
    try {
      const key =
        kind === "IFRAME"
          ? "data-brs-logged-iframe-abs"
          : "data-brs-logged-script-abs";

      const prev = el.getAttribute(key) || "";
      if (prev && prev === abs) return true;

      el.setAttribute(key, abs);
      return false;
    } catch (_) {
      return false;
    }
  }

  // (추가) 공통 로깅 함수: SCRIPT/IFRAME 삽입 + initiator 근거 포함
  function emitScript(sendLog, ruleEngine, n, phase) {
    if (!(n instanceof HTMLElement)) return;
    if (n.tagName !== "SCRIPT") return;
    if (isInternalNode(n)) return;

    const src = n.getAttribute("src");
    if (!src) return;

    const abs = toAbsUrl(src);
    if (abs.startsWith("chrome-extension://") || abs.startsWith("moz-extension://")) return;

    // (중복 방지)
    if (shouldSkipDuplicate(n, abs, "SCRIPT")) return;

    const targetOrigin = getOrigin(abs);
    const crossSite = isCrossSite(targetOrigin);

    const init = readInitiatorEvidence(n);

    // (추가) hook이 남긴 targetOrigin/cross가 있으면 그 값을 우선(없으면 dom_mutation 계산값)
    const effTargetOrigin = init.targetOriginByHook || targetOrigin;
    const effCrossSite =
      init.targetOriginByHook ? init.targetCrossByHook : crossSite;

    const baseMeta = {
      ruleId: effCrossSite ? "DYN_SCRIPT_INSERT_CROSS_SITE" : "DYN_SCRIPT_INSERT_SAME_SITE",
      scoreDelta: effCrossSite ? 20 : 5,
      severity: "LOW",
      targetOrigin: effTargetOrigin,
      evidence: {
        src,
        abs,
        crossSite: effCrossSite,
        targetOrigin: effTargetOrigin,
        phase,
        // (추가) initiator 근거
        initiatorUrl: init.initiatorUrl,
        initiatorOrigin: init.initiatorOrigin,
        initiatorCrossSite: init.initiatorCrossSite,
        initiatorStack: init.initiatorStack,
        initiatorPhase: init.initiatorPhase
      }
    };

    // (추가) ruleEngine이 initiatorCrossSite 등을 판단할 수 있도록 data에도 포함
    const data = {
      src,
      abs,
      crossSite: effCrossSite,
      initiatorUrl: init.initiatorUrl,
      initiatorOrigin: init.initiatorOrigin,
      initiatorCrossSite: init.initiatorCrossSite,
      initiatorStack: init.initiatorStack
    };

    const matched = ruleEngine ? ruleEngine.match({ type: "DYN_SCRIPT_INSERT", data, ctx: {} }) : null;
    const meta = matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;

    sendLog("DYN_SCRIPT_INSERT", data, meta);
  }

  function emitIframe(sendLog, ruleEngine, n, phase) {
    if (!(n instanceof HTMLElement)) return;
    if (n.tagName !== "IFRAME") return;
    if (isInternalNode(n)) return;

    const src = n.src || n.getAttribute("src") || "";
    const abs = toAbsUrl(src);
    if (abs.startsWith("chrome-extension://") || abs.startsWith("moz-extension://")) return;

    // (중복 방지)
    if (shouldSkipDuplicate(n, abs, "IFRAME")) return;

    const targetOrigin = getOrigin(abs);
    const crossSite = isCrossSite(targetOrigin);

    const style = (n.getAttribute("style") || "").toLowerCase();
    const hidden =
      n.hidden ||
      style.includes("display: none") ||
      style.includes("visibility: hidden") ||
      style.includes("opacity: 0") ||
      (n.width == 0 || n.height == 0) ||
      style.includes("left: -") || style.includes("top: -");

    const init = readInitiatorEvidence(n);

    // (추가) hook이 남긴 targetOrigin/cross가 있으면 그 값을 우선(없으면 dom_mutation 계산값)
    const effTargetOrigin = init.targetOriginByHook || targetOrigin;
    const effCrossSite =
      init.targetOriginByHook ? init.targetCrossByHook : crossSite;

    const scoreDelta = (hidden ? 25 : 10) + (effCrossSite ? 10 : 0);

    const baseMeta = {
      ruleId: hidden ? "HIDDEN_IFRAME_INSERT" : "IFRAME_INSERT",
      scoreDelta,
      severity: scoreDelta >= 35 ? "HIGH" : scoreDelta >= 20 ? "MEDIUM" : "LOW",
      targetOrigin: effTargetOrigin,
      evidence: {
        src,
        abs,
        crossSite: effCrossSite,
        hidden,
        targetOrigin: effTargetOrigin,
        phase,
        // (추가) initiator 근거
        initiatorUrl: init.initiatorUrl,
        initiatorOrigin: init.initiatorOrigin,
        initiatorCrossSite: init.initiatorCrossSite,
        initiatorStack: init.initiatorStack,
        initiatorPhase: init.initiatorPhase
      }
    };

    // (추가) ruleEngine이 initiatorCrossSite 등을 판단할 수 있도록 data에도 포함
    const data = {
      src,
      abs,
      crossSite: effCrossSite,
      hidden,
      initiatorUrl: init.initiatorUrl,
      initiatorOrigin: init.initiatorOrigin,
      initiatorCrossSite: init.initiatorCrossSite,
      initiatorStack: init.initiatorStack
    };

    const matched = ruleEngine ? ruleEngine.match({ type: "DYN_IFRAME_INSERT", data, ctx: {} }) : null;
    const meta = matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;

    sendLog("DYN_IFRAME_INSERT", data, meta);
  }

  function start(sendLog, ruleEngine) {
    // (추가) 초기 스캔: 이미 DOM에 존재하는 script/iframe도 1회 감지
    try {
      document.querySelectorAll("script[src]").forEach((n) => {
        emitScript(sendLog, ruleEngine, n, "initial_scan");
      });

      document.querySelectorAll("iframe").forEach((n) => {
        emitIframe(sendLog, ruleEngine, n, "initial_scan");
      });
    } catch (_) {}

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // (추가) src가 "나중에" 세팅되는 케이스 대응
        // - page_hook.js는 src 설정 시점에 data-brs-init-*를 붙이지만
        // - MutationObserver가 childList만 보면 삽입 직후 src가 없어서 놓칠 수 있음
        if (m.type === "attributes" && m.attributeName === "src") {
          const t = m.target;
          if (t && t instanceof HTMLElement) {
            if (t.tagName === "SCRIPT") emitScript(sendLog, ruleEngine, t, "attr:src");
            if (t.tagName === "IFRAME") emitIframe(sendLog, ruleEngine, t, "attr:src");
          }
        }

        for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;

          if (n.tagName === "SCRIPT") {
            emitScript(sendLog, ruleEngine, n, "mutation_add");
          }

          if (n.tagName === "IFRAME") {
            emitIframe(sendLog, ruleEngine, n, "mutation_add");
          }
        }
      }
    });

    // (기존) childList/subtree
    // (추가) attributes+attributeFilter(src): src가 나중에 붙는 케이스 보완
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  }

  window.BRS_Detectors = window.BRS_Detectors || {};
  window.BRS_Detectors.domMutation = { start };
})();