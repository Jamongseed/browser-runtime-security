import moment from "moment"
import React, { useEffect, useState } from "react"
import TitleCard from "../../components/Cards/TitleCard"
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon'
import SearchBar from "../../components/Input/SearchBar"
import { getEvents } from "../aws/AwsSearch" // 아까 만든 함수 임포트

const TopSideButtons = ({ applySearch, removeFilter, searchText, setSearchText }) => {
    return (
        <div className="inline-block float-right">
            <SearchBar searchText={searchText} styleClass="mr-4" setSearchText={setSearchText} />
            {searchText !== "" && (
                <button onClick={removeFilter} className="btn btn-xs mr-2 btn-active btn-ghost normal-case">
                    Clear <XMarkIcon className="w-4 ml-2" />
                </button>
            )}
        </div>
    )
}

function EventTransactions() {
    const [groupedList, setGroupedList] = useState([]); // 세션별 그룹 데이터
    const [originalList, setOriginalList] = useState([]); // 필터링 전 전체 데이터
    const [searchText, setSearchText] = useState("");
    const installId = "e025b1ff-be5b-429e-87bf-00f0b0b05f59"; // 테스트용 ID

    // 1. 데이터 가져오기
    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        const res = await getEvents({ installId });
        setGroupedList(res.groupedList || []);
        setOriginalList(res.groupedList || []);
    };

    // 2. 검색 로직 (도메인이나 RuleId로 검색)
    useEffect(() => {
        if (searchText === "") {
            setGroupedList(originalList);
        } else {
            const filtered = originalList.map(session => ({
                ...session,
                events: session.events.filter(e => 
                    e.domain.toLowerCase().includes(searchText.toLowerCase()) ||
                    e.ruleId.toLowerCase().includes(searchText.toLowerCase())
                )
            })).filter(session => session.events.length > 0);
            
            setGroupedList(filtered);
        }
    }, [searchText]);

    const removeFilter = () => setSearchText("");

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
                            {groupedList.map((session, sIdx) => (
                                <React.Fragment key={session.sessionId}>
                                    {/* 세션 구분선 */}
                                    <tr className="bg-slate-200/70 border-y-2 border-slate-300">
                                        <td colSpan="4" className="py-2 text-xs font-bold text-primary">
                                            SESSION: {session.sessionId}
                                        </td>
                                    </tr>
                                    {/* 세션 내 이벤트 리스트 */}
                                    {session.events.map((e, eIdx) => (
                                        <tr key={e.eventId} className="hover">
                                            <td>
                                                <div className="font-bold text-sm">
                                                    {moment(e.ts).format("HH:mm:ss")}
                                                </div>
                                                <div className="text-xs opacity-50">
                                                    {moment(e.ts).format("YYYY-MM-DD")}
                                                </div>
                                            </td>
                                            <td>
                                                <div className={`badge badge-sm mb-1 ${
                                                    e.severity === 'HIGH' ? 'badge-error' : 
                                                    e.severity === 'MEDIUM' ? 'badge-warning' : 'badge-success'
                                                }`}>
                                                    {e.severity}
                                                </div>
                                                <div className="text-xs font-mono">{e.ruleId}</div>
                                            </td>
                                            <td>
                                                <div className="text-sm font-bold">{e.domain}</div>
                                                <div className="text-xs opacity-50 truncate w-48" title={e.page}>
                                                    {e.page}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="font-mono text-orange-600">+{e.scoreDelta}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    {groupedList.length === 0 && (
                        <div className="text-center py-10 text-gray-400">조회된 이벤트가 없습니다.</div>
                    )}
                </div>
            </TitleCard>
        </>
    )
}

export default EventTransactions;