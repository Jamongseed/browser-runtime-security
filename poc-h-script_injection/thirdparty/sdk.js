(() => {
  const ORIGIN = "http://localhost:4000";
  console.log("[thirdparty sdk] loaded");//일단 로드되면 콘솔로 알려주기

  function injectAdWidget() {
    if (document.getElementById("adWidgetContainer")) return;//이미 열려있다면 종료(중복 방지)

    //광고위젯 구현
    const container = document.createElement("div");
    container.id = "adWidgetContainer";
    container.dataset.poc = "ad-widget";
    container.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 16px;
      width: 320px;
      height: 260px;
      z-index: 999999;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(0,0,0,0.25);
      background: white;
    `;
    
    //닫기버튼 구현
    const close = document.createElement("button");
    close.textContent = "닫기";
    close.setAttribute("aria-label", "close-ad");
    close.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 2;
      padding: 6px 10px;
      border-radius: 10px;
      border: 1px solid #ddd;
      background: rgba(255,255,255,0.95);
      cursor: pointer;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      font-size: 13px;
    `;

    //닫기 버튼에서 이벤트리스너로 클립 이벤트 대기(굳이 pointerdown일 필요는 없다고 생각했음)
    close.addEventListener("click", (e) => {
      e.preventDefault();//일단 멈추고(위젯이 닫히는 도중에 엉뚱한 이동이나 이벤트가 있을수도 있으니까)
      e.stopPropagation();//부모노드로 이벤트 전달도 막고(위젯 말고 메인페이지의 이벤트가 실수로 눌러질수도 있어서), 혹시 문제 생기면 지울 예정
      container.remove();//위젯 컨테이너 자체를 삭제하는 판정
      console.log("[thirdparty sdk] ad closed (container removed)");
    });//뭔가 로그가 안가거나 동작이 끊기면 아마 여기가 문제일거라 추측.......

    //iframe생성, 4000번 페이지가 담긴 창
    const iframe = document.createElement("iframe");//iframe 태그 생성, 객체도 생성
    iframe.src = `${ORIGIN}/widget.html`;//가져올 정확한 주소의 html파일
    iframe.style.cssText = "border:0;width:100%;height:100%;";//디자인
    iframe.setAttribute("title", "Ad Widget");//id랑은 다른거임, 브라우저에서 부르는 명칭이다.

    container.appendChild(close);//컨테이너 안에 만든 닫기버튼 집어넣기
    container.appendChild(iframe);//마찬가지
    document.documentElement.appendChild(container);//DOM트리에서 루트의 자식으로 완성된 컨테이너를 놓기, 여기서 document는 현재 사용자가 보고있는 페이지의 기준이라서 3000번 페이지의 html을 말하는거다.
  }

  document.addEventListener("DOMContentLoaded", injectAdWidget);//html이 완성되면 injectAdWidget 함수실행하쇼
})();
