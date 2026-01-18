import DashboardStats from "./components/DashboardStats";
import AmountStats from "./components/AmountStats";
import PageStats from "./components/PageStats";

import UserGroupIcon from "@heroicons/react/24/outline/UserGroupIcon";
import UsersIcon from "@heroicons/react/24/outline/UsersIcon";
import CircleStackIcon from "@heroicons/react/24/outline/CircleStackIcon";
import CreditCardIcon from "@heroicons/react/24/outline/CreditCardIcon";
import UserChannels from "./components/UserChannels";
import LineChart from "./components/LineChart";
import BarChart from "./components/BarChart";
import DashboardTopBar from "./components/DashboardTopBar";
import { useDispatch } from "react-redux";
import { showNotification } from "../common/headerSlice";
import DoughnutChart from "./components/DoughnutChart";
import { useEffect, useState } from "react";
import {
  getUserSeverity,
  getUserDomain,
  getUserEventBytime,
} from "../aws/AwsSearch";
import TitleCard from "../../components/Cards/TitleCard";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // const [searchParams] = useSearchParams();
  // const installId = searchParams.get('installId');
  const installId = "14f85da9-93aa-4b72-bbea-457f07945305"; //테스트용 임시값

  const updateDashboardPeriod = (newRange) => {
    // Dashboard range changed, write code to refresh your values
    dispatch(
      showNotification({
        message: `Period updated to ${newRange.startDate} to ${newRange.endDate}`,
        status: 1,
      }),
    );
  };

  const gotoDetail = (id) => {
    // 상세 페이지 경로로 이동 (예: /app/details/아이디)
    navigate(`/app/details/${id}`);
  };

  const [severityData, setseverityData] = useState(null);

  // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.
  useEffect(() => {
    // getDomain() 함수를 실행해서 나온 결과를 domainData에 넣습니다.
    // 임시 데이터
    const update = true;
    getUserSeverity({ installId, update }).then((res) => {
      setseverityData(res);
    });
  }, []); // 처음 한 번만 실행

  const [domainData, setDomainData] = useState(null);

  // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.

  useEffect(() => {
    // getDomain() 함수를 실행해서 나온 결과를 domainData에 넣습니다.
    getUserDomain({ installId }).then((res) => {
      setDomainData(res);
    });
  }, []); // 처음 한 번만 실행

  const [userTableData, setUserTableData] = useState([]);

  // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.
  useEffect(() => {
    // getAllEvents() 함수를 실행해서 나온 결과를 recentData에 넣습니다.
    getUserEventBytime({ installId }).then((res) => {
      setUserTableData(res.sortedData);
    });
  }, []); // 처음 한 번만 실행

  return (
    <>
      {/** ---------------------- Select Period Content ------------------------- */}
      <DashboardTopBar updateDashboardPeriod={updateDashboardPeriod} />

      {/** ---------------------- Different stats content 1 ------------------------- */}

      {/** ---------------------- Different charts ------------------------- */}
      <div className="grid lg:grid-cols-2 mt-0 grid-cols-1 gap-6">
        {severityData?.labels ? (
          <DoughnutChart title="Severity Ratio" chartData={severityData} />
        ) : (
          <div>불러오는중</div>
        )}

        {domainData?.labels ? (
          <BarChart title="Domain Counts" chartData={domainData} />
        ) : (
          <div>불러오는중</div>
        )}
      </div>

      {/** ---------------------- Different stats content 2 ------------------------- */}
      {
        <div className="w-full mt-10 bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
          {/* 1. 테이블 헤더 (이름 및 통계) */}
          <div className="p-5 border-b border-base-200 flex justify-between items-center bg-white">
            <div>
              <h2 className="text-xl font-bold text-base-content tracking-tight">
                최근 알람 내역
              </h2>
              <p className="text-sm text-base-content/60 mt-1">
                최근에 조회된 중간~높음 위험도 수준의 알람을 나타냅니다.
              </p>
            </div>
            <div className="flex gap-2">
              <div className="badge badge-outline badge-lg opacity-70">
                합계: {userTableData?.length || 0}
              </div>
            </div>
          </div>

          {/* 2. 테이블 본문 영역 */}
          <div className="overflow-x-auto w-full">
            <table className="table w-full table-auto">
              {/* 테이블 헤더 정의 */}
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
                {userTableData && userTableData.length > 0 ? (
                  userTableData.map((l, k) => (
                    <tr
                      key={k}
                      className="hover:bg-base-200/50 transition-colors border-b border-base-100 last:border-none"
                    >
                      {/* 1. 시간 및 날짜 */}
                      <td className="py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-base text-base-content">
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

                      {/* 2. 도메인 (아이콘 + 텍스트) */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div>
                            <div
                              className="font-bold text-sm max-w-[180px] truncate"
                              title={l.domain}
                            >
                              {l.domain}
                            </div>
                            <div className="text-[10px] opacity-40 uppercase tracking-tighter font-semibold">
                              도메인 주소
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. 위험도 (배지 적용) */}
                      <td>
                        <div
                          className={`badge badge-md border-none font-bold ${
                            l.severity === "HIGH"
                              ? "bg-error/20 text-error"
                              : l.severity === "MEDIUM"
                                ? "bg-warning/20 text-warning"
                                : "bg-success/20 text-success"
                          }`}
                        >
                          {l.severity || "UNKNOWN"}
                        </div>
                      </td>

                      {/* 4. 점수 */}
                      <td>
                        <span className="font-mono font-bold text-secondary text-sm">
                          {l.scoreDelta > 0 ? `+${l.scoreDelta}` : l.scoreDelta}
                        </span>
                      </td>

                      {/* 5. Rule ID */}
                      <td>
                        <code className="text-[11px] bg-base-300 px-2 py-1 rounded-md opacity-80 font-semibold">
                          {l.ruleId || "N/A"}
                        </code>
                      </td>

                      {/* 6. 페이지 경로 */}
                      <td>
                        <div
                          className="text-xs opacity-60 max-w-[200px] truncate cursor-help hover:text-primary transition-colors"
                          title={l.page}
                        >
                          {l.page || "/"}
                        </div>
                      </td>

                      {/* 7. 상세보기 버튼 */}
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-ghost btn-outline border-base-300 hover:btn-primary hover:border-primary transition-all normal-case"
                          onClick={() => gotoDetail(l.installId)}
                        >
                          자세히
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2.5}
                            stroke="currentColor"
                            className="w-3.5 h-3.5 ml-1"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8.25 4.5l7.5 7.5-7.5 7.5"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-20 opacity-50">
                      데이터가 존재하지 않습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      }
      {/** ---------------------- User source channels table  ------------------------- */}
    </>
  );
}

export default Dashboard;
