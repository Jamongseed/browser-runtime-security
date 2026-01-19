// index.mjs (AWS Lambda - Node.js 24)
// deps: @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

/* =========================================================
 * Imports
 * =======================================================*/
import crypto from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/* =========================================================
 * Environment & Constants
 * =======================================================*/
const TABLE = process.env.TABLE_NAME || "Threat_Events";
const AGG_TABLE = process.env.AGG_TABLE_NAME || "Threat_Aggregates";

const DUMP_BUCKET = process.env.DUMP_BUCKET || "brs-threat-dumps-prod";
const DUMP_PREFIX = process.env.DUMP_PREFIX || "events";

const TTL_DAYS = Number(process.env.TTL_DAYS || 30);
const MAX_JSON_BYTES = Number(process.env.MAX_JSON_BYTES || 20_000);
const MAX_PAYLOAD_BYTES = Number(process.env.MAX_PAYLOAD_BYTES || 350_000);

const EVENT_SHARDS = Number(process.env.EVENT_SHARDS || 8);
const AGG_SHARDS = Number(process.env.AGG_SHARDS || 4);

const EVENT_SCORE_CAP = Number(process.env.EVENT_SCORE_CAP || 50);

const REQUIRE_HMAC =
  String(process.env.REQUIRE_HMAC || "false").toLowerCase() === "true";
const HMAC_KEY = process.env.HMAC_KEY || "";
const HMAC_VERSION = process.env.HMAC_VERSION || "v1";

const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";
const ALLOW_HEADERS = "content-type";
const ALLOW_METHODS = "POST,OPTIONS";

/* =========================================================
 * AWS Clients
 * =======================================================*/
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({});

/* =========================================================
 * Basic Helpers
 * =======================================================*/
const safeStr = (v, max = 400) =>
  (v == null ? "" : String(v)).slice(0, max);

const jsonByteLength = (obj) =>
  Buffer.byteLength(JSON.stringify(obj ?? null), "utf8");

const toTsMs = (ts) => {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return n < 1e12 ? Math.trunc(n * 1000) : Math.trunc(n);
};

const padTs13 = (ts) => String(ts).padStart(13, "0");

/* =========================================================
 * URL / Domain Helpers
 * =======================================================*/
const stripPort = (host) => {
  if (!host) return "";
  if (host.startsWith("[")) {
    const i = host.indexOf("]");
    return i >= 0 ? host.slice(0, i + 1) : host;
  }
  const idx = host.lastIndexOf(":");
  return idx > 0 && /^\d+$/.test(host.slice(idx + 1))
    ? host.slice(0, idx)
    : host;
};

const extractHostFromUrl = (url) => { // 현재 안 쓰는 중
  try {
    const u = new URL(url);
    return stripPort(u.hostname);
  } catch {
    return "";
  }
};

const extractPathFromUrl = (url) => {
  try {
    return new URL(url).pathname || "";
  } catch {
    return "";
  }
};

const maskPath = (path = "") =>
  path
    .split("/")
    .map((seg) => {
      if (/^\d+$/.test(seg)) return ":n";
      if (/^[A-Za-z0-9_-]{16,}$/.test(seg)) return ":tok";
      return seg;
    })
    .join("/")
    .slice(0, 2000);

export const deriveTopDomainFromPageUrl = (pageUrl) => {
  try {
    const host = new URL(pageUrl).hostname.toLowerCase();
    const parts = host.split(".").filter(Boolean);
    if (parts.length <= 2) return host;
    return `${parts.at(-2)}.${parts.at(-1)}`;
  } catch {
    return "UNKNOWN";
  }
};

/* =========================================================
 * Time Helpers (Asia/Seoul)
 * =======================================================*/
const isoDayFromTs = (ts) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
  }).format(ts);

