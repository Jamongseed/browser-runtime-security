import express from "express";
import path from "path";
import { fileURLToPath } from "url";

//경로 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//express 객체 생성
const app = express();

//동작 준비
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (req, res) => res.send("ok"));

const port = process.env.PORT || 3000;

//실제 실행 시작점
app.listen(port, () => console.log("MAIN listening on http://localhost:" + port));
