(function () {
  function safeStr(v, n) {
    try { return String(v == null ? "" : v).slice(0, n || 300); } catch (_) { return ""; }
  }

  function absUrl(raw) {
    try { return new URL(String(raw || ""), location.href).href; } catch (_) { return safeStr(raw, 800); }
  }

  function originOf(url) {
    try { return new URL(String(url || ""), location.href).origin; } catch (_) { return ""; }
  }

  async function getRegs() {
    try {
      if (!navigator.serviceWorker || typeof navigator.serviceWorker.getRegistrations !== "function") return [];
      const regs = await navigator.serviceWorker.getRegistrations();
      if (!regs || !regs.length) return [];
      return regs.map((r) => {
        const scope = safeStr(r && r.scope, 800);

        const active = r && r.active ? safeStr(r.active.scriptURL, 1200) : "";
        const waiting = r && r.waiting ? safeStr(r.waiting.scriptURL, 1200) : "";
        const installing = r && r.installing ? safeStr(r.installing.scriptURL, 1200) : "";

        return { scope, active, waiting, installing };
      });
    } catch (_) {
      return [];
    }
  }

  function getControllerInfo() {
    const ctrl = (navigator.serviceWorker && navigator.serviceWorker.controller) || null;
    if (!ctrl) return { hasController: false, controller: null };

    const info = {};
    try { info.state = safeStr(ctrl.state, 40); } catch (_) {}
    try { info.scriptURL = safeStr(ctrl.scriptURL, 1200); } catch (_) {}

    return { hasController: true, controller: info };
  }

  function start(sendLog, ruleEngine) {
    let firstRegSeenTs = 0;
    let lastRegs = [];
    let sentActive = false;
    let sentRegistrationExists = false;

    let lastSwRegisterTs = 0;
    let lastSwRegisterData = null;

    const STATE_KEY = "__BRS_SW_PERSISTENCE_STATE__";

    function setState(patch) {
      try {
        const st = window[STATE_KEY] = window[STATE_KEY] || {
          firstRegSeenTs: 0,
          lastCheckTs: 0,
          lastRegs: [],
          sentRegistrationExists: false,
          sentActive: false,

          lastSwRegisterTs: 0,
          lastSwRegisterData: null,
          lastActiveTs: 0,
          lastActiveData: null,
          sentPocGChain: false,
        };
        Object.assign(st, patch || {});
      } catch (_) {}
    }

    function getState() {
      try { return window[STATE_KEY] || null; } catch (_) { return null; }
    }

    function within(a, b, ms) {
      if (!a || !b) return false;
      const dt = b - a;
      return dt >= 0 && dt <= ms;
    }

    function getDynCross() {
      try {
        const g = window.__BRS_POC_G__ || {};
        return {
          ts: g.lastDynCrossTs || 0,
          data: g.lastDynCrossData || null,
        };
      } catch (_) {
        return { ts: 0, data: null };
      }
    }

    try {
      window.addEventListener("message", (e) => {
        if (e.source !== window || !e.data || !e.data.__BRS__) return;
        const { type, data } = e.data || {};
        if (type !== "SW_REGISTER") return;

        lastSwRegisterTs = Date.now();
        lastSwRegisterData = data || null;

        setState({
          lastSwRegisterTs,
          lastSwRegisterData,
        });

      });
    } catch (_) {}

    function tryEmitPocGChain(swActiveData, reason) {
      try {
        const st = getState() || {};
        if (st.sentPocGChain) return;

        const dyn = getDynCross();

        const tDyn = dyn.ts || 0;
        const tReg = lastSwRegisterTs || st.lastSwRegisterTs || 0;
        const tAct = Date.now();

        // 시간 윈도우 (필요시 조정)
        const WIN1_MS = 10 * 1000; // DYN_SCRIPT_INSERT_CROSS_SITE -> SW_REGISTER
        const WIN2_MS = 30 * 1000; // SW_REGISTER -> controller 확보(active)

        if (!tDyn || !tReg) return;
        if (!within(tDyn, tReg, WIN1_MS)) return;
        if (!within(tReg, tAct, WIN2_MS)) return;

        const d = {
          reason: safeStr(reason || "", 80),
          t_dyn_cross: tDyn,
          t_sw_register: tReg,
          t_sw_active: tAct,
          dt_dyn_to_reg_ms: tReg - tDyn,
          dt_reg_to_active_ms: tAct - tReg,
          dyn: dyn.data || null,
          swRegister: lastSwRegisterData || st.lastSwRegisterData || null,
          swActive: swActiveData || null,
        };

        const baseMeta = {
          ruleId: "POC_G_SW_CHAIN_CONFIRMED",
          scoreDelta: 90,
          severity: "HIGH",
          targetOrigin: (swActiveData && swActiveData.controllerOrigin) ? swActiveData.controllerOrigin : location.origin,
          evidence: {
            reason: d.reason,
            dt_dyn_to_reg_ms: d.dt_dyn_to_reg_ms,
            dt_reg_to_active_ms: d.dt_reg_to_active_ms,
          }
        };

        const matched = ruleEngine ? ruleEngine.match({ type: "POC_G_SW_CHAIN", data: d, ctx: {} }) : null;
        const meta = matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;

        sendLog("POC_G_SW_CHAIN", d, meta);

        setState({ sentPocGChain: true });
      } catch (_) {}
    }

    async function check(reason) {
      try {
        const regs = await getRegs();
        const hasRegs = regs.length > 0;

        const ctrlInfo = getControllerInfo();
        const hasController = !!ctrlInfo.hasController;

        if (hasRegs && !firstRegSeenTs) firstRegSeenTs = Date.now();

        lastRegs = regs;
        setState({
          firstRegSeenTs,
          lastCheckTs: Date.now(),
          lastRegs,
        });

        if (hasRegs && !sentRegistrationExists) {
          sentRegistrationExists = true;
          setState({ sentRegistrationExists: true });

          const d = {
            reason: safeStr(reason, 80),
            hasRegs,
            regsCount: regs.length,
            regs,
          };

          const baseMeta = {
            ruleId: "SW_REGISTRATIONS_PRESENT",
            scoreDelta: 5,
            severity: "LOW",
            targetOrigin: location.origin,
            evidence: {
              reason: d.reason,
              regsCount: d.regsCount,
            }
          };

          const matched = ruleEngine ? ruleEngine.match({ type: "SW_REGISTRATIONS_PRESENT", data: d, ctx: {} }) : null;
          const meta = matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;

          sendLog("SW_REGISTRATIONS_PRESENT", d, meta);
        }

        const active = hasRegs && hasController;

        if (active && !sentActive) {
          sentActive = true;
          setState({ sentActive: true });

          const ctrl = ctrlInfo.controller || {};
          const ctrlAbs = ctrl.scriptURL ? absUrl(ctrl.scriptURL) : "";
          const ctrlOrigin = ctrlAbs ? originOf(ctrlAbs) : "";

          const d = {
            reason: safeStr(reason, 80),
            hasRegs,
            regsCount: regs.length,
            regs,
            hasController,
            controller: ctrl,
            controllerAbs: ctrlAbs,
            controllerOrigin: ctrlOrigin,

            firstRegSeenTs: firstRegSeenTs || null,
            dtMs: firstRegSeenTs ? (Date.now() - firstRegSeenTs) : null,
          };

          const baseMeta = {
            ruleId: "SW_PERSISTENCE_ACTIVE",
            scoreDelta: 20,
            severity: "MEDIUM",
            targetOrigin: ctrlOrigin || location.origin,
            evidence: {
              reason: d.reason,
              regsCount: d.regsCount,
              hasController: d.hasController,
              controller: d.controller,
              controllerOrigin: d.controllerOrigin || "",
              dtMs: d.dtMs,
            }
          };

          const matched = ruleEngine ? ruleEngine.match({ type: "SW_PERSISTENCE_ACTIVE", data: d, ctx: {} }) : null;
          const meta = matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;

          try {
            setState({
              lastActiveTs: Date.now(),
              lastActiveData: d,
              lastSwRegisterTs: lastSwRegisterTs,
              lastSwRegisterData: lastSwRegisterData,
            });
          } catch (_) {}

          sendLog("SW_PERSISTENCE_ACTIVE", d, meta);
          tryEmitPocGChain(d, "SW_PERSISTENCE_ACTIVE");
        }
      } catch (_) {}
    }

    check("init");
    setTimeout(() => check("t+1s"), 1000);
    setTimeout(() => check("t+5s"), 5000);
    setTimeout(() => check("t+15s"), 15000);

    try {
      if (navigator.serviceWorker && typeof navigator.serviceWorker.addEventListener === "function") {
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          check("controllerchange");
        });
      }
    } catch (_) {}

    try {
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) check("visibilitychange");
      });
    } catch (_) {}

    setState({
      firstRegSeenTs,
      lastRegs,
      sentRegistrationExists,
      sentActive,
      lastSwRegisterTs,
      lastSwRegisterData,
    });

    const prev = getState();
    if (prev) {
      try {
        if (prev.firstRegSeenTs) firstRegSeenTs = prev.firstRegSeenTs;
        if (prev.sentRegistrationExists) sentRegistrationExists = true;
        if (prev.sentActive) sentActive = true;

        if (prev.lastSwRegisterTs) lastSwRegisterTs = prev.lastSwRegisterTs;
        if (prev.lastSwRegisterData) lastSwRegisterData = prev.lastSwRegisterData;
      } catch (_) {}
    }
  }

  window.BRS_Detectors = window.BRS_Detectors || {};
  window.BRS_Detectors.swPersistence = { start };
})();
