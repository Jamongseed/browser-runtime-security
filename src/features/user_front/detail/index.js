import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import TitleCard from "../../../components/Cards/TitleCard";
import { getEventDetail, getRuleDescription } from "../../aws/AwsSearch";
import { setInstallId } from "../../../app/auth";

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
    day >= 1
      ? `${day}일`
      : hr >= 1
        ? `${hr}시간`
        : min >= 1
          ? `${min}분`
          : `${sec}초`;
  return diff >= 0 ? `${label} 전` : `${label} 후`;
}

function sevBadgeClass(sev) {
  const s = String(sev || "").toUpperCase();
  if (s === "HIGH") return "badge badge-error";
  if (s === "MEDIUM") return "badge badge-warning";
  if (s === "LOW") return "badge badge-success";
  return "badge";
}

function sevKo(sev) {
  const s = String(sev || "").toUpperCase();
  if (s === "HIGH") return "고위험";
  if (s === "MEDIUM") return "주의";
  if (s === "LOW") return "정보";
  return "알 수 없음";
}

function clampText(s, max = 4000) {
  const t = String(s ?? "");
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function normalizeHost(urlLike) {
  try {
    const u = new URL(urlLike);
    return u.host;
  } catch {
    return "";
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function buildReportText({ summary, meta, eventId, currentUrl }) {
  const lines = [];
  lines.push("[보안 이벤트 보고]");
  lines.push("");
  lines.push(`- 발생 시각: ${fmtTs(summary.tsMs)}`);
  lines.push(
    `- 위험도: ${String(summary.severity || "UNKNOWN").toUpperCase()} (${sevKo(summary.severity)})`,
  );
  lines.push(`- 이벤트 유형: ${summary.type || "-"}`);
  lines.push(`- 탐지 규칙(ruleId): ${summary.ruleId || "-"}`);
  lines.push(`- 현재 페이지: ${summary.page || "-"}`);
  lines.push(`- 페이지 도메인: ${summary.pageHost || "-"}`);
  lines.push(`- 전송/대상 도메인: ${summary.targetHost || "-"}`);
  lines.push(`- origin: ${summary.origin || "-"}`);
  lines.push(`- sessionId: ${summary.sessionId || "-"}`);
  lines.push(`- installId: ${summary.installId || "-"}`);
  lines.push(`- eventId: ${eventId || "-"}`);
  if (currentUrl) lines.push(`- 링크: ${currentUrl}`);
  return lines.join("\n");
}

/**
 * 사용자용 이벤트 상세
 */
export default function AdminEventDetailPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const params = useParams();

  const eventId = params.eventId || sp.get("eventId") || "";
  const installId = params.InstallId;
  useEffect(() => {
    // 2. installId가 존재할 때만 실행
    if (installId) {
      // 3. 현재 확정된 ID를 다시 저장소에 업데이트 (동기화)
      setInstallId(installId);
    }
  }, [installId]); // URL이 바뀌거나 계산된 installId가 바뀔 때 실행
  const from = sp.get("from") || "";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const currentUrlRef = useRef("");
  useEffect(() => {
    try {
      currentUrlRef.current = window.location?.href || "";
    } catch {
      currentUrlRef.current = "";
    }
  }, []);

  const [data, setData] = useState(null);
  const [ruleId, setRuleId] = useState(null);
  const [ruleDescription, setRuleDescription] = useState(null);

  useEffect(() => {
    getEventDetail({ eventId }).then((res) => {
      setData(res.data);
      setRuleId(res.data.ruleId);
    });
  }, []); // 처음 한 번만 실행

  useEffect(() => {
    // ruleId가 처음 설정될 때, 그리고 값이 변경될 때마다 여기가 실행됩니다.
    if (!ruleId) return; // 값이 null일 때는 실행되지 않도록 방어 코드 추가
    getRuleDescription({ ruleId }).then((res) => {
      setRuleDescription(res.data);
    });
  }, [ruleId]); // <--- 핵심: ruleId를 감시합니다.

  const meta = data || {};

  // 1. 이미 API 함수에서 파싱해서 보낸 details를 사용
  const payloadObj = useMemo(() => data?.details || {}, [data]);

  // 2. 정제된 data 객체에서 값을 바로 추출
  const summary = useMemo(() => {
    if (!data) return {};

    return {
      tsMs: data.tsMs || null,
      type: data.details?.type || null,
      ruleId: data.details?.ruleId || null,
      severity: data.details?.severity || null,
      scoreDelta: data.details?.scoreDelta || null,
      sessionId: data.details?.sessionId || null,
      installId: data.installId || data.details?.installId || null,
      origin: data.origin || null,
      page: data.details?.page || null,
      // data.origin이 URL 형태가 아닐 경우를 대비해 try-catch 처리 권장
      pageHost: data.origin ? new URL(data.origin).hostname : "",
      targetHost:
        data.details?.data?.targetOrigin || data.details?.targetOrigin || "",
      via: data.details?.data?.api || data.details?.data?.via || null,
      mismatch: data.details?.data?.crossSite ?? null,
      ua: data.details?.ua || null,
    };
  }, [data]);

  // TODO: ruleId 템플릿 연동 (사용자용)
  // const ruleTemplate = getRuleTemplate(summary.ruleId);
  const ruleTemplate = null;

  const reportText = useMemo(() => {
    if (!eventId) return "";
    return buildReportText({
      summary,
      meta: { ...meta, payloadHash: data?.payload?.payloadHash },
      eventId,
      currentUrl: currentUrlRef.current,
    });
  }, [eventId, summary, meta, data]);

  function onBack() {
    if (from) navigate(from);
    else navigate(-1);
  }

  const gotoSessionDetail = (sessionId, sessionEvent) => {
    // session 상세 페이지 경로로 이동 ()
    navigate(`/app/user_front/listpage_session/detail`, {
      state: { sessionId, sessionEvent },
    });
  };

  return (
    <TitleCard title="이벤트 상세" topMargin="mt-2">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="text-sm opacity-70">
          <div className="font-mono break-all">
            eventId: {eventId || "(none)"}
          </div>
          {summary.sessionId && (
            <div className="mt-1">
              <span className="opacity-60">sessionId:</span>{" "}
              <span className="font-mono break-all">{summary.sessionId}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm btn-primary" onClick={onBack}>
            ← 뒤로
          </button>
          {/* TODO: 실제 라우트에 맞춰 조정 */}
          <Link
            className="btn btn-sm btn-primary"
            onClick={() => gotoSessionDetail(summary.sessionId, summary.events)}
          >
            해당 세션
          </Link>
        </div>
      </div>

      {!eventId && (
        <div className="p-4 border rounded-xl">
          <div className="font-semibold mb-1">eventId가 필요해요</div>
          <div className="text-sm opacity-70">
            예: <span className="font-mono">/app/events/{"{eventId}"}</span>{" "}
            또는 <span className="font-mono">?eventId=...</span>
          </div>
        </div>
      )}

      {loading && <div className="opacity-70">loading…</div>}
      {err && (
        <div className="p-3 border border-red-300 bg-red-50 text-red-700 rounded-xl">
          <div className="font-semibold mb-1">조회 실패</div>
          <div className="text-sm break-all">{err}</div>
        </div>
      )}

      {!loading && !err && data && (
        <div className="space-y-4">
          {/* 1) 판단 요약 */}
          <div className="card bg-base-100 border">
            <div className="card-body gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={sevBadgeClass(summary.severity)}>
                      {String(summary.severity || "UNKNOWN").toUpperCase()}
                    </span>
                    <span className="text-sm opacity-70">
                      {sevKo(summary.severity)}
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-bold">
                    {summary.severity
                      ? `${sevKo(summary.severity)} 보안 이벤트 감지`
                      : "보안 이벤트 상세"}
                  </div>
                  <div className="mt-1 text-sm opacity-80">
                    {summary.ruleId
                      ? "탐지 규칙에 의해 의심 행위가 감지되었습니다. 아래에서 규칙 설명과 사건 요약을 확인해 주세요."
                      : "이벤트 근거를 확인해 주세요."}
                  </div>
                </div>

                <div className="text-right text-sm">
                  <div className="opacity-60">발생 시각</div>
                  <div className="font-mono">{fmtTs(summary.tsMs)}</div>
                  {summary.tsMs && (
                    <div className="opacity-70">{relTime(summary.tsMs)}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl border">
                  <div className="opacity-60 mb-1">위험 페이지</div>
                  {/*summary.page ? (
                    <a className="link link-primary break-all" href={summary.page} target="_blank" rel="noreferrer">
                      {summary.page}
                    </a>
                  ) : (
                    <div className="opacity-70">-</div>
                  )*/}
                  {!!summary.pageHost && (
                    <div className="mt-1 font-mono opacity-70">
                      {summary.pageHost}
                    </div>
                  )}
                </div>
                <div className="p-3 rounded-xl border">
                  <div className="opacity-60 mb-1">전송/대상 도메인</div>
                  {summary.targetHost ? (
                    <div className="font-mono break-all">
                      {summary.targetHost}
                    </div>
                  ) : (
                    <div className="opacity-70">-</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2) 규칙 설명 + 사건 요약 (중복 제거/역할 분리) */}
          <div className="card bg-base-100 border">
            <div className="card-body gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold">사건 요약</div>
                  <div className="mt-1 text-xs opacity-60 font-mono">
                    ruleId: {summary.ruleId || "-"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl border">
                  <div className="opacity-60">이벤트</div>
                  <div className="mt-2">
                    <span className="opacity-60">탐지 규칙:</span>{" "}
                    <span className="font-mono break-all">
                      {summary.ruleId || "-"}
                    </span>
                  </div>
                  {!ruleTemplate && (
                    <div className="text-sm opacity-70">
                      <span className="opacity-60">원인:</span>{" "}
                      <span className="font-mono break-all">
                        {ruleDescription?.oneLine}
                      </span>
                    </div>
                  )}
                  {ruleTemplate && (
                    <div className="text-sm">
                      <div className="font-semibold">
                        {ruleTemplate.titleKo}
                      </div>
                      <div className="mt-2 whitespace-pre-line opacity-80">
                        {ruleTemplate.descriptionKo}
                      </div>
                      {ruleTemplate.guidanceKo && (
                        <div className="mt-3 p-3 rounded-xl border bg-base-200 whitespace-pre-line">
                          {ruleTemplate.guidanceKo}
                        </div>
                      )}
                    </div>
                  )}
                  {summary.scoreDelta != null && (
                    <div className="mt-2">
                      <span className="opacity-60">위험 점수:</span>{" "}
                      <span className="font-mono">{summary.scoreDelta}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl border">
                  <div className="opacity-60">사용자/환경</div>
                  <div className="mt-1">
                    <span className="opacity-60">origin:</span>{" "}
                    <span className="font-mono break-all">
                      {summary.origin || "-"}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="opacity-60">installId:</span>{" "}
                    <span className="font-mono break-all">
                      {summary.installId || "-"}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="opacity-60">sessionId:</span>{" "}
                    <span className="font-mono break-all">
                      {summary.sessionId || "-"}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border md:col-span-2">
                  <div className="opacity-60">관측된 근거</div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <div className="text-xs opacity-60">via</div>
                      <div className="font-mono break-all">
                        {summary.via || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs opacity-60">mismatch</div>
                      <div className="font-mono break-all">
                        {summary.mismatch === true
                          ? "true"
                          : summary.mismatch === false
                            ? "false"
                            : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs opacity-60">targetHost</div>
                      <div className="font-mono break-all">
                        {summary.targetHost || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {summary.ua && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-sm opacity-70">
                    User-Agent 보기
                  </summary>
                  <div className="mt-2 p-3 rounded-xl border text-xs font-mono break-all">
                    {clampText(summary.ua, 1200)}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </TitleCard>
  );
}
