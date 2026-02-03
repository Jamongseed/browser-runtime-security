// index.mjs (Node.js 24 / ESM) - Threat_Events Query API
// deps: @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"; // ruleset 전용 추가

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const s3 = new S3Client({}); // ruleset 전용 추가
const TABLE_NAME = process.env.TABLE_NAME || "Threat_Events";
const EVENT_SHARDS = Number(process.env.EVENT_SHARDS || 8);
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";

// ruleset 전용 추가
const RULESET_BUCKET = process.env.RULESET_BUCKET || "";
const RULESET_PREFIX = process.env.RULESET_PREFIX || "rulesets/";
const RULESET_CACHE_TTL_MS = Number(process.env.RULESET_CACHE_TTL_MS || 300000);
const RULESET_DEFAULT_LOCALE = String(process.env.RULESET_DEFAULT_LOCALE || "ko");
const RULESET_FALLBACK_LOCALE = String(process.env.RULESET_FALLBACK_LOCALE || "en");

// Guardrails
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "OPTIONS,GET",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token",
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(obj),
  };
}

// 숫자 파라미터를 min/max 범위로 제한
function clampInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

// 조회 시작 시점을 now 기준 window로 안전하게 보정
function toSinceMs(qs) {
  const now = Date.now();
  const raw = Number(qs?.sinceMs);
  if (!Number.isFinite(raw) || raw <= 0) return now - DEFAULT_WINDOW_MS;

  const safe = Math.min(raw, now);
  const minSince = now - MAX_WINDOW_MS;
  return safe < minSince ? minSince : safe;
}

function padTs13(tsMs) {
  return String(Math.trunc(Number(tsMs))).padStart(13, "0");
}

// ingest 시 사용한 reverse timestamp 생성 로직
function revTs13FromMs(tsMs) {
  // Ingest sk: "T#<revTs>#E#..."
  const rev = 9999999999999 - Math.trunc(Number(tsMs));
  return String(rev).padStart(13, "0");
}

