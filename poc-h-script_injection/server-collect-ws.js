//웹소켓이 연결된 수집 서버(웹소켓 대기소? 느낌), injected.js가 주는 정보를 받는 곳
import { WebSocketServer } from "ws";

const port = process.env.PORT || 5000;

//웹소켓이라기보다는 서버 객체라고 이해하면 편하다. 외부에서 요청이 오는지 감시하는 감시자 객체임
const wss = new WebSocketServer({ port });//5000번 포트에 감시자? 객체 생성

console.log("COLLECTOR(WS) listening on ws://localhost:" + port);

const events = [];
const MAX_EVENTS = 2000;

wss.on("connection", (socket) => {  //connection이 발생하면 'socket'이라는 웹소켓 객체 생성
  console.log("[collector] client connected");

  //소켓객체의 콜백함수 예약
  socket.on("message", (raw) => {   //그리고 생성된 웹소켓 객체인 socket은 "message"데이터를 받으면 'raw'에 일단 저장, 이후에 json으로 정리할꺼임
    try {
      const msg = JSON.parse(raw.toString("utf8"));//raw를 json으로 파싱해서 msg에 저장
      events.push(msg);//events에 msg를 push
      if (events.length > MAX_EVENTS) events.shift();//2000개 넘어가면 오래된것 부터 지움

      //일단 json이니까 분류는 하는데, 없으면 그냥 기본값으로 공백이나 - 같은걸로 두도록 설정
      const et = msg?.eventType || "UNKNOWN";
      const sid = msg?.sessionId || "-";
      const c = msg?.counter ?? "";
      console.log("[collector]", et, sid, c);
    } catch {
      //일단 서버가 죽지 않느게 좋으니까 에러는 못본척 하겠습니다.
    }
  });
  //마찬가지로 닫힐때 콘솔 찍도록 콜백함수 예약
  socket.on("close", () => console.log("[collector] client disconnected"));
});
