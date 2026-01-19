// api/brsQuery.ts
// BRS_Query client (API Gateway prod)

export const API_BASE = "https://z5g5ahz467.execute-api.ap-northeast-2.amazonaws.com/prod";

/** BRS_Query endpoints */
export const BRS_Query = {
  // Aggregates (operator)
  aggregatesTopDomainsRange: "/agg/global",
  aggregatesTopRulesRange: "/aggregates/topn/rules-range",
  aggregatesSeverityRange: "/agg/global",

  // Trends (operator)
  trendsDomain: "/trends/domain",
  trendsRule: "/trends/rule",

  // Events lists (operator)
  eventsByDomain: "/events/by-domain",
  eventsByRule: "/events/by-rule",
  eventsBySev: "/events/by-sev",

  // Event detail (operator)
  eventBody: "/events/body",

  // 
  eventBySeverity: "/events/by-sev",
  // User
  eventsByInstall: "/events/by-install",
} as const;

// ------------------------
// Types
// ------------------------

export type DayRangeParams = {
  origin: string;
  startDay: string; // YYYY-MM-DD
  endDay: string;   // YYYY-MM-DD
};

export type TopNParams = DayRangeParams & {
  limit?: number; // default 10~50 (server default exists)
};

export type ListParamsBase = DayRangeParams & {
  limit?: number;
  newest?: boolean; // true => 최신순
};

export type EventsByDomainParams = ListParamsBase & {
  domain: string;
};

export type EventsByRuleParams = ListParamsBase & {
  ruleId: string;
};

export type EventsBySevParams = ListParamsBase & {
  severity: "HIGH" | "MEDIUM" | "LOW" | string; // 서버는 string 허용
};

export type TrendsDomainParams = DayRangeParams & {
  domain: string;
};

export type TrendsRuleParams = DayRangeParams & {
  ruleId: string;
};

export type EventBodyParams = {
  eventId: string;
};

export type EventsByInstallParams = {
  installId: string;
  sinceMs?: number;   // ms epoch
  limit?: number;
  nextToken?: string; // pagination
};

export type DomainResponse = {
  sk: string;       // "DOMAIN#google.com" 형태
  cnt: number;      // 탐지 건수
  scoreSum: number; // 점수 합계
};

export type SeverityResponse = {
  sk: string;
  cnt: number;
};

export type ItemResponse = {
  severity: string;
  scoreDelta: number;
  domain: string;
  pageURL: string;
  eventId: string;
  installId: string;
}


// ------------------------
// HTTP helpers
// ------------------------
function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
) {
  const url = new URL(API_BASE + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function getJson<T>(path: string, params?: Record<string, any>): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    method: "GET",
    headers: { "content-type": "application/json" },
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { ok: false, reason: "NON_JSON_RESPONSE", raw: text };
  }

  if (!res.ok) {
    const msg = data?.reason || data?.error || `HTTP_${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

// ------------------------
// BRS_Query API methods
// ------------------------
export const brsQueryApi = {

  // GET /aggregates/severity?origin&day
  severity: ({ startDay, endDay }: { startDay: string, endDay: string }) => {
    console.log("전달된 날짜 확인serverity:", { startDay, endDay });
    return getJson<{ ok: boolean; query: any; items: SeverityResponse[] }>(
    BRS_Query.aggregatesSeverityRange, { kind: "sev", startDay, endDay } 
  )},

  // GET /aggregates/topn/domains?origin&day&limit
  topDomains: ({ startDay, endDay }: { startDay: string, endDay: string }) => {
    console.log("전달된 날짜 확인domain:", { startDay, endDay });
    return getJson<{ ok: boolean; query: any; items: DomainResponse[] }>(
      BRS_Query.aggregatesTopDomainsRange, { kind: "domain", startDay, endDay}
    )},

  severityLists: (args: { origin: string; serverity: string; startDay: string, endDay: string, limit: number, newest: string }) =>
    getJson<{ ok: boolean; query: any; items: ItemResponse[] }>(BRS_Query.eventBySeverity, args),

  // GET /events/by-install?installId=...&limit=50&sinceMs=10
  eventsByInstall: ({ installId, limit = 50, sinceMs = 10 }: { installId: string; limit?: number; sinceMs?: number }) => {
    console.log("전달된 인자 확인(Install):", { installId, limit, sinceMs });
    return getJson<{ ok: boolean; query: any; items: ItemResponse[]; nextToken?: string | null }>(
      BRS_Query.eventsByInstall, 
      { installId, limit, sinceMs }
    );
  },

/*
  // GET /aggregates/topn/rules?origin&day&limit
  topRules: (args: { origin: string; day: string; limit?: number }) =>
    getJson<{ ok: boolean; query: any; items: TopnItem[] }>(BRS_Query.aggregatesTopRules, args),

  // GET /trends/rule?origin&ruleId&startDay&endDay  (start/end optional -> server defaults to last 30d)
  ruleTrend: (args: { origin: string; ruleId: string; startDay?: string; endDay?: string }) =>
    getJson<{ ok: boolean; query: any; items: TrendDayItem[] }>(BRS_Query.trendsRule, args),

  // GET /trends/domain?origin&domain&startDay&endDay  (start/end optional -> server defaults to last 30d)
  domainTrend: (args: { origin: string; domain: string; startDay?: string; endDay?: string }) =>
    getJson<{ ok: boolean; query: any; items: TrendDayItem[] }>(BRS_Query.trendsDomain, args),

  // GET /events?origin&day&sinceMs&limit&nextToken  (sinceMs optional -> server defaults to 24h)
  events: (args: { origin: string; day: string; sinceMs?: number; limit?: number; nextToken?: string }) =>
    getJson<EventsResponse>(BRS_Query.events, args),


  // GET /events/by-install?installId&sinceMs&limit&nextToken
  eventsByInstall: (args: { installId: string; sinceMs?: number; limit?: number; nextToken?: string }) =>
    getJson<{ ok: boolean; query: any; items: EventItem[]; nextToken?: string | null }>(
      BRS_Query.eventsByInstall,
      args
    ),
    */
};