function normDay(s) {
  const day = String(s || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return day;
}

function addDaysIso(isoDay, deltaDays) {
  const [y, m, d] = isoDay.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function clampDayRange(startDay, endDay, maxDays = 90) {
  let count = 0;
  let cur = startDay;
  while (cur <= endDay) {
    count++;
    if (count > maxDays) return { ok: false, reason: "DAY_RANGE_TOO_LARGE" };
    cur = addDaysIso(cur, 1);
  }
  return { ok: true };
}

function normSeverity(s) {
  // ingest에서 severity 표준화 제거했으므로,
  // query도 raw 값 그대로 받는다(빈 값만 null)
  if (!s) return null;
  const v = String(s).trim();
  return v ? v : null;
}

function* iterDaysDesc(endDay, startDay) {
  // inclusive, descending
  let cur = endDay;
  while (cur >= startDay) {
    yield cur;
    cur = addDaysIso(cur, -1);
  }
}

function isValidEventsTokenShape(obj) {
  // token 형태:
  // { day: "YYYY-MM-DD", shards: [{s, lek}], done: [s1,s2,...] }
  if (!obj) return true;
  if (!isPlainObject(obj)) return false;
  if (obj.day && !normDay(obj.day)) return false;
  if (obj.shards && !Array.isArray(obj.shards)) return false;
  if (obj.done && !Array.isArray(obj.done)) return false;
  return true;
}

function safeStr(s, max = 4000) {
  const v = String(s ?? "").trim();
  if (!v) return "";
  return v.length > max ? v.slice(0, max) : v;
}

function encodeNextToken(key) {
  if (!key) return null;
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

// GSI detail SK range helper
function detailSkFromDay(day) {
  // ingest detail SK: "DAY#YYYY-MM-DD#T#<revTs>#E#..."
  return `DAY#${day}`;
}
function detailSkToDay(day) {
  return `DAY#${day}~`; // '~'로 해당 day prefix의 모든 값 포함
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;
}

// ruleset 전용 추가 [ line 160~330, primaryLocaleFromHeader(h) ~ const entry = pickI18nEntry(meta.i18n, locale) ]
function primaryLocaleFromHeader(h) {
  const v = String(h || "").trim();
  if (!v) return "";
  const first = v.split(",")[0] || "";
  const tag = first.split(";")[0].trim();
  if (!tag) return "";
  return tag.split("-")[0].toLowerCase();
}

function resolveRequestLocale(event) {
  const qs = event.queryStringParameters || {};
  const q = String(qs.locale || "").trim().toLowerCase();
  if (q) return q;
  const hdr = event.headers || {};
  const al = hdr["accept-language"] || hdr["Accept-Language"] || "";
  return primaryLocaleFromHeader(al) || RULESET_DEFAULT_LOCALE;
}

async function streamToString(body) {
  if (!body) return "";
  if (typeof body.transformToString === "function") return await body.transformToString();
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

const _rulesetCache = new Map(); // rulesetId -> { atMs, index }

function pickRulesetIdFromItem(it) {
  const v = it?.rulesetId || it?.modelId || it?.policyId;
  if (v) return String(v);
  return "default-v1";
}

function pickI18nEntry(i18n, locale) {
  if (!isPlainObject(i18n)) return null;
  const l = String(locale || "").toLowerCase();
  return (
    i18n[l] ||
    i18n[RULESET_FALLBACK_LOCALE] ||
    i18n[RULESET_DEFAULT_LOCALE] ||
    i18n.ko ||
    i18n.en ||
    null
  );
}

function buildMessageIndex(doc) {
  const index = new Map(); // ruleId -> { title, oneLine }

  // default-v1 style: rules[].action.{display|i18n}
  if (Array.isArray(doc?.rules)) {
    for (const r of doc.rules) {
      const rid = r?.action?.ruleId || r?.id;
      if (!rid) continue;
      const display = r?.action?.display;
      const i18n = r?.action?.i18n;
      index.set(String(rid), { display, i18n });
    }
  }

  // default-v1 messages map: rules[].action.messageKey -> doc.messages[messageKey]
  if (Array.isArray(doc?.rules) && doc?.messages && isPlainObject(doc.messages)) {
    for (const r of doc.rules) {
      const rid = r?.action?.ruleId || r?.id;
      const mk = r?.action?.messageKey;
      if (!rid || !mk) continue;
      const msg = doc.messages[String(mk)];
      if (!msg) continue;
      const prev = index.get(String(rid)) || {};
      // msg는 { ko:{title,oneLine}, en:{...} } 형태라 i18n으로 취급
      index.set(String(rid), { ...prev, i18n: prev.i18n || msg });
    }
  }

  // scoring-model style: signals[].{display|i18n}
  if (Array.isArray(doc?.signals)) {
    for (const s of doc.signals) {
      const rid = s?.id;
      if (!rid) continue;
      const display = s?.display;
      const i18n = s?.i18n;
      index.set(String(rid), { display, i18n });
    }
  }

  // scoring-model style: combos[].comboId (or id)
  if (Array.isArray(doc?.combos)) {
    for (const c of doc.combos) {
      const rid = c?.comboId || c?.id;
      if (!rid) continue;
      const display = c?.display;
      const i18n = c?.i18n;
      index.set(String(rid), { display, i18n });
    }
  }  
  return index;
}

async function loadRulesetIndex(rulesetId) {
  if (!RULESET_BUCKET) return null;
  const id = String(rulesetId || "").trim();
  if (!id) return null;

  const now = Date.now();
  const cached = _rulesetCache.get(id);
  if (cached && now - cached.atMs <= RULESET_CACHE_TTL_MS) return cached.index;

  const key = `${RULESET_PREFIX}${id}.json`;
  console.log("[ruleset] get", { bucket: RULESET_BUCKET, key }); // for test
  const res = await s3.send(new GetObjectCommand({ Bucket: RULESET_BUCKET, Key: key }));
  const text = await streamToString(res.Body);
  const doc = JSON.parse(text);
  const index = buildMessageIndex(doc);
  _rulesetCache.set(id, { atMs: now, index });
  return index;
}

async function attachDisplayToItems(event, rawItems, outItems) {
  const locale = resolveRequestLocale(event);
  const needed = new Set();
  for (let i = 0; i < rawItems.length; i++) needed.add(pickRulesetIdFromItem(rawItems[i]));

  const indexByRuleset = new Map();
  for (const rid of needed) {
    try {
      const idx = await loadRulesetIndex(rid);
      if (idx) indexByRuleset.set(rid, idx);
    } catch (e) {
      console.error("ruleset load failed:", rid, e?.message || e);
    }
  }

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    const out = outItems[i];
    if (!out || out.display) continue;

    const rulesetId = pickRulesetIdFromItem(raw);
    const idx = indexByRuleset.get(rulesetId);
    if (!idx) continue;

    const meta = idx.get(String(out.ruleId || ""));
    if (!meta) continue;

    if (meta.display && (meta.display.title || meta.display.oneLine)) {
      out.display = {
        title: String(meta.display.title || ""),
        oneLine: String(meta.display.oneLine || ""),
        locale,
        rulesetId,
      };
      continue;
    }

    const entry = pickI18nEntry(meta.i18n, locale);
    if (entry && (entry.title || entry.oneLine)) {
      out.display = {
        title: String(entry.title || ""),
        oneLine: String(entry.oneLine || ""),
        locale,
        rulesetId,
      };
    }
  }
}

// 토큰 검증 및 디코딩
function decodeNextToken(token) {
  if (!token) return { ok: true, key: undefined };
  let obj;
  try {
    obj = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "INVALID_nextToken" };
  }
  if (!isPlainObject(obj)) return { ok: false, reason: "INVALID_nextToken" };
  // { day?: "YYYY-MM-DD", shards: [{ s:0, lek: {...} }, ...], done: [0,1,...] }
  if (!Array.isArray(obj.shards) && !Array.isArray(obj.done)) {
    return { ok: false, reason: "INVALID_nextToken" };
  }
  if (!isValidEventsTokenShape(obj)) return { ok: false, reason: "INVALID_nextToken" };
  return { ok: true, key: obj };
}


// nextToken for single Query (LastEvaluatedKey)
function encodeLekToken(lek) {
  if (!lek) return null;
  return Buffer.from(JSON.stringify(lek), "utf8").toString("base64url");
}

function decodeLekToken(token) {
  if (!token) return { ok: true, lek: undefined };
  let obj;
  try {
    obj = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "INVALID_nextToken" };
  }
  if (!isPlainObject(obj)) return { ok: false, reason: "INVALID_nextToken" };
  return { ok: true, lek: obj };
}

// token = { day: "YYYY-MM-DD", lek: <LastEvaluatedKey or null> }
function encodeDayFanoutToken(obj) {
  if (!obj) return null;
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}
function decodeDayFanoutToken(token) {
  if (!token) return { ok: true, t: undefined };
  let obj;
  try {
    obj = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "INVALID_nextToken" };
  }
  if (!isPlainObject(obj)) return { ok: false, reason: "INVALID_nextToken" };
  if (obj.day && !normDay(obj.day)) return { ok: false, reason: "INVALID_nextToken" };
  return { ok: true, t: obj };
}

