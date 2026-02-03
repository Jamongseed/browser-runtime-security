import { runWithLock } from "./lock.js";
import { STORAGE_KEYS, LOCK_KEYS } from "../config.js";

export async function updateTabSession(tabId, sessionId) {
  if (!tabId || !sessionId) return;

  await runWithLock(LOCK_KEYS.SESSION_LOCK, async () => {
    try {
      const { [STORAGE_KEYS.TAB_SESSIONS]: tabSessions = {} } = await chrome.storage.local.get(STORAGE_KEYS.TAB_SESSIONS);

      if (tabSessions[tabId] === sessionId) return;

      tabSessions[tabId] = sessionId;

      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_SESSIONS]: tabSessions });
    } catch (err) {
      console.error("[BRS] Session update failed:", err);
      throw err;
    }
  });
}

export async function removeTabSession(tabId) {
  if (!tabId) return;

  await runWithLock(LOCK_KEYS.SESSION_LOCK, async () => {
    try {
      const { [STORAGE_KEYS.TAB_SESSIONS]: tabSessions = {} } = await chrome.storage.local.get(STORAGE_KEYS.TAB_SESSIONS);

      if (tabSessions[tabId]) {
        delete tabSessions[tabId];
        await chrome.storage.local.set({ [STORAGE_KEYS.TAB_SESSIONS]: tabSessions });
        console.log(`[BRS] Session cleared: ${tabId}`);
      }
    } catch (err) {
      console.error("[BRS] Session remove failed:", err);
      throw err;
    }
  });
}