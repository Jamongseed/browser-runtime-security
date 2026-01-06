export function createBadgeSink() {
	return {
		name: "BadgeSink",

    // 현재 필터링은 없음
		shouldHandle(threat) {
			return true; 
		},

		async send(threat, context) {
			const tabId = context.sender?.tab?.id || threat.tabId;
			if (!tabId) return;

			if (threat.type === "SENSOR_READY" || threat.severity === "RESET") {
				await chrome.action.setBadgeText({ text: "", tabId });
				return { status: "cleared" };
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
				await chrome.action.setBadgeText({ text: "WARN", tabId });
				await chrome.action.setBadgeBackgroundColor({ color: "#FFA500", tabId });
				return { status: "updated", color: "orange" };
			}
            
			return { status: "ignored" };
		}
	};
}