import { runWithLock } from "../utils/lock.js";

const STORAGE_KEY = "brs_threat_logs";
const STORAGE_LOCK = "brs_local_storage_lock";

export function createLocalStorageSink({ maxLogCount = 200, targets = [] } = {}) {
  return {
    name: "LocalStorageSink",

    shouldHandle(threat) {
      return !targets || targets.length === 0 || targets.includes(threat.severity);
    },

    async send(threat) {
      return runWithLock(STORAGE_LOCK, async (lock) => {
        try {
          let { [STORAGE_KEY]: logs } = await chrome.storage.local.get({
            [STORAGE_KEY]: [],  
          });

          const logEntry = { ...threat, savedAt: Date.now() };
          logs.push(logEntry);

          if (logs.length > maxLogCount) logs = logs.slice(-maxLogCount);

          await chrome.storage.local.set({ [STORAGE_KEY]: logs });

          return { status: "saved", totalLogs: logs.length };

        } catch (err) {
          throw new Error(`Storage Write Failed: ${err.message}`);
        }
      });
    }
  };
}