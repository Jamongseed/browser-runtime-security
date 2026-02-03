// api/brsQuery.ts
// BRS_Query client (API Gateway prod)

//const API_ORIGIN = process.env.REACT_APP_API_ORIGIN;
const API_ORIGIN =
  "https://z5g5ahz467.execute-api.ap-northeast-2.amazonaws.com/prod";

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
  origin = API_ORIGIN,
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
  agg: "/agg/global",

  trendDomain: "/trends/domain",
  trendRule: "/trends/rule",
  ruleDescribtion: "/rulemeta",
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

export type EventItem = {
  ts: number;
  day: string;
  type: string;
  ruleId: string;
  severity: "LOW" | "MEDIUM" | "HIGH"; // 예상되는 값들을 유니온 타입으로 지정
  scoreDelta: string | number;
  sessionId: string;
  installId: string;
  origin: string;
  domain: string;
  page: string;
  eventId: string;
  rulesetId: string;
  display: {
    title: string;
    oneLine: string;
    locale: string;
    rulesetId: string;
  };
};

export type AggItem = {
  sk: string;
  cnt: number;
  scoreSum: number;
};

export type TopNItem = { key: string; cnt: number; scoreSum?: number };

export type SeverityAggItem = { key: string; cnt: number };

// ---- params start ----------
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

export type EventsByDomainParams = {
  domain: string;
  startDay: string;
  endDay: string;
  limit: number;
  newest?: boolean;
};

export type EventsByRuleParams = {
  ruleId: string;
  startDay: string;
  endDay: string;
  limit: number;
  newest?: boolean;
};

export type EventsByInstallParams = {
  installId: string;
  startDay: string;
  endDay: string;
  nextToken?: string;
};

export type EventBodyParams = { eventId: string };

// ---- Aggregates API ----
export type AggRangeParams = {
  startDay?: string; // optional; lambda는 default last 30 days 지원 :contentReference[oaicite:7]{index=7}
  endDay?: string;
  limit?: number;
};

export type AggParams = {
  kind: string;
  startDay: string;
  endDay: string;
};

//------------param end ------------
// -----------response start -----------

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
  ruleId: string;
  domain: string;
  payload: {
    payloadJson?: any;
    payloadTruncated?: boolean;
    payloadHash?: string;
  };
};

export type RuleDescriptionResponse = {
  ok: boolean;
  rulesetId: string;
  ruleId: string;
  locale: string;
  online: string;
  titme: string;
};

export type TrendDaysResponse = {
  ok: boolean;
  query: any;
  severities: string[];
  days: Array<{ day: string; buckets: Record<string, number> }>;
};

export type ruleDescribtionParams = { ruleId: string; local: string };

export type EventsByRuleResponse = {
  ok: boolean;
  query: any;
  items: EventItem[];
};

export type EventsByDomainResponse = {
  ok: boolean;
  query: any;
  items: EventItem[];
};

export type AggResponse = {
  ok: boolean;
  query: any;
  items: AggItem[];
};

export const brsQueryApi = {
  // ----- events list (day fan-out, token은 shard fanout token) -----
  events: (args: EventsRangeParams, origin?: string) =>
    getJson<ListResponse<ThreatEventItem>>(BRS_Query.events, args, origin),

  // ----- body -----
  eventBody: (args: EventBodyParams) =>
    getJson<EventBodyResponse>(BRS_Query.eventBody, args),

  // ----- body -----
  ruleDescription: (args: ruleDescribtionParams) =>
    getJson<ruleDescribtionParams>(BRS_Query.ruleDescribtion, args),

  // ----- by install (sinceMs window) -----
  eventsByInstall: (args: EventsByInstallParams) =>
    getJson<ListResponse<ThreatEventItem>>(
      BRS_Query.eventsByInstall,
      args,
      origin,
    ),

  // ----- by domain/rule/sev -----
  eventsByDomain: (args: EventsByDomainParams, origin?: string) =>
    getJson<EventsByDomainResponse>(BRS_Query.eventsByDomain, args),

  eventsByRule: (args: EventsByRuleParams) =>
    getJson<EventsByRuleResponse>(BRS_Query.eventsByRule, args),

  // ----- aggregates -----
  aggSearch: (args: AggParams) => getJson<AggResponse>(BRS_Query.agg, args),

  topnRules: (args: AggRangeParams) =>
    getJson<{ ok: boolean; query: any; items: TopNItem[] }>(BRS_Query.topn, {
      ...args,
      type: "rule",
    }),

  severityRange: (args: AggRangeParams) =>
    getJson<{ ok: boolean; query: any; items: SeverityAggItem[] }>(
      BRS_Query.severityRange,
      args,
      origin,
    ),

  trendRule: (
    args: { ruleId: string; startDay?: string; endDay?: string },
    origin?: string,
  ) => getJson<TrendDaysResponse>(BRS_Query.trendRule, args, origin),

  trendDomain: (
    args: { domain: string; startDay?: string; endDay?: string },
    origin?: string,
  ) => getJson<TrendDaysResponse>(BRS_Query.trendDomain, args, origin),
};
