import { SYSTEM_CONFIG, STORAGE_KEYS, DEFAULT_SETTINGS, SINK_CONFIG, THREAT_MESSAGES } from '../config.js';

const SEVERITY_RANK = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
const tabStateCache = new Map();

// OS별 알림 옵션 빌드
function buildNotificationOptions(threat, os) {
  const message = THREAT_MESSAGES[threat.ruleId] || THREAT_MESSAGES["DEFAULT"];
  const displayUrl = threat.browserUrl || threat.page || "";

  // 공통 옵션
  const options = {
    type: 'basic',
    iconUrl: 'icon/notification_icon.png',
    title: `보안 위협 알림 (${threat.severity})`,
    message: message,
    contextMessage: displayUrl.substring(0, 40) + "...",
    priority: 2,
    requireInteraction: true
  };
  return options;
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const targetUrl = `${SYSTEM_CONFIG.DASHBOARD_URL}?reportId=${notificationId}`;
  try {
    await chrome.tabs.create({ url: targetUrl });
    chrome.notifications.clear(notificationId, () => {
      if (chrome.runtime.lastError) console.debug("[BRS] Notification clear failed");
    });
  } catch (err) {
    console.error("[BRS] Notification click handler error:", err);
  }
});

export function createNotificationSink() {
  return {
    name: "NotificationSink",

    shouldHandle(threat) {
      return !!threat.severity;
    },

    async send(threat) {
      const { tabId, severity } = threat;
      const currentSeverity = (severity || "LOW").toUpperCase();
      const tabKey = `last_noti_tab_${tabId}`;
      const now = Date.now();

      try {
        const cached = tabStateCache.get(tabId);
        if (cached) {
          const isTimeOverMem = (now - cached.lastTime) > SINK_CONFIG.NOTIFICATION_COOLDOWN;
          const isEscalatedMem = SEVERITY_RANK[currentSeverity] > SEVERITY_RANK[cached.lastSeverity];
          if (!isTimeOverMem && !isEscalatedMem) return { status: "muted_by_mem" };
        }

        const storage = await chrome.storage.local.get({
          [STORAGE_KEYS.NOTIFICATIONS]: DEFAULT_SETTINGS[STORAGE_KEYS.NOTIFICATIONS],
          [tabKey]: { lastTime: 0, lastSeverity: 'LOW' }
        });

        const settings = storage[STORAGE_KEYS.NOTIFICATIONS];
        const { lastTime, lastSeverity } = storage[tabKey];

        if (!settings?.[currentSeverity.toLowerCase()]) return { status: "muted_by_settings" };

        const isTimeOver = (now - lastTime) > SINK_CONFIG.NOTIFICATION_COOLDOWN;
        const isEscalated = SEVERITY_RANK[currentSeverity] > SEVERITY_RANK[lastSeverity];

        if (!isTimeOver && !isEscalated) {
          return { status: "muted_by_cooldown" };
        }

        const newState = { lastTime: now, lastSeverity: currentSeverity };
        tabStateCache.set(tabId, newState);

        await chrome.storage.local.set({ [tabKey]: newState });

        return new Promise((resolve, reject) => {
          chrome.runtime.getPlatformInfo((info) => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);

            const os = info.os;
            const reportId = threat.reportId || `noti_${Date.now()}`;
            const messageText = THREAT_MESSAGES[threat.ruleId] || THREAT_MESSAGES["DEFAULT"];

            if (os === 'linux') {
              this._sendLinuxToast(threat, messageText, reportId, resolve);
            } else {
              // 윈도우, 맥
              const options = buildNotificationOptions(threat, os);

              chrome.notifications.create(reportId, options, (id) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  setTimeout(() => chrome.notifications.clear(id, () => { }), SINK_CONFIG.NOTIFICATION_DURATION);
                  resolve({ status: "created", id });
                }
              });
            }
          });
        });
      } catch (err) {
        console.error(`[BRS] ${this.name} failed:`, err);
        throw new Error(`Notification Display Failed: ${err.message}`);
      }
    },

    _sendLinuxToast(threat, messageText, reportId, resolve) {
      if (!threat.tabId) {
        return resolve({ status: "linux_skipped_no_tab" });
      }

      const now = Date.now();
      const pendingData = {
        message: messageText,
        severity: threat.severity,
        reportId: reportId,
        ts: now
      };

      const storageKey = `pending_toast_${threat.tabId}`;
      chrome.storage.local.set({ [storageKey]: pendingData });

      chrome.tabs.sendMessage(threat.tabId, {
        action: "SHOW_TOAST",
        data: pendingData
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.debug("[BRS] Linux toast message fail:", chrome.runtime.lastError.message);
        }
        resolve({ status: "linux_toast_initiated" });
      });
    }
  };
}