import {
  Chart as ChartJS,
  Filler,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

// 중복 등록 제거 및 정리
ChartJS.register(ArcElement, Tooltip, Legend, Filler);

function DoughnutChart({ title, chartData }) {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
    },
  };

  const data = {
    labels: chartData?.labels || [],
    datasets: [
      {
        label: "위험개수",
        data: chartData?.datasets?.[0]?.data || [],
        backgroundColor: chartData?.datasets?.[0]?.backgroundColor || [],
        borderColor: chartData?.datasets?.[0]?.backgroundColor || [],
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
