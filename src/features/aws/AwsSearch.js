import axios from 'axios';
import { brsQueryApi } from './BRSQuery.ts';

const now = new Date();
//const day = now.toLocaleDateString('sv-SE'); // 'sv-SE' 로케일은 YYYY-MM-DD 형식을 반환합니다.
const day = "2026-01-10"

/**
 * AWS에서 차트 데이터를 조회하고 가공하여 반환합니다.
 */
export const getServerity = async ({ origin, day }) => {
    try {
        // 1. AWS 위험도 api 호출
        const response = await brsQueryApi.severity({ origin, day});
        const rawData = response.data;

        if (rawData.length === 0) {
        return {
            labels: ["데이터 없음"],
            datasets: [{
                label: "조회된 데이터가 없습니다",
                data: [0],
                backgroundColor: 'rgba(200, 200, 200, 0.5)' // 회색으로 표시
            }]
        };
        }

        // 2. labels와 datasets만 추출하여 리턴
        return {
            labels: rawData.map(item => item.key),
            datasets: [
                {
                    data: rawData.map(item => item.cnt)
                }
            ]
        };
        
    } catch (error) {
        console.error("데이터 조회 실패:", error);
        return { labels: [], datasets: [] };
    }
};

export const getAllEvents = async () => {
    try {
        // 1. AWS 전체 이벤트 목록 조회
        const response = await brsQueryApi.events({ origin, day});
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

export const getEvents = async ({ installId }) => {
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

export const getDomain = async ({ origin, day }) => {
    try {
        // 1. AWS 도매인 트랜드
        const response = await brsQueryApi.topDomains({ origin, day});
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