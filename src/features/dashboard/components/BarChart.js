import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, getElementAtEvent } from 'react-chartjs-2';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TitleCard from '../../../components/Cards/TitleCard';

// ChartJS 구성 요소 등록
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const serverityKeywords = ['HIGH', 'MEDIUM', 'LOW'];

function BarChart({ title, labels }) { // props 이름을 labels로 받습니다.
  const chartRef = useRef(null);
  const navigate = useNavigate();

  // 클릭 이벤트 핸들러
  const onClick = (event) => {
    const { current: chart } = chartRef;
    if (!chart) return;

    const element = getElementAtEvent(chart, event);
    if (element.length > 0) {
      const { index } = element[0];
      
      // 아래 정의한 data 객체의 labels 배열에서 값을 가져옵니다.
      const clickedLabel = data.labels[index];

      if (serverityKeywords.includes(clickedLabel)) {
        // 경로(URL)는 프로젝트 설정에 맞게 수정하세요 (예: /app/detail/severity)
        navigate("/app/detail/severity", { 
          state: { value: clickedLabel, title: title } 
        });
      }
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick, // 옵션에 클릭 핸들러 등록
    plugins: {
      legend: {
        position: 'top',
      }
    },
  };

  // Chart.js가 요구하는 필수 데이터 구조
  const data = {
    labels: labels || [], // 부모로부터 받은 labels가 없으면 빈 배열
    datasets: [
      {
        label: title || '위험도',
        // datasets를 안 쓰더라도 구조상 data 배열은 labels 개수만큼 존재해야 합니다.
        data: (labels || []).map(() => 0), 
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      }
    ],
  };

  return (
    <TitleCard title={title || "Chart Title"} topMargin="mt-2">
      <div style={{ height: '300px' }}> 
        {/* labels가 들어온 경우에만 차트를 그리고, 아니면 로딩 표시 */}
        {labels && labels.length > 0 ? (
          <Bar ref={chartRef} options={options} data={data} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            데이터를 불러오는 중...
          </div>
        )}
      </div>
    </TitleCard>
  );
}

export default BarChart;