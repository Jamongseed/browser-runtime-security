import React, { useState, useEffect } from "react";
import moment from "moment";
import TitleCard from "../../../components/Cards/TitleCard";
// 사용할 API 함수들을 가져옵니다.
import {
  getEventsByRule,
  getEventsByDomain,
  getEvents,
  getOneEvent,
} from "../../aws/AwsSearch";

const START_DAY = "2026-01-01";
const END_DAY = "2026-01-30";

const TopSideButtons = ({ applySearch, removeFilter }) => {
  const [searchType, setSearchType] = useState("domain");
  const [searchText, setSearchText] = useState("");

  const searchOptions = [
    { label: "도메인", value: "domain" },
    { label: "규칙 ID", value: "ruleId" },
    { label: "인스톨 ID", value: "installId" }, // 인스톨 ID 옵션 유지
    { label: "이벤트 ID", value: "eventId" },
  ];

  const handleSearch = () => {
    if (!searchText.trim()) return;
    console.log("검색");
    console.log(searchType);
    console.log(searchText);
    applySearch({ type: searchType, query: searchText });
  };

  const handleReset = () => {
    setSearchText("");
    setSearchType("domain");
    removeFilter();
  };

  return (
    <div className="flex items-center gap-2 float-right">
      <select
        className="select select-bordered select-sm w-32"
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
          className="input input-bordered input-sm w-64 pr-8"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        {searchText && (
          <button
            className="absolute right-2 top-1.5 opacity-50 hover:opacity-100"
            onClick={handleReset}
          >
            ×
          </button>
        )}
      </div>

      <button className="btn btn-sm btn-primary" onClick={handleSearch}>
        검색
      </button>
    </div>
  );
};

function Transactions() {
  const [userTableData, setUserTableData] = useState([]);
  const [loading, setLoading] = useState(false);

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
          startDay: START_DAY,
          endDay: END_DAY,
        });
      } else {
        // 검색 타입별 분기 처리
        switch (type) {
          case "domain":
            console.log("검색domain");
            res = await getEventsByDomain({
              domain: query,
              startDay: START_DAY,
              endDay: END_DAY,
              limit: 20,
            });
            console.log(res);
            break;
          case "ruleId":
            res = await getEventsByRule({
              ruleId: query,
              startDay: START_DAY,
              endDay: END_DAY,
              limit: 20,
            });
            break;
          case "installId":
            // 인스톨 ID 검색 시 getEvents 사용 (필요한 파라미터에 맞춰 수정 가능)
            res = await getEvents({
              installId: query,
              startDay: START_DAY,
              endDay: END_DAY,
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
    fetchEvents();
  }, []);

  const applySearch = (params) => fetchEvents(params);
  const removeFilter = () => fetchEvents({});
  const gotoDetail = (id) => console.log("Detail ID:", id);

  return (
    <TitleCard
      title="검색결과"
      topMargin="mt-2"
      TopSideButtons={
        <TopSideButtons applySearch={applySearch} removeFilter={removeFilter} />
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
                      className="font-bold text-sm max-w-[180px] truncate"
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
                    <span className="font-mono font-bold text-secondary text-sm">
                      {l.scoreDelta > 0 ? `+${l.scoreDelta}` : l.scoreDelta}
                    </span>
                  </td>
                  <td>
                    <code className="text-[11px] bg-base-300 px-2 py-1 rounded-md opacity-80 font-semibold">
                      {l.ruleId || "N/A"}
                    </code>
                  </td>
                  <td>
                    <div
                      className="text-xs opacity-60 max-w-[200px] truncate"
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
