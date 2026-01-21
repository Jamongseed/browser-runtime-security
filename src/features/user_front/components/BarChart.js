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

const severityKeywords = ["HIGH", "MEDIUM", "LOW"];

function BarChart({ title, chartData }) {
  const chartRef = useRef(null);
  const navigate = useNavigate();

  const onClick = (event) => {
    const chart = chartRef.current;
    if (!chart) return;

    const element = getElementAtEvent(chart, event);
    if (element.length > 0) {
      const { index } = element[0];
      const clickedLabel = chartData?.labels?.[index];

      if (severityKeywords.includes(clickedLabel)) {
        navigate("/app/detail/severity", {
          state: { value: clickedLabel, title },
        });
      }
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick,
    plugins: {
      legend: { display: false },
    },
  };

  const data = chartData || {
    labels: [],
    datasets: [
      {
        label: title,
        data: [],
        backgroundColor: "rgba(53, 162, 235, 0.5)",
      },
    ],
  };

  return (
    <div className="flex flex-col h-full p-4">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>

      <div className="flex-1">
        {data.datasets[0].data.length > 0 ? (
          <Bar ref={chartRef} options={options} data={data} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            데이터를 불러오는 중이거나 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

export default BarChart;
