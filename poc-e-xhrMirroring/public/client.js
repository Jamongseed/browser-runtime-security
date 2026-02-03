(function () {
  //세션ID생성하고 상단에 띄우기
  document.getElementById('originLabel').textContent = location.origin;
  const sid = localStorage.getItem('poc_sid') || crypto.randomUUID();
  localStorage.setItem('poc_sid', sid);
  document.getElementById('sidLabel').textContent = sid;

  //XHR요청의 결과를 웹페이지 하단에 출력하기
  const tbody = document.querySelector('#logTable tbody');
  function addRow(r){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td class="mono">${r.t}</td><td class="mono">${r.method}</td><td class="mono">${r.url}</td><td class="mono">${r.ct||'-'}</td><td class="mono">${r.kind}</td><td class="mono">${r.size}</td><td class="mono">${r.status??'-'}</td>`;
    tbody.prepend(tr); while(tbody.children.length>25) tbody.removeChild(tbody.lastChild);
  }
  
  function xhrReq({method,url,headers={},body=null,kind="none"}){
    return new Promise((resolve)=>{
      const xhr=new XMLHttpRequest();
      xhr.open(method,url,true);
      xhr.setRequestHeader('X-POC-Session', sid);
      for(const [k,v] of Object.entries(headers)) xhr.setRequestHeader(k,v);
      const started=Date.now();
      xhr.onload=()=>{ addRow({t:new Date(started).toLocaleTimeString(),method,url,ct:headers['Content-Type']||'',kind,size: typeof body==="string"?body.length:(body?1:0),status:xhr.status}); resolve(); };
      xhr.onerror=()=>{ addRow({t:new Date(started).toLocaleTimeString(),method,url,ct:headers['Content-Type']||'',kind,size: typeof body==="string"?body.length:(body?1:0),status:'ERR'}); resolve(); };
      xhr.send(body);
    });
  }

  document.getElementById('btnGetProducts').onclick=()=> {
    const c=document.getElementById('categorySel').value;
    const s=document.getElementById('sortSel').value;
    return xhrReq({method:'GET', url:`/api/products?category=${encodeURIComponent(c)}&sort=${encodeURIComponent(s)}&page=1`});
  };

  document.getElementById('btnAddCart').onclick=()=> {
    const productId=Number(document.getElementById('productId').value||123);
    const qty=Number(document.getElementById('qty').value||2);
    const body=JSON.stringify({productId,qty,variant:"black-270"});
    return xhrReq({method:'POST', url:'/api/cart/add', headers:{'Content-Type':'application/json'}, body, kind:'json-string'});
  };

  document.getElementById('btnApplyCoupon').onclick=()=> {
    const code=document.getElementById('coupon').value||'CAT10';
    const cartId=document.getElementById('cartId').value||'abc123';
    const body=`code=${encodeURIComponent(code)}&cartId=${encodeURIComponent(cartId)}`;
    return xhrReq({method:'POST', url:'/api/coupon/apply', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body, kind:'urlencoded-string'});
  };

  document.getElementById('btnUpload').onclick=()=> {
    const input=document.getElementById('uploadFile');
    const fd=new FormData();
    fd.append('meta', JSON.stringify({from:'poc',ts:Date.now()}));
    if(input.files && input.files[0]) fd.append('file', input.files[0]);
    else fd.append('file', new Blob([`dummy upload ${new Date().toISOString()}`],{type:'text/plain'}), 'poc-dummy.txt');
    return xhrReq({method:'POST', url:'/api/upload', body:fd, kind:'formdata'});
  };
})();