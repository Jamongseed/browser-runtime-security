import express from "express";
import path from "path";
import { fileURLToPath } from "url";

//파일경로, 폴더경로 일단 저장해두기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//express객체(서버 및 라우딩 등등 여러개 담당)를 일단 app이라고 저장하자
const app = express();

// 정적 파일 제공
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.send("ok")); //GPT가 서버가 떠있는데 접속이 안되는 경우를 확인하는 용도로 만들어두면 좋다고 해서 넣었습니다. 없어도 됨

//투명레이어 클릭 시 /ad로 이동하면 돌려줄 화면구현
app.get("/ad", (req, res) => {
  res.send(`
    <h1>Advertisement (PoC)</h1>
    <p>이 페이지는 PoC용 로컬 광고 페이지입니다.</p>
    <p><b>포인트:</b> 사용자는 “빈 화면 클릭”처럼 느꼈지만, 실제로는 투명 레이어가 클릭을 가로챘습니다.</p>
    <p>이 화면에 그럴싸한 가짜 사이트를 만들어놓거나 , 로그인 화면을 구현해 놓으면 개인정보를 입력할 우려가 있습니다.</p>
    <a href="/">Back</a>
  `);
});

//포트 설정
const port = process.env.PORT || 3000; //그냥 3000으로 해도 될것 같습니다. 어짜피 실험용이라서.......환경변수 port값을 따로 정하는거면 process.env.PORT 이런식으로 통일해도 될 것 같아요.

//실제로 서버 열기
app.listen(port, () => console.log("poc-b-invisible-layer listening on", port)); //console.log는 그냥 CMD에서 켜졌는지 확인할 수 있으면 좋으니까 넣었습니다.
