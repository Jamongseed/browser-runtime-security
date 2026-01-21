import React from "react";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  TimeScale,
} from "chart.js";
import "chartjs-adapter-moment";
import { Line } from "react-chartjs-2";
import moment from "moment";
import TitleCard from "../../../components/Cards/TitleCard";

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  TimeScale
);

function SessionLineChart({
  events = [],
  onPointClick,
  title = "시간대별 위험점수 차트",
}) {
  const sortedEvents = [...events].sort((a, b) => a.ts - b.ts);

  const scores = sortedEvents.map((e) => e.scoreDelta || 0);

  const pointColors = scores.map((score) => {
    if (score >= 60) return "rgb(239, 68, 68)";
    if (score >= 30) return "rgb(245, 158, 11)";
    return "rgb(30, 41, 59)";
  });

  const pointSizes = scores.map((score) => {
    if (score >= 60) return 7;
    if (score >= 30) return 5;
    return 3;
  });

  // ✅ 데이터 포인트(x=ts)를 그대로 쓰는 형태
  const mainSeries = sortedEvents.map((e) => ({
    x: Number(e.ts),
    y: e.scoreDelta || 0,
  }));

  const line60 = sortedEvents.map((e) => ({ x: Number(e.ts), y: 60 }));
  const line30 = sortedEvents.map((e) => ({ x: Number(e.ts), y: 30 }));

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: { display: false },
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
            return `⏰ 발생 시각: ${moment(event?.ts).format("HH:mm:ss.SSS")}`;
          },
          label: (context) => {
            // 기준선 데이터 tooltip 제외
            if (context.datasetIndex !== 0) return null;
            return ` 🔥 위험 점수: ${context.parsed.y}점`;
          },
          afterLabel: (context) => {
            if (context.datasetIndex !== 0) return null;
            const event = sortedEvents[context.dataIndex];
            return ` 🛡️ 탐지 규칙: ${event?.ruleId ?? "-"}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "time",
        time: {
          // ✅ unit 강제 금지 (초로 고정되면 ms가 죽을 수 있음)
          displayFormats: {
            millisecond: "HH:mm:ss.SSS",
            second: "HH:mm:ss.SSS",
            minute: "HH:mm:ss.SSS",
            hour: "HH:mm:ss.SSS",
          },
          tooltipFormat: "HH:mm:ss.SSS",
        },
        ticks: {
          // ✅ 핵심: tick을 '데이터' 기반으로 뽑아서 ms가 살아남게
          source: "data",
          autoSkip: true,
          maxTicksLimit: 8,
          callback: (value) => moment(value).format("HH:mm:ss.SSS"),
        },
        grid: { display: false },
      },
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
    datasets: [
      {
        label: "위험 점수",
        data: mainSeries,
        borderColor: "rgb(30, 41, 59)",
        tension: 0,
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        pointRadius: pointSizes,
        pointHoverRadius: 8,
        borderWidth: 2,
      },
      {
        label: "위험 (60점)",
        data: line60,
        borderColor: "rgba(239, 68, 68, 0.8)",
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
      {
        label: "주의 (30점)",
        data: line30,
        borderColor: "rgba(245, 158, 11, 0.8)",
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
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
