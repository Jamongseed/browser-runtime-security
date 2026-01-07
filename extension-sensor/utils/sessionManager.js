// 동시성 제어 Key
const SESSION_LOCK = "brs_session_lock";

export async function updateTabSession(tabId, sessionId) {
  if (!tabId || !sessionId) return;

  await navigator.locks.request(SESSION_LOCK, async () => {
    try {
      const { tabSessions = {} } = await chrome.storage.local.get("tabSessions");
      
      if (tabSessions[tabId] === sessionId) return;

      tabSessions[tabId] = sessionId;
      
      await chrome.storage.local.set({ tabSessions });
    } catch (err) {
      console.error("[BRS] Session update failed:", err);
    }
  });
}

export async function getSessionIdByTab(tabId) {
  const { tabSessions = {} } = await chrome.storage.local.get("tabSessions");
  return tabSessions[tabId];
}

export async function removeTabSession(tabId) {
  if (!tabId) return;

  await navigator.locks.request(SESSION_LOCK, async () => {
    try {
      const { tabSessions = {} } = await chrome.storage.local.get("tabSessions");
      
      if (tabSessions[tabId]) {
        delete tabSessions[tabId];
        await chrome.storage.local.set({ tabSessions });
        console.log(`[BRS] Session cleared: ${tabId}`);
      }
    } catch (err) {
      console.error("[BRS] Session remove failed:", err);
    }
  });
}