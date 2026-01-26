import axios from "axios";
import { brsQueryApi } from "./BRSQuery.ts";
import moment from "moment";
import { getStartDay, getEndDay } from "../../app/auth";

const now = new Date();
let userDataResponse = [];
//const day = now.toLocaleDateString('sv-SE'); // 'sv-SE' 로케일은 YYYY-MM-DD 형식을 반환합니다.

/**
 * AWS에서 차트 데이터를 조회하고 가공하여 반환합니다.
 */

export const getSeverity = async ({ startDay, endDay }) => {
  try {
    const kind = "sev";
    const response = await brsQueryApi.aggSearch({ kind, startDay, endDay });

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
    // 한글 변환용 맵 추가
    const labelMap = {
      LOW: "낮음",
      MEDIUM: "중간",
      HIGH: "높음",
      UNKNOWN: "알 수 없음",
    };

    // 3. 정렬된 데이터로 리턴
    return {
      labels: sortedData.map((item) => {
        const level = item.sk?.split("#")[1] || "UNKNOWN";
        return labelMap[level] || level; // 맵에 없으면 원래 값 출력
      }),
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

export const getAggDomain = async ({ startDay, endDay }) => {
  try {
    const kind = "domain";
    const response = await brsQueryApi.aggSearch({ kind, startDay, endDay });

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

    const topData = [...rawData]
      .sort((a, b) => (b.cnt || 0) - (a.cnt || 0))
      .slice(0, 15);

    const getRandomColor = () => {
      const r = Math.floor(Math.random() * 255);
      const g = Math.floor(Math.random() * 255);
      const b = Math.floor(Math.random() * 255);
      return `rgba(${r}, ${g}, ${b}, 0.8)`; // 투명도 0.6
    };

    // 2. 응답 구조(sk, cnt)에 맞춰 추출하여 리턴
    return {
      // "DOMAIN#google.com"에서 "google.com"만 추출
      labels: topData.map((item) =>
        item.sk ? item.sk.split("#")[1] : "Unknown",
      ),
      datasets: [
        {
          label: "도메인별 탐지 건수",
          // item.val이 아니라 item.cnt를 사용해야 합니다.
          data: topData.map((item) => item.cnt),
          backgroundColor: topData.map(() => getRandomColor()), // 도메인 차트는 보통 파란색 계열 사용
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

export const getAggRule = async ({ startDay, endDay }) => {
  try {
    const kind = "rule";
    const response = await brsQueryApi.aggSearch({ kind, startDay, endDay });

    // response.items가 배열인지 확인하고 안전하게 가져오기
    const rawData = response?.items || [];

    if (rawData.length === 0) {
      return {
        labels: ["데이터 없음"],
        datasets: [
          {
            label: "룰 데이터가 없습니다",
            data: [0],
            backgroundColor: "#e5e7eb",
          },
        ],
      };
    }

    const topData = [...rawData]
      .sort((a, b) => (b.cnt || 0) - (a.cnt || 0))
      .slice(0, 5);

    const getRandomColor = () => {
      const r = Math.floor(Math.random() * 255);
      const g = Math.floor(Math.random() * 255);
      const b = Math.floor(Math.random() * 255);
      return `rgba(${r}, ${g}, ${b}, 0.8)`; // 투명도 0.6
    };

    // 2. 응답 구조(sk, cnt)에 맞춰 추출하여 리턴
    return {
      // "DOMAIN#google.com"에서 "google.com"만 추출
      labels: topData.map((item) =>
        item.sk ? item.sk.split("#")[1] : "Unknown",
      ),
      datasets: [
        {
          label: "룰별 탐지 건수",
          // item.val이 아니라 item.cnt를 사용해야 합니다.
          data: topData.map((item) => item.cnt),
          backgroundColor: topData.map(() => getRandomColor()), // 도메인 차트는 보통 파란색 계열 사용
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

export const getEventsAll = async ({
  startDay,
  endDay,
  limit = 200,
  nextToken,
}) => {
  try {
    const response = await brsQueryApi.events({
      startDay,
      endDay,
      limit,
      nextToken,
    });

    return { data: response, error: null };
  } catch (error) {
    console.error(`getEventsAll 조회 실패:`, error);
    return { data: null, error: error?.message || "Unknown error" };
  }
};

export const getEvents = async ({ installId, startDay, endDay }) => {
  try {
    const response = await brsQueryApi.eventsByInstall({
      installId,
      startDay,
      endDay,
    });

    const items = response?.items || [];

    return {
      data: items,
      error: null,
    };
  } catch (error) {
    console.error(`getEvents 조회 실패:`, error);
    return {
      data: null,
      error: error?.message || "Unknown error",
    };
  }
};

export const getEventsByRule = async ({
  ruleId,
  startDay,
  endDay,
  limit = 50,
  newest = true,
}) => {
  try {
    if (!ruleId) return { data: null, error: "No Rule ID" };
    const response = await brsQueryApi.eventsByRule({
      ruleId,
      startDay,
      endDay,
      limit,
      newest,
    });

    const items = response?.items || [];

    return {
      data: items,
      error: null,
    };
  } catch (error) {
    console.error(`룰아이디(${ruleId}) 조회 실패:`, error);
    return {
      data: null,
      error: error?.message || "Unknown error",
    };
  }
};

export const getEventsByDomain = async ({
  domain,
  startDay,
  endDay,
  limit = 50,
  newest = true,
}) => {
  try {
    // 1. 유효성 검사 (함수 인자 이름은 ruleId지만, 메시지는 문맥에 맞게 수정)
    if (!domain) return { data: null, error: "No Rule ID or Domain provided" };

    const response = await brsQueryApi.eventsByDomain({
      domain,
      startDay,
      endDay,
      limit,
      newest,
    });

    // 2. response.items가 없을 경우를 대비해 빈 배열로 처리
    const items = response?.items || [];

    // 3. 리턴 객체 내부 구분자는 쉼표(,)여야 합니다.
    return {
      data: items, // 세미콜론(;) 제거
      error: null, // 세미콜론(;) 제거
    };
  } catch (error) {
    console.error(`룰아이디(${domain}) 조회 실패:`, error);
    return {
      data: null,
      error: error?.message || "Unknown error",
    };
  }
};

//---------------유저용 -------------------

export const getUserSessionEvents = async ({
  installId,
  update = false,
  startDay,
  endDay,
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
  startDay,
  endDay,
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
  startDay,
  endDay,
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
    const severityOrder = ["LOW", "MEDIUM", "HIGH"];
    const severityOrderKorean = ["낮음", "중간", "높음"];

    // 4. 정렬된 결과 생성
    const labels = severityOrderKorean;
    const data = severityOrder.map((level) => counts[level]);
    const backgroundColors = severityOrder.map((level) => {
      if (level === "HIGH") return "rgba(255, 99, 132, 0.7)"; // 빨강
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
  startDay,
  endDay,
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
  startDay,
  endDay,
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

export const getRule = async ({ startDay, endDay, limit = 7 }) => {
  try {
    // 1. AWS rule 트랜드
    const response = await brsQueryApi.topnRules({ startDay, endDay, limit });
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

//---------------------공용--------------

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

export const getEventDetail = async ({ eventId }) => {
  try {
    if (!eventId) return { data: null, error: "No Event ID" };

    const response = await brsQueryApi.eventBody({ eventId });
    const rawData = response.meta;

    if (!rawData || !response.ok) {
      throw new Error("데이터를 찾을 수 없습니다.");
    }

    // 1. payloadJson 파싱 (문자열 -> 객체)
    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(response.payload.payloadJson);
    } catch (e) {
      console.error("Payload 파싱 실패", e);
    }

    // 2. meta 내부의 모든 값을 개별적으로 추출 (누락 방지)
    const formattedData = {
      eventId: response.eventId,
      ok: response.ok,

      // meta 필드들 개별 리턴
      origin: rawData?.origin,
      tsMs: rawData?.tsMs,
      day: rawData?.day,
      shard: rawData?.shard, // 누락됐던 값
      pkMain: rawData?.pkMain, // 누락됐던 값
      skMain: rawData?.skMain, // 누락됐던 값
      pk: rawData?.pk,
      sk: rawData?.sk,
      ttl: rawData?.ttl, // 누락됐던 값
      payloadTruncated: rawData?.payloadTruncated,
      payloadHash: rawData?.payloadHash,
      ruleId: parsedPayload?.ruleId,

      // 파싱된 상세 정보
      details: parsedPayload,

      // payload 관련 추가 정보
      fullPayload: rawData.payload,
    };

    return {
      data: formattedData,
      error: null,
    };
  } catch (error) {
    console.error(`이벤트(${eventId}) 조회 실패:`, error);
    return {
      data: null,
      error: error?.message || "Unknown error",
    };
  }
};

export const getOneEvent = async ({ eventId }) => {
  try {
    if (!eventId) return { data: null, error: "No Event ID" };

    const response = await brsQueryApi.eventBody({ eventId });

    if (!response || !response.ok) {
      throw new Error("데이터를 찾을 수 없습니다.");
    }

    // 1. payloadJson 파싱 (문자열 -> 객체)
    let parsedInnerPayload = {};
    try {
      parsedInnerPayload = response.payload?.payloadJson
        ? JSON.parse(response.payload.payloadJson)
        : {};
    } catch (e) {
      console.error("Payload 파싱 실패", e);
    }

    // 2. 데이터 평탄화 및 포맷팅 (items 배열에 들어갈 객체 생성)
    const eventItem = {
      // meta 및 기본 정보 추출
      ts: response.meta?.tsMs || Date.now(),
      day: response.meta?.day || "",
      eventId: response.eventId,
      rulesetId: response.rulesetId,
      domain: response.domain,

      // 파싱된 내부 payload 데이터 추출
      type: parsedInnerPayload.type || "",
      ruleId: parsedInnerPayload.ruleId || "",
      severity: parsedInnerPayload.severity || "INFO",
      scoreDelta: String(parsedInnerPayload.scoreDelta || "0"),
      sessionId: parsedInnerPayload.sessionId || "",
      installId: parsedInnerPayload.installId || "",
      origin: parsedInnerPayload.origin || "",
      page: parsedInnerPayload.page || "",
    };

    // 3. 최종 반환 구조 (query + items 배열)

    console.log("getOneEvent 리스폰스");
    console.log(eventItem);

    return {
      data: [eventItem],
      error: null,
    };
  } catch (error) {
    console.error(`이벤트(${eventId}) 조회 실패:`, error);
    return {
      data: null,
      error: error?.message || "Unknown error",
    };
  }
};

export const getRuleDescription = async ({ ruleId, locale = "ko" }) => {
  try {
    if (!ruleId) return { data: null, error: "No Rule ID" };
    const response = await brsQueryApi.ruleDescription({ ruleId, locale });

    const formattedData = {
      ok: response.ok,
      rulesetId: response.rulesetId,
      ruleId: response.ruleId,
      locale: response.locale,
      oneLine: response.oneLine, // 한 줄 요약
      title: response.title, // 규칙 제목
    };

    return {
      data: formattedData,
      error: null,
    };
  } catch (error) {
    console.error(`룰아이디(${ruleId}) 조회 실패:`, error);
    return {
      data: null,
      error: error?.message || "Unknown error",
    };
  }
};
