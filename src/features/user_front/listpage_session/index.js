import moment from "moment";
import React, { useEffect, useState } from "react";
import TitleCard from "../../../components/Cards/TitleCard";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import SearchBar from "../../../components/Input/SearchBar";
import { getUserSessionEvents } from "../../aws/AwsSearch";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { getInstallId } from "../../../app/auth";

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

  const installId = getInstallId();
  console.log("세션 유저아이디");
  console.log(installId);

  const navigate = useNavigate();

  const gotoDetail = (id) => {
    // 상세 페이지 경로로 이동 (예: /app/details/아이디)
    navigate(`/app/user_front/detail/${id}`);
  };

  const gotoSessionDetail = (sessionId, sessionEvent) => {
    // session 상세 페이지 경로로 이동 ()
    navigate(`/app/user_front/listpage_session/detail`, {
      state: { sessionId, sessionEvent },
    });
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
  }, [installId]);

  const fetchEvents = async () => {
    const res = await getUserSessionEvents({ installId, update: true });
    setGroupedList(res.groupedList || []);
    setOriginalList(res.groupedList || []);
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
        title="세션별 탐지 이력"
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
              <col style={{ width: "200px" }} /> {/* Domain */}
              <col style={{ width: "100px" }} /> {/* Severity */}
              <col style={{ width: "100px" }} /> {/* Score Delta */}
              <col style={{ width: "auto" }} /> {/* Rule ID */}
              <col style={{ width: "250px" }} />
              {/* Page (남는 공간 다 차지) */}
              <col style={{ width: "100px" }} /> {/* Action */}
            </colgroup>
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
              {groupedList && groupedList.length > 0
                ? groupedList.map((session) => {
                    const isExpanded = expandedSessions[session.sessionId];
                    return (
                      <React.Fragment key={session.sessionId}>
                        {/* 세션 바 (동일) */}
                        <tr
                          className="bg-slate-200/80 hover:bg-slate-300/90 cursor-pointer shadow-sm"
                          onClick={() => toggleSession(session.sessionId)}
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
                                <span className="text-[10px] font-bold opacity-40 uppercase whitespace-nowrap">
                                  세션 :
                                </span>
                                <span className="font-mono text-sm font-bold text-primary truncate">
                                  {session.sessionId}
                                </span>
                                <div className="flex items-center gap-2 shrink-0 border-l border-slate-400/30 pl-3">
                                  <span className="badge badge-sm bg-slate-400/20 border-none text-slate-600 font-bold">
                                    {session.events.length}개의 위험
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-500">
                                    {moment(session.latestTs).format(
                                      "HH:mm:ss",
                                    )}
                                  </span>
                                  <div className="shrink-0">
                                    <button
                                      className="btn btn-xs h-6 min-h-[1.5rem] bg-white border-slate-950 text-slate-950 hover:bg-slate-950 hover:text-white hover:border-slate-950 transition-all duration-200 rounded px-2 text-[12px] font-bold shadow-sm"
                                      onClick={() =>
                                        gotoSessionDetail(
                                          session.sessionId,
                                          session.events,
                                        )
                                      }
                                    >
                                      상세 분석
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={3}
                                        stroke="currentColor"
                                        className="w-3 h-3 ml-1"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* 펼쳐지는 데이터 */}
                        {isExpanded &&
                          session.events.map((l, k) => (
                            <tr
                              key={k}
                              className="bg-white border-b border-base-100 last:border-none"
                            >
                              {/* ✅ 각 td에도 truncate를 사용하여 고정된 너비를 넘지 않게 합니다. */}
                              <td className="py-4 truncate">
                                <div className="flex flex-col">
                                  <span className="font-bold text-sm">
                                    {moment(l.ts).format("HH:mm:ss")}
                                  </span>
                                  <span className="text-[10px] opacity-50">
                                    {moment(l.ts).format("YYYY-MM-DD")}
                                  </span>
                                </div>
                              </td>
                              <td
                                className="truncate font-bold text-sm"
                                title={l.domain}
                              >
                                {l.domain}
                              </td>
                              <td>
                                <div
                                  className={`badge badge-sm border-none font-bold ${
                                    l.severity === "HIGH"
                                      ? "bg-error/20 text-error"
                                      : l.severity === "MEDIUM"
                                        ? "bg-warning/20 text-warning"
                                        : "bg-success/20 text-success"
                                  }`}
                                >
                                  {l.severity}
                                </div>
                              </td>
                              <td className="font-mono font-bold text-orange-600">
                                +{l.scoreDelta}
                              </td>
                              <td className="truncate opacity-80 text-xs font-mono">
                                {l.ruleId}
                              </td>
                              <td className="px-4">
                                <div
                                  className="text-xs opacity-60 max-w-full truncate cursor-help hover:text-primary        transition-colors"
                                  title={l.page} // 마우스 호버 시 전체 경로 표시
                                >
                                  {l.page || "/"}
                                </div>
                              </td>
                              <td className="text-center">
                                <button
                                  className="btn btn-xs btn-ghost btn-outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    gotoDetail(l.eventId);
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
                : null}
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
