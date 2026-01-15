import { runWithLock } from "../utils/lock.js";
import { STORAGE_KEYS } from '../config.js';

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
          let { [STORAGE_KEYS.LOGS]: logs } = await chrome.storage.local.get({
            [STORAGE_KEYS.LOGS]: [],  
          });

          const logEntry = { ...threat, savedAt: Date.now() };
          logs.push(logEntry);

          if (logs.length > maxLogCount) logs = logs.slice(-maxLogCount);

          await chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: logs });

          return { status: "saved", totalLogs: logs.length };

        } catch (err) {
          throw new Error(`Storage Write Failed: ${err.message}`);
        }
      });
    }
  };
}