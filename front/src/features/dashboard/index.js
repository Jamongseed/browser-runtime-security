import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardTopBar from "./components/DashboardTopBar";
import TitleCard from "../../components/Cards/TitleCard";
import { buildQuery } from "../common/query";

// 너희 프로젝트에 맞게 유지/교체
import { getHighSeverityEvents, getDomain, getSeverity } from "../aws/AwsSearch";

function toYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function getDefaultRange(days = 30) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { startDay: toYMD(start), endDay: toYMD(end) };
}

function severityBadgeClass(sev) {
  const s = String(sev || "").toUpperCase();
  if (s === "HIGH") return "badge-error";
  if (s === "MEDIUM") return "badge-warning";
  return "badge-success";
}

export default function Dashboard() {
  const navigate = useNavigate();

  const defaultRange = useMemo(() => getDefaultRange(30), []);
  const [startDay, setStartDay] = useState(defaultRange.startDay);
  const [endDay, setEndDay] = useState(defaultRange.endDay);

  // ✅ 요약 데이터
  const [severityAgg, setSeverityAgg] = useState(null); // 차트/집계
  const [domainAgg, setDomainAgg] = useState(null);     // top domains
  const [actionQueue, setActionQueue] = useState([]);   // high list
  const [loading, setLoading] = useState(false);

  const updateDashboardPeriod = (newRange) => {
    const nextStart = newRange?.startDate || newRange?.startDay;
    const nextEnd = newRange?.endDate || newRange?.endDay;
    if (!nextStart || !nextEnd) return;
    setStartDay(nextStart);
    setEndDay(nextEnd);
  };

  useEffect(() => {
    let alive = true;

    async function fetchOverview() {
      setLoading(true);
      try {
        const [sev, dom, high] = await Promise.all([
          getSeverity({ startDay, endDay }),
          getDomain({ startDay, endDay }),
          getHighSeverityEvents({ startDay, endDay }),
        ]);
        if (!alive) return;
        setSeverityAgg(sev);
        setDomainAgg(dom);
        setActionQueue(Array.isArray(high) ? high.slice(0, 10) : []);
      } catch (e) {
        if (!alive) return;
        setSeverityAgg(null);
        setDomainAgg(null);
        setActionQueue([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchOverview();
    return () => { alive = false; };
  }, [startDay, endDay]);

  // ✅ 공통: 이벤트 리스트로 드릴다운 (필터 유지)
  const goEvents = (extra = {}) => {
    const q = buildQuery({
      start: startDay,
      end: endDay,
      ...extra,
    });
    navigate(`/app/events${q}`);
  };

  const goDomains = () => {
    const q = buildQuery({ start: startDay, end: endDay });
    navigate(`/app/domains${q}`);
  };

  const goAnalytics = () => {
    const q = buildQuery({ start: startDay, end: endDay });
    navigate(`/app/analytics${q}`);
  };

  // ✅ KPI 계산(가능한 만큼만)
  const totalEvents = useMemo(() => {
    // severityAgg.datasets[0].data 합으로 total 추정 (차트 구조에 맞춰 방어)
    const data = severityAgg?.datasets?.[0]?.data;
    if (!Array.isArray(data)) return 0;
    return data.reduce((acc, v) => acc + Number(v || 0), 0);
  }, [severityAgg]);

  const highCount = useMemo(() => {
    const labels = severityAgg?.labels || [];
    const data = severityAgg?.datasets?.[0]?.data || [];
    const idx = labels.findIndex(l => String(l).toUpperCase() === "HIGH");
    if (idx < 0) return 0;
    return Number(data[idx] || 0);
  }, [severityAgg]);

  const topDomainsPreview = useMemo(() => {
    const labels = domainAgg?.labels || [];
    const data = domainAgg?.datasets?.[0]?.data || [];
    return labels.slice(0, 5).map((d, i) => ({
      domain: d,
      count: Number(data[i] || 0),
    }));
  }, [domainAgg]);

  return (
    <>
      <DashboardTopBar updateDashboardPeriod={updateDashboardPeriod} />

      {/* ✅ KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
        <div className="card bg-base-100 shadow cursor-pointer" onClick={() => goEvents({})}>
          <div className="card-body p-4">
            <div className="text-xs opacity-60">Total Events</div>
            <div className="text-2xl font-bold">{totalEvents}</div>
            <div className="text-xs opacity-50">{startDay} ~ {endDay}</div>
          </div>
        </div>

        <div className="card bg-base-100 shadow cursor-pointer" onClick={() => goEvents({ sev: "HIGH" })}>
          <div className="card-body p-4">
            <div className="text-xs opacity-60">HIGH</div>
            <div className="text-2xl font-bold">{highCount}</div>
            <div className="text-xs opacity-50">Click to see HIGH list</div>
          </div>
        </div>

        <div className="card bg-base-100 shadow cursor-pointer" onClick={goDomains}>
          <div className="card-body p-4">
            <div className="text-xs opacity-60">Top Domains</div>
            <div className="text-2xl font-bold">{topDomainsPreview.length}</div>
            <div className="text-xs opacity-50">Click to ranking</div>
          </div>
        </div>

        <div className="card bg-base-100 shadow cursor-pointer" onClick={goAnalytics}>
          <div className="card-body p-4">
            <div className="text-xs opacity-60">Trends / Stats</div>
            <div className="text-2xl font-bold">View</div>
            <div className="text-xs opacity-50">Click to analytics</div>
          </div>
        </div>
      </div>

      {/* ✅ Action Queue Preview */}
      <TitleCard
        title="Action Queue (Top 10)"
        topMargin="mt-6"
      >
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm opacity-70">
            HIGH 이벤트 상위 10개 미리보기
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => goEvents({ sev: "HIGH" })} type="button">
            더 보기 →
          </button>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="table w-full">
            <thead>
              <tr>
                <th>ts</th>
                <th>severity</th>
                <th>scoreDelta</th>
                <th>domain</th>
                <th>ruleId</th>
                <th>installId</th>
                <th>eventId</th>
              </tr>
            </thead>
            <tbody>
              {actionQueue.map((e, idx) => (
                <tr
                  key={`${e.eventId || "noid"}-${idx}`}
                  className="hover cursor-pointer"
                  onClick={() => {
                    if (!e.eventId) return;
                    const from = encodeURIComponent(`/app/dashboard${buildQuery({ start: startDay, end: endDay })}`);
                    navigate(`/app/events/${encodeURIComponent(e.eventId)}?from=${from}`);
                  }}
                >
                  <td className="font-mono text-xs">{String(e.ts || "-")}</td>
                  <td>
                    <span className={`badge badge-sm ${severityBadgeClass(e.severity)}`}>
                      {String(e.severity || "").toUpperCase()}
                    </span>
                  </td>
                  <td className="font-mono">{e.scoreDelta ?? ""}</td>
                  <td className="font-mono break-all">{e.domain ?? ""}</td>
                  <td className="font-mono break-all">{e.ruleId ?? ""}</td>
                  <td className="font-mono break-all">{e.installId ?? ""}</td>
                  <td className="font-mono break-all">{e.eventId ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && <div className="py-4 text-center opacity-60">로딩 중…</div>}
          {!loading && actionQueue.length === 0 && (
            <div className="py-6 text-center text-gray-400">표시할 이벤트가 없습니다.</div>
          )}
        </div>
      </TitleCard>

      {/* ✅ Domain Ranking Preview */}
      <TitleCard title="Top Domains (Preview)" topMargin="mt-6">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm opacity-70">상위 도메인 5개</div>
          <button className="btn btn-sm btn-outline" onClick={goDomains} type="button">
            전체 보기 →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {topDomainsPreview.map((d) => (
            <div
              key={d.domain}
              className="card bg-base-100 shadow cursor-pointer"
              onClick={() => goEvents({ domain: d.domain })}
            >
              <div className="card-body p-4">
                <div className="text-xs opacity-60">domain</div>
                <div className="font-mono text-sm break-all">{d.domain}</div>
                <div className="mt-2 text-xs opacity-60">count</div>
                <div className="text-lg font-bold">{d.count}</div>
              </div>
            </div>
          ))}
        </div>
      </TitleCard>

      {/* ✅ Trends Shortcut */}
      <TitleCard title="Trends / Stats (Shortcut)" topMargin="mt-6">
        <div className="text-sm opacity-70 mb-3">
          트렌드/통계 상세는 Analytics 페이지에서 확인
        </div>
        <button className="btn btn-primary" onClick={goAnalytics} type="button">
          Analytics로 이동 →
        </button>
      </TitleCard>
    </>
  );
}
