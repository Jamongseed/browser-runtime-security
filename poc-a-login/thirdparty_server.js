import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.get("/health", (req, res) => res.send("ok"));

app.get("/poc-a-thirdparty.js", (req, res) => {
  const p = path.join(__dirname, "thirdparty", "poc-a-thirdparty.js");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.sendFile(p);
});

app.get("/frame", (req, res) => {
  const ts = Date.now();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>PoC-A Thirdparty Frame</title>
</head>
<body>
  <h1>Thirdparty Frame</h1>
  <p>Loaded at ${ts}</p>

  <script>
    console.log("[PoC-A thirdparty frame] loaded", ${ts});
  </script>
</body>
</html>`);
});

app.get("/frame2", (req, res) => {
  const ts = Date.now();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>PoC-A Thirdparty Frame2</title>
</head>
<body>
  <h1>Thirdparty Frame2</h1>
  <p>Loaded at ${ts}</p>

  <script>
    console.log("[PoC-A thirdparty frame2] loaded", ${ts});
  </script>
</body>
</html>`);
});

const port = 4000;
app.listen(port, () => console.log("poc-a thirdparty listening on", port));