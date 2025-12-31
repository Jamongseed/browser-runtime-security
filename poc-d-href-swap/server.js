import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.send("ok"));

app.get("/real", (req, res) => {
  res.send(`
    <h1>REAL destination (PoC)</h1>
    <p>정상이라면 사용자는 이 페이지(/real)로 와야 합니다.</p>
    <p><b>하지만 이 PoC에서는</b> 클릭 직전에 href가 /ad로 바뀌어 이 페이지로 오지 않습니다.</p>
    <a href="/">Back</a>
  `);
});

app.get("/ad", (req, res) => {
  res.send(`
    <h1>AD destination (PoC)</h1>
    <p>PoC: 링크 href가 클릭 직전에 /ad로 바뀌어 이 페이지로 이동했습니다.</p>
    <a href="/">Back</a>
  `);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("poc-d-href-swap listening on", port));
