import { STORAGE_KEYS, SYSTEM_CONFIG } from './config.js';
import { getThreatMessage } from './utils/threatMessages.js';
import { getOrCreateInstallId } from './utils/installIdManager.js';

// 시간 표시 함수 (1차 방식)
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  return `${days}일 전`;
 }

// reportId 파라미터 추가
function openDashboard(installId, reportId = null) {
  const dashboardBase = SYSTEM_CONFIG.DASHBOARD_URL;
  if (!dashboardBase) {
    console.error("[BRS] Missing SYSTEM_CONFIG.DASHBOARD_URL");
    return;
  }
  const base = dashboardBase.endsWith("/") ? dashboardBase : `${dashboardBase}/`;

  let targetUrl;
  if (reportId) {
    targetUrl = `${base}detail/${encodeURIComponent(reportId)}?installId=${encodeURIComponent(installId)}`;
  } else {
    targetUrl = `${base}dashboard/${encodeURIComponent(installId)}`;
  }

  chrome.tabs.create({ url: targetUrl }, () => {
    if (chrome.runtime.lastError) {
      console.error("[BRS] Failed to open dashboard:", chrome.runtime.lastError.message);
    }
  });
}

function renderEmpty(element, msg) {
  const message = msg || "탐지된 위협이 없습니다.";
  element.innerHTML = `<div class="empty-state">${message}</div>`;
}

