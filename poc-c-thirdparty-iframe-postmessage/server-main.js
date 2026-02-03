import express from "express";
import path from "path";
import { fileURLToPath } from "url";

//일단 사용하기 편하게 이름이랑 경로 지정해두기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//express객체 생성, app이 무난
const app = express();

//use로 제일 먼저 밑작업(맨 먼저 실행되니까)
app.use(express.urlencoded({ extended: true }));//post로 보낸 로그인정보는 body에 담겨있는데, express가 body에 담긴 id/pw를 기어이 열어서 포장해둘 수 있게 해줌
app.use(express.static(path.join(__dirname, "public")));//접근 권한 열기

//오류 났을 때 서버 문제인지 확인용임, 없어도 됨
app.get("/health", (req, res) => res.send("ok"));



//정상 로그인 요청 성공 했을때 뜨는 엔드포인트 구현, 그래도 로그인이니까 양심상 post로 구현
app.post("/login", (req, res) => {
  res.send(`
    <h1>Login OK (PoC - MAIN)</h1>
    <p>정상 흐름이라면 이 엔드포인트(:3000 /login)로 오게 됩니다.</p>
    <a href="/">Back</a>
  `);
});

//Main서버 포트 3000번으로 열어두고 listen상태로 두기
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("MAIN listening on", port));//전부 '함수 정의'지만 얘만 실행이다.(제가 헷갈리지 않으려고 메모한거라 신경쓰지마세요 ;;)
