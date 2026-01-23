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

// 중복 등록 제거 및 정리
ChartJS.register(ArcElement, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = "'Pretendard', sans-serif";
ChartJS.defaults.font.size = 16;

function DoughnutChart({ title, chartData }) {
  const options = {
    responsive: true,
    maintainAspectRatio: false, // 컨테이너 크기에 맞게 조절
    plugins: {
      legend: {
        position: "top",
      },
    },
  };

  // 부모로부터 전달받은 chartData가 없을 경우를 대비한 기본값 설정
  const data = {
    labels: chartData?.labels || [],
    datasets: [
      {
        label: "# of Events",
        data: chartData?.datasets?.[0]?.data || [],
        backgroundColor: [
          "rgba(75, 192, 192, 0.8)", // LOW (Green)
          "rgba(255, 159, 64, 0.8)", // MEDIUM (Orange)
          "rgba(255, 99, 132, 0.8)", // HIGH (Red)
        ],
        borderColor: [
          "rgba(75, 192, 192, 1)",
          "rgba(255, 159, 64, 1)",
          "rgba(255, 99, 132, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <TitleCard title={title}>
      <div className="h-[300px]">
        {" "}
        {/* 차트 크기 제어를 위한 컨테이너 */}
        <Doughnut options={options} data={data} />
      </div>
    </TitleCard>
  );
}

export default DoughnutChart;
