//후킹 js로드 되도록 간단히만
const express=require('express');
const app=express();
app.use(express.static('hook'));
app.listen(4000,()=>console.log('HOOK server listening on http://localhost:4000'));