// ON/OFF 토글 UI 반영
function updateStatusUI(isOn) {
  const statusText = document.getElementById('status-text');
  const toggle = document.getElementById('master-toggle');

  if (toggle) toggle.checked = isOn;

  if (statusText) {
    statusText.textContent = isOn ? "ON" : "OFF";
    // 켜지면 초록색, 꺼지면 회색
    if (isOn) statusText.classList.add('on');
    else statusText.classList.remove('on');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const settingsBtn = document.getElementById('go-settings');
  const dashboardBtn = document.getElementById('go-dashboard');
  const logArea = document.getElementById('log-area');
  const toggle = document.getElementById('master-toggle');

  // 대시보드 버튼 로직 INSTALL_ID만 불러오면 되는 가벼운 작업을 위 쪽으로 올림
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', async () => {
      const installId = await getOrCreateInstallId();
      openDashboard(installId);
    });
  }

  // 설정 버튼 로직
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('local_dashboard/brs-options-panel.html'));
      }
    });
  }

  chrome.storage.local.get({
    [STORAGE_KEYS.LOGS]: [],
    [STORAGE_KEYS.IS_ENABLED]: true
  }, async (result) => {

    if (chrome.runtime.lastError) {
      console.error("[BRS] Storage Access Failed:", chrome.runtime.lastError.message);
      renderEmpty(logArea, "데이터 로드 실패<br>(Storage Error)");
      return;
    }

    const logs = result[STORAGE_KEYS.LOGS] || [];
    const isEnabled = result[STORAGE_KEYS.IS_ENABLED];
    const installId = await getOrCreateInstallId();

    // 초기 토글 상태 반영
    updateStatusUI(isEnabled);

    if (toggle) {
      toggle.addEventListener('change', (e) => {
        const newState = e.target.checked;

        toggle.disabled = true;

        chrome.storage.local.set({ [STORAGE_KEYS.IS_ENABLED]: newState }, () => {
          toggle.disabled = false; // 저장 완료 후 해제

          if (chrome.runtime.lastError) {
            console.error("[BRS] Toggle Save Failed:", chrome.runtime.lastError.message);
            // 에러 시 UI를 이전 상태로 복구
            toggle.checked = !newState;
            updateStatusUI(!newState);
          } else {
            updateStatusUI(newState);
          }
        });
      });
    }

    if (logs.length === 0) {
      renderEmpty(logArea);
      return;
    }

    let tab;
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tab = activeTab;
    } catch (e) {
      console.error("[BRS] Tab Query Failed:", e);
    }

    // URL을 못 찾으면 그냥 빈 창 띄우기
    if (!tab || !tab.url) {
      renderEmpty(logArea);
      return;
    }

    const currentTabId = tab.id;
    const sessionLogs = logs.filter(log => {
      const severity = (log.severity || "").toUpperCase();
      const isTargetSeverity = ['MEDIUM', 'HIGH'].includes(severity);

      return log.tabId === currentTabId && isTargetSeverity;
    });

    const summaryArea = document.getElementById('status-summary');
    if (summaryArea) {
      if (sessionLogs.length > 0) {
        summaryArea.textContent = `현재 탭에서 총 ${sessionLogs.length}건의 위협이 발견되었습니다.`;
        summaryArea.style.display = 'block';
      } else {
        summaryArea.style.display = 'none';
      }
    }

    if (sessionLogs.length === 0) {
      renderEmpty(logArea, "현재 탭에서 탐지된<br>주요 위협(Medium 이상)이 없습니다.");
      return;
    }

    const logsToDisplay = sessionLogs
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 7);

    if (logArea) {
      logArea.innerHTML = '';
      for (const log of logsToDisplay) {
        // SITE 라벨: 이벤트가 들고 있는 page/origin 우선, 없으면 기존 필드 fallback
        const siteInfo =
          log?.page ||
          log?.origin ||
          log?.browserUrl ||
          log?.targetOrigin ||
          "Internal/Page";

        const timeStr = getRelativeTime(log.ts);
        const logTitle = await getThreatMessage(log.ruleId, "title");

        const itemDiv = document.createElement('div');
        itemDiv.className = `log-item ${log.severity}`;

        itemDiv.addEventListener('click', () => {
          openDashboard(installId, log.reportId);
        });

        const headerDiv = document.createElement('div');
        headerDiv.className = 'log-header';

        const typeSpan = document.createElement('span');
        typeSpan.textContent = logTitle;
        typeSpan.className = 'log-title';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = timeStr;

        headerDiv.appendChild(typeSpan);
        headerDiv.appendChild(timeSpan);

        const originDiv = document.createElement('div');
        originDiv.style.fontSize = '11px';
        originDiv.style.marginTop = '4px';
        originDiv.textContent = `URL: ${siteInfo}`;

        const footerDiv = document.createElement('div');
        footerDiv.style.marginTop = '5px';
        footerDiv.style.fontSize = '11px';
        footerDiv.style.color = '#888';

        footerDiv.appendChild(document.createTextNode("위험도: "));

        const bTag = document.createElement('b');
        bTag.textContent = log.severity;
        footerDiv.appendChild(bTag);

        // 점수 표기: 최종점수(finalScore) 우선, 없으면 score/effectiveScore, 마지막에 scoreDelta
        const scoreShown =
          (typeof log?.finalScore === "number") ? log.finalScore :
          (typeof log?.data?.finalScore === "number") ? log.data.finalScore :
          (typeof log?.effectiveScore === "number") ? log.effectiveScore :
          (typeof log?.data?.effectiveScore === "number") ? log.data.effectiveScore :
          (typeof log?.score === "number") ? log.score :
          (typeof log?.data?.score === "number") ? log.data.score :
          log.scoreDelta;

        footerDiv.appendChild(document.createTextNode(` (점수: ${scoreShown})`));

        itemDiv.appendChild(headerDiv);
        itemDiv.appendChild(originDiv);
        itemDiv.appendChild(footerDiv);
        logArea.appendChild(itemDiv);
      }

      if (sessionLogs.length > 7) {
        const moreLink = document.createElement('div');
        moreLink.className = 'more-logs-link';
        moreLink.textContent = `+ ${sessionLogs.length - 7}개의 위협 더 보기`;
        moreLink.addEventListener('click', () => openDashboard(installId));
        logArea.appendChild(moreLink);
      }
    }
  });
});