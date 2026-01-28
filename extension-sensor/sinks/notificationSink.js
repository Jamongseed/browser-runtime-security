import { STORAGE_KEYS, DEFAULT_SETTINGS, SINK_CONFIG } from '../config.js';
import { getThreatMessage } from '../utils/threatMessages.js';

const SEVERITY_RANK = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
const tabStateCache = new Map();

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabStateCache.has(tabId)) {
    tabStateCache.delete(tabId);
  }
});

export function createNotificationSink() {
  return {
    name: "NotificationSink",

    shouldHandle(threat) {
      return !!threat.severity && !!threat.tabId && threat.reportId;
    },

    async send(threat) {
      const { tabId, severity, reportId } = threat;
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

        const rawMessage = await getThreatMessage(threat.ruleId, "oneLine");

        const htmlMessage = rawMessage.replace(/\. /g, '.<br/>');
        return new Promise((resolve, reject) => {
          this._sendToast(threat, htmlMessage, reportId, resolve);
        });
      } catch (err) {
        console.error(`[BRS] ${this.name} failed:`, err);
        throw new Error(`Notification Display Failed: ${err.message}`);
      }
    },

    _sendToast(threat, messageText, reportId, resolve) {
      if (!threat.tabId) {
        return resolve({ status: "skipped_no_tab" });
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
          console.debug("[BRS] Toast message fail:", chrome.runtime.lastError.message);
        }
        resolve({ status: "toast_initiated" });
      });
    }
  };
}