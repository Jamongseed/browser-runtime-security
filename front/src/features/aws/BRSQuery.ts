// features/aws/BRSQuery.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

const API_ORIGIN = process.env.REACT_APP_API_ORIGIN;

if (!API_ORIGIN) {
  throw new Error("REACT_APP_API_ORIGIN is not defined");
}

type GetJsonResult<T> = T;

function qsStringify(params: Record<string, any>) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function getJson<T>(
  path: string,
  params: Record<string, any>,
  origin = API_ORIGIN
): Promise<GetJsonResult<T>> {
  const url = `${API_ORIGIN}${path}${qsStringify(params)}`;
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { ok: false, reason: "INVALID_JSON", raw: text };
  }
  if (!res.ok) {
    // 람다는 ok:false + reason을 주는 경우가 많아서 그대로 전달
    const reason = data?.reason || `HTTP_${res.status}`;
    const err = new Error(reason);
    (err as any).status = res.status;
    (err as any).data = data;
    throw err;
  }
  return data as T;
}

export const BRS_Query = {
  events: "/events",
  eventBody: "/events/body",
  eventsByInstall: "/events/by-install",
  eventsByDomain: "/events/by-domain",
  eventsByRule: "/events/by-rule",

  severityRange: "/severity-range",
  topn: "/topn",

  trendDomain: "/trends/domain",
  trendRule: "/trends/rule",
};

// ---- Common response shapes ----
export type ThreatEventItem = {
  ts: number; // tsMs
  day: string;
  type?: string;
  ruleId?: string;
  severity?: string;
  scoreDelta?: number;
  sessionId?: string;
  origin?: string;
  domain?: string;
  page?: string;
  eventId: string;
};

export type ListResponse<T> = {
  ok: boolean;
  query?: any;
  items: T[];
  nextToken?: string | null;
};

export type EventBodyResponse = {
  ok: boolean;
  eventId: string;
  meta: any;
  payload: {
    payloadJson?: any;
    payloadTruncated?: boolean;
    payloadHash?: string;
  };
};

// ---- Events API ----
export type EventsRangeParams = {
  startDay: string; // YYYY-MM-DD
  endDay: string; // YYYY-MM-DD
  limit?: number;
  nextToken?: string;
};

export type EventsBySevParams = EventsRangeParams & {
  severity: string; // raw value 그대로 :contentReference[oaicite:5]{index=5}
  newest?: boolean; // true -> newest mode (qs.newest=true) :contentReference[oaicite:6]{index=6}
};

export type EventsByDomainParams = EventsRangeParams & {
  domain: string;
  newest?: boolean;
};

export type EventsByRuleParams = EventsRangeParams & {
  ruleId: string;
  newest?: boolean;
};

export type EventsByInstallParams = {
  installId: string;
  sinceMs?: number;
  limit?: number;
  nextToken?: string;
};

export type EventBodyParams = { eventId: string };

// ---- Aggregates API ----
export type AggRangeParams = {
  startDay?: string; // optional; lambda는 default last 30 days 지원 :contentReference[oaicite:7]{index=7}
  endDay?: string;
  limit?: number;
};

export type TopNItem = { key: string; cnt: number; scoreSum?: number };

export type SeverityAggItem = { key: string; cnt: number };

export type TrendDaysResponse = {
  ok: boolean;
  query: any;
  severities: string[];
  days: Array<{ day: string; buckets: Record<string, number> }>;
};

export const brsQueryApi = {
  // ----- events list (day fan-out, token은 shard fanout token) -----
  events: (args: EventsRangeParams, origin?: string) =>
    getJson<ListResponse<ThreatEventItem>>(BRS_Query.events, args, origin),

  // ----- body -----
  eventBody: (args: EventBodyParams, origin?: string) =>
    getJson<EventBodyResponse>(BRS_Query.eventBody, args, origin),

  // ----- by install (sinceMs window) -----
  eventsByInstall: (args: EventsByInstallParams, origin?: string) =>
    getJson<ListResponse<ThreatEventItem>>(BRS_Query.eventsByInstall, args, origin),

  // ----- by domain/rule/sev -----
  eventsByDomain: (args: EventsByDomainParams, origin?: string) =>
    getJson<ListResponse<ThreatEventItem>>(BRS_Query.eventsByDomain, {
      ...args,
      newest: args.newest ? "true" : undefined,
    }, origin),

  eventsByRule: (args: EventsByRuleParams, origin?: string) =>
    getJson<ListResponse<ThreatEventItem>>(BRS_Query.eventsByRule, {
      ...args,
      newest: args.newest ? "true" : undefined,
    }, origin),

  // ----- aggregates -----
  topnDomains: (args: AggRangeParams, origin?: string) =>
    getJson<{ ok: boolean; query: any; items: TopNItem[] }>(BRS_Query.topn, { ...args, type: "domain" }),

  topnRules: (args: AggRangeParams, origin?: string) =>
    getJson<{ ok: boolean; query: any; items: TopNItem[] }>(BRS_Query.topn, { ...args, type: "rule" }),

  severityRange: (args: Omit<AggRangeParams, "limit">, origin?: string) =>
    getJson<{ ok: boolean; query: any; items: SeverityAggItem[] }>(BRS_Query.severityRange, args, origin),

  trendRule: (args: { ruleId: string; startDay?: string; endDay?: string }, origin?: string) =>
    getJson<TrendDaysResponse>(BRS_Query.trendRule, args, origin),

  trendDomain: (args: { domain: string; startDay?: string; endDay?: string }, origin?: string) =>
    getJson<TrendDaysResponse>(BRS_Query.trendDomain, args, origin),
};
