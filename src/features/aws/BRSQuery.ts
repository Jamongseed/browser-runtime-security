// api/brsQuery.ts
// BRS_Query client (API Gateway prod)

export const API_BASE = "https://z5g5ahz467.execute-api.ap-northeast-2.amazonaws.com/prod";

/** BRS_Query endpoints */
export const BRS_Query = {
  aggregatesTopDomains: "/aggregates/topn/domains",
  aggregatesTopRules: "/aggregates/topn/rules",
  aggregatesSeverity: "/aggregates/severity",
  trendsRule: "/trends/rule",
  trendsDomain: "/trends/domain",
  events: "/events",
  eventBody: "/events/body",
  eventsByInstall: "/events/by-install",
} as const;

// ------------------------
// Types
// ------------------------
export type SeverityKey = "HIGH" | "MEDIUM" | "LOW" | string;

export type TopnItem = { key: string; cnt: number; scoreSum?: number };
export type SeverityItem = { key: SeverityKey; cnt: number };
export type TrendDayItem = { day: string; HIGH: number; MEDIUM: number; LOW: number };

export type EventItem = {
  ts: number;
  day: string;
  type: string;
  ruleId: string;
  severity: SeverityKey;
  scoreClient?: number;
  scoreServer?: number;
  sessionId: string;
  origin: string;
  top_domain: string;
  page_host: string;
  page_path_masked: string;
  eventId: string;
};

export type EventsResponse = {
  ok: boolean;
  query: { origin: string; day: string; sinceMs: number; limit: number };
  items: EventItem[];
  nextToken?: string | null;
};

export type EventBodyResponse = {
  ok: boolean;
  eventId: string;
  body: {
    tsMs: number;
    day: string;
    installId: string;
    data: any;
    evidence: any;
    dataTruncated?: boolean;
    evidenceTruncated?: boolean;
  };
};

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
  // GET /aggregates/topn/domains?origin&day&limit
  topDomains: (args: { origin: string; day: string; limit?: number }) =>
    getJson<{ ok: boolean; query: any; items: TopnItem[] }>(BRS_Query.aggregatesTopDomains, args),

  // GET /aggregates/topn/rules?origin&day&limit
  topRules: (args: { origin: string; day: string; limit?: number }) =>
    getJson<{ ok: boolean; query: any; items: TopnItem[] }>(BRS_Query.aggregatesTopRules, args),

  // GET /aggregates/severity?origin&day
  severity: (args: { origin: string; day: string }) =>
    getJson<{ ok: boolean; query: any; items: SeverityItem[] }>(BRS_Query.aggregatesSeverity, args),

  // GET /trends/rule?origin&ruleId&startDay&endDay  (start/end optional -> server defaults to last 30d)
  ruleTrend: (args: { origin: string; ruleId: string; startDay?: string; endDay?: string }) =>
    getJson<{ ok: boolean; query: any; items: TrendDayItem[] }>(BRS_Query.trendsRule, args),

  // GET /trends/domain?origin&domain&startDay&endDay  (start/end optional -> server defaults to last 30d)
  domainTrend: (args: { origin: string; domain: string; startDay?: string; endDay?: string }) =>
    getJson<{ ok: boolean; query: any; items: TrendDayItem[] }>(BRS_Query.trendsDomain, args),

  // GET /events?origin&day&sinceMs&limit&nextToken  (sinceMs optional -> server defaults to 24h)
  events: (args: { origin: string; day: string; sinceMs?: number; limit?: number; nextToken?: string }) =>
    getJson<EventsResponse>(BRS_Query.events, args),

  // GET /events/body?eventId
  eventBody: (eventId: string) =>
    getJson<EventBodyResponse>(BRS_Query.eventBody, { eventId }),

  // GET /events/by-install?installId&sinceMs&limit&nextToken
  eventsByInstall: (args: { installId: string; sinceMs?: number; limit?: number; nextToken?: string }) =>
    getJson<{ ok: boolean; query: any; items: EventItem[]; nextToken?: string | null }>(
      BRS_Query.eventsByInstall,
      args
    ),
};
