(function () {
    // Session ID 생성
    const sessionId = (crypto && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // 위험도 계산기
    function getSeverity(score) {
        if (score >= 50) return "HIGH";
        if (score >= 20) return "MEDIUM";
        return "LOW";
    }

    // Background로 전송
    function sendLog(type, data, meta = {}) {
        const scoreDelta = meta.scoreDelta || 0;
        
        const payload = {
            type: type,                         // 위협 종류(ex. "DYN_SCRIPT_INSERT", "FORM_SUBMIT")
            sessionId: sessionId,
            ts: Date.now(),
            page: location.href,
            origin: location.origin,
            data: data || {},
            ruleId: meta.ruleId || type,
            scoreDelta: scoreDelta,
            severity: meta.severity || getSeverity(scoreDelta),     // 위험 등급
            targetOrigin: meta.targetOrigin || "",                  // 목적지 주소
            evidence: meta.evidence || {}
        };

        console.log(`[BRS] 📡 ${type}`, payload);
        chrome.runtime.sendMessage({ action: "REPORT_THREAT", data: payload });
    }

    // 절대 주소로 변환
    function toAbsUrl(raw) {
        if (!raw) return "";
        try { return new URL(raw, location.href).href; } catch { return raw; }
    }
    // 오리진 추출
    function getOrigin(url) {
        try { return new URL(url).origin; } catch { return ""; }
    }

    // 스크립트 & 아이프레임 감시
    const mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const n of m.addedNodes) {
                if (!(n instanceof HTMLElement)) continue;

                // 스크립트 감지
                if (n.tagName === "SCRIPT") {
                    const src = n.getAttribute("src");
                    if (src) {
                        const abs = toAbsUrl(src);
                        const targetOrigin = getOrigin(abs);
                        const isCrossSite = targetOrigin && targetOrigin !== location.origin;
                        
                        sendLog("DYN_SCRIPT_INSERT", { src, abs, crossSite: isCrossSite }, {
                            ruleId: isCrossSite ? "DYN_SCRIPT_INSERT_CROSS_SITE" : "DYN_SCRIPT_INSERT_SAME_SITE",
                            scoreDelta: isCrossSite ? 20 : 0,
                            targetOrigin: targetOrigin
                        });
                    }
                }

                // 아이프레임 감지
                if (n.tagName === "IFRAME") {
                    const src = n.src || n.getAttribute("src") || "";
                    const style = (n.getAttribute("style") || "").toLowerCase();
                    
                    const isHidden = 
                        n.hidden ||
                        style.includes("display: none") || 
                        style.includes("visibility: hidden") || 
                        style.includes("opacity: 0") ||
                        (n.width == 0 || n.height == 0) ||
                        style.includes("left: -");

                    const abs = toAbsUrl(src);
                    const targetOrigin = getOrigin(abs);
                    const isCrossSite = targetOrigin && targetOrigin !== location.origin;

                    sendLog("DYN_IFRAME_INSERT", { src, hidden: isHidden, crossSite: isCrossSite }, {
                        ruleId: isHidden ? "HIDDEN_IFRAME_INSERT" : "IFRAME_INSERT",
                        scoreDelta: isHidden ? 35 : 10,
                        severity: isHidden ? "HIGH" : "LOW",
                        targetOrigin: targetOrigin,
                        evidence: { styleSnippet: style.slice(0, 50) }
                    });
                }
            }
        }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // 피싱 폼 전송 감지
    function handleFormRisk(form, triggerType) {
        const action = form.getAttribute("action") || "";
        const actionResolved = form.action;
        const actionOrigin = getOrigin(actionResolved);
        const isMismatch = actionOrigin && actionOrigin !== location.origin;

        if (isMismatch) {
            sendLog("FORM_SUBMIT", {
                trigger: triggerType,
                actionAttr: action,
                actionResolved: actionResolved
            }, {
                ruleId: "PHISHING_FORM_MISMATCH",
                scoreDelta: 50,
                severity: "HIGH",
                targetOrigin: actionOrigin,
                evidence: { msg: "폼 데이터가 외부 도메인으로 전송됨" }
            });
        }
    }

    document.addEventListener("submit", (e) => {
        if (e.defaultPrevented) return;
        handleFormRisk(e.target, "submit");
    }, false);
    
    document.addEventListener("click", (e) => {
        const btn = e.target.closest("button[type='submit'], input[type='submit']");
        if (btn && btn.form) {
            handleFormRisk(btn.form, "click");
        }
    }, true);

    // page_hook.js에서 오는 메시지 수신
    window.addEventListener("message", (e) => {
        if (e.source !== window || !e.data.__BRS__) return;
        const { type, data } = e.data;

        let score = 0;
        let ruleId = type;

        if (type === "SUSP_ATOB_CALL") { score = 10; ruleId = "OBFUSCATION_ATOB"; }
        else if (type === "SUSP_EVAL_CALL") { score = 25; ruleId = "DYNAMIC_CODE_EVAL"; }
        else if (type === "SUSP_FUNCTION_CONSTRUCTOR_CALL") { score = 25; ruleId = "DYNAMIC_CODE_FUNCTION"; }
        else if (type === "SUSP_DOM_XSS") { score = 40; ruleId = "DOM_XSS_INJECTION"; } 
        else if (type === "SENSITIVE_DATA_ACCESS") { score = 50; ruleId = "COOKIE_THEFT"; } 
        else if (type === "SUSP_NETWORK_CALL") { score = 15; ruleId = "NETWORK_LEAK"; }

        sendLog(type, data, { ruleId, scoreDelta: score });
    });

    // 훅 주입
    function injectHooks() {
        const s = document.createElement("script");
        s.src = chrome.runtime.getURL("page_hook.js");
        s.onload = function() { this.remove(); };
        (document.head || document.documentElement).appendChild(s);
    }
    injectHooks();

    // 세션 시작 알림
    sendLog("SENSOR_READY", { ready: true }, { scoreDelta: 0, severity: "LOW" });

})();