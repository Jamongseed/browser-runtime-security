import {
  Chart as ChartJS,
  Filler,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import TitleCard from "../../../components/Cards/TitleCard";

ChartJS.register(ArcElement, Tooltip, Legend, Filler);

function DoughnutChart({ title, chartData }) {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
    },
  };

  // 1. 데이터 존재 여부 확인 로직
  // labels와 datasets[0].data가 모두 존재하고 길이가 0보다 큰지 확인합니다.
  const hasData =
    chartData?.labels?.length > 0 && chartData?.datasets?.[0]?.data?.length > 0;

  const data = {
    labels: chartData?.labels || [],
    datasets: [
      {
        label: "# of Events",
        data: chartData?.datasets?.[0]?.data || [],
        backgroundColor: [
          "rgba(255, 99, 132, 0.8)",
          "rgba(255, 159, 64, 0.8)",
          "rgba(75, 192, 192, 0.8)",
          "rgba(54, 162, 235, 0.8)", // 데이터가 많아질 경우를 대비한 추가 색상
        ],
        borderColor: [
          "rgba(255, 99, 132, 1)",
          "rgba(255, 159, 64, 1)",
          "rgba(75, 192, 192, 1)",
          "rgba(54, 162, 235, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <TitleCard title={title}>
      <div className="h-[300px] flex items-center justify-center">
        {/* 2. 조건부 렌더링: 데이터가 있을 때만 차트를 보여줌 */}
        {hasData ? (
          <Doughnut options={options} data={data} />
        ) : (
          <div className="text-gray-400 italic">
            {/* 데이터가 로딩 중이거나 없는 경우 표시될 문구 */}
            데이터가 없습니다.
          </div>
        )}
      </div>
    </TitleCard>
  );
}

export default DoughnutChart;
