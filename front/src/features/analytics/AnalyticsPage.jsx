import { useLocation, useNavigate } from "react-router-dom";
import TitleCard from "../../components/Cards/TitleCard";
import { parseQuery } from "../common/query";

export default function AnalyticsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const q = parseQuery(location.search);

  return (
    <TitleCard title="Trends / Statistics" topMargin="mt-2">
      <div className="mb-4 text-sm opacity-70">
        트렌드 / 통계 분석 페이지 (준비중)
      </div>

      {/* 기간 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="p-3 bg-base-200 rounded-lg">
          <div className="text-xs opacity-60">기간</div>
          <div className="font-mono text-sm">
            {q.start || "-"} ~ {q.end || "-"}
          </div>
        </div>

        <div className="p-3 bg-base-200 rounded-lg">
          <div className="text-xs opacity-60">Severity</div>
          <div className="font-mono text-sm">
            {q.sev?.length ? q.sev.join(", ") : "ALL"}
          </div>
        </div>

        <div className="p-3 bg-base-200 rounded-lg">
          <div className="text-xs opacity-60">Domain</div>
          <div className="font-mono text-sm">
            {q.domain || "ALL"}
          </div>
        </div>
      </div>

      {/* 임시 차트 영역 */}
      <div className="p-6 border border-dashed border-base-300 rounded-xl text-center text-sm opacity-60">
        📊 이 영역에 시간대별 이벤트 수 / Severity 분포 / Rule 빈도 차트가 들어갈 예정입니다.
      </div>

      {/* 이동 버튼 */}
      <div className="mt-6 flex gap-2">
        <button
          className="btn btn-sm btn-outline"
          onClick={() => navigate(`/app/events${location.search}`)}
        >
          → 이벤트 리스트로 이동
        </button>

        <button
          className="btn btn-sm btn-primary"
          onClick={() => navigate("/app/dashboard")}
        >
          ← 대시보드로 돌아가기
        </button>
      </div>

      <div className="mt-6 text-xs opacity-50">
        * 차트 클릭 시 이벤트 리스트로 드릴다운하는 구조로 확장 예정
      </div>
    </TitleCard>
  );
}
