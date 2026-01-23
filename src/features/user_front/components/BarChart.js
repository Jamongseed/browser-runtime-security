import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { useRef } from "react";
import TitleCard from "../../../components/Cards/TitleCard";

// 기본 폰트 설정
ChartJS.defaults.font.family = "'Pretendard', sans-serif";
ChartJS.defaults.font.size = 14;

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

function BarChart({ title, chartData, onClick }) {
  // onClick 프롭 추가
  const chartRef = useRef(null);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: onClick || null, // 클릭 핸들러가 있을 때만 연결
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true }, // 바 차트는 0부터 시작하는 게 보기 좋습니다.
    },
  };

  // 1. 데이터 존재 여부를 안전하게 확인 (옵셔널 체이닝 사용)
  const hasData =
    chartData?.datasets?.[0]?.data && chartData.datasets[0].data.length > 0;

  // 2. 렌더링용 데이터 구조 (chartData가 null이어도 에러 안 나게 방어)
  const data = {
    labels: chartData?.labels || [],
    datasets: [
      {
        label: title || "Events",
        data: chartData?.datasets?.[0]?.data || [],
        backgroundColor: "rgba(53, 162, 235, 0.5)",
        borderRadius: 4, // 바 끝을 살짝 둥글게 하면 예쁩니다.
      },
    ],
  };

  return (
    <TitleCard title={title || "Chart Title"} topMargin="mt-2">
      <div style={{ height: "300px" }}>
        {/* 3. 데이터가 확실히 있을 때만 차트 렌더링 */}
        {hasData ? (
          <Bar ref={chartRef} options={options} data={data} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 italic">
            데이터를 불러오는 중이거나 결과가 없습니다.
          </div>
        )}
      </div>
    </TitleCard>
  );
}

export default BarChart;