function pickLekForIndex(lek) {
  // 그대로 넣어도 되지만, 최소 형태로 유지하고 싶으면 이 함수에서 축소 가능
  return lek;
}

function pickItem(it) {
  return {
    ts: it.tsMs,
    day: it.day,
    type: it.type,
    ruleId: it.ruleId,
    severity: it.severity,
    scoreDelta: it.scoreDelta,
    sessionId: it.sessionId,
    installId: it.installId,
    origin: it.origin,
    domain: it.domain,
    page: it.page,
    eventId: it.eventId,
    rulesetId: pickRulesetIdFromItem(it), // ruleset 전용 추가
  };
}

// 단일 shard에 대해 sinceMs 기준 최신 이벤트 조회
async function queryOneShard({ pkValue, limit, exclusiveStartKey }) {
  // sinceMs 컷: SK <= upperBound (revTs가 작을수록 최신이므로)
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: "#pk = :pk",
    ExpressionAttributeNames: { "#pk": "pk" },
    ExpressionAttributeValues: {
      ":pk": pkValue,
    },
    Limit: limit,
    ScanIndexForward: true, // revTs 오름차순 = 최신부터
    ExclusiveStartKey: exclusiveStartKey,
  };
  const res = await ddb.send(new QueryCommand(params));
  return { items: res.Items || [], lek: res.LastEvaluatedKey };
}

function revTsFromSk(sk) {
  // sk = "T#<13digits>#E#..."
  const m = /^T#(\d{13})#/.exec(String(sk || ""));
  return m ? m[1] : "9999999999999";
}

// revTs 기준으로 두 shard 결과를 최신순으로 병합
function mergeByRevTs(itemsA, itemsB, limit) {
  // 두 리스트 모두 최신부터(작은 revTs부터) 정렬되어 있다는 가정
  const out = [];
  let i = 0, j = 0;
  while (out.length < limit && (i < itemsA.length || j < itemsB.length)) {
    const a = itemsA[i];
    const b = itemsB[j];
    if (!b) { out.push(a); i++; continue; }
    if (!a) { out.push(b); j++; continue; }
    const ra = revTsFromSk(a.sk);
    const rb = revTsFromSk(b.sk);
    if (ra <= rb) { out.push(a); i++; } else { out.push(b); j++; }
  }
  return out;
}


