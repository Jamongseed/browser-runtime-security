import {
  Chart as ChartJS,
  Filler,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, Filler);

function normLabel(l) {
  return String(l || "").trim().toUpperCase();
}

// ✅ 리스트 배지 톤 참고: HIGH=error, MEDIUM=warning, LOW=success
const SEV_COLORS = {
  HIGH: { bg: "rgba(239, 68, 68, 0.5)", border: "rgba(239, 68, 68, 1)" },      // error
  MEDIUM: { bg: "rgba(245, 158, 11, 0.5)", border: "rgba(245, 158, 11, 1)" },   // warning
  LOW: { bg: "rgba(34, 197, 94, 0.5)", border: "rgba(34, 197, 94, 1)" },        // success
  // 혹시 UNKNOWN 등 들어오면 중립
  DEFAULT: { bg: "rgba(148, 163, 184, 0.8)", border: "rgba(148, 163, 184, 1)" }, // slate
};

function DoughnutChart({ title, chartData }) {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
    },
  };

  const labels = chartData?.labels || [];
  const values = chartData?.datasets?.[0]?.data || [];

  // ✅ 라벨 기반으로 색을 매핑 (순서 바뀌어도 안전)
  const backgroundColor = labels.map((l) => {
    const key = normLabel(l);
    return (SEV_COLORS[key] || SEV_COLORS.DEFAULT).bg;
  });

  const borderColor = labels.map((l) => {
    const key = normLabel(l);
    return (SEV_COLORS[key] || SEV_COLORS.DEFAULT).border;
  });

  const data = {
    labels,
    datasets: [
      {
        label: "# of Events",
        data: values,
        backgroundColor,
        borderColor,
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="flex flex-col h-full p-4">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>

      <div className="flex-1">
        {data.datasets[0].data.length > 0 ? (
          <Doughnut options={options} data={data} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            데이터를 불러오는 중이거나 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

export default DoughnutChart;
