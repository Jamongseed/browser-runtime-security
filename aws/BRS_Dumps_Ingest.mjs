// index.mjs (AWS Lambda - /dumps ingest)
// deps: @aws-sdk/client-s3 @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { webcrack } from "webcrack";

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const BUCKET = process.env.DUMPS_BUCKET || "";
const PREFIX = process.env.DUMPS_PREFIX || "dumps/";
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";

// scoring-model-v1.json (S3에서 로드)
const RULESET_BUCKET = process.env.RULESET_BUCKET || "";
const SCORING_MODEL_KEY = process.env.SCORING_MODEL_KEY || "rulesets/scoring-model-v1.json";
const SCORING_MODEL_CACHE_TTL_MS = Number(process.env.SCORING_MODEL_CACHE_TTL_MS || 300000);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 8000);
const AI_PROMPT_VERSION = process.env.AI_PROMPT_VERSION || "ai-verdict-v1";

const SCORE_LOW = 50;
const SCORE_HIGH = 80;

// Threat_Events로 점수 이벤트 emit (API Gateway URL)
const EVENTS_INGEST_ENDPOINT = process.env.EVENTS_INGEST_ENDPOINT || "";
const EVENTS_INGEST_TIMEOUT_MS = Number(process.env.EVENTS_INGEST_TIMEOUT_MS || 2500);

const corsHeaders = () => ({
  "access-control-allow-origin": ALLOW_ORIGIN,
  "access-control-allow-methods": "OPTIONS,POST",
  "access-control-allow-headers": "content-type",
});

const resp = (statusCode, bodyObj) => ({
  statusCode,
  headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders() },
  body: JSON.stringify(bodyObj),
});

function isConditionalFail(e) {
  return e?.name === "ConditionalCheckFailedException";
}

function computeInjectedScoreSeverity(score, aiVerdict) {
  const s = Number(score);
  if (!Number.isFinite(s)) return "LOW";
  if (s >= SCORE_HIGH) return "HIGH";
  if (s < SCORE_LOW) return "LOW";
  return (aiVerdict === "MALICIOUS") ? "HIGH" : "LOW";
}

async function postJsonWithTimeout(url, bodyObj, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`EVENTS_INGEST_HTTP_${r.status} ${txt}`.trim());
    }
    // events ingest는 보통 {ok:true,eventId:...} 같은 JSON을 반환하므로 로그용으로 리턴
    return await r.json().catch(() => null);
  } finally {
    clearTimeout(t);
  }
}

// scoring-model loader (S3)
let scoringModelCache = null;
let scoringModelCacheAt = 0;

async function streamToString(body) {
  if (!body) return "";
  const chunks = [];
  for await (const c of body) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks).toString("utf8");
}

async function getS3TextIfExists(bucket, key) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const txt = await streamToString(r.Body);
    return (typeof txt === "string" && txt.length) ? txt : null;
  } catch {
    return null; // NoSuchKey 등은 캐시 미스 취급
  }
}

async function loadScoringModelFromS3() {
  const now = Date.now();
  if (scoringModelCache && (now - scoringModelCacheAt) < SCORING_MODEL_CACHE_TTL_MS) return scoringModelCache;
  if (!RULESET_BUCKET) throw new Error("MISSING_ENV:RULESET_BUCKET");
  const r = await s3.send(new GetObjectCommand({ Bucket: RULESET_BUCKET, Key: SCORING_MODEL_KEY }));
  const txt = await streamToString(r.Body);
  scoringModelCache = JSON.parse(txt);
  scoringModelCacheAt = now;
  return scoringModelCache;
}

