const MAX_LOG_COUNT = 50;
const LOCAL_SAVE_TARGETS = ["HIGH", "MEDIUM"];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "REPORT_THREAT") {
    const threat = message.data;

    if (threat.type === "SENSOR_READY") {
        chrome.action.setBadgeText({ text: "", tabId: sender.tab.id });
        return;
    }
    
    if (threat.severity === "HIGH") {
        chrome.action.setBadgeText({ text: "!!!", tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
    } else if (threat.severity === "MEDIUM") {
        chrome.action.setBadgeText({ text: "WARN", tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "#FFA500" });
    }

    fetch("http://localhost:8080/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(threat),
    }).catch(err => console.error("Failed to transmit threat data:", err));

    if (LOCAL_SAVE_TARGETS.includes(threat.severity)) {
      chrome.storage.local.get({ threatLogs: [] }, (result) => {
        let logs = result.threatLogs;
        logs.push(threat);

        if (logs.length > MAX_LOG_COUNT) {
          logs = logs.slice(-MAX_LOG_COUNT);
        }
        chrome.storage.local.set({ threatLogs: logs });
      });
      
    }
  }
});