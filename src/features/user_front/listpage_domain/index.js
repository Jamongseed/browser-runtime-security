import moment from "moment";
import React, { useEffect, useState } from "react";
import TitleCard from "../../../components/Cards/TitleCard";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import SearchBar from "../../../components/Input/SearchBar";
import { getUserDomainEvents } from "../../aws/AwsSearch";
import { useNavigate } from "react-router-dom";
import { getInstallId } from "../../../app/auth";
import DashboardTopBar from "../components/DashboardTopBar";
import {
  getStartDay,
  setStartDay,
  getEndDay,
  setEndDay,
} from "../../../app/auth";

function EventTransactions() {
  const [groupedList, setGroupedList] = useState([]);
  const [originalList, setOriginalList] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [expandedSessions, setExpandedSessions] = useState({});

  const installId = getInstallId();
  const navigate = useNavigate();

  const gotoDetail = (id) => navigate(`/app/user_front/detail/${id}`);

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

  const toggleSession = (domain) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [domain]: !prev[domain],
    }));
  };

  useEffect(() => {
    fetchEvents();
  }, [startDay, endDay]);

  const fetchEvents = async () => {
    const res = await getUserDomainEvents({
      installId,
      update: true,
      startDay,
      endDay,
    });
    setGroupedList(res.groupedList || []);
    setOriginalList(res.groupedList || []);
  };

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
  }, [searchText, originalList]);

  const removeFilter = () => setSearchText("");

  return (
    <>
      <TitleCard title="도메인별 탐지 이력" topMargin="mt-2">
        <DashboardTopBar updateDashboardPeriod={updateDashboardPeriod} />
        <div className="overflow-x-auto w-full">
          <table className="table w-full table-auto border-separate border-spacing-y-1">
            {/* 메인 헤더 */}
            <thead className="bg-base-200/50">
              <tr className="text-base-content/70">
                <th colSpan="7" className="py-3 text-left pl-12">
                  도메인 정보 (클릭하여 펼치기)
                </th>
              </tr>
            </thead>

            <tbody>
              {groupedList.length > 0 ? (
                groupedList.map((group) => {
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
                            <div className="flex items-center gap-3 flex-1">
                              <span className="text-[10px] font-bold opacity-40 uppercase">
                                도메인 :
                              </span>
                              <span className="font-bold text-[14px] text-primary">
                                {group.domain}
                              </span>
                              <div className="flex items-center gap-2 border-l border-slate-400/30 pl-3">
                                <span className="badge badge-sm bg-slate-400/20 border-none text-slate-600 font-bold">
                                  {group.events.length}개의 위험
                                </span>
                                <span className="text-[12px] font-bold text-slate-500 font-mono">
                                  최근위험:{" "}
                                  {moment(group.latestTs).format(
                                    "YYYY-MM-DD HH:mm:ss",
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* ✅ 서브 헤더 (펼쳐졌을 때만 표시, 밑의 코드와 동일하게 세팅) */}
                      {isExpanded && (
                        <tr className="bg-base-100 text-base-content/70 text-[13px] uppercase tracking-wider">
                          <th className="py-2 pl-12 text-left">시간</th>
                          <th className="text-left">세션 ID</th>
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

                      {/* ✅ 실제 데이터 행 (스타일 통일) */}
                      {isExpanded &&
                        group.events.map((event, index) => (
                          <tr
                            key={`${group.domain}-${index}`}
                            className="bg-white border-b border-base-100 last:border-none hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="py-3 pl-12">
                              <div className="flex flex-col">
                                <span className="font-bold text-[13px]">
                                  {moment(event.ts).format("HH:mm:ss")}
                                </span>
                                <span className="text-[11px] opacity-60">
                                  {moment(event.ts).format("YYYY-MM-DD")}
                                </span>
                              </div>
                            </td>
                            {/* 세션 ID (도메인 뷰이므로 세션을 표시) */}
                            <td className="truncate opacity-90 text-[12px] font-mono font-medium">
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
                            <td className="font-mono font-bold text-orange-600 text-[13px]">
                              +{event.scoreDelta}
                            </td>
                            {/* ✅ 탐지규칙 ID: font-medium 적용 및 크기 업 */}
                            <td className="truncate opacity-90 text-[12px] font-mono font-medium">
                              {event.ruleId}
                            </td>
                            {/* ✅ 사이트: 불투명도 조절 및 선명도 업 */}
                            <td
                              className="px-4 max-w-[250px] truncate text-[13px] font-medium opacity-90 text-base-content/80"
                              title={event.page}
                            >
                              {event.page || "/"}
                            </td>
                            <td className="text-center">
                              <button
                                className="btn btn-ghost btn-sm text-primary font-bold"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  gotoDetail(event.eventId);
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
                  <td
                    colSpan="7"
                    className="text-center py-20 opacity-40 text-[13px]"
                  >
                    조회된 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TitleCard>
    </>
  );
}

export default EventTransactions;
