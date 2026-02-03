import express from "express";
import path from "path";
import { fileURLToPath } from "url";

//경로랑 이름 지정해두기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//express객체 생성
const app = express();
app.use(express.urlencoded({ extended: true }));//post에 담긴거 열어야 돼서 필요함

//index.html 안의 <script src="http://localhost:4000/sdk.js">를 신뢰하고 여기 URL로 http요청을 보냄
app.get("/sdk.js", (req, res) => {
  res
    .type("application/javascript")//응답헤더에 언급을 줘서 텍스트가 아니라 스크립트로 실행하게 만듬, 사실 없어도 알아서 해결한다고 합니다. 그래도 명시적인게 좋아서 일단 있는게 좋은것 같네요.
    .sendFile(path.join(__dirname, "thirdparty", "sdk.js"));//sdk.js의 내용을 바로 V8로 넘긴다. 헤더에서 JS라고 언급을 해줬기 때문임
});

//광고 창 구현, 이후 sdk.js가 iframe을 만들어서 iframe.src = http://localhost:4000/widget.html로 지정합니다.
app.get("/widget.html", (req, res) => {
  res
    .type("text/html")
    .sendFile(path.join(__dirname, "thirdparty", "widget.html"));
});

//서버 상태 체크용(없어도 됨)
app.get("/health", (req, res) => res.send("ok"));


//PoC 엔드포인트 구현, 주소 이름만 collect입니다. 수집 구현은 안했음....
//submit 직전 action이 바뀌면 여기로 post가 오게 됩니다.
app.post("/collect", (req, res) => {
  console.log("[THIRDPARTY collect]", {
    ip: req.ip,
    ua: (req.get("user-agent") || "").slice(0, 120),
    ref: (req.get("referer") || "").slice(0, 200),
    keys: Object.keys(req.body || {})
  });

  res.send(`
    <h1>Collected (PoC - THIRDPARTY)</h1>
    <p><b>포인트:</b> 사용자는 :3000(정상 페이지)에서 로그인 버튼을 눌렀지만, 광고를 눌렀기 때문에 제출이 :4000으로 도착했습니다.</p>
    <p>이 PoC는 자격증명을 저장하지 않습니다. (콘솔에 key 목록이 출력되어 있을겁니다.)</p>
    <a href="http://localhost:3000/">Back to main</a>
  `);
});

//PoC 포트는 4000번으로 했습니다.
const port = process.env.PORT || 4000;
app.listen(port, () => console.log("THIRDPARTY(PoC) listening on", port));//4000번에서 실행중
