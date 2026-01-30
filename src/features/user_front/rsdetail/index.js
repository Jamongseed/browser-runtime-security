// src/features/admin_front/rsdetail/index.js
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import TitleCard from "../../../components/Cards/TitleCard";
import { getEventDetail } from "../../aws/AwsSearch";

/** -----------------------------
 * 최소 유틸/카드 (기존 카드 형태 유지)
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
      <div className="mt-1 text-lg font-bold break-all">{value ?? "-"}</div>
      {hint ? <div className="mt-1 text-xs opacity-60 break-all">{hint}</div> : null}
    </div>
  );
}

/**
 * KV: 기존 카드(row) 형태 유지하면서 v에 JSX도 허용
 * link 케이스는 기존처럼 문자열로만 렌더(필요하면 확장 가능)
 */
function KV({ k, v, copy, link }) {
  if (v == null || v === "-" || v === "") return null;
  const isNode = typeof v === "object"; // JSX/ReactNode 허용

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-base-200">
      <div className="text-ms opacity-60 min-w-[140px]">{k}</div>
      <div className="flex-1 text-left">
        {link ? (
          <a className="link link-primary break-all" href={link} target="_blank" rel="noreferrer">
            {String(v)}
          </a>
        ) : (
          <div className="break-all">{isNode ? v : String(v)}</div>
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
  const [mode, setMode] = useState("tree"); // tree | raw
  const pretty = useMemo(() => {
    if (mode === "raw") return raw || "";
    try {
      return obj ? JSON.stringify(obj, null, 2) : raw || "";
    } catch {
      return raw || "";
    }
  }, [mode, obj, raw]);

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-base-200 border-b">
        <div className="text-sm font-semibold">{title}</div>
        <div className="flex items-center gap-2">
          <button
            className={`btn btn-xs ${mode === "tree" ? "btn-neutral" : "btn-ghost"}`}
            onClick={() => setMode("tree")}
          >
            Tree
          </button>
          <button
            className={`btn btn-xs ${mode === "raw" ? "btn-neutral" : "btn-ghost"}`}
            onClick={() => setMode("raw")}
          >
            Raw
          </button>
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
      </div>
      <pre className="p-3 text-xs break-all overflow-auto max-h-[520px] bg-base-100">
        {pretty || "-"}
      </pre>
    </div>
  );
}

function baseIdFromEventId(id) {
  return typeof id === "string" ? id.replace(/^RS_/, "") : id;
}

function badgeForSeverity(sev) {
  const s = String(sev || "").toUpperCase();
  if (s === "HIGH") return "badge badge-error";
  if (s === "MEDIUM") return "badge badge-warning";
  if (s === "LOW") return "badge badge-info";
  return "badge";
}
function sevKo(sev) {
  const s = String(sev || "").toUpperCase();
  if (s === "HIGH") return "고위험";
  if (s === "MEDIUM") return "주의";
  if (s === "LOW") return "정보";
  return "알 수 없음";
}

/** -----------------------------
 * RESCORE payload에서 필요한 것만 뽑기
 * ------------------------------ */
function pickRescoreBlock(detail, parsedPayload) {
  const det = detail?.details || {};
  const payload = parsedPayload || {};
  const candidates = [payload, payload?.data, det, det?.data, detail, detail?.payload].filter(Boolean);

  const pick = (...paths) => {
    for (const c of candidates) {
      for (const p of paths) {
        const v = p(c);
        if (v !== undefined && v !== null && v !== "") return v;
      }
    }
    return null;
  };

  const dataObj = pick((c) => c.data) || payload?.data || det?.data || {};
  const evidenceObj = pick((c) => c.evidence) || payload?.evidence || det?.evidence || {};

  const addedHits =
    (Array.isArray(dataObj?.addedHits) && dataObj.addedHits) ||
    (Array.isArray(evidenceObj?.addedHits) && evidenceObj.addedHits) ||
    [];

  return {
    type: pick((c) => c.type) || "UNKNOWN",
    ruleId: pick((c) => c.ruleId) || null,
    severity: pick((c) => c.severity) || detail?.severity || "UNKNOWN",
    scoreDelta: pick((c) => c.scoreDelta) ?? null,
    ts: pick((c) => c.ts, (c) => c.tsMs, (c) => c?.data?.ts, (c) => c?.data?.tsMs),

    reportId: pick((c) => c.reportId) || null,
    installId: pick((c) => c.installId) || null,
    sessionId: pick((c) => c.sessionId) || null,
    origin: pick((c) => c.origin) || null,
    page: pick((c) => c.page) || null,

    sha256: pick((c) => c?.data?.sha256, (c) => c?.evidence?.sha256, (c) => c.sha256) || null,
    norm: pick((c) => c?.data?.norm, (c) => c?.evidence?.norm, (c) => c.norm) || null,

    oldScore: dataObj?.oldScore ?? evidenceObj?.oldScore ?? null,
    newScore: dataObj?.newScore ?? evidenceObj?.newScore ?? null,

    oneLine:
      pick((c) => c?.data?.summary?.oneLine, (c) => c?.evidence?.summary?.oneLine) ||
      dataObj?.summary?.oneLine ||
      evidenceObj?.summary?.oneLine ||
      null,

    deobMeta: dataObj?.deobMeta || evidenceObj?.deobMeta || null,
    webcrackKey: dataObj?.s3?.webcrackKey || evidenceObj?.s3?.webcrackKey || null,

    addedHits,
    rawObj: { payload, det, detail },
  };
}

function groupByCategory(addedHits = []) {
  const map = new Map();
  for (const h of addedHits) {
    const cat = (h?.category || "Uncategorized").trim();
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(h);
  }
  return Array.from(map.entries());
}

/** -----------------------------
 * addedHits 요약/집계
 * ------------------------------ */
function summarizeAddedHits(addedHits = []) {
  const totalScore = addedHits.reduce((sum, h) => sum + (Number(h?.score) || 0), 0);

  const byAxis = {};
  const byCategory = {};
  let top = null;

  for (const h of addedHits) {
    const axis = h?.axis || "NA";
    const cat = (h?.category || "Uncategorized").trim();
    byAxis[axis] = (byAxis[axis] || 0) + 1;
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    const score = Number(h?.score) || 0;
    if (!top || score > (Number(top?.score) || 0)) top = h;
  }

  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  const axisText =
    Object.entries(byAxis)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`)
      .join(", ") || "-";

  const topHitText = top ? `${top.id} (+${top.score})` : "-";

  return { totalScore, axisText, topCategory, topHitText };
}

/** -----------------------------
 * Page
 * ------------------------------ */
export default function AdminInjectedScriptRescoreDetailPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const params = useParams();

  const eventId = params.eventId || sp.get("eventId");
  const from = sp.get("from") || "";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  const [axisFilter, setAxisFilter] = useState("ALL"); // ALL | A | B ...

  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    setLoading(true);
    setErr("");

    getEventDetail({ eventId })
      .then((res) => {
        if (!alive) return;
        setData(res.data);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e?.message || "이벤트 조회 실패");
        setData(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [eventId]);

  const detail = data;

  const payloadObj = useMemo(() => detail?.details || {}, [detail]);

  const parsedPayload = useMemo(() => {
    const raw =
      detail?.payload?.payloadJson ||
      detail?.payload?.payload?.payloadJson ||
      detail?.payloadJson;
    return raw ? safeJsonParse(raw) : null;
  }, [detail]);

  const rs = useMemo(() => pickRescoreBlock(detail, parsedPayload), [detail, parsedPayload]);

  // KPI용 핵심 변경점
  const hitSummary = useMemo(() => summarizeAddedHits(rs.addedHits), [rs.addedHits]);
  const scoreChangeText =
    rs.oldScore != null && rs.newScore != null ? `${rs.oldScore} → ${rs.newScore}` : "-";

  // hits 탭용 확장
  const axes = useMemo(() => {
    const s = new Set((rs.addedHits || []).map((h) => h?.axis).filter(Boolean));
    return ["ALL", ...Array.from(s).sort()];
  }, [rs.addedHits]);

  const filteredHits = useMemo(() => {
    if (axisFilter === "ALL") return rs.addedHits || [];
    return (rs.addedHits || []).filter((h) => (h?.axis || "NA") === axisFilter);
  }, [rs.addedHits, axisFilter]);

  const filteredGrouped = useMemo(() => groupByCategory(filteredHits), [filteredHits]);

  const pageHost = rs.page ? hostFromUrl(rs.page) : rs.origin ? hostFromUrl(rs.origin) : "";

  function onBack() {
    if (from) navigate(from);
    else navigate(-1);
  }

  const [hasAiEvent, setHasAiEvent] = useState(false);
  const baseId = baseIdFromEventId(eventId);

  useEffect(() => {
    let alive = true;

    getEventDetail({ eventId: `AI_${baseId}` })
      .then((res) => {
        if (!alive) return;

        const d = res?.data;

        const hasAi =
          !!d?.data?.aiVerdict ||
          !!d?.evidence?.aiVerdict ||
          !!d?.details?.data?.aiVerdict ||
          !!d?.details?.evidence?.aiVerdict;

        setHasAiEvent(hasAi);
      })
      .catch(() => {
        if (!alive) return;
        setHasAiEvent(false);
      });

    return () => { alive = false; };
  }, [eventId]);

  return (
    <TitleCard title="Rescore 이벤트 상세" topMargin="mt-2">
      {/* Top bar */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="text-sm opacity-70">
          <div className="break-all">eventId: {eventId || "(none)"}</div>
          {rs.sessionId ? <div className="mt-1 break-all">sessionId: {rs.sessionId}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm btn-primary" onClick={onBack}>
            ← 뒤로
          </button>
          {rs.reportId ? (
            <Link className="btn btn-sm btn-primary" to={`/app/user_front/detail/${baseId}`}>
              원본
            </Link>
          ) : null}
          {hasAiEvent && (
            <Link className="btn btn-sm btn-primary" to={`/app/user_front/detail/AI_${baseId}`}>
              AI 분석
            </Link>
          )}
        </div>
      </div>

      {!eventId ? (
        <div className="p-4 border rounded-xl">
          <div className="font-semibold mb-1">eventId가 필요해요</div>
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
          {/* Header / KPI(핵심 변경점) */}
          <div className="card bg-base-100 border">
            <div className="card-body gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={badgeForSeverity(rs.severity)}>
                      {String(rs.severity || "UNKNOWN").toUpperCase()}
                    </span>
                    <span className="text-sm opacity-70">{sevKo(rs.severity) || "-"}</span>
                  </div>

                  <div className="mt-2 text-lg font-bold">주입 스크립트 난독화 해제·재평가</div>

                  <div className="mt-2 text-xs opacity-70 break-all">
                    type: {rs.type}
                  </div>
                </div>

                <div className="text-right text-sm">
                  <div className="opacity-60">발생 시각</div>
                  <div>{fmtTs(rs.ts)}</div>
                  {rs.ts ? <div className="opacity-70">{relTime(rs.ts)}</div> : null}
                </div>
              </div>

              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <KpiCard label="점수 변화" value={scoreChangeText} hint={rs.oneLine || ""} />
                <KpiCard
                  label="addedHits"
                  value={rs.addedHits?.length ? `${rs.addedHits.length}개` : "-"}
                  hint={`합산 +${hitSummary.totalScore}`}
                />
                <KpiCard label="Top Category" value={hitSummary.topCategory} hint={`axis 분포: ${hitSummary.axisText}`} />
                <KpiCard
                  label="Top Hit"
                  value={hitSummary.topHitText}
                />
              </div>
            </div>
          </div>

          
            <Section title="추가 히트">
              {/* axis 필터 */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="text-sm opacity-60">axis</div>
                {axes.map((ax) => (
                  <button
                    key={ax}
                    className={`btn btn-xs ${axisFilter === ax ? "btn-neutral" : "btn-ghost"}`}
                    onClick={() => setAxisFilter(ax)}
                  >
                    {ax}
                  </button>
                ))}
              </div>

              {/* 카테고리별 그룹 + 카테고리 메타 + 테이블 */}
              <div className="mt-4 space-y-4">
                {filteredGrouped.length ? (
                  filteredGrouped.map(([cat, hits]) => {
                    const catScore = hits.reduce((sum, h) => sum + (Number(h?.score) || 0), 0);
                    const allSignals = hits.map((h) => h?.signal).filter(Boolean);
                    const uniqueSignals = Array.from(new Set(allSignals)).slice(0, 5);
                    const signalMore = new Set(allSignals).size > uniqueSignals.length;

                    return (
                      <div key={cat} className="border rounded-xl p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-semibold whitespace-pre-line">{cat}</div>
                          <div className="text-sm opacity-70 text-right">
                            <div>{hits.length}개</div>
                            <div>합산 +{catScore}</div>
                          </div>
                        </div>

                        {uniqueSignals.length ? (
                          <div className="mt-2 text-xs opacity-60 break-all">
                            대표 signal: {uniqueSignals.join(" · ")}
                            {signalMore ? " …" : ""}
                          </div>
                        ) : null}

                        <div className="mt-3 overflow-auto">
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>axis</th>
                                <th>ID</th>
                                <th>signal</th>
                                <th>score</th>
                                <th>reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hits.map((h, idx) => (
                                <tr key={`${h.id}-${idx}`}>
                                  <td>{h.axis || "-"}</td>
                                  <td className="break-all">{h.id}</td>
                                  <td className="break-all">{h.signal}</td>
                                  <td>{h.score}</td>
                                  <td className="break-all">{h.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm opacity-70">addedHits 데이터가 없습니다.</div>
                )}
              </div>
            </Section>
        </div>
      ) : null}
    </TitleCard>
  );
}
