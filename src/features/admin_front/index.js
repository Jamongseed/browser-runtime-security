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
  getSeverity,
  getAggDomain,
  getAggRule,
  //getHighSeverityEvents,
} from "../aws/AwsSearch";
import TitleCard from "../../components/Cards/TitleCard";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const startDay = "2026-01-01";
  const endDay = "2026-01-30";

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
    navigate(`/app/user_front/detail/${id}`);
  };

  const [severityData, setSeverityData] = useState([]);

  // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.
  useEffect(() => {
    getSeverity({ startDay, endDay }).then((res) => {
      setSeverityData(res);
      console.log("getSeverity 로그");
      console.log(res);
    });
  }, []); // 처음 한 번만 실행

  const [domainData, setDomainData] = useState([]);

  // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.

  useEffect(() => {
    // getDomain() 함수를 실행해서 나온 결과를 domainData에 넣습니다.
    getAggDomain({ startDay, endDay }).then((res) => {
      setDomainData(res);
      console.log("getDomain 로그");
      console.log(res);
    });
  }, []); // 처음 한 번만 실행

  const [ruleData, setRuleData] = useState([]);

  useEffect(() => {
    // getAggRule() 함수를 실행해서 나온 결과를 ruleData에 넣습니다.
    getAggRule({ startDay, endDay }).then((res) => {
      setRuleData(res);
      console.log("getRule 로그");
      console.log(res);
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
          <DoughnutChart title="위험도 비율" chartData={severityData} />
        ) : (
          <div>불러오는중</div>
        )}

        {ruleData?.labels ? (
          <BarChart title="TOP5 많이 탐지된 룰" chartData={ruleData} />
        ) : (
          <div>불러오는중</div>
        )}
      </div>

      {/** ---------------------- Different stats content 2 ------------------------- */}
      {
        <div className="w-full mt-10 bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
          {domainData?.labels ? (
            <BarChart title="도메인별 집계(15개까지)" chartData={domainData} />
          ) : (
            <div>불러오는중</div>
          )}
          {/* 1. 테이블 헤더 (이름 및 통계) */}

          {/* 2. 테이블 본문 영역 */}
          <div className="overflow-x-auto w-full"></div>
        </div>
      }
      {/** ---------------------- User source channels table  ------------------------- */}
    </>
  );
}

export default Dashboard;
