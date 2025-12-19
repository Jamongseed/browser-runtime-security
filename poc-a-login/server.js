import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.send("ok"));

app.post("/collect", (req, res) => {
  console.log("[collect] submit", {
    ip: req.ip,
    ua: (req.get("user-agent") || "").slice(0, 120),
    ref: (req.get("referer") || "").slice(0, 200),
    keys: Object.keys(req.body || {}),
  });

  res.send(`
    <h1>Received</h1>
    <p>PoC endpoint. No credentials are stored.</p>
    <a href="/">Back</a>
  `);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("poc-a listening on", port));

