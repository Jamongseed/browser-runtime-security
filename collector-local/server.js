import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());

// dumps는 스크립트 원문이 들어가서 커질 수 있음 (1mb면 잘릴 수 있음)
app.use(express.json({ limit: "10mb" }));

const events = [];
const dumps = []; // 메모리에도 최근 메타 저장(선택)

const STORAGE_DIR = path.join(process.cwd(), "storage");
const DUMPS_DIR = path.join(STORAGE_DIR, "dumps");

function ensureDirs() {
  try { fs.mkdirSync(STORAGE_DIR, { recursive: true }); } catch (_) {}
  try { fs.mkdirSync(DUMPS_DIR, { recursive: true }); } catch (_) {}
}
ensureDirs();

// --------------------
// events (기존)
// --------------------
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

// --------------------
// dumps (추가)
// --------------------
app.post("/dumps", (req, res) => {
  try {
    const ev = req.body || {};
    ev._ts = Date.now();

    const data = ev.data || {};
    const sha256 = String(data.sha256 || "");
    const text = String(data.text || "");
    const url = String(data.url || "");
    const norm = String(data.norm || "");

    if (!sha256 || !text) {
      return res.status(400).json({ ok: false, err: "missing data.sha256 or data.text" });
    }

    // 파일명 안전화: sha256 기반
    const base = sha256.replace(/[^a-f0-9]/gi, "").slice(0, 64) || "nohash";
    const ts = Date.now();
    const jsonPath = path.join(DUMPS_DIR, `${ts}_${base}.json`);
    const jsPath = path.join(DUMPS_DIR, `${ts}_${base}.js`);

    // 1) 메타+원문 전체를 json으로 저장
    fs.writeFileSync(jsonPath, JSON.stringify(ev, null, 2), "utf-8");

    // 2) 원문만 .js로도 저장(분석 편의)
    fs.writeFileSync(jsPath, text, "utf-8");

    // 메모리에는 텍스트 제외한 메타만 최근 N개 유지(선택)
    dumps.push({
      _ts: ev._ts,
      type: ev.type,
      page: ev.page,
      origin: ev.origin,
      targetOrigin: ev.targetOrigin,
      url,
      norm,
      sha256,
      length: data.length,
      contentType: data.contentType,
      via: data.via,
      truncated: data.truncated,
      files: { json: path.basename(jsonPath), js: path.basename(jsPath) },
    });
    if (dumps.length > 200) dumps.splice(0, dumps.length - 200);

    console.log("[dump]", sha256, norm || url, "->", path.basename(jsPath));
    return res.json({ ok: true, saved: { json: path.basename(jsonPath), js: path.basename(jsPath) } });
  } catch (e) {
    console.error("[dump] failed:", e);
    return res.status(500).json({ ok: false, err: String(e?.message || e) });
  }
});

app.get("/dumps", (req, res) => {
  res.json(dumps.slice(-200));
});

// health
app.get("/health", (req, res) => res.send("ok"));

app.listen(8080, () => console.log("collector listening on :8080"));
