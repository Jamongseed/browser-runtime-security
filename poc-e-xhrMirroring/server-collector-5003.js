//구조는 5001이랑 동일함
const express = require('express');

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.sendStatus(204);

  next();
});

app.use(express.json({ limit: '256kb' }));

app.post('/mirror', (req, res) => {
  const p = req.body || {};
  console.log(`[COLLECTOR 5003]`, JSON.stringify({
    type: p.type,
    sid: p.sid,
    seq: p.seq,
    method: p.method,
    url: p.url,
    contentType: p.contentType || '',
    bodyKind: p.bodyKind,
    bodySize: p.bodySize,
    ts: p.ts
  }));
  res.json({ ok: true });
});

app.listen(5003, () => console.log(`COLLECTOR 5003 listening on http://localhost:5003`));
