import moment from "moment";
import React, { useEffect, useMemo, useState } from "react";
import TitleCard from "../../components/Cards/TitleCard";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import SearchBar from "../../components/Input/SearchBar";
import { getEvents } from "../aws/AwsSearch";
import { Link } from "react-router-dom";

const TopSideButtons = ({ removeFilter, searchText, setSearchText }) => {
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

// severity badge 색상
function severityBadgeClass(sev) {
  const s = String(sev || "").toUpperCase();
  if (s === "HIGH") return "badge-error";
  if (s === "MEDIUM") return "badge-warning";
  return "badge-success";
}

// 인라인 상세에서 보여줄 값 정리(없는 값도 안전하게)
function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function EventTransactions() {
  const [groupedList, setGroupedList] = useState([]); // 세션별 그룹 데이터
  const [originalList, setOriginalList] = useState([]); // 필터링 전 전체 데이터
  const [searchText, setSearchText] = useState("");

  // 인라인 상세: 현재 펼쳐진 eventId (하나만 펼치기)
  const [expandedEventId, setExpandedEventId] = useState(null);

  // TODO: 실제 서비스에서는 installId를 로그인 유저에서 가져오면 됨
  const installId = "14f85da9-93aa-4b72-bbea-457f07945305"; // 테스트용 ID

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEvents = async () => {
    const res = await getEvents({ installId });
    const list = res?.groupedList || [];
    setGroupedList(list);
    setOriginalList(list);

    // 데이터가 바뀌면 펼친 상세는 닫아주는 게 UX 깔끔
    setExpandedEventId(null);
  };

  // 검색 로직 (도메인이나 RuleId로 검색)
  useEffect(() => {
    if (searchText === "") {
      setGroupedList(originalList);
      return;
    }

    const q = searchText.toLowerCase();
    const filtered = originalList
      .map((session) => ({
        ...session,
        events: (session.events || []).filter((e) => {
          const d = (e.domain || "").toLowerCase();
          const r = (e.ruleId || "").toLowerCase();
          return d.includes(q) || r.includes(q);
        }),
      }))
      .filter((session) => (session.events || []).length > 0);

    setGroupedList(filtered);

    // 검색 결과 바뀌면 펼친 상세는 닫아주는 게 안전
    setExpandedEventId(null);
  }, [searchText, originalList]);

  const removeFilter = () => setSearchText("");

  const toggleExpand = (eventId) => {
    setExpandedEventId((prev) => (prev === eventId ? null : eventId));
  };

  // 표 컬럼 수 (thead 기준 4개)
  const COLS = 4;

  return (
    <>
      <TitleCard
        title="개인 이벤트 탐지 이력"
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
          <table className="table w-full">
            <thead>
              <tr>
                <th>탐지 시간</th>
                <th>위험도 / 유형</th>
                <th>도메인 / 페이지</th>
                <th>Score</th>
              </tr>
            </thead>

            <tbody>
              {groupedList.map((session) => (
                <React.Fragment key={session.sessionId}>
                  {/* 세션 구분선 */}
                  <tr className="bg-slate-200/70 border-y-2 border-slate-300">
                    <td colSpan={COLS} className="py-2 text-xs font-bold text-primary">
                      SESSION: {session.sessionId}
                    </td>
                  </tr>

                  {/* 세션 내 이벤트 리스트 */}
                  {(session.events || []).map((e) => {
                    const open = expandedEventId === e.eventId;

                    return (
                      <React.Fragment key={e.eventId}>
                        {/* 이벤트 row */}
                        <tr
                          className={`hover cursor-pointer ${open ? "bg-base-200" : ""}`}
                          onClick={() => toggleExpand(e.eventId)}
                          title="클릭해서 상세 보기"
                        >
                          <td>
                            <div className="font-bold text-sm">
                              {moment(e.ts).format("HH:mm:ss")}
                            </div>
                            <div className="text-xs opacity-50">
                              {moment(e.ts).format("YYYY-MM-DD")}
                            </div>
                          </td>

                          <td>
                            <div
                              className={`badge badge-sm mb-1 ${severityBadgeClass(
                                e.severity
                              )}`}
                            >
                              {safeStr(e.severity).toUpperCase()}
                            </div>
                            <div className="text-xs font-mono break-all">
                              {safeStr(e.ruleId)}
                            </div>
                          </td>

                          <td>
                            <div className="text-sm font-bold break-all">
                              {safeStr(e.domain)}
                            </div>
                            <div
                              className="text-xs opacity-50 truncate w-48"
                              title={safeStr(e.page)}
                            >
                              {safeStr(e.page)}
                            </div>
                          </td>

                          <td>
                            <span className="font-mono text-orange-600">
                              +{safeStr(e.scoreDelta)}
                            </span>
                          </td>
                        </tr>

                        {/*  인라인 상세 row */}
                        {open && (
                          <tr>
                            <td colSpan={COLS} className="p-0">
                              <div className="bg-base-100 border-t border-base-300">
                                <div className="p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="text-sm font-bold">
                                      이벤트 상세
                                    </div>
                                    <button
                                      className="btn btn-xs btn-ghost"
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        setExpandedEventId(null);
                                      }}
                                    >
                                      닫기
                                    </button>
                                  </div>

                                  {/* 사용자용: 필요한 정보만 */}
                                  <div className="grid md:grid-cols-2 gap-3">
                                    <div className="border border-base-200 rounded-xl p-3">
                                      <div className="text-xs opacity-60 mb-1">
                                        event_id
                                      </div>
                                      <div className="flex items-center justify-between gap-2"></div>
                                        <div className="font-mono text-sm break-all">
                                            {safeStr(e.eventId)}
                                        </div>

                                        <Link
                                            to={`/app/events/${encodeURIComponent(e.eventId)}?from=${encodeURIComponent("/app/transactions")}`}
                                            className="btn btn-xs btn-outline btn-primary"
                                            onClick={(ev) => ev.stopPropagation()}
                                        >
                                            자세히 보기 →
                                        </Link>
                                    </div>

                                    <div className="border border-base-200 rounded-xl p-3">
                                      <div className="text-xs opacity-60 mb-1">
                                        install_id
                                      </div>
                                      <div className="font-mono text-sm break-all">
                                        {safeStr(e.installId)}
                                      </div>
                                    </div>

                                    <div className="border border-base-200 rounded-xl p-3">
                                      <div className="text-xs opacity-60 mb-1">
                                        탐지 시각
                                      </div>
                                      <div className="text-sm">
                                        {moment(e.ts).format("YYYY-MM-DD HH:mm:ss")}
                                      </div>
                                    </div>

                                    <div className="border border-base-200 rounded-xl p-3">
                                      <div className="text-xs opacity-60 mb-1">
                                        위험도 / 유형
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`badge badge-sm ${severityBadgeClass(
                                            e.severity
                                          )}`}
                                        >
                                          {safeStr(e.severity).toUpperCase()}
                                        </span>
                                        <span className="font-mono text-sm break-all">
                                          {safeStr(e.ruleId)}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="border border-base-200 rounded-xl p-3 md:col-span-2">
                                      <div className="text-xs opacity-60 mb-1">
                                        도메인 / 페이지
                                      </div>
                                      <div className="text-sm font-bold break-all">
                                        {safeStr(e.domain)}
                                      </div>
                                      <div className="text-xs opacity-70 break-all">
                                        {safeStr(e.page)}
                                      </div>
                                    </div>

                                    <div className="border border-base-200 rounded-xl p-3">
                                      <div className="text-xs opacity-60 mb-1">
                                        Score Delta
                                      </div>
                                      <div className="font-mono text-orange-600">
                                        +{safeStr(e.scoreDelta)}
                                      </div>
                                    </div>
                                  </div>

                                  {/* API 붙기 전 안내(나중에 제거 가능) */}
                                  <div className="mt-3 text-xs opacity-60">
                                    * 현재는 목록 데이터로만 상세를 표시합니다. (추후 event_id로 서버 조회 가능)
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))}
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
