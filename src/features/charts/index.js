import LineChart from "./components/LineChart";
import BarChartEdit from "./components/BarChartEdit";
import DoughnutChart from "./components/DoughnutChart";
import PieChart from "./components/PieChart";
import ScatterChart from "./components/ScatterChart";
import StackBarChart from "./components/StackBarChart";
import Datepicker from "react-tailwindcss-datepicker";
import { useEffect, useState } from "react";
import { getSeverity, getDomain } from "../aws/AwsSearch";

function Charts() {
  const [dateValue, setDateValue] = useState({
    startDate: new Date(),
    endDate: new Date(),
  });

  const handleDatePickerValueChange = (newValue) => {
    console.log("newValue:", newValue);
    setDateValue(newValue);
  };

  const [domainData, setDomainData] = useState(null);

  // ✅ 2. 화면이 켜질 때 데이터를 가져오라고 명령합니다.
  useEffect(() => {
    // getDomain() 함수를 실행해서 나온 결과를 domainData에 넣습니다.
    getDomain().then((res) => {
      setDomainData(res);
    });
  }, []); // 처음 한 번만 실행

  return (
    <>
      <Datepicker
        containerClassName="w-72"
        value={dateValue}
        theme={"light"}
        inputClassName="input input-bordered w-72"
        popoverDirection={"down"}
        toggleClassName="invisible"
        onChange={handleDatePickerValueChange}
        showShortcuts={true}
        primaryColor={"white"}
      />
      {/** ---------------------- Different charts ------------------------- */}
      <div className="grid lg:grid-cols-2 mt-0 grid-cols-1 gap-6">
        {domainData ? (
          <BarChartEdit
            title="도메인별 트렌드"
            labels={domainData.labels}
            datasets={domainData.datasets}
          />
        ) : (
          <div>차트 로딩 중...</div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 mt-4 grid-cols-1 gap-6">
        <DoughnutChart />
        <PieChart />
      </div>

      <div className="grid lg:grid-cols-2 mt-4 grid-cols-1 gap-6">
        <ScatterChart />
        <LineChart />
      </div>
    </>
  );
}

export default Charts;
