export const SYSTEM_CONFIG = {
    API_ENDPOINT: "http://localhost:8080/events",
    DUMPS_ENDPOINT: "http://localhost:8080/dumps",
    // API_ENDPOINT: "https://tatnbs1wq5.execute-api.ap-northeast-2.amazonaws.com/prod/events",
    
    USE_SERVER_DASHBOARD: false,
    AWS_DASHBOARD_URL: "",
    LOCAL_DASHBOARD_PATH: "local_dashboard/dashboard.html",
};

export const STORAGE_KEYS = {
    WHITELIST: 'whitelist',
    NOTIFICATIONS: 'notification_settings',
    LOGS: 'brs_threat_logs',
    DASHBOARD_URL: 'dashboardUrl',
    LAST_NOTI_TIME: 'lastNotiTime',
    TAB_SESSIONS: 'tabSessions',
    INSTALL_ID: "brs_installId",
    FAILED_QUEUE: "failed_log_queue",
    HTTP_SINK_URL: "httpSinkUrl"
};


export const DEFAULT_SETTINGS = {
    [STORAGE_KEYS.WHITELIST]: [],
    [STORAGE_KEYS.NOTIFICATIONS]: { 
        low: false, 
        medium: false,
        high: true 
    }
};

