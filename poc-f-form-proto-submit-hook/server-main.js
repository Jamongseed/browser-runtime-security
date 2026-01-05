import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "server-site", "public")));

app.post("/login", (req, res) => {
  const u = req.body.u ?? "";
  const p = req.body.p ?? "";
  res.type("text").send(
    `OK /login\nu=${u}\np=${p.slice(0, 2)}***\n`
  );
});

app.listen(3000, () => console.log("server-site listening on :3000"));
