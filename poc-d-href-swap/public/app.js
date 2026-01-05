/*경로 2개, real은 말 그대로 정상적인 원래 목적지,
ad는 pointdown시점에서 바뀌는 목적지*/
const REAL_PATH = "/real";
const AD_PATH = "/ad";

let enabled = true;//PoC on/off 상태값
let swapped = false; //스왑 중복 체크용 플래그
let demoMode = true; //네비게이션 막고 직접 이동하는 용도로 만듬

//조작할 태그들 몇개 자바스크립트 객체로 따로 빼두기
const link = document.getElementById("baitLink");
const hrefView = document.getElementById("hrefView");
const statusEl = document.getElementById("status");
const toggleBtn = document.getElementById("toggleBtn");

//화면에 on/off로 상태표시(편의성으로 만든 기능입니다)(수동으로 조작해 볼수 있습니다.)
function setStatus() {
  if (statusEl) statusEl.textContent = enabled ? "ON" : "OFF";
}

//현재 링크의 목적지를 화면에 보여주기 위해 만들었습니다.(사실 얘도 편의성 기능임)
function updateHrefView() {
  if (!hrefView || !link) return;
  try {
    const u = new URL(link.href, window.location.href);
    hrefView.textContent = u.pathname;
  } catch {
    hrefView.textContent = link.getAttribute("href") || "";
  }
}

//href 바꿔치기를 하는 장본인
function swapHrefToAd() {
  if (!link) return;
  link.setAttribute("href", AD_PATH);//DOM 속성 변경하기
  updateHrefView();//바꼈다면 view 업데이트 반영
  console.log("[poc-d] href swapped to", AD_PATH);
}

//이후 스왑 중복 방지용으로 설계
function swapHrefToAdOnce() {
  if (swapped) return;   //이미 이번 클릭에서 swap 했으면 무시
  swapped = true;
  swapHrefToAd();
}

//Reset 함수입니다. href를 다시 정상경로로 복구해줍니다.(데모사이트를 반복해서 실행할 때 있으면 좋을것 같아서 넣었습니다)
function resetHrefToReal() {
  swapped = false; //swap플래그도 초기화 해줘야 함
  if (!link) return;
  link.setAttribute("href", REAL_PATH);
  updateHrefView();
  console.log("[poc-d] href reset to", REAL_PATH);
}


//클릭 직전에 href를 바꾸기 위한 이벤트 훅 설치해두기
function installPreClickHook() {
  if (!link) return;
  //어쩔지 몰라서 pointerdown이랑 mousedown이랑 그냥 둘다 넣었습니다.
  link.addEventListener(
    "pointerdown",
    (e) => {
      if (!enabled) return;
      if (e.button !== undefined && e.button !== 0) return;
      swapHrefToAdOnce();//DOM 속성 변경
    },
    { capture: true }
  );

  link.addEventListener(
    "mousedown",
    (e) => {
      if (!enabled) return;
      if (e.button !== 0) return;
      swapHrefToAdOnce();//DOM 속성 변경
    },
    { capture: true }
  );

  //다시 원위치(데모 반복시행시 도움이 될것 같아서 넣음)
  link.addEventListener(
      "click", 
      (e) => {
          if(!enabled) return;//일단 off면 빠꾸

          if(demoMode){
              e.preventDefault();//기본이동을 일단 멈추고
              const to = link.href;//preclickHook에서 이미 ad로 바뀐 상태의 주소를 to에 저장
              resetHrefToReal();//이제 리셋하고(약간 증거인멸 느낌?)
              setTimeout(()=>{
                  window.location.assign(to);//잠깐 지연 후(쫄려서 넣었음....), 직접 이동하기
              }, 150);}         
      },
      {capture: true}
  );
}

//herf가 바뀌는 순간을 콘솔에 증거로 남겨주는 함수입니다. MutationObserver를 사용해봤습니다.
function installHrefMutationObserver() {
  console.log("[poc-d] installHrefMutationObserver mounted");
  if (!link) return;

  //먼저 발생한 down 이벤트 기준 시각
  let firstDownAt = 0;

  function markFirstDown(type) {
    if (firstDownAt !== 0) return; // 이미 기록됐으면 무시하도록 만들기
    firstDownAt = performance.now();
  }

  // pointerdown
  link.addEventListener(
    "pointerdown",
    () => {
      markFirstDown("pointerdown");
    },
    { capture: true }
  );

  // mousedown
  link.addEventListener(
    "mousedown",
    () => {
      markFirstDown("mousedown");
    },
    { capture: true }
  );

  //href 변경을 감지하고, 이벤트 이후 차이만큼 delta(ms) 출력
  const obs = new MutationObserver((mutations) => {
    const now = performance.now();

    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "href") {
        const href = link.getAttribute("href");

        const deltaMs =
          firstDownAt > 0 ? Math.round(now - firstDownAt) : null;

        console.log("[poc-d][mutation] href changed ->", href, {
          delta_ms: deltaMs,  // down 이벤트 이후 몇 ms 만에 변경됐는지
        });

        //종료 후 초기화
        firstDownAt = 0;
      }
    }
  });

  obs.observe(link, { attributes: true, attributeFilter: ["href"] });
}



//최종완성, DOM이 완성된 순간 함수들 전부 설치
document.addEventListener("DOMContentLoaded", () => {
  installHrefMutationObserver();//얘를 제일 먼저 둬야 delta_ms가 인식이 됨..... 심지어 1ms 뜸

  setStatus();
  updateHrefView();

  installPreClickHook();
  
  toggleBtn?.addEventListener("click", () => {
    enabled = !enabled;
    setStatus();
    if (!enabled) resetHrefToReal();
  });
});
