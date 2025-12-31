/*경로 2개, real은 말 그대로 정상적인 원래 목적지,
ad는 pointdown시점에서 바뀌는 목적지*/
const REAL_PATH = "/real";
const AD_PATH = "/ad";

let enabled = true;//PoC on/off 상태값

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

//Reset 함수입니다. href를 다시 정상경로로 복구해줍니다.(데모사이트를 반복해서 실행할 때 있으면 좋을것 같아서 넣었습니다)
function resetHrefToReal() {
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
      swapHrefToAd();//DOM 속성 변경
    },
    { capture: true }
  );

  link.addEventListener(
    "mousedown",
    (e) => {
      if (!enabled) return;
      if (e.button !== 0) return;
      swapHrefToAd();//DOM 속성 변경
    },
    { capture: true }
  );

  //다시 원위치(데모 반복시행시 도움이 될것 같아서 넣음)
  link.addEventListener("click", () => {
    setTimeout(() => resetHrefToReal(), 0);
  });
}

//herf가 바뀌는 순간을 콘솔에 증거로 남겨주는 함수입니다. MutationObserver를 사용해봤습니다.
//저번에 말씀하신 MutationObserver를 사용해볼려고 했는데, 이걸 공격용으로 어떻게 사용하는지 감이 안잡혀서 콘솔기록용으로 써봤습니다.
function installHrefMutationObserver() {
  if (!link) return;
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "href") {
        console.log("[poc-d][mutation] href changed ->", link.getAttribute("href"));
      }
    }
  });
  obs.observe(link, { attributes: true, attributeFilter: ["href"] });
}

//최종완성, DOM이 완성된 순간 함수들 전부 설치
document.addEventListener("DOMContentLoaded", () => {
  setStatus();
  updateHrefView();

  installPreClickHook();
  installHrefMutationObserver();

  toggleBtn?.addEventListener("click", () => {
    enabled = !enabled;
    setStatus();
    if (!enabled) resetHrefToReal();
  });
});
