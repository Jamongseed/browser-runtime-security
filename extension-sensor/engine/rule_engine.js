(function () {
  async function loadJson(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("fetch failed: " + r.status);
    return r.json();
  }

  function isValidRuleset(rs) {
    return !!rs && Array.isArray(rs.rules);
  }

  const RuleEngine = {
    ruleset: null,

    async load() {
      // 1) storage 우선
      try {
        if (typeof chrome !== "undefined" && chrome.storage?.local?.get) {
          const stored = await chrome.storage.local.get({ ruleset: null });
          if (stored && stored.ruleset && isValidRuleset(stored.ruleset)) {
            this.ruleset = stored.ruleset;
            return this.ruleset;
          }
        }
      } catch (e) {
        console.debug("[BRS] ruleset load(storage) failed:", String(e?.message || e));
      }

      // 2) 번들 기본 ruleset
      try {
        if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
          const url = chrome.runtime.getURL("rulesets/default-v1.json");
          const rs = await loadJson(url);
          this.ruleset = isValidRuleset(rs) ? rs : null;
          return this.ruleset;
        }
      } catch (e) {
        console.debug("[BRS] ruleset load(default) failed:", String(e?.message || e));
      }

      this.ruleset = null;
      return null;
    },

    match(event) {
      const rs = this.ruleset;
      if (!isValidRuleset(rs)) return null;

      for (const rule of rs.rules) {
        if (!rule || rule.enabled === false) continue;

        const when = rule.when || {};
        if (when.type && when.type !== event.type) continue;

        if (when.equals) {
          let ok = true;
          for (const [k, v] of Object.entries(when.equals)) {
            if (event.data?.[k] !== v) { ok = false; break; }
          }
          if (!ok) continue;
        }

        if (when.contains) {
          let ok = true;
          for (const [k, v] of Object.entries(when.contains)) {
            const s = String(event.data?.[k] ?? "");
            if (!s.includes(String(v))) { ok = false; break; }
          }
          if (!ok) continue;
        }

        return rule;
      }
      return null;
    },

    apply(rule, baseMeta) {
      const meta = Object.assign({}, baseMeta || {});
      const act = (rule && rule.action) ? rule.action : {};

      if (act.ruleId) meta.ruleId = act.ruleId;
      if (typeof act.scoreDelta === "number") meta.scoreDelta = act.scoreDelta;
      if (act.severity) meta.severity = act.severity;
      if (act.targetOrigin) meta.targetOrigin = act.targetOrigin;

      return meta;
    },
  };

  window.BRS_RuleEngine = RuleEngine;
})();
