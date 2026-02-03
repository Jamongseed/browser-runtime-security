import { runWithLock } from "../utils/lock.js";
import { STORAGE_KEYS, LOCK_KEYS } from '../config.js';

export function createLocalStorageSink({ maxLogCount = 200, targets = [] } = {}) {
  return {
    name: "LocalStorageSink",

    shouldHandle(threat) {
      return !targets || targets.length === 0 || targets.includes(threat.severity);
    },

    async send(threat) {
      return runWithLock(LOCK_KEYS.LOCAL_STORAGE, async () => {
        try {
          const { [STORAGE_KEYS.LOGS]: existingLogs } = await chrome.storage.local.get({ [STORAGE_KEYS.LOGS]: [] });

          let logList = Array.isArray(existingLogs) ? existingLogs : [];
          logList.push({ ...threat, savedAt: Date.now() });

          if (logList.length > maxLogCount) logList = logList.slice(-maxLogCount);

          await chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: logList });

          return { status: "saved", totalLogs: logList.length };
        } catch (err) {
          console.error(`[BRS] ${this.name} failed:`, err);
          throw new Error(`Local Storage Write Failed: ${err.message}`);
        }
      });
    }
  };
}