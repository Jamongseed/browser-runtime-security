const STORAGE_KEY = "brs_threat_logs";

export function createLocalStorageSink({ maxLogCount = 200, targets = [] } = {}) {
  return {
    name: "LocalStorageSink",

    shouldHandle(threat) {
      return !targets || targets.length === 0 || targets.includes(threat.severity);
    },

    async send(threat) {
      return navigator.locks.request('brs_local_storage_lock', async (lock) => {
        try {
          let { [STORAGE_KEY]: logs, tabSessions } = await chrome.storage.local.get({
            [STORAGE_KEY]: [],
            tabSessions: {}
          });

          const logEntry = { ...threat, savedAt: Date.now() };
          logs.push(logEntry);

          if (logs.length > maxLogCount) logs = logs.slice(-maxLogCount);
          if (threat.tabId && threat.sessionId) tabSessions[threat.tabId] = threat.sessionId;

          await chrome.storage.local.set({ [STORAGE_KEY]: logs, tabSessions });

          return { status: "saved", totalLogs: logs.length };

        } catch (err) {
          throw new Error(`Storage Write Failed: ${err.message}`);
        }
      });
    }
  };
}