import { STORAGE_KEYS } from './config.js';


// reportId 파라미터 추가
function openDashboard(installId, reportId) {
  const dashboardUrl = chrome.runtime.getURL("local_dashboard/dashboard.html");
  const params = new URLSearchParams();

  if (installId) params.append("installId", installId);

  // reportId가 있으면 URL 파라미터에 추가
  if (reportId) {
    params.append("reportId", reportId);
  }

  const targetUrl = `${dashboardUrl}?${params.toString()}`;

  chrome.tabs.create({ url: targetUrl });
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
    dashboardBtn.addEventListener('click', () => {
      chrome.storage.local.get([STORAGE_KEYS.INSTALL_ID], (res) => {
        openDashboard(res[STORAGE_KEYS.INSTALL_ID]);
      });
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
    [STORAGE_KEYS.INSTALL_ID]: null,
    [STORAGE_KEYS.IS_ENABLED]: true
  }, async (result) => {

    if (chrome.runtime.lastError) {
      console.error("[BRS] Storage Access Failed:", chrome.runtime.lastError.message);
      renderEmpty(logArea, "데이터 로드 실패<br>(Storage Error)");
      return;
    }

    const logs = result[STORAGE_KEYS.LOGS] || [];
    const installId = result[STORAGE_KEYS.INSTALL_ID];
    const isEnabled = result[STORAGE_KEYS.IS_ENABLED];

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

    if (sessionLogs.length === 0) {
      renderEmpty(logArea, "현재 탭에서 탐지된<br>주요 위협(Medium 이상)이 없습니다.");
      return;
    }

    const logsToDisplay = sessionLogs
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 20);

    if (logArea) {
      logArea.innerHTML = '';
      logsToDisplay.forEach(log => {
        const siteInfo = log?.browserUrl || log?.targetOrigin || "Internal/Page";

        const timeStr = new Date(log.ts).toLocaleTimeString();

        const itemDiv = document.createElement('div');
        itemDiv.className = `log-item ${log.severity}`;

        itemDiv.addEventListener('click', () => {
          openDashboard(installId, log.reportId);
        });

        const headerDiv = document.createElement('div');
        headerDiv.className = 'log-header';

        const typeSpan = document.createElement('span');
        typeSpan.textContent = log.type;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = timeStr;

        headerDiv.appendChild(typeSpan);
        headerDiv.appendChild(timeSpan);

        const originDiv = document.createElement('div');
        originDiv.style.fontSize = '11px';
        originDiv.style.marginTop = '4px';
        originDiv.textContent = `SITE: ${siteInfo}`;

        const footerDiv = document.createElement('div');
        footerDiv.style.marginTop = '5px';
        footerDiv.style.fontSize = '11px';
        footerDiv.style.color = '#888';

        footerDiv.appendChild(document.createTextNode("위험도: "));

        const bTag = document.createElement('b');
        bTag.textContent = log.severity;
        footerDiv.appendChild(bTag);

        footerDiv.appendChild(document.createTextNode(` (점수: ${log.scoreDelta})`));

        itemDiv.appendChild(headerDiv);
        itemDiv.appendChild(originDiv);
        itemDiv.appendChild(footerDiv);
        logArea.appendChild(itemDiv);
      });
    }
  });
});