const isoHourKeyFromTs = (ts) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(ts);
  const g = (t) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}${g("month")}${g("day")}${g("hour")}`;
};

const ttlFromDay = (day, plusDays) => {
  const [y, m, d] = day.split("-").map(Number);
  const endSeoul = Date.UTC(y, m - 1, d, 15, 59, 59);
  return Math.floor((endSeoul + plusDays * 86400e3) / 1000);
};

/* =========================================================
 * Security (HMAC)
 * =======================================================*/
const hmacHex = (key, msg) =>
  crypto.createHmac("sha256", key).update(msg).digest("hex");

const timingSafeEqHex = (a, b) => {
  try {
    return (
      a.length === b.length &&
      crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))
    );
  } catch {
    return false;
  }
};

const buildCanonicalV1 = ({
  eventId,
  tsMs,
  installId,
  sessionId,
  type,
  ruleId,
  severity,
  scoreDelta,
}) =>
  [
    "v1",
    eventId,
    tsMs,
    installId,
    sessionId,
    type,
    ruleId,
    severity,
    scoreDelta,
  ].join("|");

/* =========================================================
 * CORS / Response Helpers
 * =======================================================*/
const corsHeaders = () => ({
  "content-type": "application/json",
  "access-control-allow-origin": ALLOW_ORIGIN,
  "access-control-allow-methods": ALLOW_METHODS,
  "access-control-allow-headers": ALLOW_HEADERS,
  "access-control-max-age": "600",
});

const resp = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders(),
  body: JSON.stringify(body),
});

/* =========================================================
 * Payload Storage Helpers
 * =======================================================*/
const stableStringify = (obj) => {
  // 일반 JSON.stringify면 충분하지만, 키 순서를 고정하고 싶으면 별도 구현 필요
  return JSON.stringify(obj ?? null);
};

const limitUtf8 = (s, maxBytes) => {
  const buf = Buffer.from(String(s ?? ""), "utf8");
  if (buf.byteLength <= maxBytes) return { text: buf.toString("utf8"), truncated: false };
  return { text: buf.subarray(0, maxBytes).toString("utf8"), truncated: true };
};

const sha256Hex = (s) =>
  crypto.createHash("sha256").update(String(s ?? ""), "utf8").digest("hex");


/* =========================================================
 * AGG Helpers
 * =======================================================*/
const aggShardFor = (s) =>
  parseInt(
    crypto.createHash("sha256").update(String(s || "")).digest("hex").slice(0, 8),
    16
  ) % AGG_SHARDS;

const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

/* =========================================================
 * S3 Helpers
 * =======================================================*/
const safeS3KeyPart = (s, max = 200) =>
  String(s || "")
    .replace(/[^A-Za-z0-9._\-=/]/g, "_")
    .slice(0, max);

const putTextToS3 = async ({ bucket, key, text, contentType }) =>
  s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: text ?? "",
      ContentType: contentType || "text/plain; charset=utf-8",
    })
  );

/* =========================================================
 * Main Handler
 * =======================================================*/
export const handler = async (event) => {
  const method =
    event?.requestContext?.http?.method || event?.httpMethod || "";

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return resp(400, { ok: false, error: "INVALID_JSON" });
  }

  if (jsonByteLength(payload) > MAX_PAYLOAD_BYTES) {
    return resp(413, { ok: false, error: "PAYLOAD_TOO_LARGE" });
  }

  /* ---------- validate ---------- */
  const type = safeStr(payload.type, 120);
  const eventId = safeStr(payload.reportId, 200);
  const installId = safeStr(payload.installId, 120);
  const sessionId = safeStr(payload.sessionId, 120);
  const tsMs = toTsMs(payload.ts);
  const severity = safeStr(payload.severity, 40);
  const ruleId = safeStr(payload.ruleId, 200);
  const origin = safeStr(payload.origin, 80) || "UNKNOWN";
  const targetOrigin = safeStr(payload.targetOrigin, 80) || "UNKNOWN";
  const ua = safeStr(payload.ua, 400);
  const page = safeStr(payload.page, 2000);
  const scoreDelta = safeStr(payload.scoreDelta, 200)  || "UNKNOWN";
  const domain = page ? deriveTopDomainFromPageUrl(page) : "UNKNOWN";

  if (!type || !eventId || !installId || !severity || !ruleId || !Number.isFinite(tsMs)) {
    return resp(400, { ok: false, error: "MISSING_REQUIRED_FIELD" });
  }

  /* ---------- HMAC ---------- */
  if (REQUIRE_HMAC) {
    const headers = event.headers || {};
    const sig = headers["x-sig"] || headers["X-Sig"] || headers["X-SIG"];
    const canonical = buildCanonicalV1({
      eventId, tsMs, installId, sessionId, type,ruleId, severity, scoreDelta,
    });

    if (!timingSafeEqHex(hmacHex(HMAC_KEY, canonical), sig)) {
      return resp(401, { ok: false, error: "INVALID_SIGNATURE" });
    }
  }

  /* ---------- keys ---------- */
  const day = isoDayFromTs(tsMs);
  const revTs = padTs13(9999999999999 - tsMs);
  const shard =
    parseInt(
      crypto.createHash("sha256").update(eventId).digest("hex").slice(0, 8),
      16
    ) % EVENT_SHARDS;

  const pk = `DAY#${day}#S#${shard}`;
  const sk = `T#${revTs}#E#${eventId}`;

  const payloadStr = stableStringify(payload);
  const limited = limitUtf8(payloadStr, MAX_JSON_BYTES);

  const payloadJson = limited.text;                 // DynamoDB에 저장할 원문(또는 일부)
  const payloadTruncated = limited.truncated;       // 잘렸는지 여부
  const payloadHash = sha256Hex(payloadStr);        // 원문 기준 해시(추후 정합성/중복/조회용)

  /* ----- Aggregates shard ----- */
  const orgKey = origin || "UNKNOWN";
  const ruleKey = ruleId  || "UNKNOWN";
  const domainKey = domain || "UNKNOWN";
  const sevKey = severity || "LOW";

  // scoreDelta numeric (optional aggregate metric)
  const score = Math.min(Math.max(toNum(payload.scoreDelta, 0), 0), EVENT_SCORE_CAP);

  // NOTE: shard는 aggregate "대상 키"로 분산시키는 게 핫파티션 방지에 유리
  const aggShardDomain = aggShardFor(`D|${orgKey}|${domainKey}`);
  const aggShardRule   = aggShardFor(`R|${orgKey}|${ruleKey}`);
  const aggShardSev    = aggShardFor(`S|${orgKey}|${sevKey}`);

  // GLOBAL(ORIGIN 무관) 집계용 shard - 임시 수정 입니다 추후 수정 필요해요
  const aggShardGlobalDomain = aggShardFor(`GD|${domainKey}`);
  const aggShardGlobalSev    = aggShardFor(`GS|${sevKey}`);
  const aggShardGlobalRule   = aggShardFor(`GR|${ruleKey}`);

  const aggTtl = ttlFromDay(day, TTL_DAYS);
  const nowMs = Date.now();

  const updateAgg = async ({ pk, sk, cntDelta = 1, scoreDelta = 0 }) => {
    return ddb.send(
      new UpdateCommand({
        TableName: AGG_TABLE,
        Key: { pk, sk },
        UpdateExpression:
          "ADD #cnt :dc, #scoreSum :ds " +
          "SET #ttl = if_not_exists(#ttl, :ttl), #updatedAt = :now",
        ExpressionAttributeNames: {
          "#cnt": "cnt",
          "#scoreSum": "scoreSum",
          "#ttl": "ttl",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":dc": cntDelta,
          ":ds": scoreDelta,
          ":ttl": aggTtl,
          ":now": nowMs,
        },
      })
    );
  };

  /* ---------- write ---------- */
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk,
          sk,
          eventId,
          severity,
          type,
          page,
          ruleId,
          installId,
          sessionId,
          domain,
          origin,
          targetOrigin,
          scoreDelta,
          ua,
          tsMs,
          day,
          ttl: ttlFromDay(day, TTL_DAYS),

          ii_pk: `INSTALL#${installId}`,
          ii_sk: `DAY#${day}#T#${revTs}#E#${eventId}`,

          domain_pk: `DOMAIN#${domain}`,
          domain_sk: `DAY#${day}#T#${revTs}#E#${eventId}`,

          rule_pk: `RULE#${ruleId}`,
          rule_sk: `DAY#${day}#T#${revTs}#E#${eventId}`,

          sev_pk: `SEV#${severity}`,
          sev_sk: `DAY#${day}#T#${revTs}#E#${eventId}`,

          payloadJson,         // string (최대 MAX_JSON_BYTES)
          payloadTruncated,    // boolean
          payloadHash,         // string (sha256 hex)
        },
        ConditionExpression:
          "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      })
    );
    /* ---------- bodyItem write (TABLE) ---------- */
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: `EVENT#${eventId}`,
          sk: "META",
          // 원본 위치 포인터
          pkMain: pk,
          skMain: sk,

          // 운영/디버깅 및 검증용 메타
          origin: orgKey,              // = origin || "UNKNOWN"
          day,
          shard,                       // event shard
          tsMs,
          ttl: ttlFromDay(day, TTL_DAYS),

          // payload 관련
          payloadHash,
          payloadTruncated,
        },
        ConditionExpression:
          "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      })
    );

    /* ---------- aggregate write (AGG_TABLE) ---------- */
    const aggUpdates = [];
    
    // DAY / DOMAIN  (하루-도메인 카운트: Top N Domains / 도메인별 합산용)
    aggUpdates.push(
      updateAgg({
        pk: `DAY#${day}#S#${aggShardDomain}`,
        sk: `DOMAIN#${domainKey}`,
        cntDelta: 1,
        scoreDelta: score,
      })
    );

    // DAY / RULE (하루-룰 카운트: Top N Rules / 룰별 합산용)
    aggUpdates.push(
      updateAgg({
        pk: `DAY#${day}#S#${aggShardRule}`,
        sk: `RULE#${ruleKey}`,
        cntDelta: 1,
        scoreDelta: score,
      })
    );

    // DAY / SEV (하루-위험도 카운트: Severity 분포용)
    aggUpdates.push(
      updateAgg({
        pk: `DAY#${day}#S#${aggShardSev}`,
        sk: `SEV#${sevKey}`,
        cntDelta: 1,
        scoreDelta: score,
      })
    );

    // TREND / RULE (룰 트렌드: day × sev)
    aggUpdates.push(
      updateAgg({
        pk: `TREND#RULE#K#${ruleKey}#S#${aggShardRule}`,
        sk: `DAY#${day}#SEV#${sevKey}`,
        cntDelta: 1,
        scoreDelta: score,
      })
    );

    // TREND / DOMAIN (도메인 트렌드: day × sev)
    aggUpdates.push(
      updateAgg({
        pk: `TREND#DOMAIN#K#${domainKey}#S#${aggShardDomain}`,
        sk: `DAY#${day}#SEV#${sevKey}`,
        cntDelta: 1,
        scoreDelta: score,
      })
    );

    // GLOBAL / DAY / DOMAIN (origin 없이 전체 도메인 통계) - 임시 수정 입니다 추후 수정 필요해요
    aggUpdates.push(
      updateAgg({
        pk: `GLOBAL#DAY#${day}#S#${aggShardGlobalDomain}`,
        sk: `DOMAIN#${domainKey}`,
        cntDelta: 1,
        scoreDelta: score,
      })
    );

    // GLOBAL / DAY / SEV (origin 없이 전체 위험도 통계) - 임시 수정 입니다 추후 수정 필요해요
    aggUpdates.push(
      updateAgg({
        pk: `GLOBAL#DAY#${day}#S#${aggShardGlobalSev}`,
        sk: `SEV#${sevKey}`,
        cntDelta: 1,
        scoreDelta: score,
      })
    );

    // GLOBAL / DAY / RULE (origin 없이 전체 룰 통계) - 임시 수정 입니다 추후 수정 필요해요
    aggUpdates.push(
      updateAgg({
        pk: `GLOBAL#DAY#${day}#S#${aggShardGlobalRule}`,
        sk: `RULE#${ruleKey}`,
        cntDelta: 1,
        scoreDelta: score,
      })
    );

    // DOMAIN-only / DAY (domain만으로 기간 집계 단일 호출용) - 임시 수정 입니다 추후 수정 필요해요
    aggUpdates.push(
      updateAgg({
        pk: `DOMAIN#${domainKey}`,
        sk: `DAY#${day}`,
        cntDelta: 1,
        scoreDelta: score,
      })
    );

    await Promise.all(aggUpdates);
    
  } catch (e) {
    if (String(e?.name).includes("ConditionalCheckFailed")) {
      return resp(200, { ok: true, dedup: true });
    }
    return resp(500, { ok: false, error: "DDB_WRITE_FAILED" });
  }

  return resp(200, { ok: true, eventId });
};