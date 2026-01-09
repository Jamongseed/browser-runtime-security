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
    const sessionLogs = logs.filter(log => log.tabId === currentTabId);

    if (sessionLogs.length === 0) {
      renderEmpty(logArea, "이 탭과 관련된 위협 로그가 없습니다.");
      return;
    }

    const logsToDisplay = sessionLogs.sort((a, b) => b.ts - a.ts);
  

    logArea.innerHTML = '';
    logsToDisplay.forEach(log => {
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
      itemDiv.appendChild(dataDiv);
      itemDiv.appendChild(footerDiv);
      logArea.appendChild(itemDiv);
    });
  });
});