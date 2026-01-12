const express = require('express');//호환성을 고려하면 require 방식이 더 안전하다고 하는데, 솔직히 잘 모르겠음. import express랑 똑같다고 하더라구요.

const app = express();//express객체 생성

app.use((req, res, next) => {
  //PoC구현이니까 CORS때문에 또 터지면 전체 허용으로 해보기 '*'(일단 보류)
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  //무조건 허락으로 답장하자
  if (req.method === 'OPTIONS') return res.sendStatus(204);

  next();
});

//저장까지는 구현 안하고, 그냥 들어온 정보를 자동으로 파싱해서 콘솔로그로 띄워주는 정도만 구현
app.use(express.json({ limit: '256kb' }));

//골고루 담자
app.post('/mirror', (req, res) => {
  const p = req.body || {};
  console.log(`[COLLECTOR 5001]`, JSON.stringify({
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

app.listen(5001, () => console.log(`COLLECTOR 5001 listening on http://localhost:5001`));