// ---------- Route handlers ----------
// DAY 기준 이벤트 리스트 조회 (샤드 fan-out + pagination)
async function handleEvents(event) {
  const qs = event.queryStringParameters || {};
  const startDay = normDay(qs.startDay);
  const endDay   = normDay(qs.endDay);

  if (!startDay || !endDay) {
    return json(400, { ok: false, reason: "MISSING_startDay_or_endDay" });
  }

  const rangeOk = clampDayRange(startDay, endDay, 120);
  if (!rangeOk.ok) return json(400, { ok: false, reason: rangeOk.reason });

  const limit = clampInt(qs.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const nextToken = qs.nextToken ? String(qs.nextToken) : undefined;

  // shard fan-out pagination token
  const decoded = decodeNextToken(nextToken);
  if (!decoded.ok) return json(400, { ok: false, reason: decoded.reason });
  const tokenObj = decoded.key || { day: endDay, shards: [], done: [] };

  // 각 샤드에서 일부씩 뽑아 merge (비용 통제: perShardLimit)
  const perShardLimit = Math.max(1, Math.ceil(limit / 2));
  let merged = [];
  
  let curDay = tokenObj.day || endDay;
  if (curDay > endDay) curDay = endDay;
  if (curDay < startDay) curDay = startDay;

  // 2개씩 병렬로 Query (동시성 제한)
  const CONCURRENCY = 2;

  // day=endDay부터 역순으로 채우되, limit 채우면 중단
  while (merged.length < limit && curDay >= startDay) {
    // day가 바뀌면 shard pagination 상태는 해당 day 전용이어야 함
    const doneSet = new Set(Array.isArray(tokenObj.done) ? tokenObj.done : []);
    const shardState = new Map();
    for (const e of (Array.isArray(tokenObj.shards) ? tokenObj.shards : [])) {
      if (e && Number.isFinite(Number(e.s))) shardState.set(Number(e.s), e.lek);
    }

    const pendingShards = [];
    for (let s = 0; s < EVENT_SHARDS; s++) {
      if (!doneSet.has(s)) pendingShards.push(s);
    }

    const newShardTokens = [];
    const newlyDone = [];

    for (let i = 0; i < pendingShards.length && merged.length < limit; i += CONCURRENCY) {
      const batch = pendingShards.slice(i, i + CONCURRENCY);

      const results = await Promise.all(batch.map(async (s) => {
        const pkValue = `DAY#${curDay}#S#${s}`;
        const { items, lek } = await queryOneShard({
          pkValue,
          limit: perShardLimit,
          exclusiveStartKey: shardState.get(s),
        });
        return { s, items, lek };
      }));

      for (const r of results) {
        merged = mergeByRevTs(merged, r.items, limit);
        if (r.lek) newShardTokens.push({ s: r.s, lek: r.lek });
        else newlyDone.push(r.s);
        if (merged.length >= limit) break;
      }
    }

    // day가 아직 남아 있으면 (어떤 shard든 lek가 남아있으면) 같은 day로 계속
    const outDone = Array.from(new Set([...doneSet, ...newlyDone]));
    const hasMoreThisDay = newShardTokens.length > 0;

    if (merged.length >= limit) {
      // limit을 채웠으니, 토큰은 "현재 day + shard progress"를 저장
      const outToken = encodeNextToken({
        day: curDay,
        shards: newShardTokens,
        done: outDone,
      });
      return json(200, {
        ok: true,
        query: { startDay, endDay, limit, newest: true },
        items: await (async () => { // ruleset 전용 추가
          const out = merged.map(pickItem);
          await attachDisplayToItems(event, merged, out);
          return out;
        })(),
        nextToken: outToken,
      });
    }

    if (hasMoreThisDay) {
      // limit은 못 채웠지만, 같은 day에서 더 뽑을 수 있음 → 토큰 갱신 후 루프 계속
      tokenObj.day = curDay;
      tokenObj.shards = newShardTokens;
      tokenObj.done = outDone;
      continue;
    }

    // 현재 day를 다 소진 → 전날로 이동하며 shard 상태 리셋
    curDay = addDaysIso(curDay, -1);
    tokenObj.day = curDay;
    tokenObj.shards = [];
    tokenObj.done = [];
  }

  // 다 소진
  return json(200, {
    ok: true,
    query: { startDay, endDay, limit, newest: true },
    items: await (async () => { // ruleset 전용 추가
      const out = merged.map(pickItem);
      await attachDisplayToItems(event, merged, out);
      return out;
    })(),
    nextToken: null,
  });
}

// 단일 eventId에 대한 상세 BODY 조회
async function handleBody(event) {
  const qs = event.queryStringParameters || {};
  const eventId = safeStr(qs.eventId, 200);
  if (!eventId) return json(400, { ok: false, reason: "MISSING_eventId" });

  // eventId -> 메인 아이템 위치(META) 조회
  const metaRes = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: `EVENT#${eventId}`, sk: "META" },
    })
  );
  if (!metaRes.Item) return json(404, { ok: false, reason: "NOT_FOUND" });

  const { pkMain, skMain } = metaRes.Item || {};
  if (!pkMain || !skMain) {
    return json(500, { ok: false, reason: "META_MISSING_POINTER" });
  }

  // 메인 아이템에서 payloadJson/payloadHash 등 실제 본문 조회
  const mainRes = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: pkMain, sk: skMain },
    })
  );

  if (!mainRes.Item) {
    return json(404, { ok: false, reason: "MAIN_NOT_FOUND" });
  }

  const { payloadJson, payloadTruncated, payloadHash } = mainRes.Item;
  return json(200, {
    ok: true,
    eventId,
    meta: metaRes.Item,
    payload: { payloadJson, payloadTruncated, payloadHash },
  });
}

