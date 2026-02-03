import express from "express";
import path from "path";
import { fileURLToPath } from "url";

//경로 설정
const __filename = fileURLToPath(import.meta.url);//현재 파일의 경로(URL 처럼)
const __dirname = path.dirname(__filename);//현재 파일이 담긴 폴더 주소

//객체 생성
const app = express();

//4000번에 요청이 오면 제일먼저 thirdparty 폴더부터 조회(요청받았을 때 제일 우선)
app.use(express.static(path.join(__dirname, "thirdparty")));

app.get("/health", (req, res) => res.send("ok"));//서버 체크용

const port = process.env.PORT || 4000;
app.listen(port, () => console.log("THIRDPARTY listening on http://localhost:" + port));
