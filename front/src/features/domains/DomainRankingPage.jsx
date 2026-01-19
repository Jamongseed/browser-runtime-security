import { useLocation, useNavigate } from "react-router-dom";
import TitleCard from "../../components/Cards/TitleCard";
import { parseQuery } from "../common/query";

export default function DomainRankingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const q = parseQuery(location.search);

  return (
    <TitleCard title="Domain Ranking" topMargin="mt-2">
      <div className="mb-4 text-sm opacity-70">
        도메인별 탐지 랭킹 페이지 (준비중)
      </div>

      {/* 현재 적용된 기간 표시 */}
      <div className="mb-4 p-3 bg-base-200 rounded-lg text-sm">
        <div className="font-semibold mb-1">적용된 기간</div>
        <div className="font-mono">
          {q.start || "-"} ~ {q.end || "-"}
        </div>
      </div>

      {/* 임시 액션 */}
      <div className="flex gap-2">
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

      {/* 안내 */}
      <div className="mt-6 text-xs opacity-50">
        * 이 페이지는 이후 도메인별 횟수 / 평균 score / 추이 랭킹으로 확장될 예정입니다.
      </div>
    </TitleCard>
  );
}