// 단일 installId에 대한 상세 이벤트 조회
async function handleEventsByInstall(event) {
  const qs = event.queryStringParameters || {};
  const installId = safeStr(qs.installId, 120);
  if (!installId) return json(400, { ok: false, reason: "MISSING_installId" });

  const startDay = normDay(qs.startDay);
  const endDay   = normDay(qs.endDay);
  if (!startDay || !endDay) {
    return json(400, { ok: false, reason: "MISSING_startDay_or_endDay" });
  }

  const rangeOk = clampDayRange(startDay, endDay, 120);
  if (!rangeOk.ok) return json(400, { ok: false, reason: rangeOk.reason });

  const limit = clampInt(qs.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);

  // newest mode token: { day: "YYYY-MM-DD", lek?: LastEvaluatedKey }
  const tok = qs.nextToken ? String(qs.nextToken) : undefined;
  const dt = decodeDayFanoutToken(tok);
  if (!dt.ok) return json(400, { ok: false, reason: dt.reason });

  let curDay = dt.t?.day || endDay;
  let curLek = dt.t?.lek || undefined;

  const pk = `INSTALL#${installId}`;
  const out = [];

  const perDayLimit = Math.max(1, Math.min(50, Math.ceil(limit / 2)));

  while (out.length < limit && curDay >= startDay) {
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "install_ID",
      KeyConditionExpression: "#pk = :pk AND #sk BETWEEN :a AND :b",
      ExpressionAttributeNames: { "#pk": "ii_pk", "#sk": "ii_sk" },
      ExpressionAttributeValues: {
        ":pk": pk,
        ":a": detailSkFromDay(curDay), // "DAY#curDay"
        ":b": detailSkToDay(curDay),   // "DAY#curDay~"
      },
      Limit: perDayLimit,
      ScanIndexForward: true,   // DAY#...#T#revTs... 에서 revTs 오름차순 = 최신 우선
      ExclusiveStartKey: curLek,
    }));

    for (const it of (res.Items || [])) {
      out.push(it);
      if (out.length >= limit) break;
    }

    if (out.length >= limit) {
      const next = res.LastEvaluatedKey
        ? { day: curDay, lek: pickLekForIndex(res.LastEvaluatedKey) }
        : { day: addDaysIso(curDay, -1), lek: undefined };

      return json(200, {
        ok: true,
        query: { installId, startDay, endDay, limit, newest: true },
        items: out.map(pickItem),
        nextToken: encodeDayFanoutToken(next),
      });
    }

    // day를 다 소진했으면 전날로
    if (res.LastEvaluatedKey) {
      // perDayLimit이 작아서 같은 day에 더 남았으면 이어서
      curLek = res.LastEvaluatedKey;
    } else {
      curDay = addDaysIso(curDay, -1);
      curLek = undefined;
    }
  }

  return json(200, {
    ok: true,
    query: { installId, startDay, endDay, limit, newest: true },
    items: out.map(pickItem),
    nextToken: null,
  });
}

