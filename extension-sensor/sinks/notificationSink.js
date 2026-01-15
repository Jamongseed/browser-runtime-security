import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../config.js';

const NOTIFICATION_COOLDOWN = 5000;
const NOTIFICATION_DURATION = 10000;

const THREAT_MESSAGES = {
	"PHISHING_FORM_MISMATCH": "피싱 사이트로 의심되는 폼 전송이 감지되었습니다.",
	"HIDDEN_IFRAME_INSERT": "보이지 않는 프레임 삽입이 탐지되었습니다.",
	"COOKIE_THEFT": "민감한 쿠키 정보에 대한 접근 시도가 포착되었습니다.",
	"DEFAULT": "현재 페이지에서 의심스러운 동작이 감지되었습니다."
};

let lastNotiTimestamp = 0;

// OS별 알림 옵션 빌드
function buildNotificationOptions(threat, os) {
	const message = THREAT_MESSAGES[threat.ruleId] || THREAT_MESSAGES["DEFAULT"];
	const displayUrl = threat.browserUrl || threat.page || "";

	// 공통 옵션
	const options = {
  	type: 'basic',
    iconUrl: 'icon/notification_icon.png',
    title: `보안 위협 알림 (${threat.severity})`,
    message: message,
    contextMessage: displayUrl.substring(0, 40) + "...",
    priority: 2,
    requireInteraction: true
  };

	// if (os === 'win') {
	// } else if (os === 'mac') {
	// } else if ( os === 'linux') {
	// }

	return options;

}

chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.storage.local.get(STORAGE_KEYS.DASHBOARD_URL, (result) => {
    const dashboardUrl = result[STORAGE_KEYS.DASHBOARD_URL];
    	if (dashboardUrl) {
        	const targetUrl = `${dashboardUrl}?reportId=${notificationId}`;
        	chrome.tabs.create({ url: targetUrl });
        	chrome.notifications.clear(notificationId);
      	}
	});
});


export function createNotificationSink({ dashboardUrl }) {
	if (dashboardUrl) {
    	chrome.storage.local.set({ [STORAGE_KEYS.DASHBOARD_URL]: dashboardUrl });
		if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
  	}

	return {
		name: "NotificationSink",

		shouldHandle(threat) {
			return !!threat.severity;
		},

		send(threat) {
			const query = {
				...DEFAULT_SETTINGS, 
				[STORAGE_KEYS.LAST_NOTI_TIME]: 0 
			};

			chrome.storage.local.get(query, (storage) => {
				if (chrome.runtime.lastError) {
					console.error("[BRS] Storage Error:", chrome.runtime.lastError);
					return;
				}

				const settings = storage[STORAGE_KEYS.NOTIFICATIONS];
				const lastNotiTimeStore = storage[STORAGE_KEYS.LAST_NOTI_TIME];
				const severityKey = (threat.severity || "LOW").toLowerCase();

				if (!settings || !settings[severityKey]) {
                    return; 
                }

				const now = Date.now();

				if (now - lastNotiTimestamp <= NOTIFICATION_COOLDOWN) {
					return;
				}
				if (now - lastNotiTimeStore <= NOTIFICATION_COOLDOWN) {
                    lastNotiTimestamp = lastNotiTimeStore;
                    return;
                }

				lastNotiTimestamp = now;

				chrome.runtime.getPlatformInfo((info) => {
                    const os = info.os; 
                    const notificationOptions = buildNotificationOptions(threat, os);
                    const reportId = threat.reportId || `noti_${now}`;

					chrome.notifications.create(reportId, notificationOptions, (createdId) => {
                        if (chrome.runtime.lastError) {
                            console.error("[BRS] Notification Error:", chrome.runtime.lastError);
                            return;
                        }

						lastNotiTimestamp = now;
                        chrome.storage.local.set({ [STORAGE_KEYS.LAST_NOTI_TIME]: now });

						setTimeout(() => {
                            chrome.notifications.clear(createdId);
                        }, NOTIFICATION_DURATION);
                    });
                });
            });
		
			return { status: "processing" };
		}
	};
}