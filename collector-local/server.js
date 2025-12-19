import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const events = [];

app.post("/events", (req, res) => {
  const ev = req.body || {};
  ev._ts = Date.now();
  events.push(ev);

  console.log("[event]", ev.type, ev.pageOrigin || ev.origin || "", ev.data || {});
  res.json({ ok: true });
});

app.get("/events", (req, res) => {
  res.json(events.slice(-200));
});

app.get("/health", (req, res) => res.send("ok"));

app.listen(8080, () => console.log("collector listening on :8080"));