// ----- Operator detail pages (GSI queries) -----
async function handleEventsByDomain(event) {
  const qs = event.queryStringParameters || {};
  const domain = safeStr(qs.domain, 400); // top_domain 값
  const startDay = normDay(qs.startDay);
  const endDay = normDay(qs.endDay);
  if (!domain) return json(400, { ok: false, reason: "MISSING_domain" });
  if (!startDay || !endDay) return json(400, { ok: false, reason: "MISSING_or_INVALID_day_range" });

  const limit = clampInt(qs.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  
  const newest = String(qs.newest || "").toLowerCase();
  const isNewestMode = newest === "1" || newest === "true" || newest === "yes";

  const rangeOk = clampDayRange(startDay, endDay, 120);
  if (!rangeOk.ok) return json(400, { ok: false, reason: rangeOk.reason });

  if (!isNewestMode) {
    // 기본: 기간 BETWEEN (day 오름차순)
    const decoded = decodeLekToken(qs.nextToken ? String(qs.nextToken) : undefined);
    if (!decoded.ok) return json(400, { ok: false, reason: decoded.reason });

    const pk = `DOMAIN#${domain}`;
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "DOMAIN",
      KeyConditionExpression: "#pk = :pk AND #sk BETWEEN :a AND :b",
      ExpressionAttributeNames: { "#pk": "domain_pk", "#sk": "domain_sk" },
      ExpressionAttributeValues: {
        ":pk": pk,
        ":a": detailSkFromDay(startDay),
        ":b": detailSkToDay(endDay),
      },
      Limit: limit,
      ExclusiveStartKey: decoded.lek,
    }));

    return json(200, {
      ok: true,
      query: { domain, startDay, endDay, limit, newest: false },
      items: await (async () => { // ruleset 전용 추가
        const raw = (res.Items || []);
        const out = raw.map(pickItem);
        await attachDisplayToItems(event, raw, out);
        return out;
      })(),
      nextToken: encodeLekToken(res.LastEvaluatedKey),
    });
  }

  // newest mode: day=endDay부터 역순
  const tok = qs.nextToken ? String(qs.nextToken) : undefined;
  const dt = decodeDayFanoutToken(tok);
  if (!dt.ok) return json(400, { ok: false, reason: dt.reason });

  let curDay = dt.t?.day || endDay;
  let curLek = dt.t?.lek || undefined;

  const pk = `DOMAIN#${domain}`;
  const out = [];

  // day당 가져올 최대량(너무 많이 가져오면 비용↑)
  const perDayLimit = Math.max(1, Math.min(50, Math.ceil(limit / 2)));

  while (out.length < limit && curDay >= startDay) {
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "DOMAIN",
      KeyConditionExpression: "#pk = :pk AND #sk BETWEEN :a AND :b",
      ExpressionAttributeNames: { "#pk": "domain_pk", "#sk": "domain_sk" },
      ExpressionAttributeValues: {
        ":pk": pk,
        ":a": detailSkFromDay(curDay),
        ":b": detailSkToDay(curDay),
      },
      Limit: perDayLimit,
      ScanIndexForward: true, // DAY#...#T#revTs... 에서 revTs 오름차순 = 최신 우선
      ExclusiveStartKey: curLek,
    }));

    for (const it of (res.Items || [])) {
      out.push(it);
      if (out.length >= limit) break;
    }

    if (out.length >= limit) {
      // 아직 같은 day에서 더 남았으면 그 자리에서 이어가기
      const next = res.LastEvaluatedKey
        ? { day: curDay, lek: pickLekForIndex(res.LastEvaluatedKey) }
        : { day: addDaysIso(curDay, -1), lek: undefined };
      return json(200, {
        ok: true,
        query: { domain, startDay, endDay, limit, newest: true },
        items: await (async () => { // ruleset 전용 추가
          const raw = out;
          const mapped = raw.map(pickItem);
          await attachDisplayToItems(event, raw, mapped);
          return mapped;
        })(),
        nextToken: encodeDayFanoutToken(next),
      });
    }

    // day를 다 소진했으면 전날로
    if (res.LastEvaluatedKey) {
      // limit을 못 채웠는데 LEK가 남아있다? perDayLimit이 작아서 그런 것 → 같은 day 계속
      curLek = res.LastEvaluatedKey;
    } else {
      curDay = addDaysIso(curDay, -1);
      curLek = undefined;
    }
  }

  return json(200, {
    ok: true,
    query: { domain, startDay, endDay, limit, newest: true },
    items: await (async () => { // ruleset 전용 추가
      const raw = out;
      const mapped = raw.map(pickItem);
      await attachDisplayToItems(event, raw, mapped);
      return mapped;
    })(),
    nextToken: null,
  }); 
}