// scoring engine (background.js에서 그대로 가져옴)
function extractOriginsFromText(text) {
  const s = String(text || "");
  const re = /\b(?:https?|wss?):\/\/[^\s"'`)<>\]]+/gi;
  const origins = new Set();
  let m;
  while ((m = re.exec(s))) {
    try { origins.add(new URL(m[0]).origin); } catch (_) {}
  }
  return origins;
}

function parseRegexPattern(p) {
  const s = String(p || "");
  if (s.length >= 2 && s[0] === "/" && s.lastIndexOf("/") > 0) {
    const last = s.lastIndexOf("/");
    const body = s.slice(1, last);
    const flags = s.slice(last + 1) || "i";
    return { body, flags };
  }
  return { body: s, flags: "i" };
}

function matchSignal(text, sig) {
  const m = sig?.match || null;
  if (!m) return false;

  const raw = String(text || "");
  const caseSensitive = m.caseSensitive === true;
  const hay = caseSensitive ? raw : raw.toLowerCase();

  if (m.type === "special" && m.name === "MULTI_ORIGIN_URL_LITERALS") {
    const min = Number(m.minOrigins || m.min || 2) || 2;
    return extractOriginsFromText(raw).size >= min;
  }

  if (m.type === "substrAny") {
    const pats = Array.isArray(m.patterns) ? m.patterns : [];
    return pats.some((p) => {
      if (!p) return false;
      const needle = caseSensitive ? String(p) : String(p).toLowerCase();
      return needle && hay.includes(needle);
    });
  }

  if (m.type === "regexAny") {
    const pats = Array.isArray(m.patterns) ? m.patterns : [];
    return pats.some((p) => {
      try {
        const { body, flags } = parseRegexPattern(p);
        if (!body) return false;
        const re = new RegExp(body, caseSensitive ? flags.replace(/i/g, "") : flags);
        return re.test(raw);
      } catch (_) {
        return false;
      }
    });
  }

  return false;
}

function scoreScriptText(text, model) {
  const signals = Array.isArray(model?.signals) ? model.signals : [];
  const combos  = Array.isArray(model?.combos) ? model.combos : [];

  const hits = [];
  const hitIds = new Set();
  let score = 0;

  for (const sig of signals) {
    if (!sig?.id) continue;
    if (!matchSignal(text, sig)) continue;

    const s = Number(sig.score || 0) || 0;
    score += s;
    hitIds.add(sig.id);
    hits.push({
      id: sig.id,
      axis: sig.axis || null,
      category: sig.category || null,
      signal: sig.signal || null,
      score: s,
      reason: sig.reason || null
    });
  }

  let comboBonus = 0;
  for (const c of combos) {
    if (c?.enabled !== true) continue;
    const bonus = Number(c.bonus || 0) || 0;
    if (!bonus) continue;
    const req = Array.isArray(c.requires) ? c.requires : [];
    if (!req.length) continue;
    const ok = req.every((id) => hitIds.has(id));
    if (!ok) continue;
    comboBonus += bonus;
  }

  score += comboBonus;
  return { score, hits };
}

function scoreBand(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return "LOW";
  if (s >= SCORE_HIGH) return "HIGH";
  if (s >= SCORE_LOW) return "MEDIUM";
  return "LOW";
}

function detectObfSignals(text) {
  const s = String(text || "");
  const sigs = [];
  if (/\beval\s*\(|new Function\s*\(/.test(s)) sigs.push("eval_or_function");
  if (/\batob\s*\(|fromCharCode\s*\(/.test(s) || /\b(?:=|:)\s*atob\b|\.map\(\s*atob\s*\)/.test(s)) sigs.push("decode_helpers");
  if (/[A-Za-z0-9+/]{400,}={0,2}/.test(s)) sigs.push("long_base64");
  if (/[0-9a-fA-F]{600,}/.test(s)) sigs.push("long_hex");
  return { ok: sigs.length >= 2, sigs };
}

async function classifyScriptWithOpenAI({ text, norm, score, sha256 }) {
  if (!OPENAI_API_KEY) throw new Error("MISSING_ENV:OPENAI_API_KEY");

  // 비용/지연 방지용 하드 캡(필요하면 조정)
  const MAX_CHARS = 12000;
  const full = String(text || "");
  const snippetTruncated = full.length > MAX_CHARS;
  const snippet = full.slice(0, MAX_CHARS);

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      verdict: { type: "string", enum: ["BENIGN", "MALICIOUS"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reasonShort: { type: "string", minLength: 1, maxLength: 140 },
      reason: { type: "string", minLength: 1, maxLength: 2000 },
      findings: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            kind: { type: "string", minLength: 1, maxLength: 40 },
            label: { type: "string", minLength: 1, maxLength: 120 },
            evidence: { type: "string", minLength: 0, maxLength: 160 }
          },
          required: ["kind", "label", "evidence"]
        }
      },
      actions: {
        type: "array",
        minItems: 3,
        maxItems: 4,
        items: { type: "string", minLength: 8, maxLength: 120 }
      }
    },
    required: ["verdict", "confidence", "reasonShort", "reason", "findings", "actions"]
  };

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const t0 = Date.now();
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: "system",
            content:
              "You are a security analyst. Decide if the given JavaScript snippet is malicious. " +
              "Return ONLY JSON that matches the provided schema. " +
              "IMPORTANT OUTPUT RULES (DASHBOARD STYLE): " +
              "1) Language: Write reasonShort, reason, findings[].label, findings[].evidence in Korean. " +
              "   - Keep verdict strictly as one of: BENIGN, MALICIOUS (do NOT translate). " +
              "   - findings[].kind is a short technical tag (English OK: exfiltration, obfuscation, hook, persistence, etc.). " +
              "   - Code tokens/URLs/API names may remain as-is, but explanatory text must be Korean. " +
              "2) Tone (Korean): Use neutral security-dashboard tone. Prefer endings like: " +
              "   - '~으로 의심됩니다', '~정황이 관찰됩니다', '~가능성이 있습니다', '~행위가 확인됩니다(근거가 명확할 때만)'. " +
              "   Avoid sensational or absolute claims unless directly evidenced in snippet. " +
              "3) reasonShort constraints: " +
              "   - 80~120 Korean characters (if possible). " +
              "   - One sentence only. No quotes. No emojis. " +
              "   - Mention 1) 핵심 행위(예: 후킹/탈취/전송) + 2) 대상/경로(예: XHR/fetch/쿠키/외부 도메인) 정도만. " +
              "4) reason constraints: " +
              "   - 3~6 sentences, each sentence <= 200 chars. " +
              "   - Structure: (a) 관찰된 행위 요약 → (b) 위험/영향 → (c) 근거(함수/패턴/문자열) → (d) 불확실성/대안 가능성(있으면). " +
              "5) findings constraints (max 3): " +
              "   - label: Korean, 20~60 chars, 명사형 요약(예: 'XMLHttpRequest 후킹 정황'). " +
              "   - evidence: Korean, 40~160 chars. 코드 전체를 붙이지 말고 '관찰 근거'를 요약하되, " +
              "     필요한 경우 짧은 토큰(함수명/문자열/엔드포인트 일부)만 포함. " +
              "6) actions constraints (3~4 lines): " +
              "   - actions는 '추천 조치' 한줄 문장들의 배열입니다(객체 금지). " +
              "   - 3~4개만 작성. 각 줄은 한국어 40~90자 권장, 120자 이내. " +
              "   - SOC가 바로 실행 가능한 형태(차단/격리/로그확인/재발검색/유입경로추적)로 작성. " +
              "   - 스니펫에서 도메인/sha256가 명확하면 해당 값을 문장에 포함하고, 불확실하면 '확인 시/의심 시' 조건부로 작성. " +
              "   - 예시(형식만 참고): " +
              "     1) 외부 전송 목적지 도메인/URL을 WAF·프록시·DNS 정책에서 우선 차단하세요. " +
              "     2) 동일 sha256/norm이 다른 session/installId에서 재발하는지 검색해 확산 여부를 확인하세요. " +
              "     3) XHR/fetch 후킹 근거(프로토타입 변조)와 실제 네트워크 전송 로그를 교차 검증하세요. " +
              "     4) 의심 스크립트는 격리 후 원본 유입 경로(주입 스크립트/서드파티/확장)를 추적하세요. " +
              "Return ONLY JSON that matches the schema and nothing else."
          },
          {
            role: "user",
            content:
              `score=${Number(score)}\n` +
              `sha256=${sha256}\n` + `norm=${norm || ""}\n` +
              "js:\n" + snippet
          }
        ],
        text: {
          format: { type: "json_schema", name: "script_classification", strict: true, schema }
        }
      })
    });

    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const msg = j?.error?.message || `OpenAI HTTP ${r.status}`;
      throw new Error(msg);
    }

    const outText =
      j?.output_text ||
      (Array.isArray(j?.output)
        ? j.output.map(o => o?.content?.map(c => c?.text).join("") || "").join("")
        : "");

    const obj = typeof outText === "string" && outText.trim()
      ? JSON.parse(outText)
      : (j?.output_parsed || null);

    if (!obj || !obj.verdict) throw new Error("OPENAI_PARSE_FAILED");

    const latencyMs = Date.now() - t0;
    return {
      ...obj,
      meta: {
        model: OPENAI_MODEL,
        snippetTruncated,
        latencyMs,
        promptVersion: AI_PROMPT_VERSION,
      },
    }; // { verdict, confidence, reasonShort, reason, findings, meta }
  } finally {
    clearTimeout(t);
  }
}

