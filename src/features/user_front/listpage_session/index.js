import moment from "moment";
import React, { useEffect, useState } from "react";
import TitleCard from "../../../components/Cards/TitleCard";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import SearchBar from "../../../components/Input/SearchBar";
import { getUserSessionEvents } from "../../aws/AwsSearch";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { getInstallId } from "../../../app/auth";
import DashboardTopBar from "../components/DashboardTopBar";
import {
  getStartDay,
  setStartDay,
  getEndDay,
  setEndDay,
} from "../../../app/auth";

function EventTransactions() {
  const [groupedList, setGroupedList] = useState([]); // 세션별 그룹 데이터
  const [originalList, setOriginalList] = useState([]); // 필터링 전 전체 데이터
  const [searchText, setSearchText] = useState("");

  const installId = getInstallId();
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
  }, [installId, startDay, endDay]);

  const fetchEvents = async () => {
    const res = await getUserSessionEvents({
      installId,
      update: true,
      startDay,
      endDay,
    });
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
      <TitleCard title="세션별 탐지 이력" topMargin="mt-2">
        <DashboardTopBar updateDashboardPeriod={updateDashboardPeriod} />
        <div className="overflow-x-auto w-full">
          <table className="table w-full border-separate border-spacing-y-2">
            {/* 1. 세션용 메인 헤더 (가장 상단) */}
            <thead className="bg-base-200/50">
              <tr className="text-base-content/70">
                <th colSpan="7" className="py-3 text-left pl-12">
                  세션 정보 (클릭하여 펼치기)
                </th>
              </tr>
            </thead>

            <tbody>
              {groupedList && groupedList.length > 0
                ? groupedList.map((session) => {
                    const isExpanded = expandedSessions[session.sessionId];
                    return (
                      <React.Fragment key={session.sessionId}>
                        {/* 2. 세션 바 (접다펴기 기능) */}
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
                                <span className="text-[10px] font-bold opacity-40 uppercase">
                                  세션 :
                                </span>
                                <span className="font-mono text-sm font-bold text-primary truncate">
                                  {session.sessionId}
                                </span>
                                <div className="flex items-center gap-2 border-l border-slate-400/30 pl-3">
                                  <span className="badge badge-sm bg-slate-400/20 border-none text-slate-600 font-bold w-[90px] justify-center">
                                    {session.events.length}개의 위험
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-500">
                                    최근위험:{" "}
                                    {moment(session.latestTs).format(
                                      "YYYY-MM-DD HH:mm:ss",
                                    )}
                                  </span>
                                </div>
                              </div>
                              <button
                                className="btn btn-xs h-6 bg-white border-slate-950 text-slate-950 hover:bg-slate-950 hover:text-white transition-all rounded px-2 text-[12px] font-bold"
                                onClick={(e) => {
                                  e.stopPropagation(); // 부모 토글 방지
                                  gotoSessionDetail(
                                    session.sessionId,
                                    session.events,
                                  );
                                }}
                              >
                                상세 분석
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* 3. 데이터용 헤더 (글자 크기 업) */}
                        {isExpanded && (
                          <tr className="bg-base-100 text-base-content/70 text-[13px] uppercase tracking-wider">
                            <th className="py-2 pl-12 text-left">시간</th>
                            <th className="text-left">도메인</th>
                            <th className="text-left">위험도</th>
                            <th className="text-left">위험 점수</th>
                            <th className="text-left">탐지규칙 ID</th>
                            <th className="text-left">사이트</th>
                            <th
                              className="text-center"
                              style={{ width: "100px" }}
                            >
                              자세히
                            </th>
                          </tr>
                        )}

                        {/* 4. 실제 데이터 행 */}
                        {isExpanded &&
                          session.events.map((l, k) => (
                            <tr
                              key={k}
                              className="bg-white border-b border-base-100 last:border-none hover:bg-slate-50/50"
                            >
                              <td className="py-3 pl-12 truncate">
                                <div className="flex flex-col">
                                  <span className="font-bold text-[13px]">
                                    {" "}
                                    {/* 시간 크기 업 */}
                                    {moment(l.ts).format("HH:mm:ss")}
                                  </span>
                                  <span className="text-[11px] opacity-60">
                                    {" "}
                                    {/* 날짜 크기 업 */}
                                    {moment(l.ts).format("YYYY-MM-DD")}
                                  </span>
                                </div>
                              </td>
                              <td className="truncate font-bold text-[13px]">
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
                              <td className="font-mono font-bold text-orange-600 text-[13px]">
                                +{l.scoreDelta}
                              </td>

                              {/* ✅ 탐지규칙 ID: 크기를 키우고 가독성 좋은 font-medium 적용 */}
                              <td className="truncate opacity-90 text-[12px] font-mono font-medium">
                                {l.ruleId}
                              </td>

                              {/* ✅ 사이트: 크기를 키우고 불투명도를 높여 더 선명하게 표시 */}
                              <td
                                className="px-4 max-w-[250px] truncate text-[13px] font-medium opacity-90 text-base-content/80"
                                title={l.page}
                              >
                                {l.page || "/"}
                              </td>

                              <td className="text-center">
                                <button
                                  className="btn btn-ghost btn-sm text-primary font-bold" // 버튼 크기 조정
                                  onClick={() => gotoDetail(l.eventId)}
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
        </div>
      </TitleCard>
    </>
  );
}

export default EventTransactions;
