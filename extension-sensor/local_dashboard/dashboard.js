document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  
  // 두 가지 경우의 수를 다 받습니다.
  const targetReportId = params.get('reportId'); 
  const targetSessionId = params.get('sessionId'); 

  const contentDiv = document.getElementById('content');

  // 1. 스토리지에서 모든 로그 가져오기
  chrome.storage.local.get({ threatLogs: [] }, (result) => {
    const logs = result.threatLogs;

    if (logs.length === 0) {
      contentDiv.innerHTML = '<div id="error-msg">저장된 위협 로그가 없습니다.</div>';
      return;
    }

    let mainLog = null;

    // ---------------------------------------------------------
    // CASE A: 알림 클릭해서 들어옴 (?reportId=abc...)
    // ---------------------------------------------------------
    if (targetReportId) {
      mainLog = logs.find(l => l.reportId === targetReportId);
    } 
    // ---------------------------------------------------------
    // CASE B: 팝업에서 버튼 눌러서 들어옴 (?sessionId=xyz...)
    // ---------------------------------------------------------
    else if (targetSessionId) {
      // 해당 세션의 로그 중 '가장 최신 것'을 메인으로 잡음
      const sessionLogs = logs.filter(l => l.sessionId === targetSessionId);
      if (sessionLogs.length > 0) {
        // 최신순 정렬 후 첫 번째꺼 선택
        mainLog = sessionLogs.sort((a, b) => b.ts - a.ts)[0];
      }
    }

    // ---------------------------------------------------------
    // 결과 렌더링
    // ---------------------------------------------------------
    
    // 1. 타겟을 찾았으면 -> 상세 화면(타임라인 포함) 보여주기
    if (mainLog) {
      // 같은 세션의 모든 로그를 가져와서 타임라인 구성
      const relatedLogs = logs
        .filter(l => l.sessionId === mainLog.sessionId)
        .sort((a, b) => b.ts - a.ts);

      renderDetailView(mainLog, relatedLogs, contentDiv);
    } 
    // 2. 아무 파라미터도 없거나 못 찾았으면 -> 전체 목록(관리자뷰) 보여주기
    else {
      // 만약 특정 ID를 찾으려다 실패한 거면 에러 표시
      if (targetReportId || targetSessionId) {
         contentDiv.innerHTML = `
          <div id="error-msg">
            해당 세션의 로그가 삭제되었거나 존재하지 않습니다.<br>
            <a href="dashboard.html" class="view-btn" style="margin-top:20px; display:inline-block;">전체 목록 보기</a>
          </div>`;
      } else {
        renderSessionList(logs, contentDiv);
      }
    }
  });
});

// ==========================================
// [화면 1] 전체 목록 (파라미터 없을 때만 나옴)
// ==========================================
function renderSessionList(logs, container) {
  const sessionMap = {};
  logs.forEach(log => {
    if (!sessionMap[log.sessionId]) {
      sessionMap[log.sessionId] = {
        sessionId: log.sessionId,
        page: log.page || "Unknown Page",
        logs: [],
        lastTs: 0,
        maxSeverityScore: 0,
        maxSeverityLabel: "LOW"
      };
    }
    sessionMap[log.sessionId].logs.push(log);
    if (log.ts > sessionMap[log.sessionId].lastTs) sessionMap[log.sessionId].lastTs = log.ts;
    
    const score = (log.severity === "HIGH") ? 3 : (log.severity === "MEDIUM" ? 2 : 1);
    if (score > sessionMap[log.sessionId].maxSeverityScore) {
      sessionMap[log.sessionId].maxSeverityScore = score;
      sessionMap[log.sessionId].maxSeverityLabel = log.severity;
    }
  });

  const sortedSessions = Object.values(sessionMap).sort((a, b) => b.lastTs - a.lastTs);

  const listHtml = sortedSessions.map(sess => {
    const timeStr = new Date(sess.lastTs).toLocaleString();
    const latestReportId = sess.logs.sort((a,b)=>b.ts-a.ts)[0].reportId;

    return `
      <div class="log-item" style="display:block;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
           <div>
             <span class="badge ${sess.maxSeverityLabel}">${sess.maxSeverityLabel}</span>
             <span style="font-weight:bold; margin-left:5px;">${sess.page}</span>
           </div>
           <a href="dashboard.html?sessionId=${sess.sessionId}" class="view-btn">이 세션 보기 ></a>
        </div>
        <div style="font-size:13px; color:#666; display:flex; justify-content:space-between;">
           <span>Session: ${sess.sessionId.substring(0,10)}...</span>
           <span>${timeStr} (${sess.logs.length}건)</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <header><h1>🛡️ 전체 탐지 목록</h1></header>
    <div class="timeline-section" style="border:none;">${listHtml}</div>
  `;
}

// ==========================================
// [화면 2] 상세 뷰 (특정 세션만 보여줌)
// ==========================================
function renderDetailView(log, relatedLogs, container) {
  const timeStr = new Date(log.ts).toLocaleString();
  const evidenceJson = JSON.stringify(log.evidence || log.data || {}, null, 2);

  // 타임라인 아이템들 생성
  const timelineHtml = relatedLogs.map(item => {
    const isCurrent = item.reportId === log.reportId; 
    const itemTime = new Date(item.ts).toLocaleTimeString();
    
    return `
      <div class="log-item ${isCurrent ? 'active' : ''}">
        <div class="log-info">
          <span class="badge ${item.severity}" style="font-size:11px; padding:2px 8px; min-width:50px; text-align:center;">${item.severity}</span>
          <span class="log-time" style="width:100px;">${itemTime}</span>
          <span class="log-type">${item.type}</span>
        </div>
        ${isCurrent 
          ? `<span style="font-size:12px; font-weight:bold; color:#00C851;">보고 중</span>` 
          : `<a href="dashboard.html?reportId=${item.reportId}" class="view-btn">상세보기</a>`
        }
      </div>
    `;
  }).join('');

  // 전체 HTML 조립
  container.innerHTML = `
    <header>
      <div style="display:flex; align-items:center;">
        <a href="dashboard.html" class="view-btn" style="margin-right:15px;">← 전체 목록</a>
        <div>
           <span style="font-size:12px; color:#888; display:block;">Current Session: ${log.sessionId}</span>
           <h1 style="margin:5px 0 0 0; font-size:20px;">${log.type}</h1>
        </div>
      </div>
      <div style="text-align:right;">
        <span class="badge ${log.severity}" style="font-size:14px;">${log.severity}</span>
      </div>
    </header>

    <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #ddd; margin-bottom:20px;">
      <table class="meta-table" style="margin:0;">
        <tr><th>탐지 시간</th><td>${timeStr}</td></tr>
        <tr><th>URL</th><td class="url-text">${log.page}</td></tr>
        <tr><th>위험 점수</th><td>${log.scoreDelta || 0}</td></tr>
      </table>
    </div>

    <h3 style="margin-bottom:10px;">🔍 상세 데이터 (Evidence)</h3>
    <pre class="code-box" style="max-height:300px; overflow-y:auto;">${evidenceJson}</pre>

    <div class="timeline-section">
      <h3 class="timeline-title">
        🕒 이 세션의 탐지 기록 (${relatedLogs.length}건)
      </h3>
      <div class="timeline-list">
        ${timelineHtml}
      </div>
    </div>
  `;
}