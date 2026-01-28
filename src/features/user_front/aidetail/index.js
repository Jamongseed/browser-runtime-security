// src/features/admin_front/ai_detail/index.js
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import TitleCard from "../../../components/Cards/TitleCard";
import { getEventDetail, getRuleDescription } from "../../aws/AwsSearch";

/** -----------------------------
 * Reuse: 최소 유틸/카드 (기존 파일에서 그대로 복붙)
 * - toNum, fmtTs, relTime, safeJsonParse, copyToClipboard, hostFromUrl
 * - Section, KpiCard, KV, JsonViewer
 * ------------------------------ */
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmtTs(ts) {
  const n = toNum(ts);
  if (!n) return "-";
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString("ko-KR");
}
function relTime(tsMs) {
  const n = toNum(tsMs);
  if (!n) return "";
  const diff = Date.now() - n;
  if (!Number.isFinite(diff)) return "";
  const abs = Math.abs(diff);
  const sec = Math.round(abs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  const label =
    day >= 1 ? `${day}일` : hr >= 1 ? `${hr}시간` : min >= 1 ? `${min}분` : `${sec}초`;
  return diff >= 0 ? `${label} 전` : `${label} 후`;
}
function safeJsonParse(v) {
  if (v == null) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string") return { raw: String(v) };
  try {
    return JSON.parse(v);
  } catch {
    return { raw: v };
  }
}
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
function hostFromUrl(urlLike) {
  if (!urlLike) return "";
  try {
    return new URL(urlLike).hostname;
  } catch {
    return "";
  }
}
function Section({ title, children }) {
  return (
    <div className="card bg-base-100 border">
      <div className="card-body gap-3">
        <div className="font-bold">{title}</div>
        {children}
      </div>
    </div>
  );
}
function KpiCard({ label, value, hint }) {
  return (
    <div className="p-3 rounded-xl border bg-base-100">
      <div className="text-xs opacity-60">{label}</div>
      <div className="mt-1 text-lg font-bold">{value ?? "-"}</div>
      {hint ? <div className="mt-1 text-xs opacity-60">{hint}</div> : null}
    </div>
  );
}
function KV({ k, v, copy, link }) {
  if (v == null || v === "-" || v === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-base-200">
      <div className="text-ms opacity-60 min-w-[140px]">{k}</div>
      <div className="flex-1 text-left">
        {link ? (
          <a className="link link-primary break-all" href={link} target="_blank" rel="noreferrer">
            {String(v)}
          </a>
        ) : (
          <div className="break-all">{String(v)}</div>
        )}
      </div>
      {copy ? (
        <button className="btn btn-xs btn-ghost" onClick={() => copyToClipboard(copy)}>
          Copy
        </button>
      ) : null}
    </div>
  );
}
function JsonViewer({ title, obj, raw }) {
  const pretty = useMemo(() => {
    try {
      return obj ? JSON.stringify(obj, null, 2) : raw || "";
    } catch {
      return raw || "";
    }
  }, [obj, raw]);

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-base-200 border-b">
        <div className="text-sm font-semibold">{title}</div>
        <button
          className="btn btn-xs btn-outline"
          onClick={async () => {
            const ok = await copyToClipboard(pretty || "");
            alert(ok ? "Copied" : "Copy failed");
          }}
        >
          Copy
        </button>
      </div>
      <pre className="p-3 text-xs break-all overflow-auto max-h-[520px] bg-base-100">
        {pretty || "-"}
      </pre>
    </div>
  );
}

function badgeForVerdict(v) {
  const s = String(v || "").toUpperCase();
  if (s === "MALICIOUS") return "badge badge-error";
  if (s === "SUSPICIOUS") return "badge badge-warning";
  if (s === "BENIGN") return "badge badge-success";
  return "badge";
}

function sevKo(sev) {
  const s = String(sev || "").toUpperCase();
  if (s === "HIGH") return "고위험";
  if (s === "MEDIUM") return "주의";
  if (s === "LOW") return "정보";
  return "알 수 없음";
}

