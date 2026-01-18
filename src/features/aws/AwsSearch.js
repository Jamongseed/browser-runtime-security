import axios from "axios";
import { brsQueryApi } from "./BRSQuery.ts";
import moment from "moment";

const now = new Date();
let userDataResponse = [];
//const day = now.toLocaleDateString('sv-SE'); // 'sv-SE' 로케일은 YYYY-MM-DD 형식을 반환합니다.

/**
 * AWS에서 차트 데이터를 조회하고 가공하여 반환합니다.
 */

// 1. 오늘 날짜 (YYYY-MM-DD 형식)

const today = moment().format("YYYY-MM-DD");
const sevenDaysAgo = moment().subtract(7, "days").format("YYYY-MM-DD");

export const getSeverity = async ({ startDay, endDay }) => {
  try {
    const response = await brsQueryApi.severityRange({ startDay, endDay });
    const rawData = response?.items || [];

    if (rawData.length === 0) {
      return {
        labels: ["데이터 없음"],
        datasets: [{ data: [0], backgroundColor: "#ccc" }],
      };
    }

    // 1. 정렬 기준 정의 (HIGH가 가장 먼저 오도록)
    const priority = { LOW: 1, MEDIUM: 2, HIGH: 3 };

    // 2. 데이터 정렬 실행
    const sortedData = [...rawData].sort((a, b) => {
      const labelA = a.sk?.split("#")[1] || "";
      const labelB = b.sk?.split("#")[1] || "";
      return (priority[labelA] || 99) - (priority[labelB] || 99);
    });

    // 3. 정렬된 데이터로 리턴
    return {
      labels: sortedData.map((item) => item.sk?.split("#")[1] || "UNKNOWN"),
      datasets: [
        {
          label: "위험도 건수",
          data: sortedData.map((item) => item.cnt),
          // 정렬된 순서에 맞게 색상 매핑
          backgroundColor: sortedData.map((item) => {
            const level = item.sk?.split("#")[1];
            if (level === "HIGH") return "rgba(255, 99, 132, 0.7)"; // 빨강
            if (level === "MEDIUM") return "rgba(255, 159, 64, 0.7)"; // 주황
            return "rgba(75, 192, 192, 0.7)"; // 초록
          }),
          borderWidth: 1,
        },
      ],
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
        datasets: [
          {
            label: "도메인 데이터가 없습니다",
            data: [0],
            backgroundColor: "#e5e7eb",
          },
        ],
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
      labels: rawData.map((item) =>
        item.sk ? item.sk.split("#")[1] : "Unknown",
      ),
      datasets: [
        {
          label: "도메인별 탐지 건수",
          // item.val이 아니라 item.cnt를 사용해야 합니다.
          data: rawData.map((item) => item.cnt),
          backgroundColor: rawData.map(() => getRandomColor()), // 도메인 차트는 보통 파란색 계열 사용
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
        },
      ],
    };
  } catch (error) {
    console.error("데이터 조회 실패:", error);
    return { labels: [], datasets: [] };
  }
};

export const getHighSeverityEvents = async ({ startDay, endDay }) => {
  try {
    const origin = "https://poc-a-main.onrender.com";
    const severity = "HIGH";
    const limit = 20;
    const newest = "";
    const response = await brsQueryApi.severityLists({
      origin,
      severity,
      startDay,
      endDay,
      limit,
      newest,
    });
    const rawData = response.data;

    if (!rawData || !Array.isArray(rawData)) {
      return [];
    }

    // ItemResponse 형식에 맞춰 필요한 데이터만 추출
    return rawData.map((item) => ({
      severity: item.severity, // 원본 severity
      scoreDelta: item.scoreDelta,
      domain: item.domain,
      pageURL: item.page, // 원본의 'page' 필드를 'pageURL'로 매핑
      eventId: item.eventId,
      installId: item.installId,
    }));
  } catch (error) {
    console.error("데이터 조회 실패:", error);
    return [];
  }
};

export const getEvents = async ({ installId }) => {
  try {
    if (userDataResponse.length == 0) {
      const response = await brsQueryApi.eventsByInstall({ installId });
      userDataResponse = response;
    }

    const rawData = userDataResponse?.items || [];
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
          events: [],
        };
      }
      acc[sId].events.push(item);
      return acc;
    }, {});

    // 3. 세션 자체도 최신 이벤트가 있는 세션이 위로 오도록 정렬하여 배열로 변환
    const sortedGroupedList = Object.values(grouped).sort(
      (a, b) => b.latestTs - a.latestTs,
    );

    return {
      groupedList: sortedGroupedList, // 세션별로 묶인 배열
      totalCount: rawData.length,
    };
  } catch (error) {
    console.error("이벤트 목록 조회 실패:", error);
    return { groupedList: [], totalCount: 0 };
  }
};

