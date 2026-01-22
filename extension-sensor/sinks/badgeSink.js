export function createBadgeSink() {
  return {
    name: "BadgeSink",

    shouldHandle(threat) {
      const isSensorReady = threat.type === "SENSOR_READY";
      const isImportantSeverity = threat.severity === "HIGH" || threat.severity === "MEDIUM";

      return isSensorReady || isImportantSeverity;
    },

    async send(threat, context) {
      const tabId = context.sender?.tab?.id || threat.tabId;
      if (!tabId) return { status: "no_tab_id" };

      try {
        if (threat.type === "SENSOR_READY") {
          const frameId = context.sender?.frameId;

          if (frameId === 0) {
            await chrome.action.setBadgeText({ text: "", tabId });
            return { status: "cleared" };
          } else {
            return { status: "ignored_iframe_ready" };
          }
        }

        const currentText = await chrome.action.getBadgeText({ tabId });
        if (currentText === "!!!" && threat.severity === "MEDIUM") {
          return { status: "ignored_due_to_priority" };
        }

        if (threat.severity === "HIGH") {
          await chrome.action.setBadgeText({ text: "!!!", tabId });
          await chrome.action.setBadgeBackgroundColor({ color: "#FF0000", tabId });
          return { status: "updated", color: "red" };

        } else if (threat.severity === "MEDIUM") {
          await chrome.action.setBadgeText({ text: "!", tabId });
          await chrome.action.setBadgeBackgroundColor({ color: "#FFA500", tabId });
          return { status: "updated", color: "orange" };
        }

        return { status: "ignored" };
      } catch (err) {
        console.error(`[BRS] ${this.name} failed:`, err);
        throw new Error(`Badge update failed: ${err.message}`);
      }

    }
  };
}