import { useLocation, useParams } from "react-router-dom";
import TitleCard from "../../../../components/Cards/TitleCard";
import moment from "moment";
import SessionLineChart from "../../components/SessionLineChart"; // 만든 차트 컴포넌트
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function SessionDetail() {
  const location = useLocation();

  // navigate state에서 전달받은 이벤트 목록 (없을 경우 빈 배열)
  const events = location.state?.sessionEvent || [];
  const sessionId = location.state?.sessionId || "호출실패";
  const [selectedIdx, setSelectedIdx] = useState(null);

  const navigate = useNavigate();
  const gotoDetail = (id) => {
    // 상세 페이지 경로로 이동 (예: /app/details/아이디)
    navigate(`/app/details/${id}`);
  };

  // 차트 클릭 시 테이블 스크롤을 위한 핸들러
  const scrollToRow = (index) => {
    const element = document.getElementById(`event-row-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("bg-blue-50");
      console.log("클릭이벤트");
      setSelectedIdx(index);
      setTimeout(() => element.classList.remove("bg-blue-50"), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 상단: 해당 세션의 시간별 추이 차트 */}
      <div className="grid grid-cols-1">
        <SessionLineChart
          events={events}
          title={`세션명: ${sessionId}`}
          onPointClick={scrollToRow} // 차트 점 클릭 시 함수 전달
        />
      </div>

      {/* 2. 하단: 해당 세션의 상세 이벤트 테이블 */}
      <TitleCard title="탐지 이벤트 상세 내역" topMargin="mt-0">
        <div className="overflow-x-auto w-full">
          <table className="table w-full">
            <thead>
              <tr className="text-base-content/70">
                <th>발생 시간</th>
                <th>도메인</th>
                <th>위험도</th>
                <th>점수</th>
                <th>탐지 규칙</th>
                <th>페이지 경로</th>
                <th className="text-center">자세히보기</th>
              </tr>
            </thead>
            <tbody>
              {events.map((l, k) => (
                <tr
                  key={k}
                  id={`event-row-${k}`}
                  // ✅ 4. 여기가 핵심입니다! k가 선택된 번호(selectedIdx)면 배경색을 바꿉니다.
                  className={`transition-all duration-300 ${
                    selectedIdx === k
                      ? "bg-blue-100 border-l-4 border-blue-500" // 파란색 강조
                      : "hover:bg-base-200"
                  }`}
                >
                  <td className="py-4">
                    <div className="flex flex-col">
                      <span className="font-bold">
                        {moment(l.ts).format("HH:mm:ss")}
                      </span>
                      <span className="text-[10px] opacity-50">
                        {moment(l.ts).format("YYYY-MM-DD")}
                      </span>
                    </div>
                  </td>
                  <td className="font-bold">{l.domain}</td>
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
                  <td className="font-mono text-orange-600">+{l.scoreDelta}</td>
                  <td className="text-xs opacity-80">{l.ruleId}</td>
                  <td className="max-w-[200px] truncate" title={l.page}>
                    {l.page || "/"}
                  </td>
                  <td className="text-center">
                    <button
                      className="btn btn-xs btn-ghost btn-outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        gotoDetail(l.installId);
                      }}
                    >
                      자세히
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TitleCard>
    </div>
  );
}

export default SessionDetail;
