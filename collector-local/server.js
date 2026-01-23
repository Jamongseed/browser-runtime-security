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

const SCORE_LOW = 50;
const SCORE_HIGH = 80;

function ensureDirs() {
  try { fs.mkdirSync(STORAGE_DIR, { recursive: true }); } catch (_) {}
  try { fs.mkdirSync(DUMPS_DIR, { recursive: true }); } catch (_) {}
}
ensureDirs();

function computeInitialStatus(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return "STORED_ONLY"; // score 없으면 일단 저장만
  if (s >= SCORE_HIGH) return "MALICIOUS";
  if (s >= SCORE_LOW) return "PENDING_AI";
  return "STORED_ONLY";
}

function rankStatus(st) {
  switch (st) {
    case "MALICIOUS": return 3;
    case "PENDING_AI": return 2;
    case "STORED_ONLY": return 1;
    default: return 0;
  }
}

function promoteStatus(oldSt, newSt) {
  return rankStatus(newSt) > rankStatus(oldSt) ? newSt : oldSt;
}

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
    const score = data.score;

    if (!sha256 || !text) {
      return res.status(400).json({ ok: false, err: "missing data.sha256 or data.text" });
    }

    // 파일명 안전화: sha256 기반
    const base = sha256.replace(/[^a-f0-9]/gi, "").slice(0, 64) || "nohash";
    const jsonPath = path.join(DUMPS_DIR, `${base}.json`);
    const jsPath = path.join(DUMPS_DIR, `${base}.js`);
    const metaPath = path.join(DUMPS_DIR, `${base}.meta.json`);

    const now = Date.now();
    const incomingStatus = computeInitialStatus(score);
    let meta = null;
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      } catch (_) {
        meta = null;
      }
    }

    const isNew = !meta;
    if (isNew) {
      // 최초 수신: 원문/원본 이벤트 저장
      fs.writeFileSync(jsonPath, JSON.stringify(ev, null, 2), "utf-8");
      fs.writeFileSync(jsPath, text, "utf-8");

      meta = {
        artifactId: base,
        sha256: base,
        firstSeenTs: now,
        lastSeenTs: now,
        count: 1,
        maxScore: Number.isFinite(Number(score)) ? Number(score) : null,
        status: incomingStatus,
        ai: { status: "NOT_REQUESTED", verdict: null, updatedTs: null, error: null },
        sample: { url, norm, contentType: data.contentType || "", via: data.via || "" }
      };
    } else {
      // 중복 수신: 원문/원본 이벤트는 재저장하지 않고 메타만 갱신
      meta.lastSeenTs = now;
      meta.count = (meta.count || 0) + 1;
      const s = Number(score);
      if (Number.isFinite(s)) {
        meta.maxScore = (meta.maxScore == null) ? s : Math.max(meta.maxScore, s);
        meta.status = promoteStatus(meta.status, incomingStatus);
      }
    }

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");

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
      score,
      status: meta.status,
      count: meta.count,
      length: data.length,
      contentType: data.contentType,
      via: data.via,
      truncated: data.truncated,
      files: { json: path.basename(jsonPath), js: path.basename(jsPath), meta: path.basename(metaPath) },
    });
    if (dumps.length > 200) dumps.splice(0, dumps.length - 200);

    console.log("[dump]", isNew ? "NEW" : "DUP", sha256, "status=", meta.status, "count=", meta.count);
    return res.json({
      ok: true,
      deduped: !isNew,
      status: meta.status,
      count: meta.count,
      saved: { json: path.basename(jsonPath), js: path.basename(jsPath), meta: path.basename(metaPath) }
    });
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
