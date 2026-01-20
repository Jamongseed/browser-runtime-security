import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  TimeScale, // 시간축을 위해 추가
} from "chart.js";
import { Line } from "react-chartjs-2";
import moment from "moment";
import TitleCard from "../../../components/Cards/TitleCard";

// 필수 요소 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
);

function SessionLineChart({
  events = [],
  onPointClick, // 부모로부터 받은 함수
  title = "시간대별 위험점수 차트",
}) {
  const labels = events.map((e) => moment(e.ts).format("HH:mm:ss"));
  const scores = events.map((e) => e.scoreDelta || 0);

  // 모든 옵션을 여기서 한 번에 관리합니다.
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        min: 0,
        suggestedMax: 100, // 점수가 100을 넘을 수도 있다면 suggestedMax가 좋습니다.
      },
    },
    onClick: (event, elements) => {
      if (elements.length > 0 && onPointClick) {
        const index = elements[0].index;
        onPointClick(index); // 부모의 scrollToRow 실행
      }
    },
  };

  const chartData = {
    labels,
    datasets: [
      {
        fill: true,
        label: title,
        data: scores,
        borderColor: "rgb(53, 162, 235)",
        backgroundColor: "rgba(53, 162, 235, 0.2)",
        tension: 0.4,
      },
    ],
  };

  return (
    <TitleCard title={title}>
      <div className="h-[300px]">
        <Line data={chartData} options={options} />
      </div>
    </TitleCard>
  );
}

export default SessionLineChart;
