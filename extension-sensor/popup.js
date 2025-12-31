function openDashboardWithSession(sessionId) {
  let targetUrl = "local_dashboard/dashboard.html";
  
  if (sessionId) {
    targetUrl += `?sessionId=${sessionId}`;
  }
  
  chrome.tabs.create({ url: targetUrl });
}

function renderEmpty(element, msg) {
  const message = msg || "탐지된 위협이 없습니다.";
  element.innerHTML = `<div class="empty-state">${message}</div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get({ threatLogs: [], tabSessions: {} }, async (result) => {
    const logs = result.threatLogs;
    const tabSessions = result.tabSessions;

    const logArea = document.getElementById('log-area');
    const btn = document.getElementById('go-dashboard');

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

    const targetSessionId = tabSessions[tab.id];

    if (!targetSessionId) {
      renderEmpty(logArea, "현재 페이지에서 탐지된 위협이 없습니다.");
      return; 
    }

    const sessionLogs = logs.filter(log => log.sessionId === targetSessionId);

    const logsToDisplay = sessionLogs.sort((a, b) => b.ts - a.ts);
  
    logArea.innerHTML = logsToDisplay.map(log => {
      const timeStr = new Date(log.ts).toLocaleTimeString();
      const dataStr = JSON.stringify(log.data, null, 2).replace(/"/g, '').slice(0, 100);

      return `
        <div class="log-item ${log.severity}">
          <div class="log-header">
            <span>${log.type}</span>
            <span class="log-time">${timeStr}</span>
          </div>
          <div class="log-data">${dataStr}</div>
          <div style="margin-top:5px; font-size:11px; color:#888;">
              위험도: <b>${log.severity}</b> (점수: ${log.scoreDelta})
          </div>
        </div>
      `;
    }).join('');

    if (btn) {
      btn.addEventListener('click', () => {
        openDashboardWithSession(targetSessionId);
      });
    }
    });
});