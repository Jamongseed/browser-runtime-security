import axios from 'axios';
import { brsQueryApi } from './BRSQuery.ts';

const now = new Date();
//const day = now.toLocaleDateString('sv-SE'); // 'sv-SE' 로케일은 YYYY-MM-DD 형식을 반환합니다.

/**
 * AWS에서 차트 데이터를 조회하고 가공하여 반환합니다.
 */
export const getServerity = async ({ startDay, endDay }) => {
    try {
        const response = await brsQueryApi.severity({ startDay, endDay });
        const rawData = response?.items || [];

        if (rawData.length === 0) {
            return {
                labels: ["데이터 없음"],
                datasets: [{ data: [0], backgroundColor: '#ccc' }]
            };
        }

        // 1. 정렬 기준 정의 (HIGH가 가장 먼저 오도록)
        const priority = { "LOW": 1, "MEDIUM": 2, "HIGH": 3 };

        // 2. 데이터 정렬 실행
        const sortedData = [...rawData].sort((a, b) => {
            const labelA = a.sk?.split('#')[1] || "";
            const labelB = b.sk?.split('#')[1] || "";
            return (priority[labelA] || 99) - (priority[labelB] || 99);
        });

        // 3. 정렬된 데이터로 리턴
        return {
            labels: sortedData.map(item => item.sk?.split('#')[1] || "UNKNOWN"),
            datasets: [
                {
                    label: "위험도 건수",
                    data: sortedData.map(item => item.cnt),
                    // 정렬된 순서에 맞게 색상 매핑
                    backgroundColor: sortedData.map(item => {
                        const level = item.sk?.split('#')[1];
                        if (level === 'HIGH') return 'rgba(255, 99, 132, 0.7)';   // 빨강
                        if (level === 'MEDIUM') return 'rgba(255, 159, 64, 0.7)'; // 주황
                        return 'rgba(75, 192, 192, 0.7)';                         // 초록
                    }),
                    borderWidth: 1
                }
            ]
        };
        
    } catch (error) {
        console.error("데이터 조회 실패:", error);
        return { labels: [], datasets: [] };
    }
};

export const getDomain = async ({ startDay, endDay }) => {
    try {
        console.log("전달된 날짜 확인2:", { startDay, endDay });
        const response = await brsQueryApi.topDomains({ startDay, endDay });

        // response.items가 배열인지 확인하고 안전하게 가져오기
        const rawData = response?.items || [];

        if (rawData.length === 0) {
            return {
                labels: ["데이터 없음"],
                datasets: [{ 
                    label: "도메인 데이터가 없습니다",
                    data: [0], 
                    backgroundColor: '#e5e7eb' 
                }]
            };
        }

        const getRandomColor = () => {
            const r = Math.floor(Math.random() * 255);
            const g = Math.floor(Math.random() * 255);
            const b = Math.floor(Math.random() * 255);
            return `rgba(${r}, ${g}, ${b}, 0.8)`; // 투명도 0.6
        };

        // 2. 응답 구조(sk, cnt)에 맞춰 추출하여 리턴
        return {
            // "DOMAIN#google.com"에서 "google.com"만 추출
            labels: rawData.map(item => item.sk ? item.sk.split('#')[1] : "Unknown"),
            datasets: [
                {
                    label: "도메인별 탐지 건수",
                    // item.val이 아니라 item.cnt를 사용해야 합니다.
                    data: rawData.map(item => item.cnt),
                    backgroundColor: rawData.map(() => getRandomColor()), // 도메인 차트는 보통 파란색 계열 사용
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }
            ]
        };
    } catch (error) {
        console.error("데이터 조회 실패:", error);
        return { labels: [], datasets: [] };
    }
};

export const getHighSeverityEvents = async ({ startDay, endDay }) => {
    try {
        const origin = "https://poc-a-main.onrender.com";
        const serverity = "HIGH"
        const limit = 20
        const newest = ""
        const response = await brsQueryApi.severityLists({ origin, serverity, startDay, endDay, limit, newest });
        const rawData = response.data;

        if (!rawData || !Array.isArray(rawData)) {
            return [];
        }

        // ItemResponse 형식에 맞춰 필요한 데이터만 추출
        return rawData.map(item => ({
            severity: item.severity,    // 원본 severity
            scoreDelta: item.scoreDelta,
            domain: item.domain,
            pageURL: item.page,         // 원본의 'page' 필드를 'pageURL'로 매핑
            eventId: item.eventId,
            installId: item.installId
        }));

    } catch (error) {
        console.error("데이터 조회 실패:", error);
        return [];
    }
};

export const getEvents = async ({ installId }) => {
    try {
        const response = await brsQueryApi.eventsByInstall({ installId });
        const rawData = response?.items || [];

        if (rawData.length === 0) return { groupedList: [] };

        // 1. 최신순 정렬 (ts가 높은 숫자일수록 최신)
        // 만약 ts가 문자열이라면 (b.ts > a.ts ? 1 : -1) 형식을 사용하세요.
        const sortedData = [...rawData].sort((a, b) => (b.ts || 0) - (a.ts || 0));

        // 2. 세션별 그룹화 및 순서 유지
        const grouped = sortedData.reduce((acc, item) => {
            const sId = item.sessionId || "Unknown Session";
            if (!acc[sId]) {
                acc[sId] = {
                    sessionId: sId,
                    latestTs: item.ts, // 세션의 최신 시간을 기준으로 세션 순서 정렬용
                    events: []
                };
            }
            acc[sId].events.push(item);
            return acc;
        }, {});

        // 3. 세션 자체도 최신 이벤트가 있는 세션이 위로 오도록 정렬하여 배열로 변환
        const sortedGroupedList = Object.values(grouped).sort((a, b) => b.latestTs - a.latestTs);

        return {
            groupedList: sortedGroupedList, // 세션별로 묶인 배열
            totalCount: rawData.length
        };

    } catch (error) {
        console.error("이벤트 목록 조회 실패:", error);
        return { groupedList: [], totalCount: 0 };
    }
};

export const getRule = async () => {
    try {
        // 1. AWS rule 트랜드 
        const response = await axios.get('/trends/rule');
        const rawData = response.data;

        // 2. labels와 datasets만 추출하여 리턴
        return {
            labels: rawData.map(item => item.label),
            datasets: [
                {
                    data: rawData.map(item => item.val),
                }
            ]
        };
    } catch (error) {
        console.error("데이터 조회 실패:", error);
        return { labels: [], datasets: [] };
    }
};

export const getDetail
= async () => {
    try {
        // 1. AWS 전체 이벤트 목록 조회
        const response = await axios.get('/detail');
        const rawData = response.data;

        // 2. labels와 datasets만 추출하여 리턴
        return {
            response
        };
    } catch (error) {
        console.error("데이터 조회 실패:", error);
        return { labels: [], datasets: [] };
    }
};