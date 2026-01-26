import {
    Chart as ChartJS,
    Filler,
    ArcElement,
    Tooltip,
    Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

// 중복 등록 제거 및 정리
ChartJS.register(ArcElement, Tooltip, Legend, Filler)

function DoughnutChart({ title, chartData }) {
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
        },
    }

    const data = {
        labels: chartData?.labels || [],
        datasets: [
            {
                label: '# of Events',
                data: chartData?.datasets?.[0]?.data || [],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(255, 159, 64, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(75, 192, 192, 1)',
                ],
                borderWidth: 1,
            },
        ],
    }

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
    )
}

export default DoughnutChart
