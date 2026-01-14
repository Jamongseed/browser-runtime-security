function openDashboard(installId) {
  const dashboardUrl = chrome.runtime.getURL("local_dashboard/dashboard.html");
  const params = new URLSearchParams();

  if (installId) params.append("installId", installId);

  const targetUrl = `${dashboardUrl}?${params.toString()}`;
  
  chrome.tabs.create({ url: targetUrl });
}

function renderEmpty(element, msg) {
  const message = msg || "탐지된 위협이 없습니다.";
  element.innerHTML = `<div class="empty-state">${message}</div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  // 설정 버튼 추가
  const settingsBtn = document.getElementById('go-settings');
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
    brs_threat_logs: [],
    brs_installId: null
  }, async (result) => {

    const logs = result.brs_threat_logs;
    const installId = result.brs_installId;

    const logArea = document.getElementById('log-area');
    const btn = document.getElementById('go-dashboard');

    if (btn) {
      btn.addEventListener('click', () => {
        openDashboard(installId);
      });
    }

    if (logs.length === 0) {
      renderEmpty(logArea);
      return;
    }
  
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // URL을 못 찾으면 그냥 빈 창 띄우기
    if (!tab || !tab.url) {
      renderEmpty(logArea);
      return;
    }

    const currentTabId = tab.id;
    const sessionLogs = logs.filter(log => {
    const severity = log.severity.toUpperCase();
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
  

    logArea.innerHTML = '';
    logsToDisplay.forEach(log => {
      const siteInfo = log?.browserUrl || log?.targetOrigin || "Internal/Page";

      const timeStr = new Date(log.ts).toLocaleTimeString();
      let dataStr = "";
      try {
        dataStr = JSON.stringify(log.data, null, 2).replace(/"/g, '').slice(0, 100);
      } catch (e) {
        dataStr = "Data Parsing Error";
      }

      const itemDiv = document.createElement('div');
      itemDiv.className = `log-item ${log.severity}`;

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

      const dataDiv = document.createElement('div');
      dataDiv.className = 'log-data';
      dataDiv.textContent = dataStr;

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
      // rawdata는 안 넣는 게 더 나을 것 같아서 일단 주석 처리
      // itemDiv.appendChild(dataDiv);
      itemDiv.appendChild(footerDiv);
      logArea.appendChild(itemDiv);
    });
  });
});