import { runWithLock } from "./lock.js";
import { STORAGE_KEYS, LOCK_KEYS } from "../config.js";

let cachedInstallId = null;

// ID 가져오기 (없으면 생성)
export async function getOrCreateInstallId() {
  if (cachedInstallId) return cachedInstallId;

  return runWithLock(LOCK_KEYS.INSTALL_ID, async () => {
    // 2차 캐시 확인, 락 대기열에 있던 다른 호출들이 앞 사람이 만든 캐시를 바로 사용
    if (cachedInstallId) return cachedInstallId;

    try {
      const obj = await chrome.storage.local.get(STORAGE_KEYS.INSTALL_ID);
      let id = obj[STORAGE_KEYS.INSTALL_ID];

      if (!id) {
        // UUID v4 생성
        id = crypto.randomUUID();
        await chrome.storage.local.set({ [STORAGE_KEYS.INSTALL_ID]: id });
      }

      cachedInstallId = id;
      return id;
    } catch (err) {
      console.error("[BRS] Failed to access local storage.:", err);
      throw err;
    }
  })
}

// 설치 시 초기화 
export function initInstallId() {
  chrome.runtime.onInstalled.addListener(async () => {
    try {
      await getOrCreateInstallId();
      console.log("[BRS] Install ID initialized.");
    } catch (err) {
      console.warn("[BRS] Install ID initialization skipped due to storage error.");
    }
  });
}