export const getUserSessionEvents = async ({
  installId,
  update = false,
  startDay = sevenDaysAgo,
  endDay = today,
}) => {
  try {
    if (update || !userDataResponse || userDataResponse.length === 0) {
      const response = await brsQueryApi.eventsByInstall({
        installId,
        startDay,
        endDay,
      });
      userDataResponse = response;
    }

    const rawData = userDataResponse?.items || [];
    if (rawData.length === 0) return { groupedList: [] };

    // 1. 원본 데이터 최신순 정렬
    const sortedData = [...rawData].sort((a, b) => (b.ts || 0) - (a.ts || 0));

    // 2. 세션별 그룹화 + 개수(count) + 최신 시간(latestTs) 추출
    const grouped = sortedData.reduce((acc, item) => {
      const sId = item.sessionId || "Unknown Session";

      if (!acc[sId]) {
        acc[sId] = {
          sessionId: sId,
          latestTs: item.ts || 0, // 첫 데이터의 시간으로 초기화
          eventCount: 0, // 개수 카운터 초기화
          events: [],
        };
      }

      // ✅ 개수 증가
      acc[sId].eventCount += 1;

      // ✅ 최신 시간 업데이트 (더 큰 값이 들어오면 교체)
      acc[sId].latestTs = Math.max(acc[sId].latestTs, item.ts || 0);

      acc[sId].events.push(item);
      return acc;
    }, {});

    // 3. 세션 리스트를 최신 세션 순(latestTs 내림차순)으로 정렬
    const sortedGroupedList = Object.values(grouped).sort(
      (a, b) => b.latestTs - a.latestTs,
    );

    return {
      groupedList: sortedGroupedList,
      totalCount: rawData.length,
    };
  } catch (error) {
    console.error("이벤트 목록 조회 실패:", error);
    return { groupedList: [], totalCount: 0 };
  }
};

export const getUserDomainEvents = async ({
  installId,
  update = false,
  startDay = sevenDaysAgo,
  endDay = today,
}) => {
  try {
    if (update || !userDataResponse || userDataResponse.length === 0) {
      const response = await brsQueryApi.eventsByInstall({
        installId,
        startDay,
        endDay,
      });
      userDataResponse = response;
    }

    const rawData = userDataResponse?.items || [];
    if (rawData.length === 0) return { groupedList: [] };

    // 1. 원본 데이터 최신순 정렬 (기본 정렬)
    const sortedData = [...rawData].sort((a, b) => (b.ts || 0) - (a.ts || 0));

    // 2. 도메인별(Domain) 그룹화
    const grouped = sortedData.reduce((acc, item) => {
      // 도메인이 없을 경우를 대비해 기본값 설정
      const domainKey = item.domain || "Unknown Domain";

      if (!acc[domainKey]) {
        acc[domainKey] = {
          domain: domainKey, // 그룹 기준 명칭
          latestTs: item.ts || 0, // 해당 도메인에서 발생한 가장 최근 시간
          eventCount: 0, // 해당 도메인의 총 이벤트 수
          events: [],
        };
      }

      // 데이터 누적
      acc[domainKey].eventCount += 1;
      acc[domainKey].latestTs = Math.max(
        acc[acc.domainKey]?.latestTs || 0,
        item.ts || 0,
      );
      acc[domainKey].events.push(item);

      return acc;
    }, {});

    // 3. 도메인 리스트를 최신 이벤트가 발생한 순서대로 정렬
    const sortedGroupedList = Object.values(grouped).sort(
      (a, b) => b.latestTs - a.latestTs,
    );

    return {
      groupedList: sortedGroupedList, // 이제 세션이 아닌 도메인별 리스트가 반환됨
      totalCount: rawData.length,
    };
  } catch (error) {
    console.error("도메인별 이벤트 목록 조회 실패:", error);
    return { groupedList: [], totalCount: 0 };
  }
};

export const getUserSeverity = async ({
  installId,
  update = false,
  startDay = sevenDaysAgo,
  endDay = today,
}) => {
  try {
    // 1. 데이터 가져오기 (기존 로직 유지)
    if (update || !userDataResponse || userDataResponse.length === 0) {
      const response = await brsQueryApi.eventsByInstall({
        installId,
        startDay,
        endDay,
      });
      userDataResponse = response?.items || [];
    }

    const rawData = userDataResponse || [];

    // 데이터가 없을 경우 처리
    if (rawData.length === 0) {
      return {
        labels: ["데이터 없음"],
        datasets: [{ data: [0], backgroundColor: "#ccc" }],
      };
    }

    // 2. 위험도별 개수 집계
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    rawData.forEach((item) => {
      const sev = item.severity?.toUpperCase();
      if (counts.hasOwnProperty(sev)) {
        counts[sev]++;
      }
    });

    // 3. 정렬 기준 정의 (LOW -> MEDIUM -> HIGH 순서)
    const severityOrder = ["HIGH", "MEDIUM", "LOW"];
    const severityOrderKorean = ["높음", "중간", "낮음"];

    // 4. 정렬된 결과 생성
    const labels = severityOrderKorean;
    const data = severityOrder.map((level) => counts[level]);
    const backgroundColors = severityOrder.map((level) => {
      if (level === "HIGH") return "rgba(243, 4, 56, 0.7)"; // 빨강
      if (level === "MEDIUM") return "rgba(255, 159, 64, 0.7)"; // 주황
      return "rgba(75, 192, 192, 0.7)"; // 초록
    });

    // 5. Chart.js 규격에 맞는 리턴
    return {
      labels: labels,
      datasets: [
        {
          label: "위험도 건수",
          data: data,
          backgroundColor: backgroundColors,
          borderWidth: 1,
        },
      ],
    };
  } catch (error) {
    console.error("이벤트 목록 조회 실패:", error);
    return { labels: [], datasets: [] };
  }
};