async function handleEventsByRule(event) {
  const qs = event.queryStringParameters || {};
  const ruleId = safeStr(qs.ruleId, 200);
  const startDay = normDay(qs.startDay);
  const endDay = normDay(qs.endDay);
  if (!ruleId) return json(400, { ok: false, reason: "MISSING_ruleId" });
  if (!startDay || !endDay) return json(400, { ok: false, reason: "MISSING_or_INVALID_day_range" });

  const limit = clampInt(qs.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  
  const newest = String(qs.newest || "").toLowerCase();
  const isNewestMode = newest === "1" || newest === "true" || newest === "yes";

  const rangeOk = clampDayRange(startDay, endDay, 120);
  if (!rangeOk.ok) return json(400, { ok: false, reason: rangeOk.reason });

  const pk = `RULE#${ruleId}`;

  if (!isNewestMode) {
    const decoded = decodeLekToken(qs.nextToken ? String(qs.nextToken) : undefined);
    if (!decoded.ok) return json(400, { ok: false, reason: decoded.reason });

    const res = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "RULE",
      KeyConditionExpression: "#pk = :pk AND #sk BETWEEN :a AND :b",
      ExpressionAttributeNames: { "#pk": "rule_pk", "#sk": "rule_sk" },
      ExpressionAttributeValues: {
        ":pk": pk,
        ":a": detailSkFromDay(startDay),
        ":b": detailSkToDay(endDay),
      },
      Limit: limit,
      ExclusiveStartKey: decoded.lek,
    }));

    return json(200, {
      ok: true,
      query: { ruleId, startDay, endDay, limit, newest: false },
      items: await (async () => { // ruleset 전용 추가
        const raw = (res.Items || []);
        const out = raw.map(pickItem);
        await attachDisplayToItems(event, raw, out);
        return out;
      })(),
      nextToken: encodeLekToken(res.LastEvaluatedKey),
    });
  }

  const tok = qs.nextToken ? String(qs.nextToken) : undefined;
  const dt = decodeDayFanoutToken(tok);
  if (!dt.ok) return json(400, { ok: false, reason: dt.reason });
  let curDay = dt.t?.day || endDay;
  let curLek = dt.t?.lek || undefined;

  const out = [];
  const perDayLimit = Math.max(1, Math.min(50, Math.ceil(limit / 2)));

  while (out.length < limit && curDay >= startDay) {
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "RULE",
      KeyConditionExpression: "#pk = :pk AND #sk BETWEEN :a AND :b",
      ExpressionAttributeNames: { "#pk": "rule_pk", "#sk": "rule_sk" },
      ExpressionAttributeValues: {
        ":pk": pk,
        ":a": detailSkFromDay(curDay),
        ":b": detailSkToDay(curDay),
      },
      Limit: perDayLimit,
      ScanIndexForward: true,
      ExclusiveStartKey: curLek,
    }));

    for (const it of (res.Items || [])) {
      out.push(it);
      if (out.length >= limit) break;
    }

    if (out.length >= limit) {
      const next = res.LastEvaluatedKey
        ? { day: curDay, lek: pickLekForIndex(res.LastEvaluatedKey) }
        : { day: addDaysIso(curDay, -1), lek: undefined };
      return json(200, {
        ok: true,
        query: { ruleId, startDay, endDay, limit, newest: true },
        items: await (async () => { // ruleset 전용 추가
          const raw = out;
          const mapped = raw.map(pickItem);
          await attachDisplayToItems(event, raw, mapped);
          return mapped;
        })(),
        nextToken: encodeDayFanoutToken(next),
      });
    }

    if (res.LastEvaluatedKey) curLek = res.LastEvaluatedKey;
    else { curDay = addDaysIso(curDay, -1); curLek = undefined; }
  }

  return json(200, {
    ok: true,
    query: { ruleId, startDay, endDay, limit, newest: true },
    items: await (async () => { // ruleset 전용 추가
      const raw = out;
      const mapped = raw.map(pickItem);
      await attachDisplayToItems(event, raw, mapped);
      return mapped;
    })(),
    nextToken: null,
  });
}

