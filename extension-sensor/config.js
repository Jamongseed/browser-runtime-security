export const SYSTEM_CONFIG = {
  //API_ENDPOINT: "http://localhost:8080/events",
  //DUMPS_ENDPOINT: "http://localhost:8080/dumps",
  API_ENDPOINT: "https://bdct33dfx1.execute-api.ap-northeast-2.amazonaws.com/prod/events",
  DUMPS_ENDPOINT: "https://bdct33dfx1.execute-api.ap-northeast-2.amazonaws.com/prod/dumps",

  USE_SERVER_DASHBOARD: false,
  AWS_DASHBOARD_URL: "",
  LOCAL_DASHBOARD_PATH: "local_dashboard/dashboard.html",

  // Getter, 일반 변수처럼 사용 가능 (SYSTEM_CONFIG.DASHBOARD_URL)
  get DASHBOARD_URL() {
    if (this.USE_SERVER_DASHBOARD && this.AWS_DASHBOARD_URL) {
      return this.AWS_DASHBOARD_URL;
    }
    return chrome.runtime.getURL(this.LOCAL_DASHBOARD_PATH);
  }
};

export const SINK_CONFIG = {
  // Dispatcher
  TIMEOUT_MS: 15000,

  // NotificationSink
  NOTIFICATION_COOLDOWN: 5000,
  NOTIFICATION_DURATION: 10000,

  // HttpSink
  HTTP_MAX_QUEUE_SIZE: 100,
  HTTP_FETCH_TIMEOUT_MS: 5000,
  HTTP_MAX_RETRY: 3,
  HTTP_RETRY_BASE_DELAY_MS: 600,
  HTTP_BATCH_SIZE: 5,
  HTTP_LOG_EXPIRY_MS: 24 * 60 * 60 * 1000,
};

export const STORAGE_KEYS = {
  WHITELIST: 'whitelist',
  NOTIFICATIONS: 'notification_settings',
  LOGS: 'brs_threat_logs',
  LAST_NOTI_TIME: 'lastNotiTime',
  TAB_SESSIONS: 'tabSessions',
  INSTALL_ID: "brs_installId",
  FAILED_QUEUE: "failed_log_queue",
  IS_ENABLED: "brs_is_enabled"
};

export const DEFAULT_SETTINGS = {
  [STORAGE_KEYS.IS_ENABLED]: true,
  [STORAGE_KEYS.WHITELIST]: [],
  [STORAGE_KEYS.NOTIFICATIONS]: {
    low: false,
    medium: false,
    high: true
  }
};

export const LOCK_KEYS = {
  INSTALL_ID: "lock_install_id",
  SESSION_LOCK: "brs_session_lock",
  LOCAL_STORAGE: "brs_local_storage_lock",
  HTTP_QUEUE: "brs_http_queue_lock",
};

export const ALARM_KEYS = {
  RETRY_HTTP_LOGS: "retry_failed_logs"
};