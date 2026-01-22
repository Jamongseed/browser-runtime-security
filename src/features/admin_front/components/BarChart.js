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
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        ticks: {
          // ✅ 틱(Label) 텍스트 제어
          callback: function (value, index) {
            const label = this.getLabelForValue(value);
            const maxLength = 8; // 줄바꿈 기준 글자수

            if (label.length > maxLength) {
              // 글자수만큼 잘라서 배열로 반환 (Chart.js가 배열 요소를 한 줄씩 렌더링함)
              const rows = [];
              for (let i = 0; i < label.length; i += maxLength) {
                rows.push(label.substring(i, i + maxLength));
              }
              return rows;
            }
            return label;
          },
          // 줄바꿈 시 텍스트가 겹치지 않도록 폰트 크기나 정렬 조정 (선택사항)
          font: {
            size: 11,
          },
          maxRotation: 0, // 글자가 기울어지는 것을 방지하려면 0
          minRotation: 0,
        },
      },
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
