const NOTIFICATION_COOLDOWN = 5000;
const NOTIFICATION_DURATION = 10000;

const THREAT_MESSAGES = {
	"PHISHING_FORM_MISMATCH": "피싱 사이트로 의심되는 폼 전송이 감지되었습니다.",
	"HIDDEN_IFRAME_INSERT": "보이지 않는 프레임 삽입이 탐지되었습니다.",
	"COOKIE_THEFT": "민감한 쿠키 정보에 대한 접근 시도가 포착되었습니다.",
	"DEFAULT": "현재 페이지에서 의심스러운 동작이 감지되었습니다."
};

let lastNotiTimestamp = 0;

chrome.notifications.onClicked.addListener(async (notificationId) => {
    const { dashboardUrl } = await chrome.storage.local.get("dashboardUrl");
    if (dashboardUrl) {
      const targetUrl = `${dashboardUrl}?reportId=${notificationId}`;
      chrome.tabs.create({ url: targetUrl });
      chrome.notifications.clear(notificationId);
    }
});


export function createNotificationSink({ dashboardUrl }) {
	if (dashboardUrl) {
    chrome.storage.local.set({ dashboardUrl });
  }

	return {
		name: "NotificationSink",

		shouldHandle(threat) {
			return threat.severity === "HIGH";
		},

		async send(threat) {
			const now = Date.now();

      if (now - lastNotiTimestamp <= NOTIFICATION_COOLDOWN) {
        return { status: "ignored_cooldown_memory" };
      }

			const { lastNotiTime } = await chrome.storage.local.get({ lastNotiTime: 0 });
			if (now - lastNotiTime <= NOTIFICATION_COOLDOWN) {
        lastNotiTimestamp = lastNotiTime;
				return { status: "ignored_cooldown" };
			}

      lastNotiTimestamp = now;

			const message = THREAT_MESSAGES[threat.ruleId] || THREAT_MESSAGES["DEFAULT"];
			const reportId = threat.reportId || `noti_${now}`;
      const displayUrl = threat.browserUrl || threat.page || "";

			await chrome.notifications.create(reportId, {
				type: 'basic',
				iconUrl: 'icon/notification_icon.png',
				title: `보안 위협 알림 (${threat.severity})`,
				message: message,
				contextMessage: displayUrl.substring(0, 40) + "...",
				priority: 2,
				requireInteraction: true
			});

			await chrome.storage.local.set({ lastNotiTime: now });

			setTimeout(() => {
				chrome.notifications.clear(reportId);
			}, NOTIFICATION_DURATION);

			return { status: "shown", reportId };
		}
	};
}