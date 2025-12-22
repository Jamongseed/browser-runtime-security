chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "REPORT_THREAT") {
    const threat = message.data;
    
    if (threat.severity === "HIGH") {
        chrome.action.setBadgeText({ text: "!!!", tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
    } else if (threat.severity === "MEDIUM") {
        chrome.action.setBadgeText({ text: "WARN", tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "#FFA500" });
    }

    chrome.storage.local.get({ threatLogs: [] }, (result) => {
        const newLogs = [...result.threatLogs, threat];
        chrome.storage.local.set({ threatLogs: newLogs });
    });
    
    fetch("http://localhost:8080/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(threat),
    }).catch(err => console.error("Failed to transmit threat data:", err));
  }
});