import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";
import TitleCard from "../../../components/Cards/TitleCard";
import { useNavigate } from "react-router-dom";
import DashboardTopBar from "../components/DashboardTopBar";
import { getStartDay, setStartDay, getEndDay, setEndDay } from "../../../app/auth";
import { getEventsAll } from "../../aws/AwsSearch";

const SEV_OPTIONS = [
  { label: "전체", value: "ALL" },
  { label: "HIGH", value: "HIGH" },
  { label: "MEDIUM", value: "MEDIUM" },
  { label: "LOW", value: "LOW" },
];

function SeverityFilter({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs opacity-60 font-semibold">Severity</span>
      <select
        className="select select-bordered select-sm h-[38px] min-h-[38px] w-32"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {SEV_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
  const [severity, setSeverity] = useState("ALL");

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
        // 서버 MAX_LIMIT=200에 맞춰주는 게 안전
        limit: 200,
      });

      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setUserTableData(items);
      console.log("REQ", { startDayState, endDayState });
      console.log("RES", res?.data);


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
    // 서버가 최신 우선으로 주지만, 안정적으로 한 번 더 정렬
    const sorted = [...userTableData].sort((a, b) => Number(b.ts) - Number(a.ts));
    return severity === "ALL"
      ? sorted
      : sorted.filter((x) => String(x.severity || "").toUpperCase() === severity);
    // ✅ slice(0, 50) 제거: 더 보기로 계속 늘릴 수 있게
  }, [userTableData, severity]);

  const gotoDetail = (eventId) => navigate(`/app/admin_front/detail/${eventId}`);

  return (
    <TitleCard
      title="최근 이벤트"
      topMargin="mt-2"
      TopSideButtons={
        <div className="flex items-center gap-2">
          <DashboardTopBar updateDashboardPeriod={updateDashboardPeriod} />
          <div className="divider divider-horizontal mx-0 h-8"></div>
          <SeverityFilter value={severity} onChange={setSeverity} />
          <button
            className="btn btn-sm btn-outline h-[38px] min-h-[38px]"
            onClick={() => {
              // 새로고침 시도: 리셋해서 첫 페이지부터 다시
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
              <th>위험도</th>
              <th>위험 점수</th>
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

                  <td>
                    <div
                      className={`badge badge-md border-none font-bold ${sevBadgeClass(
                        l.severity
                      )}`}
                    >
                      {String(l.severity || "UNKNOWN").toUpperCase()}
                    </div>
                  </td>

                  <td>
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
                    <button
                      className="btn btn-sm btn-ghost btn-outline"
                      onClick={() => gotoDetail(l.eventId)}
                    >
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

        {/* ✅ 더 보기 */}
        <div className="flex justify-center py-4">
          <button
            className="btn btn-sm btn-outline"
            disabled={!hasMore || loadingMore || loading}
            onClick={fetchMore}
          >
            {loadingMore ? "불러오는 중..." : hasMore ? "더 보기" : "더 이상 없음"}
          </button>
        </div>
      </div>
    </TitleCard>
  );
}
