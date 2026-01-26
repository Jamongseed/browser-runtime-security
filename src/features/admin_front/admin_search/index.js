import React, { useState, useEffect } from "react";
import moment from "moment";
import TitleCard from "../../../components/Cards/TitleCard";
import { useNavigate, useSearchParams } from "react-router-dom";
// 사용할 API 함수들을 가져옵니다.
import {
  getEventsByRule,
  getEventsByDomain,
  getEvents,
  getOneEvent,
} from "../../aws/AwsSearch";
import DashboardTopBar from "../components/DashboardTopBar";
import {
  getStartDay,
  setStartDay,
  getEndDay,
  setEndDay,
} from "../../../app/auth";

const TopSideButtons = ({ applySearch, removeFilter }) => {
  const [searchType, setSearchType] = useState("domain");
  const [searchText, setSearchText] = useState("");

  const searchOptions = [
    { label: "도메인", value: "domain" },
    { label: "규칙 ID", value: "ruleId" },
    { label: "인스톨 ID", value: "installId" },
    { label: "이벤트 ID", value: "eventId" },
  ];

  const handleSearch = () => {
    if (!searchText.trim()) return;
    applySearch({ type: searchType, query: searchText });
  };

  const handleReset = () => {
    setSearchText("");
    setSearchType("domain");
    removeFilter();
  };

  // 모든 요소의 높이를 통일하기 위한 공통 클래스
  const commonHeight = "h-[38px] min-h-[38px]";

  return (
    <div className="flex items-center gap-2">
      <select
        className={`select select-bordered select-sm w-32 ${commonHeight}`}
        value={searchType}
        onChange={(e) => setSearchType(e.target.value)}
      >
        {searchOptions.map((opt, k) => (
          <option key={k} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="relative">
        <input
          type="text"
          placeholder="검색어 입력..."
          className={`input input-bordered input-sm w-64 pr-8 ${commonHeight}`}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        {searchText && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 text-lg"
            onClick={handleReset}
          >
            ×
          </button>
        )}
      </div>

      <button
        className={`btn btn-sm btn-primary ${commonHeight}`}
        onClick={handleSearch}
      >
        검색
      </button>
    </div>
  );
};

function Transactions() {
  const [userTableData, setUserTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // ---날자 관련 업데이트
  const [startDay, setStartDayState] = useState(getStartDay());
  const [endDay, setEndDayState] = useState(getEndDay());

  const updateDashboardPeriod = (newRange) => {
    // Dashboard range changed, write code to refresh your values
    const newStartDay = moment(newRange.startDate).format("YYYY-MM-DD");
    const newEndDay = moment(newRange.endDate).format("YYYY-MM-DD");

    setStartDayState(newStartDay);
    setEndDayState(newEndDay);

    setStartDay(newStartDay);
    setEndDay(newEndDay);
  };

  // 핵심 데이터 요청 함수
  const fetchEvents = async (searchParams = {}) => {
    const { type, query } = searchParams;
    setLoading(true);

    try {
      let res;
      if (!query) {
        // 기본값: 전체 도메인 조회 등
        res = await getEventsByDomain({
          domain: "all",
          startDay: startDay,
          endDay: endDay,
        });
      } else {
        // 검색 타입별 분기 처리
        switch (type) {
          case "domain":
            console.log("검색domain");
            res = await getEventsByDomain({
              domain: query,
              startDay: startDay,
              endDay: endDay,
              limit: 20,
            });
            console.log(res);
            break;
          case "ruleId":
            res = await getEventsByRule({
              ruleId: query,
              startDay: startDay,
              endDay: endDay,
              limit: 20,
            });
            break;
          case "installId":
            // 인스톨 ID 검색 시 getEvents 사용 (필요한 파라미터에 맞춰 수정 가능)
            res = await getEvents({
              installId: query,
              startDay: startDay,
              endDay: endDay,
            });
            break;
          case "eventId":
            // 인스톨 ID 검색 시 getEvents 사용 (필요한 파라미터에 맞춰 수정 가능)
            res = await getOneEvent({
              eventId: query,
            });
            break;
          default:
            console.warn("정의되지 않은 타입:", type);
        }
      }
      if (res && res.data) {
        // getOneEvent나 getEventsByDomain 처럼 items 배열이 있는 경우와 없는 경우 모두 대응
        const items = res.data.items ? res.data.items : res.data;
        setUserTableData(Array.isArray(items) ? items : []);
      } else {
        setUserTableData([]);
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error);
      setUserTableData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const type = searchParams.get("type");   // domain | ruleId | installId | eventId
    const query = searchParams.get("query");

    if (type && query) {
      fetchEvents({ type, query });
    } else {
      fetchEvents();
    }
  }, [startDay, endDay, searchParams]);


  const applySearch = (params) => fetchEvents(params);
  const removeFilter = () => fetchEvents({});
  const gotoDetail = (id) => {
    // 상세 페이지 경로로 이동 (예: /app/details/아이디)
    navigate(`/app/admin_front/detail/${id}`);
  };

  return (
    <TitleCard
      title="검색결과"
      topMargin="mt-2"
      TopSideButtons={
        <div className="flex items-center gap-2">
          {/* 1. 날짜 선택기 */}
          <DashboardTopBar updateDashboardPeriod={updateDashboardPeriod} />

          {/* 2. 구분선이 필요하다면 넣으세요 (선택사항) */}
          <div className="divider divider-horizontal mx-0 h-8"></div>

          {/* 3. 검색 버튼들 */}
          <TopSideButtons
            applySearch={applySearch}
            removeFilter={removeFilter}
          />
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
            {console.log(userTableData)}
            {userTableData.length > 0 ? (
              userTableData.map((l, k) => (
                <tr
                  key={k}
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
                    <div
                      className="font-bold text-base max-w-[180px] truncate"
                      title={l.domain}
                    >
                      {l.domain}
                    </div>
                  </td>
                  <td>
                    <div
                      className={`badge badge-md border-none font-bold ${l.severity === "HIGH" ? "bg-error/20 text-error" : l.severity === "MEDIUM" ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}
                    >
                      {l.severity || "UNKNOWN"}
                    </div>
                  </td>
                  <td>
                    <span className="font-mono font-bold text-secondary text-base">
                      {l.scoreDelta > 0 ? `+${l.scoreDelta}` : l.scoreDelta}
                    </span>
                  </td>
                  <td>
                    <code className="text-base bg-base-300 px-2 py-1 rounded-md opacity-80 font-semibold">
                      {l.ruleId || "N/A"}
                    </code>
                  </td>
                  <td>
                    <div
                      className="text-base opacity-60 max-w-[200px] truncate"
                      title={l.page}
                    >
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
                  {loading
                    ? "데이터를 불러오는 중입니다..."
                    : "검색 결과가 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </TitleCard>
  );
}

export default Transactions;
