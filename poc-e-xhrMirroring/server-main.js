//이유는 모르겠지만, require가 호환성이 더 안정적이다라고 해서 해봤슴. import도 상관없음
const express = require('express');
const multer = require('multer');

//객체 생성
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

//일단 use로 맨 처음 설정 좀 해두기
app.use(express.static('public'));
app.use('/api', (req, res, next) => {
  const sid = req.header('X-POC-Session') || '-';
  console.log(`[3000][api] ${req.method} ${req.originalUrl} sid=${sid} ct=${req.header('content-type') || '-'}`);
  next();
});
app.use('/api', express.json({ limit: '1mb' }));
app.use('/api', express.urlencoded({ extended: false }));


//이후 구현한 기능 4개 경로마다 기능 넣기
app.get('/api/products', (req, res) => {
  const { category = 'all', sort = 'popular', page = '1' } = req.query;
  res.json({ ok: true, category, sort, page: Number(page), items: [
    { id: 101, name: `${category}-item-1`, price: 19.99 },
    { id: 102, name: `${category}-item-2`, price: 29.99 }
  ]});
});

app.post('/api/cart/add', (req, res) => {
  res.json({ ok: true, receivedKeys: Object.keys(req.body || {}), size: JSON.stringify(req.body || {}).length });
});

app.post('/api/coupon/apply', (req, res) => {
  res.json({ ok: true, applied: true, receivedKeys: Object.keys(req.body || {}) });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  const f = req.file;
  res.json({ ok: true, received: {
    metaSize: (req.body && req.body.meta) ? String(req.body.meta).length : 0,
    file: f ? { originalname: f.originalname, mimetype: f.mimetype, size: f.size } : null
  }});
});


app.listen(3000, () => console.log('MAIN listening on http://localhost:3000'));