function computeStatus(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return "STORED_ONLY"; // score 없으면 보수적으로 저장만
  if (s >= SCORE_HIGH) return "MALICIOUS";
  if (s >= SCORE_LOW) return "PENDING_AI";
  return "STORED_ONLY";
}

function safeSha(sha) {
  return String(sha || "").replace(/[^a-f0-9]/gi, "").slice(0, 64);
}

function cutStr(s, max) {
  return String(s ?? "").slice(0, max);
}

function base32FromReportId(s) {
  const t = String(s || "");
  const m = t.match(/[a-f0-9]{32}/i);
  return m ? m[0].toLowerCase() : "";
}

export const handler = async (event, context) => {
  console.log("[layer-check] webcrack typeof:", typeof webcrack);
  console.log("[layer-check] webcrack keys:", webcrack ? Object.keys(webcrack) : null);
  const method = event?.requestContext?.http?.method || event?.httpMethod || "";
  if (method === "OPTIONS") return { statusCode: 204, headers: corsHeaders(), body: "" };
  if (method !== "POST") return resp(405, { ok: false, error: "METHOD_NOT_ALLOWED" });

  if (!BUCKET) return resp(500, { ok: false, error: "MISSING_ENV:DUMPS_BUCKET" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return resp(400, { ok: false, error: "INVALID_JSON" });
  }
  // 이번 호출(런) 식별자: 매 호출마다 새 이벤트/새 스냅샷을 만들기 위해 사용
  //const runTs = (Number.isFinite(Number(payload?.ts)) && Number(payload.ts) > 0) ? Number(payload.ts) : Date.now();
  if (!(Number.isFinite(Number(payload?.ts)) && Number(payload.ts) > 0)) {
    return resp(400, { ok:false, error:"MISSING_TS_FOR_IDEMPOTENCY" });
  }
  const runTs = Number(payload.ts);
  const runNonce = Math.random().toString(16).slice(2, 10);
  const runId = `${runTs}_${runNonce}`;
  // Threat_Events reportId용 결정적 키(중복 호출에도 동일)
  const runKey =
    (Number.isFinite(Number(payload?.ts)) && Number(payload.ts) > 0)
      ? String(Number(payload.ts))
      : String(runTs);
  const data = payload?.data || {};
  const sha256 = safeSha(data.sha256);
  const norm = String(data.norm || "");
  const text = String(data.text || "");
  let score = data.score;
  let aiText = text;
  let effectiveScoreForAi = Number.isFinite(Number(score)) ? Number(score) : null;
  const baseScoreReportId = String(data.scoreReportId || "");
  const base32ReportId = base32FromReportId(baseScoreReportId);
  const oldHitIds = Array.isArray(data.hitIds) ? data.hitIds.map(String).filter(Boolean) : null;

  // 응답용 점수 필드(원문/승격/최종)
  const oldScore = Number.isFinite(Number(score)) ? Number(score) : null; // rescore 이전(원문) 점수
  let rescoredScore = null;  // webcrack rescore로 승격된 점수(예: 60)
  let finalScore = null;     // (rescored/현재 score) + AI bonus (예: 100)

  if (!sha256) return resp(400, { ok: false, error: "MISSING_SHA256" });
  if (!text) return resp(400, { ok: false, error: "MISSING_TEXT" });

  let status = computeStatus(score);

  // 멱등 게이트
  const TABLE = process.env.DUMPS_TABLE || "";

  let isNew = true;
  let seenCount = 1;
  // AI 재호출 방지 게이트 응답용 (미리 선언: TDZ 방지)
  let aiQueued = false;
  let aiVerdict = null;
  let aiConfidence = null;
  let aiReasonShort = null;
  let aiReason = null;
  let aiFindings = null;
  let aiActions = null;
  let aiMeta = null;

  // 응답/클라이언트용: 서버가 실제로 사용한 이벤트 reportId를 내려주기
  let aiReportId = null;
  let aiEventIngested = false;  

  if (TABLE) {
    const now = Date.now();

    const u = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { ScriptHash: sha256 },
        UpdateExpression:
          "SET firstSeenTs = if_not_exists(firstSeenTs, :now), lastSeenTs = :now, " +
          //"#status = if_not_exists(#status, :status), " +
          //"lastScore = if_not_exists(lastScore, :score), " +
          "#status = :status, " +
          "lastScore = :score, " +
          "lastClientScore = :score, norm = :norm " +
          "ADD seenCount :one",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":now": now,
          ":status": status,
          ":score": Number.isFinite(Number(score)) ? Number(score) : null,
          ":norm": norm,
          ":one": 1,
        },
        ReturnValues: "ALL_OLD",
      })
    );

    if (u.Attributes && Object.keys(u.Attributes).length > 0) {
      isNew = false;
      seenCount = (u.Attributes.seenCount || 1) + 1;
    } else {
      isNew = true;
      seenCount = 1;
    }
  }

  // deduped(이미 존재)인 경우: DB에 저장된 최종 상태를 응답에 반영 (UX 안정화)
  //if (TABLE && !isNew) {
  //  try {
  //    const g = await ddb.send(
  //      new GetCommand({
  //        TableName: TABLE,
  //        Key: { ScriptHash: sha256 },
  //        ConsistentRead: true,
  //        ProjectionExpression: "#status, lastScore, aiVerdict, aiConfidence, aiReasonShort, aiReason, aiFindings, aiActions, aiMeta",
  //        ExpressionAttributeNames: { "#status": "status" },
  //      })
  //    );
  //    if (g?.Item) {
  //      status = g.Item.status ?? status;
  //      aiVerdict = g.Item.aiVerdict ?? aiVerdict;
  //      if (Number.isFinite(Number(g.Item.lastScore))) effectiveScoreForAi = Number(g.Item.lastScore);
  //      aiConfidence = typeof g.Item.aiConfidence === "number" ? g.Item.aiConfidence : aiConfidence;
  //      aiReasonShort = g.Item.aiReasonShort ?? aiReasonShort;
  //      aiReason = g.Item.aiReason ?? aiReason;
  //      aiFindings = g.Item.aiFindings ?? aiFindings;
  //      aiActions = g.Item.aiActions ?? aiActions;
  //      aiMeta = g.Item.aiMeta ?? aiMeta;
  //    }
  //  } catch (e) {
  //    console.error("[DB] GetItem (deduped) failed", {
  //      table: TABLE,
  //      sha256,
  //      name: e?.name,
  //      msg: String(e?.message || e),
  //    });
  //  }
  //}

  // low -> webcrack -> rescore (시도/스킵 포함 항상 RESCORE emit)
  try {
    const oldScoreNum = Number(score);
    const oldIsLow = Number.isFinite(oldScoreNum) && oldScoreNum < SCORE_LOW;
    const obf = detectObfSignals(text);

    if (oldIsLow && obf.ok) {
      const model = await loadScoringModelFromS3();

      // 원문 hitIds는 "서버 모델"로 재계산
      const oldRes = scoreScriptText(text, model);
      const oldSet = new Set(
        Array.isArray(oldRes.hits) ? oldRes.hits.map(h => h?.id).filter(Boolean) : []
      );

      const t0 = Date.now();

      // 1) 캐시 우선
      const cacheKey = `${PREFIX}${sha256}.webcrack.js`;
      let cacheHit = false;
      let deob = "";

      const cached = await getS3TextIfExists(BUCKET, cacheKey);
      if (cached) {
        deob = cached;
        cacheHit = true;
      } else {
        const wc =
          (typeof webcrack === "function") ? webcrack :
          (typeof webcrack?.webcrack === "function") ? webcrack.webcrack :
          (typeof webcrack?.default === "function") ? webcrack.default :
          null;
        if (!wc) throw new Error("WEBCRACK_NOT_CALLABLE");

        const r = await wc(text, { unpack: false, jsx: false, mangle: false });
        deob = String(r?.code || "");
        if (!deob) deob = text;
      }

      const latencyMs = Date.now() - t0;

      const deobMeta = {
        tool: "webcrack",
        opts: { unpack: false, jsx: false, mangle: false },
        latencyMs,
        obfSignals: obf.sigs,
        cache: { hit: cacheHit, key: cacheKey }
      };

      // 2) 캐시 미스 + 변환 결과가 있고 원문과 다르면 S3에 증거 저장
      if (!cacheHit && deob && deob !== text) {
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: cacheKey,
          Body: deob,
          ContentType: "text/plain; charset=utf-8",
        }));
      }

      // run 스냅샷은 cacheHit 여부와 무관하게 항상 저장(변환 결과가 있을 때)
      if (deob && deob !== text) {
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: `${PREFIX}runs/${sha256}/${runId}.webcrack.js`,
          Body: deob,
          ContentType: "text/plain; charset=utf-8",
        }));
      }

      // 3) 점수 재계산
      const newRes = scoreScriptText(deob || text, model);
      const newScore = Number(newRes.score);
      const newHits = Array.isArray(newRes.hits) ? newRes.hits : [];

      const addedHits = newHits
        .filter(h => h?.id && !oldSet.has(h.id))
        .map(h => ({
          id: h.id,
          axis: h.axis || null,
          category: h.category || null,
          signal: h.signal || null,
          score: h.score || 0,
          reason: h.reason || null
        }));

      const upgraded = Number.isFinite(newScore) && newScore >= SCORE_LOW;
      const improved = Number.isFinite(newScore) && Number.isFinite(oldScoreNum) && newScore > oldScoreNum;
      const midForAI = Number.isFinite(newScore) && newScore >= SCORE_LOW && newScore < SCORE_HIGH;

      console.log("[rescore] cacheHit:", cacheHit, "sameAsOrig:", deob === text);
      console.log("[rescore] old/new:", oldScoreNum, "->", newScore, "addedHits:", addedHits.length);

      // 4) 승격 성공이면 score/aiText/status 갱신 + DB 기록
      if (upgraded && improved) {
        score = newScore;
        rescoredScore = newScore;
        effectiveScoreForAi = Number(newScore);
        aiText = deob || text;
        status = midForAI ? "PENDING_AI" : computeStatus(score);

        if (TABLE) {
          await ddb.send(new UpdateCommand({
            TableName: TABLE,
            Key: { ScriptHash: sha256 },
            UpdateExpression: "SET lastScore = :s, #status = :st, rescoreTs = :now",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":s": newScore, ":st": status, ":now": Date.now() }
          }));
        }
      }

      // 5) ✅ 핵심: outcome이 무엇이든 RESCORE 이벤트를 항상 emit
      if (EVENTS_INGEST_ENDPOINT) {
        const tsMs = runTs;
        const reportId = base32ReportId
          ? `RS_${base32ReportId}`
          : `RS_${sha256}_${payload.sessionId ?? data.sessionId ?? "NO_SESSION"}_${runKey}`;

        const outcome =
          (upgraded && improved) ? "UPGRADED"
          : (deob === text) ? "SKIP_NO_CHANGE"
          : !Number.isFinite(newScore) ? "SKIP_SCORE_NAN"
          : (newScore < SCORE_LOW) ? "SKIP_NO_UPGRADE"
          : "SKIP_NOT_IMPROVED";

        const summary = {
          oneLine:
            (outcome === "UPGRADED")
              ? `webcrack 재스코어링으로 ${oldScoreNum}→${newScore} (addedHits ${addedHits.length}개)`
              : `webcrack rescore ${outcome} (old ${oldScoreNum}, new ${Number.isFinite(newScore) ? newScore : "N/A"}, cacheHit ${cacheHit})`
        };

        const sevForLog = Number.isFinite(newScore) ? scoreBand(newScore) : "LOW";

        const rescoreEvent = {
          type: "INJECTED_SCRIPT_RESCORE",
          ruleId: "INJECTED_SCRIPT_RESCORE",
          severity: sevForLog,
          scoreDelta: 0,
          ts: tsMs,
          reportId,
          installId: payload.installId || "",
          sessionId: payload.sessionId ?? data.sessionId ?? null,
          origin: payload.origin || "",
          targetOrigin: payload.targetOrigin || "",
          page: payload.page || "",
          ua: payload.ua || "",
          data: {
            sha256, norm,
            runKey,
            runId,
            runTs,
            outcome,
            oldScore: oldScoreNum,
            newScore: Number.isFinite(newScore) ? newScore : null,
            upgraded, improved,
            cacheHit,
            addedHits,
            deobMeta,
            s3: { webcrackKey: cacheKey },
            summary
          },
          evidence: {
            sha256, norm,
            runKey,
            runId,
            runTs,
            outcome,
            oldScore: oldScoreNum,
            newScore: Number.isFinite(newScore) ? newScore : null,
            upgraded, improved,
            cacheHit,
            addedHits,
            deobMeta,
            s3: { webcrackKey: cacheKey },
            summary
          }
        };

        const out = await postJsonWithTimeout(EVENTS_INGEST_ENDPOINT, rescoreEvent, EVENTS_INGEST_TIMEOUT_MS);
        console.log("[rescore] emitted eventId:", out?.eventId || out);
      }
    }
  } catch (e) {
    console.error("[rescore] failed", { sha256, name: e?.name, msg: String(e?.message || e), stack: e?.stack });
  }

  //AI 재호출 방지 게이트
  if (TABLE && status === "PENDING_AI") {
   const now = Date.now();
   try {
     await ddb.send(
       new UpdateCommand({
         TableName: TABLE,
         Key: { ScriptHash: sha256 },
         UpdateExpression: "SET aiStatus = :req, aiRequestedTs = :now",
         ConditionExpression: "attribute_not_exists(aiStatus) OR aiStatus IN (:not, :err)",
         ExpressionAttributeValues: {
           ":req": "REQUESTED",
           ":not": "NOT_REQUESTED",
           ":err": "ERROR",
           ":now": now
         },
       })
     );

     // OpenAI 직접 호출 (REQUESTED 전이 성공한 1건만)
     const aiScore = Number.isFinite(Number(effectiveScoreForAi)) ? Number(effectiveScoreForAi) : Number(score);
     const result = await classifyScriptWithOpenAI({ text: aiText, norm, score: aiScore, sha256 });
     aiQueued = true;
     aiVerdict = result.verdict;
     aiConfidence = typeof result.confidence === "number" ? result.confidence : null;
     aiReasonShort = cutStr(result.reasonShort, 140);
     aiReason = cutStr(result.reason, 2000);
     aiFindings = Array.isArray(result.findings) ? result.findings.slice(0, 3) : [];
     aiActions = Array.isArray(result.actions) ? result.actions.slice(0, 4) : [];
     aiMeta = result.meta || null;
     // 방어: actions는 string[]만 허용 (혼재 방지)
     if (!Array.isArray(aiActions) || aiActions.some(x => typeof x !== "string")) {
       aiActions = [];
     }
     const finalStatus = (result.verdict === "MALICIOUS") ? "AI_DONE_MALICIOUS" : "AI_DONE_BENIGN";
     status = finalStatus;
     await ddb.send(
       new UpdateCommand({
         TableName: TABLE,
         Key: { ScriptHash: sha256 },
         UpdateExpression:
           "SET aiStatus = :done, aiDoneTs = :now, aiVerdict = :v, aiConfidence = :c, " +
           "aiReasonShort = :rs, aiReason = :r, aiFindings = :f, aiActions = :a, aiMeta = :m, #status = :s " +
           "REMOVE aiError, aiErrorTs",
         ExpressionAttributeNames: { "#status": "status" },
         ExpressionAttributeValues: {
           ":done": "DONE",
           ":now": Date.now(),
           ":v": result.verdict,
           ":c": aiConfidence,
           ":rs": aiReasonShort,
           ":r": aiReason,
           ":f": Array.isArray(aiFindings) ? aiFindings : [],
           ":a": Array.isArray(aiActions) ? aiActions : [],
           ":m": aiMeta,
           ":s": finalStatus,
         },
       })
     );
   } catch (e) {
     if (e?.name === "ConditionalCheckFailedException") {
       // 정상: 이미 요청/완료되어 재호출 방지됨 -> 현재 상태를 DB에서 읽어 응답에 반영
       try {
         const g = await ddb.send(
           new GetCommand({
             TableName: TABLE,
             Key: { ScriptHash: sha256 },
             ConsistentRead: true,
             ProjectionExpression: "#status, aiVerdict, aiConfidence, aiReasonShort, aiReason, aiFindings, aiActions, aiMeta",
             ExpressionAttributeNames: { "#status": "status" },
           })
         );
         if (g?.Item) {
           status = g.Item.status ?? status;
           aiVerdict = g.Item.aiVerdict ?? aiVerdict;
           aiConfidence = typeof g.Item.aiConfidence === "number" ? g.Item.aiConfidence : aiConfidence;
           aiReasonShort = g.Item.aiReasonShort ?? aiReasonShort;
           aiReason = g.Item.aiReason ?? aiReason;
           aiFindings = g.Item.aiFindings ?? aiFindings;
           aiActions = g.Item.aiActions ?? aiActions;
           aiMeta = g.Item.aiMeta ?? aiMeta;
         }
       } catch (_) {}
     } else {
       // REQUESTED 전이 성공 후 OpenAI 실패/기타 예외만 ERROR로 기록
       console.error("[AI] failed", { sha256, msg: String(e?.message || e), name: e?.name });
       try {
         await ddb.send(
           new UpdateCommand({
             TableName: TABLE,
             Key: { ScriptHash: sha256 },
             UpdateExpression: "SET aiStatus = :err, aiErrorTs = :now, aiError = :msg",
             ExpressionAttributeValues: {
               ":err": "ERROR",
               ":now": Date.now(),
               ":msg": String(e?.message || e).slice(0, 500),
             },
           })
         );
       } catch (_) {}
     }
   }
  }
  // // AI: 매 호출마다 실행 (PENDING_AI일 때)
  // if (status === "PENDING_AI") {
  //   try {
  //     const aiScore = Number.isFinite(Number(effectiveScoreForAi)) ? Number(effectiveScoreForAi) : Number(score);
  //     const result = await classifyScriptWithOpenAI({ text: aiText, norm, score: aiScore, sha256 });
  //     aiQueued = true;
  //     aiVerdict = result.verdict;
  //     aiConfidence = typeof result.confidence === "number" ? result.confidence : null;
  //     aiReasonShort = cutStr(result.reasonShort, 140);
  //     aiReason = cutStr(result.reason, 2000);
  //     aiFindings = Array.isArray(result.findings) ? result.findings.slice(0, 3) : [];
  //     aiActions = Array.isArray(result.actions) ? result.actions.slice(0, 4) : [];
  //     aiMeta = result.meta || null;
  //     if (!Array.isArray(aiActions) || aiActions.some(x => typeof x !== "string")) aiActions = [];

  //     const finalStatus = (result.verdict === "MALICIOUS") ? "AI_DONE_MALICIOUS" : "AI_DONE_BENIGN";
  //     status = finalStatus;

  //     if (TABLE) {
  //       await ddb.send(new UpdateCommand({
  //         TableName: TABLE,
  //         Key: { ScriptHash: sha256 },
  //         UpdateExpression:
  //           "SET aiStatus = :done, aiDoneTs = :now, aiVerdict = :v, aiConfidence = :c, " +
  //           "aiReasonShort = :rs, aiReason = :r, aiFindings = :f, aiActions = :a, aiMeta = :m, #status = :s",
  //         ExpressionAttributeNames: { "#status": "status" },
  //         ExpressionAttributeValues: {
  //           ":done": "DONE",
  //           ":now": Date.now(),
  //           ":v": aiVerdict,
  //           ":c": aiConfidence,
  //           ":rs": aiReasonShort,
  //           ":r": aiReason,
  //           ":f": Array.isArray(aiFindings) ? aiFindings : [],
  //           ":a": Array.isArray(aiActions) ? aiActions : [],
  //           ":m": aiMeta,
  //           ":s": finalStatus,
  //         },
  //       }));
  //     }
  //   } catch (e) {
  //     console.error("[AI] failed", { sha256, msg: String(e?.message || e), name: e?.name });
  //     if (TABLE) {
  //       try {
  //         await ddb.send(new UpdateCommand({
  //           TableName: TABLE,
  //           Key: { ScriptHash: sha256 },
  //           UpdateExpression: "SET aiStatus = :err, aiErrorTs = :now, aiError = :msg",
  //           ExpressionAttributeValues: {
  //             ":err": "ERROR",
  //             ":now": Date.now(),
  //             ":msg": String(e?.message || e).slice(0, 500),
  //           },
  //         }));
  //       } catch (_) {}
  //     }
  //   }
  // }
  // S3 저장: 처음 본 sha256일 때만 저장
  // (TABLE 없는 경우는 무조건 저장)
  const shouldStore = true;

  // Threat_Events emit:
  // - INJECTED_SCRIPT_SCORE는 클라(background.js)가 /events ingest로 기록
  // - /dumps ingest는 50~79 구간만 AI 판정 후 별도 이벤트로 기록
  if (EVENTS_INGEST_ENDPOINT) {
    try {
      const sNum = Number.isFinite(Number(effectiveScoreForAi)) ? Number(effectiveScoreForAi) : Number(score);
      const baseNum = sNum;
      const midNeedsAI = Number.isFinite(baseNum) && baseNum >= SCORE_LOW && baseNum < SCORE_HIGH;
      if (!midNeedsAI) throw new Error("SKIP_AI_EVENT_NOT_MID");
      if (aiVerdict == null) throw new Error("SKIP_AI_EVENT_NOT_READY");

      //const tsMs = Number(payload.ts || Date.now());
      //const tsMs = Number.isFinite(Number(payload.ts)) && Number(payload.ts) > 0
      //  ? Number(payload.ts)
      //  : Date.now();
      const tsMs = runTs;
      const reportId = base32ReportId
        ? `AI_${base32ReportId}`
        : `AI_${sha256}_${payload.sessionId ?? data.sessionId ?? "NO_SESSION"}_${runKey}`;
      aiReportId = reportId;
      const bonus = (aiVerdict === "MALICIOUS") ? 40 : 0;
      const finalScore = Number.isFinite(baseNum) ? (baseNum + bonus) : null;
      const finalSeverity =
        (Number.isFinite(finalScore) && finalScore >= SCORE_HIGH) ? "HIGH"
        : (Number.isFinite(finalScore) && finalScore < SCORE_LOW) ? "LOW"
        : (aiVerdict === "MALICIOUS") ? "HIGH" : "LOW";

      // 이벤트에도 표준 점수 기준 status를 일관되게 기록
      const statusForEvent =
        (status === "AI_DONE_MALICIOUS" || status === "AI_DONE_BENIGN")
          ? status
          : computeStatus(baseNum);

      const aiVerdictEvent = {
        type: "INJECTED_SCRIPT_AI_VERDICT",
        ruleId: "INJECTED_SCRIPT_AI_VERDICT",
        severity: finalSeverity,
        scoreDelta: bonus,
        ts: tsMs,
        reportId,
        installId: payload.installId || "",
        sessionId: payload.sessionId ?? data.sessionId ?? null,
        origin: payload.origin || "",
        targetOrigin: payload.targetOrigin || "",
        page: payload.page || "",
        ua: payload.ua || "",
        data: {
          sha256,
          norm,
          baseReportId: (base32ReportId || null),
          runKey,
          runId,
          runTs,
          score: Number.isFinite(sNum) ? sNum : null,
          effectiveScore: Number.isFinite(baseNum) ? baseNum : null,
          bonus,
          finalScore,
          status: statusForEvent,
          aiVerdict,
          aiConfidence,
          summary: {
            reasonShort: cutStr(aiReasonShort || aiReason || "", 120),
          },
          explain: {
            ai: {
              confidence: aiConfidence,
              reason: cutStr(aiReason || "", 2000),
              findings: Array.isArray(aiFindings) ? aiFindings.slice(0, 3) : [],
              actions: Array.isArray(aiActions) ? aiActions.slice(0, 4) : [],
              meta: {
                model: aiMeta?.model || OPENAI_MODEL,
                snippetTruncated: !!aiMeta?.snippetTruncated,
                latencyMs: typeof aiMeta?.latencyMs === "number" ? aiMeta.latencyMs : null,
                promptVersion: aiMeta?.promptVersion || AI_PROMPT_VERSION,
              },
            }
          }
        },
        evidence: {
          sha256,
          norm,
          baseReportId: (base32ReportId || null),
          runKey,
          runId,
          runTs,
          score: Number.isFinite(sNum) ? sNum : null,
          effectiveScore: Number.isFinite(baseNum) ? baseNum : null,
          bonus,
          finalScore,
          aiVerdict,
          aiConfidence,
          summary: {
            reasonShort: cutStr(aiReasonShort || aiReason || "", 120),
          },
          explain: {
            ai: {
              confidence: aiConfidence,
              reason: cutStr(aiReason || "", 2000),
              findings: Array.isArray(aiFindings) ? aiFindings.slice(0, 3) : [],
              actions: Array.isArray(aiActions) ? aiActions.slice(0, 4) : [],
              meta: {
                model: aiMeta?.model || OPENAI_MODEL,
                snippetTruncated: !!aiMeta?.snippetTruncated,
                latencyMs: typeof aiMeta?.latencyMs === "number" ? aiMeta.latencyMs : null,
                promptVersion: aiMeta?.promptVersion || AI_PROMPT_VERSION,
              },
            }
          }
        },
      };

      await postJsonWithTimeout(EVENTS_INGEST_ENDPOINT, aiVerdictEvent, EVENTS_INGEST_TIMEOUT_MS);
      aiEventIngested = true;
    } catch (e) {
      const m = String(e?.message || e);
      if (m === "SKIP_AI_EVENT_NOT_MID" || m === "SKIP_AI_EVENT_NOT_READY" || m === "SKIP_AI_EVENT_NO_TS") {
        // no-op
      } else {
        console.error("[events] AI verdict emit failed", { sha256, msg: m, name: e?.name });
      }
    }
  }

  let meta = null;

  const baseKey = `${PREFIX}${sha256}`;
  if (shouldStore) {
    // 원문(.js)
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${baseKey}.js`,
        Body: text,
        ContentType: "text/plain; charset=utf-8",
      })
    );

    // run 스냅샷(매 호출 보존)
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${PREFIX}runs/${sha256}/${runId}.js`,
      Body: text,
      ContentType: "text/plain; charset=utf-8",
    }));
    // 메타(.json) - text는 빼고 저장(원문은 .js로 충분)
    meta = {
      type: payload.type || "SCRIPT_DUMP",
      ts: runTs,
      page: payload.page || "",
      origin: payload.origin || "",
      targetOrigin: payload.targetOrigin || "",
      installId: payload.installId || "",
      tabId: payload.tabId ?? null,
      runId,
      data: {
        sha256,
        norm,
        score: Number.isFinite(Number(effectiveScoreForAi)) ? Number(effectiveScoreForAi)
             : Number.isFinite(Number(score)) ? Number(score) : null,
        url: String(data.url || ""),
        via: String(data.via || ""),
        length: data.length ?? text.length,
        truncated: !!data.truncated,
      },
      status,
    };

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${baseKey}.json`,
        Body: JSON.stringify(meta, null, 2),
        ContentType: "application/json; charset=utf-8",
      })
    );
  }
  // run 메타 스냅샷 (meta 없으면 최소 메타라도 저장)
  const runMeta = meta ?? {
    type: payload.type || "SCRIPT_DUMP",
    ts: runTs,
    page: payload.page || "",
    origin: payload.origin || "",
    targetOrigin: payload.targetOrigin || "",
    installId: payload.installId || "",
    tabId: payload.tabId ?? null,
    runId,
    data: { sha256, norm },
    status,
  };
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `${PREFIX}runs/${sha256}/${runId}.json`,
    Body: JSON.stringify(runMeta, null, 2),
    ContentType: "application/json; charset=utf-8",
  }));

  // (UX) 응답 직전에 DB 최종값을 1회 더 읽어 반영 (특히 2번째/이후 요청)
  if (TABLE) {
    try {
      const g = await ddb.send(
        new GetCommand({
          TableName: TABLE,
          Key: { ScriptHash: sha256 },
          ConsistentRead: true,
          ProjectionExpression: "#status, lastScore, aiVerdict, aiConfidence, aiReasonShort, aiReason, aiFindings, aiActions, aiMeta",
          ExpressionAttributeNames: { "#status": "status" },
        })
      );
      if (g?.Item) {
        status = g.Item.status ?? status;
        aiVerdict = g.Item.aiVerdict ?? aiVerdict;
        if (Number.isFinite(Number(g.Item.lastScore))) effectiveScoreForAi = Number(g.Item.lastScore);
        aiConfidence = typeof g.Item.aiConfidence === "number" ? g.Item.aiConfidence : aiConfidence;
        aiReasonShort = g.Item.aiReasonShort ?? aiReasonShort;
        aiReason = g.Item.aiReason ?? aiReason;
        aiFindings = g.Item.aiFindings ?? aiFindings;
        aiActions = g.Item.aiActions ?? aiActions;
        aiMeta = g.Item.aiMeta ?? aiMeta;
      }
    } catch (e) {
      console.error("[DB] GetItem (final) failed", {
        table: TABLE,
        sha256,
        name: e?.name,
        msg: String(e?.message || e),
      });
    }
  }

  // (UX) 표준 점수 기준으로 status를 한 번 더 정렬 (lastScore만 남고 status가 구버전인 케이스 방지)
  if (status !== "AI_DONE_MALICIOUS" && status !== "AI_DONE_BENIGN") {
    const stScore = Number.isFinite(Number(effectiveScoreForAi)) ? Number(effectiveScoreForAi) : Number(score);
    status = computeStatus(stScore);
  }

  // 응답 직전: 최종 점수 계산(현재 score는 rescore 반영된 값일 수 있음)
  {
    const sNum = Number.isFinite(Number(effectiveScoreForAi)) ? Number(effectiveScoreForAi) : Number(score);
    if (Number.isFinite(sNum) && aiVerdict) {
      const bonus = (aiVerdict === "MALICIOUS") ? 40 : 0;
      finalScore = sNum + bonus;
    }
  }  

  return resp(200, {
    ok: true,
    sha256,
    status,
    deduped: TABLE ? !isNew : false,
    stored: shouldStore,
    seenCount,
    aiQueued,
    aiVerdict,
    aiConfidence,
    aiActions,
    aiReportId,
    aiEventIngested,
    oldScore,
    rescoredScore,
    effectiveScore: Number.isFinite(Number(effectiveScoreForAi)) ? Number(effectiveScoreForAi)
                  : Number.isFinite(Number(score)) ? Number(score) : null,
    finalScore,
    s3: {
      jsKey: `${baseKey}.js`,
      metaKey: `${baseKey}.json`,
      runJsKey: `${PREFIX}runs/${sha256}/${runId}.js`,
      runMetaKey: `${PREFIX}runs/${sha256}/${runId}.json`,
    },
  });
};