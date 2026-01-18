import moment from "moment";
import React, { useEffect, useState } from "react";
import TitleCard from "../../../components/Cards/TitleCard";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import SearchBar from "../../../components/Input/SearchBar";
import { getUserDomainEvents } from "../../aws/AwsSearch";
import { useNavigate } from "react-router-dom";

const TopSideButtons = ({
  applySearch,
  removeFilter,
  searchText,
  setSearchText,
}) => {
  return (
    <div className="inline-block float-right">
      <SearchBar
        searchText={searchText}
        styleClass="mr-4"
        setSearchText={setSearchText}
      />
      {searchText !== "" && (
        <button
          onClick={removeFilter}
          className="btn btn-xs mr-2 btn-active btn-ghost normal-case"
        >
          Clear <XMarkIcon className="w-4 ml-2" />
        </button>
      )}
    </div>
  );
};

function EventTransactions() {
  const [groupedList, setGroupedList] = useState([]); // 세션별 그룹 데이터
  const [originalList, setOriginalList] = useState([]); // 필터링 전 전체 데이터
  const [searchText, setSearchText] = useState("");
  const installId = "14f85da9-93aa-4b72-bbea-457f07945305"; // 테스트용 ID

  const navigate = useNavigate();

  const gotoDetail = (id) => {
    // 상세 페이지 경로로 이동 (예: /app/details/아이디)
    navigate(`/app/details/${id}`);
  };

  const [expandedSessions, setExpandedSessions] = useState({});

  // 세션 토글 함수
  const toggleSession = (sessionId) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  // 1. 데이터 가져오기
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const res = await getUserDomainEvents({ installId });
    setGroupedList(res.groupedList || []);
    setOriginalList(res.groupedList || []);
    console.log("세션조회 결과");
    console.log(res);
  };

  // 2. 검색 로직 (도메인이나 RuleId로 검색)
  useEffect(() => {
    if (searchText === "") {
      setGroupedList(originalList);
    } else {
      const filtered = originalList
        .map((session) => ({
          ...session,
          events: session.events.filter(
            (e) =>
              e.domain.toLowerCase().includes(searchText.toLowerCase()) ||
              e.ruleId.toLowerCase().includes(searchText.toLowerCase()),
          ),
        }))
        .filter((session) => session.events.length > 0);

      setGroupedList(filtered);
    }
  }, [searchText]);

  const removeFilter = () => setSearchText("");

  return (
    <>
      <TitleCard
        title="도메인별 탐지 이력 "
        topMargin="mt-2"
        TopSideButtons={
          <TopSideButtons
            searchText={searchText}
            setSearchText={setSearchText}
            removeFilter={removeFilter}
          />
        }
      >
        <div className="overflow-x-auto w-full">
          <table className="table w-full table-auto">
            {/* 테이블 헤더 정의 */}
            <colgroup>
              <col style={{ width: "120px" }} /> {/* Time */}
              <col style={{ width: "300px" }} /> {/* Session */}
              <col style={{ width: "100px" }} /> {/* Severity */}
              <col style={{ width: "100px" }} /> {/* Score Delta */}
              <col style={{ width: "auto" }} /> {/* Rule ID */}
              <col style={{ width: "250px" }} />{" "}
              {/* Page (남는 공간 다 차지) */}
              <col style={{ width: "100px" }} /> {/* Action */}
            </colgroup>
            <thead className="bg-base-200/50">
              <tr className="text-base-content/70">
                <th className="py-4 text-left pl-12">시간</th>
                <th className="text-left">세션</th>
                <th className="text-left">위험도</th>
                <th className="text-left">위험 점수</th>
                <th className="text-left">탐지규칙 ID</th>
                <th className="text-left">사이트</th>
                <th className="text-center">자세히보기</th>
              </tr>
            </thead>

            <tbody>
              {groupedList && groupedList.length > 0 ? (
                groupedList.map((group) => {
                  // ✅ 그룹 키를 domain으로 변경 (toggleSession도 domain 기준)
                  const isExpanded = expandedSessions[group.domain];

                  return (
                    <React.Fragment key={group.domain}>
                      {/* ✅ 도메인 바 (Header) */}
                      <tr
                        className="bg-slate-200/80 hover:bg-slate-300/90 cursor-pointer shadow-sm transition-colors"
                        onClick={() => toggleSession(group.domain)}
                      >
                        <td colSpan="7" className="py-3 px-4 rounded-lg">
                          <div className="flex items-center gap-4">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>

                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="text-[10px] font-black opacity-40 uppercase whitespace-nowrap">
                                도메인
                              </span>
                              {/* ✅ 도메인 명칭 출력 */}
                              <span
                                className="font-bold text-sm text-primary truncate"
                                title={group.domain}
                              >
                                {group.domain}
                              </span>

                              <div className="flex items-center gap-2 shrink-0 border-l border-slate-400/30 pl-3">
                                <span className="badge badge-sm bg-slate-400/20 border-none text-slate-600 font-bold">
                                  {group.events.length}개의 위험
                                </span>
                                <span className="text-[11px] font-bold text-slate-500 font-mono">
                                  최근발생:{" "}
                                  {moment(group.latestTs).format("HH:mm:ss")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* ✅ 펼쳐지는 상세 이벤트 데이터 (도메인 내부 이벤트들) */}
                      {isExpanded &&
                        group.events.map((event, index) => (
                          <tr
                            key={`${group.domain}-${index}`}
                            className="bg-white hover:bg-base-100/50 border-b border-base-100 last:border-none transition-colors"
                          >
                            <td className="py-4 pl-12 truncate">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm">
                                  {moment(event.ts).format("HH:mm:ss")}
                                </span>
                                <span className="text-[10px] opacity-50">
                                  {moment(event.ts).format("YYYY-MM-DD")}
                                </span>
                              </div>
                            </td>

                            {/* 상세 열에서는 세션 ID를 보여줌으로써 어떤 방문에서 발생했는지 식별 */}
                            <td
                              className="truncate font-mono text-[11px] opacity-70"
                              title={event.sessionId}
                            >
                              {event.sessionId}
                            </td>

                            <td>
                              <div
                                className={`badge badge-sm border-none font-bold ${
                                  event.severity === "HIGH"
                                    ? "bg-error/20 text-error"
                                    : event.severity === "MEDIUM"
                                      ? "bg-warning/20 text-warning"
                                      : "bg-success/20 text-success"
                                }`}
                              >
                                {event.severity}
                              </div>
                            </td>

                            <td className="font-mono font-bold text-orange-600">
                              +{event.scoreDelta}
                            </td>

                            <td className="truncate opacity-80 text-xs font-mono">
                              {event.ruleId}
                            </td>

                            <td className="px-4">
                              <div
                                className="text-xs opacity-60 max-w-full truncate cursor-help hover:text-primary transition-colors"
                                title={event.page}
                              >
                                {event.page || "/"}
                              </div>
                            </td>

                            <td className="text-center">
                              <button
                                className="btn btn-xs btn-ghost btn-outline border-base-300 hover:btn-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  gotoDetail(event.installId);
                                }}
                              >
                                자세히
                              </button>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-20 opacity-40">
                    조회된 도메인이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {groupedList.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              조회된 이벤트가 없습니다.
            </div>
          )}
        </div>
      </TitleCard>
    </>
  );
}

export default EventTransactions;