function pickAiBlock(detail, parsedPayload) {
  const det = detail?.details || {};
  const payload = parsedPayload || {};
  const payloadData = payload?.data || {};
  const detData = det?.data || det || {};

  // “어디에 있든” 공통 필드를 찾기 위한 후보들
  const candidates = [
    payload, payloadData,
    det, detData,
    detail,
    detail?.payload,
  ].filter(Boolean);

  const pick = (...paths) => {
    for (const c of candidates) {
      for (const p of paths) {
        const v = p(c);
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
    return null;
  };

  // data/evidence/explain.ai 후보
  const dataObj =
    pick((c) => c.data) || payloadData || detData || {};
  const evidenceObj =
    pick((c) => c.evidence) || payload?.evidence || det?.evidence || {};

  const explainAi =
    pick(
      (c) => c?.data?.explain?.ai,
      (c) => c?.explain?.ai,
      (c) => c?.evidence?.explain?.ai
    ) || {};

  const findings =
    Array.isArray(explainAi?.findings) ? explainAi.findings :
    Array.isArray(dataObj?.explain?.ai?.findings) ? dataObj.explain.ai.findings :
    Array.isArray(evidenceObj?.explain?.ai?.findings) ? evidenceObj.explain.ai.findings :
    [];

  const endpointFinding = findings.find((f) => f.kind === "MaliciousEndpoint") || null;

  return {
    type: pick((c) => c.type) || "UNKNOWN",
    severity: pick((c) => c.severity) || detail?.severity || "UNKNOWN",

    verdict: pick(
      (c) => c?.data?.aiVerdict,
      (c) => c?.evidence?.aiVerdict,
      (c) => c?.aiVerdict
    ),
    confidence: pick(
      (c) => c?.data?.aiConfidence,
      (c) => c?.evidence?.aiConfidence,
      (c) => c?.aiConfidence
    ),
    finalScore: pick(
      (c) => c?.data?.finalScore,
      (c) => c?.evidence?.finalScore,
      (c) => c?.finalScore,
      (c) => c?.score
    ),
    scoreDelta: pick((c) => c.scoreDelta),

    reasonShort: pick(
      (c) => c?.data?.summary?.reasonShort,
      (c) => c?.evidence?.summary?.reasonShort
    ),
    reasonLong: explainAi?.reason ?? null,

    model: explainAi?.meta?.model ?? null,
    latencyMs: explainAi?.meta?.latencyMs ?? null,
    promptVersion: explainAi?.meta?.promptVersion ?? null,

    origin: pick((c) => c.origin, (c) => c?.data?.origin),
    page: pick((c) => c.page, (c) => c?.data?.page),
    sessionId: pick((c) => c.sessionId, (c) => c?.data?.sessionId),
    installId: pick((c) => c.installId, (c) => c?.data?.installId),
    ts: pick((c) => c.ts, (c) => c.tsMs, (c) => c?.data?.ts, (c) => c?.data?.tsMs),

    reportId: pick((c) => c.reportId, (c) => c?.data?.reportId),
    baseReportId: pick((c) => c?.data?.baseReportId, (c) => c.baseReportId),
    sha256: pick((c) => c?.data?.sha256, (c) => c?.evidence?.sha256, (c) => c.sha256),
    norm: pick((c) => c?.data?.norm, (c) => c?.evidence?.norm, (c) => c.norm),

    findings,
    primaryThreat: endpointFinding?.label || "Data Exfiltration",
    endpoint: endpointFinding?.evidence || null,

    rawObj: { payload, det, detail },
  };
}

function buildRecommendedActions(ai) {
  const actions = [];

  const confidencePct =
    ai?.confidence == null
      ? null
      : ai.confidence > 1
        ? ai.confidence
        : Math.round(ai.confidence * 100);

  const risk = ai?.finalScore ?? ai?.scoreDelta ?? null;

  const hasFinding = (kind) =>
    Array.isArray(ai?.findings) && ai.findings.some((f) => f?.kind === kind);

  const endpointUrl = ai?.endpoint || "";
  const endpointHost = endpointUrl ? hostFromUrl(endpointUrl) : "";

  // 1) 외부 전송
  if (endpointUrl) {
    actions.push({
      id: "block-endpoint",
      priority: 1,
      title: "외부 전송 목적지 차단",
      detail: endpointHost
        ? `WAF/프록시/DNS에서 ${endpointHost} 도메인(및 관련 URL)을 차단하세요.`
        : "WAF/프록시/DNS에서 외부 전송 URL을 차단하세요.",
    });

    actions.push({
      id: "network-log",
      priority: 2,
      title: "외부 전송 로그 확인",
      detail: "동일 도메인/URL로 반복 전송이 있는지 네트워크 로그를 확인하세요.",
    });
  }

  // 2) 후킹
  if (hasFinding("FunctionHook")) {
    actions.push({
      id: "hook-investigate",
      priority: 2,
      title: "런타임 후킹 경로 추적",
      detail: "XHR/fetch prototype 오염 원인(주입 스크립트/서드파티 태그/확장)을 확인하세요.",
    });
  }

  // 3) IOC
  if (ai?.sha256 || ai?.norm) {
    actions.push({
      id: "ioc-hunt",
      priority: 3,
      title: "IOC 재발 여부 검색",
      detail: "sha256/norm으로 다른 session/install에서 재발 여부를 검색하세요.",
    });

    actions.push({
      id: "ioc-register",
      priority: 3,
      title: "IOC 등록",
      detail: "sha256/norm 및 전송 도메인을 IOC 목록에 등록하세요.",
    });
  }

  // 4) 신뢰도 낮음 → 검증
  if (confidencePct != null && confidencePct < 70) {
    actions.push({
      id: "verify",
      priority: 4,
      title: "추가 검증 수행",
      detail: "오탐 가능성이 있어 샘플 수집/재현/룰 확인을 진행하세요.",
    });
  }

  if (!actions.length) {  
    actions.push({
      id: "baseline",
      priority: 5,
      title: "기본 점검 수행",
      detail: "IOC/외부 전송/주입 경로를 확인하고 필요 시 차단 정책을 적용하세요.",
    });
  }

  actions.sort((a, b) => a.priority - b.priority);
  return actions;
}

export default function AdminAiEventDetailPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const params = useParams();

  const eventId = params.eventId || sp.get("eventId");
  const from = sp.get("from") || "";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [ruleIdState, setRuleIdState] = useState(null);
  const [ruleDescription, setRuleDescription] = useState(null);

  const [tab, setTab] = useState("overview"); // overview | analysis | ioc | evidence

  const currentUrlRef = useRef("");
  useEffect(() => {
    try {
      currentUrlRef.current = window.location?.href || "";
    } catch {
      currentUrlRef.current = "";
    }
  }, []);

  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    setLoading(true);
    setErr("");

    getEventDetail({ eventId })
      .then((res) => {
        if (!alive) return;
        setData(res.data);
        setRuleIdState(res.data?.ruleId || res.data?.details?.ruleId || null);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e?.message || "이벤트 조회 실패");
        setData(null);
        setRuleIdState(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [eventId]);

  useEffect(() => {
    if (!ruleIdState) return;
    let alive = true;

    getRuleDescription({ ruleId: ruleIdState })
      .then((res) => {
        if (!alive) return;
        setRuleDescription(res.data);
      })
      .catch(() => {
        if (!alive) return;
        setRuleDescription(null);
      });

    return () => {
      alive = false;
    };
  }, [ruleIdState]);

  const detail = data;

  const payloadObj = useMemo(() => detail?.details || {}, [detail]);

  const parsedPayload = useMemo(() => {
    const raw =
      detail?.payload?.payloadJson ||
      detail?.payload?.payload?.payloadJson ||
      detail?.payloadJson;
    return raw ? safeJsonParse(raw) : null;
  }, [detail]);

  const ai = useMemo(() => pickAiBlock(detail, parsedPayload), [detail, parsedPayload]);

  function onBack() {
    if (from) navigate(from);
    else navigate(-1);
  }

  const tabs = [
    { key: "overview", label: "요약" },
    { key: "analysis", label: "분석" },
    { key: "ioc", label: "지표" },
    { key: "evidence", label: "증거" },
  ];

  const confidenceText =
    ai.confidence == null ? "-" : ai.confidence > 1 ? `${ai.confidence}%` : `${Math.round(ai.confidence * 100)}%`;

  const riskScoreText =
    ai.finalScore != null ? String(ai.finalScore) : ai.scoreDelta != null ? String(ai.scoreDelta) : "-";

  const pageHost = ai.page ? hostFromUrl(ai.page) : ai.origin ? hostFromUrl(ai.origin) : "";

  const recommendedActions = useMemo(() => buildRecommendedActions(ai), [ai]);

  return (
    <TitleCard title="AI 이벤트 상세" topMargin="mt-2">
      {/* Top bar */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="text-sm opacity-70">
          <div className="break-all">eventId: {eventId || "(none)"}</div>
          {ai.sessionId ? <div className="mt-1 break-all">sessionId: {ai.sessionId}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm btn-primary" onClick={onBack}>
            ← 뒤로
          </button>
          <Link className="btn btn-sm btn-primary" to={`/app/user_front/detail/${ai.baseReportId || ""}`}>
            기존 이벤트
          </Link>
          <Link className="btn btn-sm btn-primary" to={`/app/user_front/listpage_session/detail/${ai.sessionId || ""}`}>
            세션
          </Link>
        </div>
      </div>

      {!eventId ? (
        <div className="p-4 border rounded-xl">
          <div className="font-semibold mb-1">eventId가 필요해요</div>
          <div className="text-sm opacity-70">예: /app/admin_front/ai_detail/{"{eventId}"} 또는 ?eventId=...</div>
        </div>
      ) : null}

      {loading ? <div className="opacity-70">loading…</div> : null}

      {err ? (
        <div className="p-3 border border-red-300 bg-red-50 text-red-700 rounded-xl">
          <div className="font-semibold mb-1">조회 실패</div>
          <div className="text-sm break-all">{err}</div>
        </div>
      ) : null}

      {!loading && !err && detail ? (
        <div className="space-y-4">
          {/* Header / KPI */}
          <div className="card bg-base-100 border">
            <div className="card-body gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={badgeForVerdict(ai.verdict)}>{String(ai.severity || "UNKNOWN").toUpperCase()}</span>
                    <span className="text-sm opacity-70">{sevKo(ai.severity) || "-"}</span>
                  </div>

                  <div className="mt-2 text-lg font-bold">{"AI 분석 기반 데이터 유출 탐지"}</div>

                  <div className="mt-2 text-xs opacity-70 break-all">
                    type: {ai.type}
                  </div>
                </div>

                <div className="text-right text-sm">
                  <div className="opacity-60">발생 시각</div>
                  <div>{fmtTs(ai.ts)}</div>
                  {ai.ts ? <div className="opacity-70">{relTime(ai.ts)}</div> : null}
                </div>
              </div>

              {/* KPI 4개 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <KpiCard label="AI Verdict" value={ai.verdict || "-"} hint="모델 판정" />
                <KpiCard label="Confidence" value={confidenceText} hint="신뢰도" />
                <KpiCard label="Risk Score" value={riskScoreText} hint="finalScore" />
                <KpiCard label="Primary Threat" value={ai.primaryThreat || "-"} hint="행위 기반 요약" />
              </div>
            </div>
          </div>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* LEFT COLUMN */}
  <div className="space-y-6">
    <Section title="요약">
      <KV k="탐지 규칙" v={ai.type} />
      <KV k="탐지 설명" v={ai.reasonShort || "-"} />
      <KV k="위험 페이지" v={ai.page} />
    </Section>

    <Section title="판단 근거">
      <KV k="AI 설명" v={ai.reasonLong || ai.reasonShort || "-"} />
    </Section>

    <Section title="외부 통신">
      <KV
        k="외부 전송 URL"
        v={ai.endpoint || "-"}
      />
      <KV
        k="도메인"
        v={ai.endpoint ? hostFromUrl(ai.endpoint) : "-"}
        copy={ai.endpoint ? hostFromUrl(ai.endpoint) : ""}
      />
    </Section>
  </div>

  {/* RIGHT COLUMN */}
  <div className="space-y-6">
    <Section title="사용자/환경">
      <KV k="기존 이벤트 ID" v={ai.baseReportId || "-"} copy={ai.baseReportId || ""} />
      <KV k="이벤트 ID" v={ai.reportId || "-"} copy={ai.reportId || ""} />
      <KV
        k="세션 ID"
        v={ai.sessionId || "-"}
        copy={ai.sessionId || ""}
      />
      <KV
        k="유저 ID"
        v={ai.installId || "-"}
        copy={ai.installId || ""}
      />
    </Section>

    <Section title="분석 메타">
      <KV k="AI 모델" v={ai.model || "-"} />
    </Section>
  </div>
</div>
        </div>
      ) : null}
    </TitleCard>
  );
}
