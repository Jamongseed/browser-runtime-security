// src/features/aws/AwsSearch.js
import { brsQueryApi } from "./BRSQuery.ts";

/**
 * 서버 day 기준(Asia/Seoul)과 맞추기 위한 기본 날짜 생성
 * - "YYYY-MM-DD"
 */
function isoDaySeoul(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

function normalizeEventItem(it) {
  return {
    ts: it.ts,
    day: it.day,
    type: it.type,
    severity: it.severity,
    scoreDelta: it.scoreDelta,
    ruleId: it.ruleId,
    domain: it.domain,
    page: it.page,
    origin: it.origin,
    installId: it.installId,
    sessionId: it.sessionId,
    eventId: it.eventId,
  };
}

function uniqBy(arr, keyFn) {
  const map = new Map();
  for (const x of arr) map.set(keyFn(x), x);
  return [...map.values()];
}

function includesCI(hay, needle) {
  return String(hay || "")
    .toLowerCase()
    .includes(String(needle || "").toLowerCase());
}

/**
 * 서버 호출은 "실제 라우트"만 사용한다.
 */
async function fetchEventsFromServer({
  startDay,
  endDay,
  limit,
  newest,
  nextToken,

  installId,
  domainInclude,
  ruleInclude,
}) {
  // 1) installId 전용 라우트
  if (installId) {
    const res = await brsQueryApi.eventsByInstall({
      installId,
      limit,
      nextToken,
      newest,
    });
    return res;
  }

  // 2) rule/domain 전용 라우트
  if (ruleInclude) {
    const res = await brsQueryApi.eventsByRule({
      ruleId: ruleInclude,
      startDay,
      endDay,
      limit,
      newest,
      nextToken,
    });
    return res;
  }

  if (domainInclude) {
    const res = await brsQueryApi.eventsByDomain({
      domain: domainInclude,
      startDay,
      endDay,
      limit,
      newest,
      nextToken,
    });
    return res;
  }

  // 3) 기본 라우트
  const res = await brsQueryApi.events({
    startDay,
    endDay,
    limit,
    newest,
    nextToken,
  });
  return res;
}

/**
 * EventListPage가 직접 쓰는 함수
 * - 반환: events array (정렬된 상태)
 */
export async function getEventList(params = {}) {
  const {
    startDay,
    endDay,
    limit = 200,
    newest = true,
    nextToken,

    severities, // ["HIGH","MEDIUM","LOW"] 등
    domainInclude = "",
    domainExclude = "",
    ruleInclude = "",
    ruleExclude = "",
    installId = "",
  } = params;

  // 서버가 startDay/endDay를 기대하므로 누락 시 기본값 채움
  const safeStart = startDay || isoDaySeoul(new Date());
  const safeEnd = endDay || safeStart;

  // eslint-disable-next-line no-console
  console.log("[getEventList] fetching", {
    startDay: safeStart,
    endDay: safeEnd,
    limit,
    newest,
    nextToken,
    severities,
    domainInclude,
    ruleInclude,
    installId,
  });

  const res = await fetchEventsFromServer({
    startDay: safeStart,
    endDay: safeEnd,
    limit,
  });

  let items = Array.isArray(res?.items) ? res.items.map(normalizeEventItem) : [];

  // ---- client-side filters ----
  if (Array.isArray(severities) && severities.length) {
    const set = new Set(severities.map((s) => String(s).toUpperCase()));
    items = items.filter((e) => set.has(String(e.severity || "").toUpperCase()));
  }

  if (domainExclude) items = items.filter((e) => !includesCI(e.domain, domainExclude));
  if (ruleExclude) items = items.filter((e) => !includesCI(e.ruleId, ruleExclude));

  // installId가 서버 라우트로 안 갔을 때(예: domain/rule 조회 후 installId 추가 필터)
  if (installId && !items.every((e) => String(e.installId) === String(installId))) {
    items = items.filter((e) => String(e.installId) === String(installId));
  }

  // 최신순 정렬 + 중복 제거(방어)
  items.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
  items = uniqBy(items, (e) => e.eventId);

  return items.slice(0, limit);
}

/**
 * transactions 페이지/기존 코드 호환용 alias
 */
export async function getEvents(params = {}) {
  return getEventList(params);
}

/**
 * 대시보드에서 쓰기 좋은 "HIGH severity 이벤트"
 */
export async function getHighSeverityEvents(params = {}) {
  return getEventList({
    ...params,
    severities: ["HIGH"],
  });
}

/**
 * 대시보드/차트용: severity별 카운트
 */
export async function getSeverity(params = {}) {
  const items = await getEventList(params);
  const acc = { HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };

  for (const e of items) {
    const s = String(e.severity || "").toUpperCase();
    if (s === "HIGH") acc.HIGH += 1;
    else if (s === "MEDIUM") acc.MEDIUM += 1;
    else if (s === "LOW") acc.LOW += 1;
    else acc.UNKNOWN += 1;
  }
  return acc;
}

/**
 * 대시보드/차트용: 도메인별 카운트 Top N
 */
export async function getDomain(params = {}) {
  const { topN = 10, ...rest } = params;
  const items = await getEventList(rest);

  const map = new Map();
  for (const e of items) {
    const key = String(e.domain || "").trim() || "(unknown)";
    map.set(key, (map.get(key) || 0) + 1);
  }

  const out = [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  return out;
}

/**
 * (옵션) 서버에 aggregates 라우트가 실제로 존재하면 사용 가능
 */
export async function getTopn(params = {}) {
  // 기대: brsQueryApi.topn({ startDay, endDay, limit, newest, type? })
  // 서버 스펙이 다를 수 있으니, 실패하면 클라 집계로 fallback.
  try {
    if (typeof brsQueryApi.topn === "function") {
      return await brsQueryApi.topn(params);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[getTopn] fallback to client-side", e);
  }
  return null;
}

export async function getSeverityRange(params = {}) {
  try {
    if (typeof brsQueryApi.severityRange === "function") {
      return await brsQueryApi.severityRange(params);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[getSeverityRange] fallback", e);
  }
  return null;
}

export async function getTrendDomain(params = {}) {
  try {
    if (typeof brsQueryApi.trendDomain === "function") {
      return await brsQueryApi.trendDomain(params);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[getTrendDomain] fallback", e);
  }
  return null;
}

export async function getTrendRule(params = {}) {
  try {
    if (typeof brsQueryApi.trendRule === "function") {
      return await brsQueryApi.trendRule(params);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[getTrendRule] fallback", e);
  }
  return null;
}
