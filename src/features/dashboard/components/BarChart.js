import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import TitleCard from '../../../components/Cards/TitleCard';

// ChartJS 구성 요소 등록
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * @param {string} title - 차트 제목
 * @param {string[]} labels - X축 라벨 배열
 * @param {Object[]} datasets - 데이터 세트 배열
 */
function BarChart({ title, labels, datasets }) {

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          }
        },
    };
      
    // 데이터 세트가 없을 경우를 대비한 기본값 처리
    const data = {
        labels: labels || [],
        datasets: (datasets || []).map(set => ({
            label: set.label,
            data: set.data,
            backgroundColor: set.backgroundColor || 'rgba(53, 162, 235, 1)',
        })),
    };

    return (
      <TitleCard title={title || "Chart Title"} topMargin="mt-2">
            <div style={{ height: '300px' }}> 
                <Bar options={options} data={data} />
            </div>
      </TitleCard>
    );
}

export default BarChart;