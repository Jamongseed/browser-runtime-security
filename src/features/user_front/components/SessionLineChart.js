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
  // 1. 시간순(ts)으로 오름차순 정렬 (과거 -> 현재)
  const sortedEvents = [...events].sort((a, b) => a.ts - b.ts);
  const startTime = sortedEvents.length > 0 ? sortedEvents[0].ts : 0;
  const lastIdx = sortedEvents.length - 1;

  // 2. 정렬된 데이터를 바탕으로 labels와 scores 생성
  const labels = sortedEvents.map((e, index) => {
    // 처음(0)과 마지막(lastIdx)은 실제 시각 표시
    if (index === 0 || index === lastIdx) {
      return moment(e.ts).format("HH:mm:ss:SSS");
    }

    // 그 외 중간 지점들은 시작 시간 대비 경과 초 표시
    const diffInSeconds = Math.floor((e.ts - startTime) / 100);
    return `+${diffInSeconds/10}s`;
  });
  const scores = sortedEvents.map((e) => e.scoreDelta || 0);
  // 1. 점 색상 결정 함수
  const pointColors = scores.map((score) => {
    if (score >= 60) return "rgb(239, 68, 68)"; // 60점 이상: 빨간색 (위험)
    if (score >= 30) return "rgb(245, 158, 11)"; // 30점 이상: 노란색 (주의)
    return "rgb(30, 41, 59)"; // 기본: 진회색
  });

  // 2. 점 크기 결정 함수 (위험할수록 더 크게)
  const pointSizes = scores.map((score) => {
    if (score >= 60) return 7; // 위험: 매우 크게
    if (score >= 30) return 5; // 주의: 조금 크게
    return 3; // 기본 크기
  });

  // 모든 옵션을 여기서 한 번에 관리합니다.
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    // ✅ interaction 설정을 추가하면 마우스를 근처에만 가져가도 툴팁이 잘 뜹니다.
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      // ⚠️ 여기에 tooltip 설정이 와야 합니다! (dataset 내부에서 이쪽으로 이동)
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        padding: 12,
        titleFont: { size: 13, weight: "bold" },
        bodyFont: { size: 12 },
        footerFont: { size: 11, weight: "normal" },
        cornerRadius: 6,
        displayColors: true,
        callbacks: {
          title: (context) => {
            const index = context[0].dataIndex;
            const event = sortedEvents[index];
            return `⏰ 발생 시각: ${moment(event.ts).format("HH:mm:ss")}`;
          },
          label: (context) => {
            const score = context.parsed.y;
            // 기준선 데이터(30, 60점)의 툴팁은 제외하고 싶을 때 처리
            if (context.datasetIndex !== 0) return null;
            return ` 🔥 위험 점수: ${score}점`;
          },
          afterLabel: (context) => {
            if (context.datasetIndex !== 0) return null;
            const index = context.dataIndex;
            const event = sortedEvents[index];
            return ` 🛡️ 탐지 규칙: ${event.ruleId}`;
          },
        },
      },
    },
    scales: {
      
      y: {
        min: 0,
        suggestedMax: 100,
      },
    },
    onClick: (event, elements) => {
      if (elements.length > 0 && onPointClick) {
        const index = elements[0].index;
        onPointClick(index);
      }
    },
  };

  const chartData = {
    labels,
    datasets: [
      {
        label: "위험 점수",
        data: scores,
        borderColor: "rgb(30, 41, 59)",
        tension: 0, // 직선 유지
        pointBackgroundColor: pointColors, // 구간별 색상 적용
        pointBorderColor: pointColors,
        pointRadius: pointSizes, // 구간별 크기 적용
        pointHoverRadius: 8, // 마우스 올렸을 때 크기
        borderWidth: 2,
      },
      {
        label: "위험 (60점)",
        data: new Array(scores.length).fill(60),
        borderColor: "rgba(239, 68, 68, 0.8)", // 빨간색 (Tailwind red-500 느낌)
        borderWidth: 2,
        borderDash: [5, 5], // 점선
        pointRadius: 0, // 점 숨기기
        fill: false,
      },
      {
        label: "주의 (30점)",
        data: new Array(scores.length).fill(30),
        borderColor: "rgba(245, 158, 11, 0.8)", // 노란색 (Tailwind amber-500 느낌)
        borderWidth: 2,
        borderDash: [5, 5], // 점선
        pointRadius: 0, // 점 숨기기
        fill: false,
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
