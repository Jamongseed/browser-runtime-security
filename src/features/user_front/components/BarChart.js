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
import TitleCard from "../../../components/Cards/TitleCard";

// ChartJS 구성 요소 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

const severityKeywords = ["HIGH", "MEDIUM", "LOW"];

function BarChart({ title, chartData }) {
  const chartRef = useRef(null);
  const navigate = useNavigate();

  const onClick = (event) => {
    const { current: chart } = chartRef;
    if (!chart) return;

    const element = getElementAtEvent(chart, event);
    if (element.length > 0) {
      const { index } = element[0];
      // 넘어온 데이터의 labels에서 클릭한 값을 가져옵니다.
      const clickedLabel = chartData.labels[index];

      if (severityKeywords.includes(clickedLabel)) {
        navigate("/app/detail/severity", {
          state: { value: clickedLabel, title: title },
        });
      }
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick,
    plugins: {
      legend: { display: false }, // 범례가 필요 없으면 끕니다.
    },
  };

  // 중요: 부모가 준 데이터가 있으면 그대로 쓰고, 없으면 기본 구조를 잡습니다.
  const data = chartData || {
    labels: [],
    datasets: [
      { label: title, data: [], backgroundColor: "rgba(53, 162, 235, 0.5)" },
    ],
  };

  return (
    <TitleCard title={title || "Chart Title"} topMargin="mt-2">
      <div style={{ height: "300px" }}>
        {/* 데이터의 실제 숫자(datasets[0].data)가 있는지 확인 */}
        {data.datasets[0].data.length > 0 ? (
          <Bar ref={chartRef} options={options} data={data} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            데이터를 불러오는 중이거나 결과가 없습니다.
          </div>
        )}
      </div>
    </TitleCard>
  );
}

export default BarChart;