export const getUserDomain = async ({
  installId,
  update = false,
  startDay = sevenDaysAgo,
  endDay = today,
}) => {
  try {
    // 1. 데이터 가져오기 (기존 로직 유지)
    if (update || !userDataResponse || userDataResponse.length === 0) {
      const response = await brsQueryApi.eventsByInstall({
        installId,
        startDay,
        endDay,
      });
      userDataResponse = response?.items || [];
    }

    const rawData = userDataResponse || [];

    // 데이터가 없을 경우 처리
    if (rawData.length === 0) {
      return {
        labels: ["데이터 없음"],
        datasets: [{ label: "건수", data: [0], backgroundColor: "#ccc" }],
      };
    }

    // 2. 도메인별 개수 집계
    const domainCounts = {};
    rawData.forEach((item) => {
      const domain = item.domain || "Unknown";
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });

    // 3. 배열로 변환 후 건수 기준 내림차순 정렬
    const sortedDomains = Object.entries(domainCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count); // 많은 순서대로

    // 4. Chart.js 규격에 맞는 데이터 생성
    return {
      labels: sortedDomains.map((item) => item.name),
      datasets: [
        {
          label: "도메인별 탐지 건수",
          data: sortedDomains.map((item) => item.count),
          backgroundColor: [
            "rgba(54, 162, 235, 0.7)", // 파랑
            "rgba(153, 102, 255, 0.7)", // 보라
            "rgba(255, 159, 64, 0.7)", // 주황
            "rgba(75, 192, 192, 0.7)", // 민트
            "rgba(255, 206, 86, 0.7)", // 노랑
          ],
          borderWidth: 1,
        },
      ],
    };
  } catch (error) {
    console.error("도메인 목록 조회 실패:", error);
    return { labels: [], datasets: [] };
  }
};

export const getUserEventBytime = async ({
  installId,
  update = false,
  startDay = sevenDaysAgo,
  endDay = today,
}) => {
  try {
    // 1. 데이터가 없으면 API 호출하여 저장
    if (update || !userDataResponse || userDataResponse.length === 0) {
      const response = await brsQueryApi.eventsByInstall({
        installId,
        startDay,
        endDay,
      });
      userDataResponse = response?.items || [];
    }

    let rawData = userDataResponse || [];
    if (rawData.length === 0) return { sortedData: [] };

    // ✅ 2. severity가 'LOW'인 데이터 제거 (필터링)
    // item.severity가 존재하고, 그 값이 'low'가 아닌 것들만 남깁니다.
    const filteredData = rawData.filter(
      (item) => item.severity?.toUpperCase() !== "LOW",
    );

    // ✅ 3. 필터링된 데이터를 ts(타임스탬프) 기준 내림차순 정렬
    const sortedData = [...filteredData].sort(
      (a, b) => (b.ts || 0) - (a.ts || 0),
    );

    return {
      sortedData,
    };
  } catch (error) {
    console.error("이벤트 목록 조회 실패:", error);
    return { sortedData: [] };
  }
};

export const getRule = async () => {
  try {
    // 1. AWS rule 트랜드
    const response = await axios.get("/trends/rule");
    const rawData = response.data;

    // 2. labels와 datasets만 추출하여 리턴
    return {
      labels: rawData.map((item) => item.label),
      datasets: [
        {
          data: rawData.map((item) => item.val),
        },
      ],
    };
  } catch (error) {
    console.error("데이터 조회 실패:", error);
    return { labels: [], datasets: [] };
  }
};

export const getDetail = async () => {
  try {
    // 1. AWS 전체 이벤트 목록 조회
    const response = await axios.get("/detail");
    const rawData = response.data;

    // 2. labels와 datasets만 추출하여 리턴
    return {
      response,
    };
  } catch (error) {
    console.error("데이터 조회 실패:", error);
    return { labels: [], datasets: [] };
  }
};
