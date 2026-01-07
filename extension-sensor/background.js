import { createDispatcher } from "./sinks/dispatcher.js";
import { createHttpSink } from "./sinks/httpSink.js";
import { createLocalStorageSink } from "./sinks/localStorageSink.js";
import { createBadgeSink } from "./sinks/badgeSink.js";
import { createNotificationSink } from "./sinks/notificationSink.js";
import { generateReportHash } from "./utils/crypto.js";
import { updateTabSession, removeTabSession } from "./utils/sessionManager.js";
import { getOrCreateInstallId, initInstallId } from './utils/installIdManager.js';

initInstallId();

const CONFIG = {
	API_ENDPOINT: "http://localhost:8080/events",
  // API_ENDPOINT: "https://81rdme5tpd.execute-api.ap-southeast-2.amazonaws.com/prod/events",
	USE_SERVER_DASHBOARD:   false,
	AWS_DASHBOARD_URL: "",
	LOCAL_DASHBOARD_PATH: "local_dashboard/dashboard.html"
};

const DASHBOARD_URL = (CONFIG.USE_SERVER_DASHBOARD && CONFIG.AWS_DASHBOARD_URL)
	? CONFIG.AWS_DASHBOARD_URL
	: chrome.runtime.getURL(CONFIG.LOCAL_DASHBOARD_PATH);

// dispatcher 생성
const dispatcher = createDispatcher([
  // HIGH, MEDIUM만 전송
	createHttpSink({
		url: CONFIG.API_ENDPOINT,
		targets: ["HIGH", "MEDIUM"]
	}),
  // 로컬 저장은 모두
	createLocalStorageSink({
		maxLogCount: 200,
		targets: ["HIGH", "MEDIUM", "LOW"]
	}),
	createBadgeSink(),
	createNotificationSink({
		dashboardUrl: DASHBOARD_URL
	})
]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action !== "REPORT_THREAT") return false;

	(async () => {
		try {
			const inputData = message.data;
			const tabId = sender.tab ? sender.tab.id : null;
      const installId = await getOrCreateInstallId();

      if (!tabId && inputData.type !== "SENSOR_READY") {
        console.warn("[BRS] Message received without tabId");
        sendResponse({ ok: false, error: "Missing tabId" });
        return;
      }

      // tapId와 SessionId 매핑
      if (tabId && inputData.sessionId) {
        await updateTabSession(tabId, inputData.sessionId);
      }

      let reportId = null;
      // type이 SENSOR_READY일 경우 reportId 생성 생략
			if (inputData.type !== "SENSOR_READY") {
        reportId = await generateReportHash(inputData.sessionId, inputData.ts);
      }

			const enrichedData = {
				...inputData,
        installId,
				reportId,
				tabId,
        // Chrome브라우저에서 제공하는 URL
				browserUrl: sender.tab?.url
			};
      
      	// dispatcher 실행
			const result = await dispatcher.dispatch(enrichedData, { sender });

			sendResponse({ ok: true, result });

		} catch (err) {
			console.error("[BRS] Background Process Error:", err);
			sendResponse({ ok: false, error: err.message });
		}
	})();

	return true;
});

// 탭 세션 정보 삭제
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabSession(tabId);
});


chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ tabSessions: {} });
  console.log("[BRS] Extension installed. Session map initialized.");
});