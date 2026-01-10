import axios from 'axios';

/**
 * AWS에서 차트 데이터를 조회하고 가공하여 반환합니다.
 */
export const getServerity
= async () => {
    try {
        // 1. AWS 위험도 api 호출
        //const response = await axios.get('/aggregates/severity');
        //const rawData = response.data;

        // 2. labels와 datasets만 추출하여 리턴
        return {
            /*
            labels: rawData.map(item => item.label),
            datasets: [
                {
                    data: rawData.map(item => item.val),
                }
            ]
            */

            labels: ["LOW", "MEDIUM", "HIGH"],
            datasets: [
                {
                    label: "위험도 분포",
                    data: [10, 50, 30] 
                }
            ]
        };
        
    } catch (error) {
        console.error("데이터 조회 실패:", error);
        return { labels: [], datasets: [] };
    }
};

export const getAllEvents
= async () => {
    try {
        // 1. AWS 전체 이벤트 목록 조회
        const response = await axios.get('/events');
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

export const getEvents
= async () => {
    try {
        // 1. AWS 개인 이벤트 목록 조회
        const response = await axios.get('/events/by-install');
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

export const getRule
= async () => {
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

export const getDomain
= async () => {
    try {
        // 1. AWS 도매인 트랜드
        //const response = await axios.get('/trends/domain');
        //const rawData = response.data;

        // 2. labels와 datasets만 추출하여 리턴
        return {
            /*
            labels: rawData.map(item => item.label),
            datasets: [
                {
                    data: rawData.map(item => item.val),
                }
            ]
            */
        labels: ["naver.com", "google.com", "daum.net", "github.com", "apple.com"],
        datasets: [
            {
                label: "도메인 트래픽",
                data: [450, 670, 310, 890, 520] 
            }
        ]
        };
    } catch (error) {
        console.error("데이터 조회 실패:", error);
        return { labels: [], datasets: [] };
    }
};
