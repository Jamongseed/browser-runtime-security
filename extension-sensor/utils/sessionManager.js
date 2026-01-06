export async function updateTabSession(tabId, sessionId) {
  if (!tabId || !sessionId) return;

  try {
    const { tabSessions = {} } = await chrome.storage.local.get("tabSessions");
        
    tabSessions[tabId] = sessionId;
        
    await chrome.storage.local.set({ tabSessions });
  } catch (err) {
    console.error("[BRS] Session update failed:", err);
  }
}

export async function getSessionIdByTab(tabId) {
  const { tabSessions = {} } = await chrome.storage.local.get("tabSessions");
  return tabSessions[tabId];
}