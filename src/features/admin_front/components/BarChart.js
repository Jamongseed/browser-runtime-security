import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, getElementAtEvent } from "react-chartjs-2";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";

// ChartJS 구성 요소 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

function BarChart({ title, chartData }) {
  const chartRef = useRef(null);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
  };

  // ✅ 데이터 존재 여부를 더 안전하게 파악
  const hasData = !!(chartData?.datasets?.[0]?.data?.length > 0);

  // ✅ 기본값 설정 로직을 깔끔하게 분리
  const defaultData = {
    labels: [],
    datasets: [
      {
        label: title,
        data: [],
        backgroundColor: "rgba(53, 162, 235, 0.5)",
      },
    ],
  };

  const data = hasData ? chartData : defaultData;

  return (
    <div className="flex flex-col h-full p-4">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>

      <div className="flex-1 min-h-[300px]">
        {hasData ? (
          <Bar ref={chartRef} options={options} data={data} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 bg-base-200/20 rounded-lg">
            데이터를 불러오는 중이거나 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

export default BarChart;
