import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  next();
});

app.use(express.static(path.join(__dirname, "thirdparty")));

app.get("/health", (req, res) => res.send("ok"));

app.get("/mirror", (req, res) => {
  const d = req.query.d;
  if (d) {
    try {
      const msg = JSON.parse(decodeURIComponent(d));
      console.log("[mirror]", msg);
    } catch (e) {
      console.log("[mirror] bad d:", String(d).slice(0, 120));
    }
  }
  res.send("ok");
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log("THIRDPARTY listening on http://localhost:" + port));
