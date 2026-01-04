import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.urlencoded({ extended: false }));

app.post("/collect", (req, res) => {
  console.log("[PoC-F] /collect", req.body);
  res.status(204).end();
});

app.use(express.static(path.join(__dirname, "server-thirdparty", "public")));

app.listen(4000, () => console.log("server-thirdparty listening on :4000"));
