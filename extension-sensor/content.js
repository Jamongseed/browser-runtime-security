(function () {
    // Session ID 생성
    const sessionId = (crypto && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // 위험도 계산기
    function getSeverity(scoreDelta) {
        if (scoreDelta >= 50) return "HIGH";
        if (scoreDelta >= 25) return "MEDIUM";
        return "LOW";
    }

    // Background로 전송
    function sendLog(type, data, meta = {}) {
        const scoreDelta = meta.scoreDelta || 0;
        
        const payload = {
            type,                                           // 위협 종류(ex. "DYN_SCRIPT_INSERT", "FORM_SUBMIT")
            ruleId: meta.ruleId || type,
            sessionId,
            ts: Date.now(),

            page: location.href,
            origin: location.origin,
            targetOrigin: meta.targetOrigin || "",                  // 목적지 주소
            ua: navigator.userAgent,
            
            severity: meta.severity || getSeverity(scoreDelta),     // 위험 등급
            scoreDelta,

            data: data || {},
            evidence: meta.evidence || {}
        };

        console.log(`[BRS] ${type}`, payload);
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

    function isCrossSite(targetOrigin) {
        return targetOrigin && targetOrigin !== location.origin;
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
                        const crossSite = isCrossSite(targetOrigin);
                        const scoreDelta = crossSite ? 20 : 5;
                        
                        sendLog("DYN_SCRIPT_INSERT", { src, abs, crossSite }, {
                            ruleId: crossSite ? "DYN_SCRIPT_INSERT_CROSS_SITE" : "DYN_SCRIPT_INSERT_SAME_SITE",
                            scoreDelta,
                            targetOrigin,
                            evidence: { src, abs, crossSite, targetOrigin }
                        });
                    }
                }

                // 아이프레임 감지
                if (n.tagName === "IFRAME") {
                    const src = n.src || n.getAttribute("src") || "";
                    const abs = toAbsUrl(src);
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
                    const scoreDelta = (hidden ? 25 : 10) + (crossSite ? 10 : 0);



                    sendLog("DYN_IFRAME_INSERT", { src, abs, crossSite, hidden }, {
                        ruleId: hidden ? "HIDDEN_IFRAME_INSERT" : "IFRAME_INSERT",
                        scoreDelta,
                        severity: scoreDelta >= 35 ? "HIGH" : scoreDelta >= 20 ? "MEDIUM" : "LOW",
                        targetOrigin,
                        evidence: { src, abs, crossSite, hidden, targetOrigin }
                    });
                }
            }
        }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // 폼 전송 
    function reportForm(form, via) {
        if (!(form instanceof HTMLFormElement)) return;

        const actionAttr = form.getAttribute("action") || "";
        const actionResolved = form.action;
        const actionOrigin = getOrigin(actionResolved);
        const mismatch = actionOrigin && actionOrigin !== location.origin;

        const ruleId = mismatch ? "PHISHING_FORM_MISMATCH" : "FORM_ACTION_MATCH";
        const scoreDelta = mismatch ? 50 : 5;
        const severity = mismatch ? "HIGH" : "LOW";

        if (!actionOrigin) {
            sendLog("FORM_SUBMIT", {
                via,
                actionAttr,
                actionResolved,
                parse: "fail"
            }, {
                ruleId: "FORM_ACTION_PARSE_FAIL", 
                scoreDelta: 10,
                severity: "MEDIUM",
                targetOrigin: "UNKNOWN",
                evidence: { 
                    via,
                    actionAttr,
                    actionResolved
                }
            });
            return;
        }
        sendLog("FORM_SUBMIT", {
            via,
            actionAttr,
            actionResolved,
            actionOrigin,
            pageOrigin: location.origin,
            mismatch
        }, {
            ruleId,
            scoreDelta,
            severity,
            targetOrigin: actionOrigin,
            evidence: { 
                via,
                actionAttr,
                actionResolved,
                actionOrigin,
                pageOrigin: location.origin,
                mismatch
            }
        });
    }

    document.addEventListener("submit", (e) => {
        reportForm(e.target, "submit");
    }, false);
    
    document.addEventListener("click", (e) => {
        const btn = e.target.closest("button[type='submit'], input[type='submit']");
        if (btn && btn.form) {
            reportForm(btn.form, "click");
        }
    }, true);

    // page_hook.js에서 오는 메시지 수신
    window.addEventListener("message", (e) => {
        if (e.source !== window || !e.data.__BRS__) return;
        const { type, data } = e.data;

        let scoreDelta = 0;
        let ruleId = type;

        if (type === "SUSP_ATOB_CALL") { scoreDelta = 10; ruleId = "OBFUSCATION_ATOB"; }
        else if (type === "SUSP_EVAL_CALL") { scoreDelta = 25; ruleId = "DYNAMIC_CODE_EVAL"; }
        else if (type === "SUSP_FUNCTION_CONSTRUCTOR_CALL") { scoreDelta = 25; ruleId = "DYNAMIC_CODE_FUNCTION"; }
        else if (type === "SUSP_DOM_XSS") { scoreDelta = 40; ruleId = "DOM_XSS_INJECTION"; } 
        else if (type === "SENSITIVE_DATA_ACCESS") { scoreDelta = 50; ruleId = "COOKIE_THEFT"; } 
        else if (type === "SUSP_NETWORK_CALL") { scoreDelta = 15; ruleId = "NETWORK_LEAK"; }

        sendLog(type, data, { ruleId, scoreDelta});
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
    sendLog("SENSOR_READY", {
        origin: location.origin,
    }, { 
        ruleId: "SENSOR_READY",
        scoreDelta: 0,
        severity: "LOW",
        targetOrigin: location.origin,
        evidence: { origin: location.origin, sessionId }
    });
})();