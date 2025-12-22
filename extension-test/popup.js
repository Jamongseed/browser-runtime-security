document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get({ threatLogs: [] }, (result) => {
      const logs = result.threatLogs;
      const logArea = document.getElementById('log-area');
      
      if (logs.length === 0) {
        logArea.innerHTML = '<div class="empty-state"> 탐지된 위협이 없습니다. 안전합니다.</div>';
        return;
      }
  
      const recentLogs = logs.slice(-10).reverse(); 
  
      logArea.innerHTML = recentLogs.map(log => {
        const timeStr = new Date(log.ts).toLocaleTimeString();
        const dataStr = JSON.stringify(log.data, null, 2).replace(/"/g, ''); 
  
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
    });
});