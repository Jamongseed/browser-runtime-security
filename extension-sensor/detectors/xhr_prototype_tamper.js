(function () {
  function start(sendLog, ruleEngine) {
    const state = {
      reported: new Set(),
      lastFp: {},
    };

    try {
      window.__BRS_XHR_PROTO_TAMPER_STATE__ = window.__BRS_XHR_PROTO_TAMPER_STATE__ || {
        seen: false,
        props: { open: false, send: false, setRequestHeader: false },
        ts: 0,
        last: null,
      };
    } catch (_) {}

    const isNativeFn = (fn) => {
      try {
        if (typeof fn !== "function") return false;
        return Function.prototype.toString.call(fn).includes("[native code]");
      } catch {
        return false;
      }
    };

    const getDesc = (obj, prop) => {
      try {
        return Object.getOwnPropertyDescriptor(obj, prop);
      } catch {
        return null;
      }
    };

    const safeFnHead = (fn, max = 200) => {
      try {
        if (typeof fn !== "function") return "";
        const s = Function.prototype.toString.call(fn);
        return s.slice(0, max);
      } catch {
        return "";
      }
    };

    const fingerprint = (desc) => {
      if (!desc) return "null";
      const v = desc.value;
      return JSON.stringify({
        t: typeof v,
        head:
          typeof v === "function"
            ? safeFnHead(v, 120)
            : String(v).slice(0, 120),
        c: !!desc.configurable,
        w: !!desc.writable,
        e: !!desc.enumerable,
        hasGet: typeof desc.get === "function",
        hasSet: typeof desc.set === "function",
      });
    };

    const countMatches = (s, re) => {
      try {
        if (!s) return 0;
        const m = s.match(re);
        return m ? m.length : 0;
      } catch {
        return 0;
      }
    };

    const analyzeFn = (fn) => {
      const src = safeFnHead(fn, 1200);
      const srcLower = (src || "").toLowerCase();

      const hasHttpUrl = /https?:\/\/[^\s"'`<>]+/i.test(src);
      const hasFetch = /\bfetch\s*\(/i.test(src);
      const hasBeacon = /\bsendbeacon\b/i.test(src) || /\bnavigator\.sendbeacon\b/i.test(src);
      const hasKeepalive = /\bkeepalive\b/i.test(src);
      const hasImageExfil = /\bnew\s+Image\s*\(/i.test(src) || /\.src\s*=\s*["'`]?https?:\/\//i.test(src);
      const hasWebSocket = /\bWebSocket\s*\(/i.test(src);
      const hasPostMessage = /\bpostMessage\b/i.test(src);
      const hasMirrorKeyword = /\bmirror\b/i.test(src) || /\bcollector\b/i.test(src) || /\bexfil\b/i.test(srcLower);
      const hasJsonStringify = /\bJSON\.stringify\b/i.test(src);
      const hasStorage = /\blocalStorage\b/i.test(src) || /\bsessionStorage\b/i.test(src);
      const hasOriginRef = /\blocation\.origin\b/i.test(src) || /\bpageOrigin\b/i.test(srcLower);

      const openCalls = countMatches(src, /\bopen\s*\(/gi) + countMatches(src, /\.open\s*\(/gi);
      const sendCalls = countMatches(src, /\bsend\s*\(/gi) + countMatches(src, /\.send\s*\(/gi);

      let suspicionScore = 0;

      if (hasFetch) suspicionScore += 3;
      if (hasBeacon) suspicionScore += 3;
      if (hasImageExfil) suspicionScore += 3;
      if (hasWebSocket) suspicionScore += 3;

      if (hasKeepalive) suspicionScore += 2;
      if (hasMirrorKeyword) suspicionScore += 2;

      if (hasJsonStringify) suspicionScore += 1;
      if (hasStorage) suspicionScore += 1;
      if (hasOriginRef) suspicionScore += 1;

      if (hasHttpUrl) suspicionScore += 2;

      return {
        head: safeFnHead(fn, 220),
        hasHttpUrl,
        hasFetch,
        hasBeacon,
        hasKeepalive,
        hasImageExfil,
        hasWebSocket,
        hasPostMessage,
        hasMirrorKeyword,
        hasJsonStringify,
        hasStorage,
        hasOriginRef,
        openCalls,
        sendCalls,
        suspicionScore,
      };
    };

    const reportOnce = (key, event) => {
      if (state.reported.has(key)) return;
      state.reported.add(key);

      try {
        const target = (event.data && event.data.target) || "";
        const st = window.__BRS_XHR_PROTO_TAMPER_STATE__;
        if (st) {
          st.seen = true;
          if (target.includes(".open")) st.props.open = true;
          if (target.includes(".send")) st.props.send = true;
          if (target.includes(".setRequestHeader")) st.props.setRequestHeader = true;
          st.ts = Date.now();
          st.last = { type: event.type, ruleId: event.ruleId, data: event.data };
        }
      } catch (_) {}

      const baseMeta = {
        ruleId: event.ruleId,
        scoreDelta: event.scoreDelta,
        severity: event.severity,
        targetOrigin: location.origin,
      };

      const matched = ruleEngine ? ruleEngine.match({ type: event.type, data: event.data, ctx: {} }) : null;
      const meta = matched ? ruleEngine.apply(matched, baseMeta) : baseMeta;

      sendLog(event.type, event.data, meta);
    };

    const decideSeverity = (isNative, suspicionScore) => {
      if (isNative) return "LOW";
      if (suspicionScore >= 6) return "HIGH";
      if (suspicionScore >= 3) return "MEDIUM";
      return "LOW";
    };

    const decideScore = (isNative, suspicionScore) => {
      if (isNative) return 0;
      const base = 12;
      const extra = Math.min(40, suspicionScore * 6);
      return base + extra;
    };

    const checkOne = (prop) => {
      const proto = (typeof XMLHttpRequest !== "undefined" && XMLHttpRequest && XMLHttpRequest.prototype) || null;
      if (!proto) return;

      const desc = getDesc(proto, prop);
      const fp = fingerprint(desc);
      const val = desc && desc.value;

      if (state.lastFp[prop] === undefined) {
        const nativeNow = isNativeFn(val);
        if (typeof val === "function" && !nativeNow && !(val && val.__BRS_PATCHED__ === true)) {
          const analysis = analyzeFn(val);
          const severity = decideSeverity(false, analysis.suspicionScore);
          const scoreDelta = decideScore(false, analysis.suspicionScore);

          reportOnce(`XHR_PROTO_${prop}_INIT_${fp}`, {
            type: "PROTO_TAMPER",
            ruleId: `XHR_${prop.toUpperCase()}_PROTOTYPE_TAMPER`,
            severity,
            scoreDelta,
            data: {
              phase: "init",
              target: `XMLHttpRequest.prototype.${prop}`,
              isNative: false,
              desc: {
                configurable: !!desc?.configurable,
                writable: !!desc?.writable,
                enumerable: !!desc?.enumerable,
                valueType: typeof val,
              },
              analysis,
              valueHead: analysis.head,
              nextFp: fp,
            },
          });
        }

        state.lastFp[prop] = fp;
        return;
      }

      if (state.lastFp[prop] !== fp) {
        const nativeNow = isNativeFn(val);
        const analysis = typeof val === "function" ? analyzeFn(val) : { head: String(val).slice(0, 220), suspicionScore: 0 };

        if (val && val.__BRS_PATCHED__ === true) {
          state.lastFp[prop] = fp;
          return;
        }

        const severity = decideSeverity(nativeNow, analysis.suspicionScore);
        const scoreDelta = decideScore(nativeNow, analysis.suspicionScore);

        reportOnce(`XHR_PROTO_${prop}_CHANGED_${fp}`, {
          type: "PROTO_TAMPER",
          ruleId: `XHR_${prop.toUpperCase()}_PROTOTYPE_TAMPER`,
          severity,
          scoreDelta,
          data: {
            phase: "change",
            target: `XMLHttpRequest.prototype.${prop}`,
            isNative: nativeNow,
            desc: {
              configurable: !!desc?.configurable,
              writable: !!desc?.writable,
              enumerable: !!desc?.enumerable,
              valueType: typeof val,
            },
            analysis,
            valueHead: analysis.head,
            prevFp: state.lastFp[prop],
            nextFp: fp,
          },
        });

        state.lastFp[prop] = fp;
      }
    };

    const tick = () => {
      try {
        checkOne("open");
        checkOne("send");
        checkOne("setRequestHeader");
      } catch (_) {}
    };

    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }

  window.BRS_Detectors = window.BRS_Detectors || {};
  window.BRS_Detectors.xhrPrototypeTamper = { start };
})();