const INSTALL_ID_KEY = "brs_installId";

// ID 가져오기 (없으면 생성)
export async function getOrCreateInstallId() {
  const obj = await chrome.storage.local.get(INSTALL_ID_KEY);
  let id = obj[INSTALL_ID_KEY];

  if (!id) {
    // UUID v4 생성
    id = crypto.randomUUID(); 
    await chrome.storage.local.set({ [INSTALL_ID_KEY]: id });
  }
  return id;
}

// 설치 시 초기화 
export function initInstallId() {
  chrome.runtime.onInstalled.addListener(async () => {
    await getOrCreateInstallId();
    console.log("[BRS] Install ID initialized.");
  });
}