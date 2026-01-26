import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";
import TitleCard from "../../../components/Cards/TitleCard";
import { useNavigate } from "react-router-dom";
import DashboardTopBar from "../components/DashboardTopBar";
import { getStartDay, setStartDay, getEndDay, setEndDay } from "../../../app/auth";
import { getEventsAll } from "../../aws/AwsSearch";

const SEV_OPTIONS = [
  { label: "ALL", value: "ALL", cls: "bg-base-200 text-base-content" },
  { label: "HIGH", value: "HIGH", cls: "bg-error/15 text-error" },
  { label: "MEDIUM", value: "MEDIUM", cls: "bg-warning/15 text-warning" },
  { label: "LOW", value: "LOW", cls: "bg-success/15 text-success" },
];

function SeverityFilter({ selected, onChange }) {
  const isOn = (v) => selected.includes(v);

  const toggle = (v) => {
    if (v === "ALL") {
      onChange(["ALL"]);
      return;
    }

    const next = new Set(selected);
    next.delete("ALL");

    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next.size ? [...next] : ["ALL"]);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold opacity-50">Severity</span>

      <div className="flex gap-1 p-1 rounded-xl bg-base-200/60">
        {SEV_OPTIONS.map((opt) => {
          const active = isOn(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(opt.value)}
              className={[
                "px-3 h-[30px] text-xs font-bold rounded-lg transition-all",
                "hover:opacity-90",
                active
                  ? `${opt.cls} shadow-sm`
                  : "text-base-content/50 hover:bg-base-300/60",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function sevBadgeClass(sevRaw) {
  const sev = String(sevRaw || "").toUpperCase();
  if (sev === "HIGH") return "bg-error/20 text-error";
  if (sev === "MEDIUM") return "bg-warning/20 text-warning";
  if (sev === "LOW") return "bg-success/20 text-success";
  return "bg-base-300/50 text-base-content/70";
}

export default function RecentEventsWithSeverityFilter() {
  const navigate = useNavigate();

  const [userTableData, setUserTableData] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ 더 보기용 상태
  const [nextToken, setNextToken] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [startDayState, setStartDayState] = useState(getStartDay());
  const [endDayState, setEndDayState] = useState(getEndDay());

  // ✅ 멀티 선택 상태: 기본은 ALL
  const [severitySelected, setSeveritySelected] = useState(["ALL"]);

  const updateDashboardPeriod = (newRange) => {
    const newStartDay = moment(newRange.startDate).format("YYYY-MM-DD");
    const newEndDay = moment(newRange.endDate).format("YYYY-MM-DD");

    setStartDayState(newStartDay);
    setEndDayState(newEndDay);

    setStartDay(newStartDay);
    setEndDay(newEndDay);
  };

  // ✅ 첫 페이지(리셋) 조회
  const fetchFirst = async () => {
    setLoading(true);
    try {
      const res = await getEventsAll({
        startDay: startDayState,
        endDay: endDayState,
        limit: 200,
      });

      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setUserTableData(items);

      const nt = res?.data?.nextToken ?? null;
      setNextToken(nt);
      setHasMore(Boolean(nt));
    } catch (e) {
      console.error("최근 이벤트 로드 실패:", e);
      setUserTableData([]);
      setNextToken(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 다음 페이지(append) 조회
  const fetchMore = async () => {
    if (!nextToken || loadingMore || loading) return;

    setLoadingMore(true);
    try {
      const res = await getEventsAll({
        startDay: startDayState,
        endDay: endDayState,
        limit: 200,
        nextToken,
      });

      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setUserTableData((prev) => [...prev, ...items]);

      const nt = res?.data?.nextToken ?? null;
      setNextToken(nt);
      setHasMore(Boolean(nt));
    } catch (e) {
      console.error("추가 로드 실패:", e);
    } finally {
      setLoadingMore(false);
    }
  };

  // ✅ 기간 변경 시: 리스트/토큰 리셋 후 첫 조회
  useEffect(() => {
    setUserTableData([]);
    setNextToken(null);
    setHasMore(false);
    fetchFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDayState, endDayState]);

  const filtered = useMemo(() => {
    const sorted = [...userTableData].sort((a, b) => Number(b.ts) - Number(a.ts));

    // ✅ ALL 이거나(혹은 비어있으면) 전체 표시
    if (!severitySelected?.length || severitySelected.includes("ALL")) return sorted;

    const set = new Set(severitySelected.map((x) => String(x).toUpperCase()));
    return sorted.filter((x) => set.has(String(x.severity || "").toUpperCase()));
  }, [userTableData, severitySelected]);

  const gotoDetail = (eventId) => navigate(`/app/admin_front/detail/${eventId}`);

  return (
    <TitleCard
      title="최근 이벤트"
      topMargin="mt-2"
      TopSideButtons={
        <div className="flex items-center gap-2">
          <DashboardTopBar updateDashboardPeriod={updateDashboardPeriod} />
          <div className="divider divider-horizontal mx-0 h-8"></div>

          <SeverityFilter selected={severitySelected} onChange={setSeveritySelected} />

          <button
            className="btn btn-sm btn-outline h-[38px] min-h-[38px]"
            onClick={() => {
              setUserTableData([]);
              setNextToken(null);
              setHasMore(false);
              fetchFirst();
            }}
          >
            새로고침
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto w-full relative">
        {loading && (
          <div className="absolute inset-0 bg-base-100/50 z-10 flex items-center justify-center min-h-[200px]">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        )}

        <table className="table w-full table-auto">
          <thead className="bg-base-200/50">
            <tr className="text-base-content/70">
              <th className="py-4">시간</th>
              <th>도메인</th>
              <th className="text-center">위험도</th>
              <th className="text-center">위험 점수</th>
              <th>탐지규칙 ID</th>
              <th>사이트</th>
              <th className="text-center">자세히보기</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length > 0 ? (
              filtered.map((l, k) => (
                <tr
                  key={`${l.eventId || "noid"}-${k}`}
                  className="hover:bg-base-200/50 transition-colors border-b border-base-100 last:border-none"
                >
                  <td className="py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-base">
                        {new Date(l.ts).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </span>
                      <span className="text-[11px] font-medium opacity-50">
                        {new Date(l.ts).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                  </td>

                  <td>
                    <div className="font-bold text-base max-w-[180px] truncate" title={l.domain}>
                      {l.domain}
                    </div>
                  </td>

                  <td className="text-center">
                    <div className={`badge badge-md border-none font-bold ${sevBadgeClass(l.severity)}`}>
                      {String(l.severity || "UNKNOWN").toUpperCase()}
                    </div>
                  </td>

                  <td className="text-center">
                    <span className="font-mono font-bold text-secondary text-base">
                      {Number(l.scoreDelta) > 0 ? `+${l.scoreDelta}` : l.scoreDelta}
                    </span>
                  </td>

                  <td>
                    <code className="text-base bg-base-300 px-2 py-1 rounded-md opacity-80 font-semibold">
                      {l.ruleId || "N/A"}
                    </code>
                  </td>

                  <td>
                    <div className="text-base opacity-60 max-w-[200px] truncate" title={l.page}>
                      {l.page || "/"}
                    </div>
                  </td>

                  <td className="text-center">
                    <button className="btn btn-sm btn-ghost btn-outline" onClick={() => gotoDetail(l.eventId)}>
                      자세히
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center py-20 opacity-50">
                  {loading ? "데이터를 불러오는 중입니다..." : "표시할 이벤트가 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-center py-4">
          <button className="btn btn-sm btn-outline" disabled={!hasMore || loadingMore || loading} onClick={fetchMore}>
            {loadingMore ? "불러오는 중..." : hasMore ? "더 보기" : "더 이상 없음"}
          </button>
        </div>
      </div>
    </TitleCard>
  );
}