async function handleEventsBySev(event) {
  const qs = event.queryStringParameters || {};
  const severity = normSeverity(qs.severity);
  const startDay = normDay(qs.startDay);
  const endDay = normDay(qs.endDay);
  if (!severity) return json(400, { ok: false, reason: "MISSING_severity" });
  if (!startDay || !endDay) return json(400, { ok: false, reason: "MISSING_or_INVALID_day_range" });

  const limit = clampInt(qs.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  
  const newest = String(qs.newest || "").toLowerCase();
  const isNewestMode = newest === "1" || newest === "true" || newest === "yes";

  const rangeOk = clampDayRange(startDay, endDay, 120);
  if (!rangeOk.ok) return json(400, { ok: false, reason: rangeOk.reason });

  const pk = `SEV#${severity}`;

  if (!isNewestMode) {
    const decoded = decodeLekToken(qs.nextToken ? String(qs.nextToken) : undefined);
    if (!decoded.ok) return json(400, { ok: false, reason: decoded.reason });

    const res = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "SEV",
      KeyConditionExpression: "#pk = :pk AND #sk BETWEEN :a AND :b",
      ExpressionAttributeNames: { "#pk": "sev_pk", "#sk": "sev_sk" },
      ExpressionAttributeValues: {
        ":pk": pk,
        ":a": detailSkFromDay(startDay),
        ":b": detailSkToDay(endDay),
      },
      Limit: limit,
      ExclusiveStartKey: decoded.lek,
    }));

    return json(200, {
      ok: true,
      query: {severity, startDay, endDay, limit, newest: false },
      items: await (async () => { // ruleset 전용 추가
        const raw = (res.Items || []);
        const out = raw.map(pickItem);
        await attachDisplayToItems(event, raw, out);
        return out;
      })(),
      nextToken: encodeLekToken(res.LastEvaluatedKey),
    });
  }

  const tok = qs.nextToken ? String(qs.nextToken) : undefined;
  const dt = decodeDayFanoutToken(tok);
  if (!dt.ok) return json(400, { ok: false, reason: dt.reason });
  let curDay = dt.t?.day || endDay;
  let curLek = dt.t?.lek || undefined;

  const out = [];
  const perDayLimit = Math.max(1, Math.min(50, Math.ceil(limit / 2)));

  while (out.length < limit && curDay >= startDay) {
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "SEV",
      KeyConditionExpression: "#pk = :pk AND #sk BETWEEN :a AND :b",
      ExpressionAttributeNames: { "#pk": "sev_pk", "#sk": "sev_sk" },
      ExpressionAttributeValues: {
        ":pk": pk,
        ":a": detailSkFromDay(curDay),
        ":b": detailSkToDay(curDay),
      },
      Limit: perDayLimit,
      ScanIndexForward: true,
      ExclusiveStartKey: curLek,
    }));

    for (const it of (res.Items || [])) {
      out.push(it);
      if (out.length >= limit) break;
    }

    if (out.length >= limit) {
      const next = res.LastEvaluatedKey
        ? { day: curDay, lek: pickLekForIndex(res.LastEvaluatedKey) }
        : { day: addDaysIso(curDay, -1), lek: undefined };
      return json(200, {
        ok: true,
        query: { severity, startDay, endDay, limit, newest: true },
        items: await (async () => { // ruleset 전용 추가
          const raw = out;
          const mapped = raw.map(pickItem);
          await attachDisplayToItems(event, raw, mapped);
          return mapped;
        })(),
        nextToken: encodeDayFanoutToken(next),
      });
    }

    if (res.LastEvaluatedKey) curLek = res.LastEvaluatedKey;
    else { curDay = addDaysIso(curDay, -1); curLek = undefined; }
  }

  return json(200, {
    ok: true,
    query: { severity, startDay, endDay, limit, newest: true },
    items: await (async () => { // ruleset 전용 추가
      const raw = out;
      const mapped = raw.map(pickItem);
      await attachDisplayToItems(event, raw, mapped);
      return mapped;
    })(),
    nextToken: null,
  });
}

// ---------- Router ----------
function getMethod(event) {
  return String(event?.httpMethod || event?.requestContext?.http?.method || "")
    .toUpperCase();
}
function getPath(event) {
  return String(event?.path || event?.rawPath || "");
}

// GET /events, /events/body 라우팅 처리
export const handler = async (event) => {
  try {
    const method = getMethod(event);

    if (method === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }
    if (method !== "GET") {
      return json(405, { ok: false, reason: "METHOD_NOT_ALLOWED" });
    }
    if (!TABLE_NAME) {
      return json(500, { ok: false, reason: "MISSING_TABLE_NAME" });
    }

    const path = getPath(event);
    // stage prefix가 붙어도 동작하도록 endsWith  
    if (path.endsWith("/events")) return await handleEvents(event);  
    if (path.endsWith("/events/body")) return await handleBody(event);
    //if (path.endsWith("/events/search")) return await handleBody(event);
    if (path.endsWith("/events/by-install")) return await handleEventsByInstall(event);
    if (path.endsWith("/events/by-domain")) return await handleEventsByDomain(event);
    if (path.endsWith("/events/by-rule")) return await handleEventsByRule(event);
    if (path.endsWith("/events/by-sev")) return await handleEventsBySev(event);

    return json(404, { ok: false, reason: "NOT_FOUND" });
  } catch (err) {
    console.error("query api error:", err);
    return json(500, { ok: false, reason: "INTERNAL_ERROR" });
  }
};