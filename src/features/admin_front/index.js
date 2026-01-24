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
import { getStartDay, setStartDay, getEndDay, setEndDay } from "../../app/auth";
import moment from "moment";

function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

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

  const [severityData, setSeverityData] = useState([]);

  // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.
  useEffect(() => {
    getSeverity({ startDay, endDay }).then((res) => {
      setSeverityData(res);
      //console.log("getSeverity 로그");
      //console.log(res);
    });
  }, [startDay, endDay]); // 일자가 변경될때 실행

  const [domainData, setDomainData] = useState([]);

  // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.

  useEffect(() => {
    // getDomain() 함수를 실행해서 나온 결과를 domainData에 넣습니다.
    getAggDomain({ startDay, endDay }).then((res) => {
      setDomainData(res);
    });
  }, []); // 처음 한 번만 실행

  const [ruleData, setRuleData] = useState([]);

  useEffect(() => {
    // getAggRule() 함수를 실행해서 나온 결과를 ruleData에 넣습니다.
    getAggRule({ startDay, endDay }).then((res) => {
      setRuleData(res);
      //console.log("getRule 로그");
      //console.log(res);
    });
  }, []); // 처음 한 번만 실행

  return (
    <>
      {/** ---------------------- Select Period Content ------------------------- */}
      <DashboardTopBar updateDashboardPeriod={updateDashboardPeriod} />

      {/** ---------------------- Different stats content 1 ------------------------- */}

      {/** ---------------------- Different charts ------------------------- */}
      <div className="grid lg:grid-cols-2 mt-0 grid-cols-1 gap-6">
        {/* 위험도 비율(도넛) */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 min-h-[420px] flex flex-col">
          {severityData?.labels ? (
            <DoughnutChart title="위험도 비율" chartData={severityData} />
          ) : (
            <div>불러오는중</div>
          )}
        </div>

        {/* 도메인별 집계(바) */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 min-h-[420px] flex flex-col">
          {ruleData?.labels ? (
            <BarChart title="TOP5 많이 탐지된 룰" chartData={ruleData} />
          ) : (
            <div>불러오는중</div>
          )}
        </div>
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
