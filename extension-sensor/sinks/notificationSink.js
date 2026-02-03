import { STORAGE_KEYS, DEFAULT_SETTINGS, SINK_CONFIG } from '../config.js';
import { getThreatMessage } from '../utils/threatMessages.js';

const SEVERITY_RANK = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
const tabStateCache = new Map();

function getEffectiveSeverity(threat) {
  const v = Number(threat?.data?.finalScore ?? threat?.evidence?.finalScore);
  if (Number.isFinite(v)) {
    if (v >= 80) return "HIGH";
    if (v >= 50) return "MEDIUM";
    return "LOW";
  }
  return (threat?.severity || "LOW").toUpperCase();
}

chrome.notifications.onClicked.addListener((notificationId) => {
  // notificationId == reportId 로 사용중
  // pending_toast_* 중에서 reportId가 같은 항목을 찾아 tabId를 복구
  chrome.storage.local.get(null, (all) => {
    let tabId = null;
    for (const [k, v] of Object.entries(all || {})) {
      if (!k.startsWith("pending_toast_")) continue;
      if (v && v.reportId === notificationId) {
        tabId = Number(k.slice("pending_toast_".length));
        break;
      }
    }
    chrome.runtime.sendMessage({
      action: "OPEN_DASHBOARD_FROM_TOAST",
      reportId: notificationId,
      tabId
    });
  });

  chrome.notifications.clear(notificationId, () => {
    if (chrome.runtime.lastError) console.debug("[BRS] Notification clear failed");
  });
});

export function createNotificationSink() {
  return {
    name: "NotificationSink",

    shouldHandle(threat) {
      return !!threat?.severity || Number.isFinite(Number(threat?.data?.finalScore ?? threat?.evidence?.finalScore));
    },

    async send(threat) {
      const { tabId, severity } = threat;
      const currentSeverity = getEffectiveSeverity(threat);
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
            const messageText = getThreatMessage(threat.ruleId, "oneLine", threat.data);

            if (os === 'linux') {
              this._sendLinuxToast(threat, messageText, reportId, resolve);
            } else {
              // 윈도우/맥: 네이티브 알림. 클릭 시 background로 OPEN_DASHBOARD_FROM_TOAST 전송됨
              const displayUrl = threat.browserUrl || threat.page || "";
              const options = {
                type: 'basic',
                iconUrl: 'icon/notification_icon.png',
                title: `보안 위협 알림 (${currentSeverity})`,
                message: messageText,
                contextMessage: (displayUrl ? displayUrl.substring(0, 40) + "..." : ""),
                priority: 2,
                requireInteraction: true
              };

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
        severity: getEffectiveSeverity(threat),
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