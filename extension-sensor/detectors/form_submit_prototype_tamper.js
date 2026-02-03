(function () {
  function start(sendLog, ruleEngine) {
    const state = {
      reported: new Set(),
      last: {},
    };

    // (추가) proto tamper 상관분석용 공유 상태(1bit + 마지막 스냅샷)
    // - content.js가 FORM_SUBMIT 시점에 이 값을 읽어서 protoTamperSeen/evidence를 채움
    try {
      window.__BRS_FORM_PROTO_TAMPER_STATE__ = window.__BRS_FORM_PROTO_TAMPER_STATE__ || {
        seen: false,
        props: { submit: false, requestSubmit: false },
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
      try { return Object.getOwnPropertyDescriptor(obj, prop); } catch { return null; }
    };

    const fingerprint = (desc) => {
      if (!desc) return "null";
      const v = desc.value;
      return JSON.stringify({
        t: typeof v,
        head: typeof v === "function"
          ? Function.prototype.toString.call(v).slice(0, 80)
          : String(v).slice(0, 80),
        c: !!desc.configurable,
        w: !!desc.writable,
        e: !!desc.enumerable,
        hasGet: typeof desc.get === "function",
        hasSet: typeof desc.set === "function",
      });
    };

    const reportOnce = (key, event) => {
      if (state.reported.has(key)) return;
      state.reported.add(key);

      // (추가) 마지막 tamper 스냅샷을 공유 상태로 저장 (FORM_SUBMIT evidence에 활용)
      try {
        const propGuess =
          (event.data && typeof event.data.target === "string" && event.data.target.includes(".requestSubmit"))
            ? "requestSubmit"
            : (event.data && typeof event.data.target === "string" && event.data.target.includes(".submit"))
              ? "submit"
              : null;

        const st = window.__BRS_FORM_PROTO_TAMPER_STATE__;
        if (st) {
          st.seen = true;
          if (propGuess) st.props[propGuess] = true;
          st.ts = Date.now();
          st.last = {
            type: event.type,
            ruleId: event.ruleId,
            data: event.data,
          };
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

    const checkOne = (prop) => {
      const proto = HTMLFormElement && HTMLFormElement.prototype;
      if (!proto) return;

      const desc = getDesc(proto, prop);
      const fp = fingerprint(desc);

      if (state.last[prop] === undefined) {
        const val0 = desc && desc.value;

        if (val0 && val0.__BRS_PATCHED__ === true) {
          const orig0 = val0.__BRS_ORIG__;
          let origIsNative0 = true;

          if (typeof val0.__BRS_ORIG_IS_NATIVE__ === "boolean") {
            origIsNative0 = val0.__BRS_ORIG_IS_NATIVE__;
          } else {
            origIsNative0 = isNativeFn(orig0);
          }

          if (!origIsNative0) {
            reportOnce(`FORM_PROTO_${prop}_PRE_TAMPER_INIT_${fp}`, {
              type: "PROTO_TAMPER",
              ruleId: `FORM_${prop.toUpperCase()}_PROTOTYPE_TAMPER`,
              severity: "MEDIUM",
              scoreDelta: 30,
              data: {
                target: `HTMLFormElement.prototype.${prop}`,
                wrappedByBRS: true,
                origIsNative: false,
                origHead: typeof orig0 === "function"
                  ? Function.prototype.toString.call(orig0).slice(0, 160)
                  : String(orig0).slice(0, 160),
              },
            });
          }
        }

        state.last[prop] = fp;
        return;
      }

      if (state.last[prop] !== fp) {
        const val = desc && desc.value;

        if (val && val.__BRS_PATCHED__ === true) {
          const orig = val.__BRS_ORIG__;
          let origIsNative = true;

          if (typeof val.__BRS_ORIG_IS_NATIVE__ === "boolean") {
            origIsNative = val.__BRS_ORIG_IS_NATIVE__;
          } else {
            origIsNative = isNativeFn(orig);
          }

          if (!origIsNative) {
            reportOnce(`FORM_PROTO_${prop}_PRE_TAMPER_${fp}`, {
              type: "PROTO_TAMPER",
              ruleId: `FORM_${prop.toUpperCase()}_PROTOTYPE_TAMPER`,
              severity: "MEDIUM",
              scoreDelta: 30,
              data: {
                target: `HTMLFormElement.prototype.${prop}`,
                wrappedByBRS: true,
                origIsNative: false,
                origHead: typeof orig === "function"
                  ? Function.prototype.toString.call(orig).slice(0, 160)
                  : String(orig).slice(0, 160),
              },
            });
          }

          state.last[prop] = fp;
          return;
        }

        reportOnce(`FORM_PROTO_${prop}_CHANGED_${fp}`, {
          type: "PROTO_TAMPER",
          ruleId: `FORM_${prop.toUpperCase()}_PROTOTYPE_TAMPER`,
          severity: "MEDIUM",
          scoreDelta: 30,
          data: {
            target: `HTMLFormElement.prototype.${prop}`,
            isNative: isNativeFn(val),
            desc: {
              configurable: !!desc?.configurable,
              writable: !!desc?.writable,
              enumerable: !!desc?.enumerable,
              valueType: typeof val,
            },
            valueHead: typeof val === "function"
              ? Function.prototype.toString.call(val).slice(0, 160)
              : String(val).slice(0, 160),
            prevFp: state.last[prop],
            nextFp: fp,
          },
        });

        state.last[prop] = fp;
      }
    };

    const tick = () => {
      try {
        checkOne("submit");
        checkOne("requestSubmit");
      } catch (_) {}
    };

    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }

  window.BRS_Detectors = window.BRS_Detectors || {};
  window.BRS_Detectors.formSubmitPrototypeTamper = { start };
})();
