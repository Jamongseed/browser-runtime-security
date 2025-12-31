const MAX_LOG_COUNT = 50;
const LOCAL_SAVE_TARGETS = ["HIGH", "MEDIUM"];
const NOTIFICATION_COOLDOWN = 5000;

const CONFIG = {
  // false: 개발용, true: AWS 배포용
  USE_SERVER_DASHBOARD: false,
  AWS_DASHBOARD_URL: "",
  API_ENDPOINT: "http://localhost:8080/events"
}

const THREAT_MESSAGES = {
  "PHISHING_FORM_MISMATCH": "피싱 사이트로 의심되는 폼 전송이 감지되었습니다.",
  "HIDDEN_IFRAME_INSERT": "보이지 않는 프레임 삽입이 탐지되었습니다.",
  "COOKIE_THEFT": "민감한 쿠키 정보에 대한 접근 시도가 포착되었습니다.",
  "DEFAULT": "현재 페이지에서 의심스러운 동작이 감지되었습니다."
};

// Utils
// 해시 생성
async function generateReportHash(sessionId, ts) {
  const extensionId = chrome.runtime.id;
  const rawString = `${extensionId}:${sessionId}:${ts}`;

  const msgBuffer = new TextEncoder().encode(rawString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);

  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 앞자리 32글자만 사용
  return hashHex.slice(0,32);
}

// Notification
// 알림 생성
function createThreatNotification(reportId, threatData) {
  const message = THREAT_MESSAGES[threatData.ruleId] || THREAT_MESSAGES["DEFAULT"];
  chrome.notifications.create(reportId, {
    type: 'basic',
    iconUrl: 'notification_icon.png',
    title: `보안 위협 알림 (${threatData.severity})`,
    message: message,
    contextMessage: threatData.page.substring(0, 40) + "...",
    priority: 2,
    requireInteraction: true
  });
}

function showThreatNotification(threatData) {
  if (threatData.severity !== "HIGH") return;

  const now = Date.now();

  chrome.storage.local.get({ lastNotiTime: 0 }, (result) => {
    const lastTime = result.lastNotiTime;

    // 5초 이내 반복 탐지시 알림 생략
    if (now - lastTime <= NOTIFICATION_COOLDOWN) {
      return;
    }

    createThreatNotification(threatData.reportId, threatData);

    chrome.storage.local.set({ lastNotiTime: now });
    
    // 알림 10초 유지
    setTimeout(() => {
      chrome.notifications.clear(threatData.reportId);
    }, 10000);
  });
}

// 알림 클릭시
chrome.notifications.onClicked.addListener((notificationId) => {
  let dashboardUrl;

  if (CONFIG.USE_SERVER_DASHBOARD && CONFIG.AWS_DASHBOARD_URL) {
    dashboardUrl = `${CONFIG.AWS_DASHBOARD_URL}?reportId=${notificationId}`;
  } else {
    dashboardUrl = chrome.runtime.getURL(`local_dashboard/dashboard.html?reportId=${notificationId}`);
  }
  chrome.tabs.create({ url: dashboardUrl });

  chrome.notifications.clear(notificationId);
});

// Badge
async function updateBadge(threatData) {
  const { tabId, severity } = threatData;

  if (!tabId) return;
  

  const currentText = await chrome.action.getBadgeText({ tabId });

  if (currentText === "!!!" && severity === "MEDIUM") {
    return;
  }

  if (severity === "HIGH") {
    chrome.action.setBadgeText({ text: "!!!", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000", tabId });
  } else if (severity === "MEDIUM") {
    chrome.action.setBadgeText({ text: "WARN", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#FFA500", tabId });
  } else if (severity === "RESET") {
    chrome.action.setBadgeText({ text: "", tabId });
  }
}

// Data Handling
async function sendReport(threatData) {
  const targetUrl = CONFIG.API_ENDPOINT;
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(threatData),
      keepalive: true
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error("Failed to transmit threat data:", err);
  }
}

function saveLog(threatData) {
  if (!LOCAL_SAVE_TARGETS.includes(threatData.severity)) return;

  chrome.storage.local.get({ threatLogs: [], tabSessions: {} }, (result) => {
    if (chrome.runtime.lastError) {
      console.error("[BRS] Storage get error:", chrome.runtime.lastError);
      return;
    }
    let logs = result.threatLogs;
    let tabSessionMap = result.tabSessions;

    logs.push(threatData);

    if (logs.length > MAX_LOG_COUNT) {
      logs = logs.slice(-MAX_LOG_COUNT);
    }

    if (threatData.tabId && threatData.sessionId) {
      tabSessionMap[threatData.tabId] = threatData.sessionId;
    }

    chrome.storage.local.set({ threatLogs: logs, tabSessions: tabSessionMap }, () => {
      if (chrome.runtime.lastError) {
        console.error("[BRS] Storage set error:", chrome.runtime.lastError);
      }
    });
  });
}

async function processThreatReport(inputData, sender) {
  try {
    const tabId = sender.tab ? sender.tab.id : null;

    if (inputData.type === "SENSOR_READY") {
      updateBadge({ tabId, severity: "RESET" });
      return;
    }

    const reportHash = await generateReportHash(inputData.sessionId, inputData.ts);

    const enrichedData = {
      ...inputData,
      reportId: reportHash,
      tabId
    };

    updateBadge(enrichedData);
    showThreatNotification(enrichedData);
    sendReport(enrichedData);
    saveLog(enrichedData);
  } catch (error) {
    console.error("[BRS] Process Error:", error);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "REPORT_THREAT") {
    processThreatReport(message.data, sender);
    return true;
  }
});