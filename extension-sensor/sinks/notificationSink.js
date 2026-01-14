const NOTIFICATION_COOLDOWN = 5000;
const NOTIFICATION_DURATION = 10000;

const THREAT_MESSAGES = {
	"PHISHING_FORM_MISMATCH": "피싱 사이트로 의심되는 폼 전송이 감지되었습니다.",
	"HIDDEN_IFRAME_INSERT": "보이지 않는 프레임 삽입이 탐지되었습니다.",
	"COOKIE_THEFT": "민감한 쿠키 정보에 대한 접근 시도가 포착되었습니다.",
	"DEFAULT": "현재 페이지에서 의심스러운 동작이 감지되었습니다."
};

let lastNotiTimestamp = 0;

// 운영체제 이름 반환
async function getOSName() {
	const info = await chrome.runtime.getPlatformInfo();
	return info.os;		// // 'win', 'mac', 'linux' 등
}

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
			return !!threat.severity;
		},

		async send(threat) {
			const storage = await chrome.storage.local.get("notification_settings");
			const settings = storage.notification_settings || { low: false, medium: false, high: true };

			const severityKey = (threat.severity || "LOW").toLowerCase();
			
			if (!settings[severityKey]) {
        return { status: "ignored_user_setting", severity: threat.severity };
      }

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

			const os = await getOSName();
			const notificationOptions = buildNotificationOptions(threat, os);

			const reportId = threat.reportId || `noti_${now}`;

			await chrome.notifications.create(reportId, notificationOptions);

			await chrome.storage.local.set({ lastNotiTime: now });

			setTimeout(() => {
				chrome.notifications.clear(reportId);
			}, NOTIFICATION_DURATION);

			return { status: "shown", reportId };
		}
	};
}