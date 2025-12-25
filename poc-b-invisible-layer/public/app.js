/**
 * PoC: "처음부터 존재하는 투명 클릭 레이어"
 * - 페이지 로드 직후 overlay를 생성/삽입
 * - 사용자가 어디를 클릭해도 overlay가 클릭을 먹고 /ad로 이동
 */

function makeInvisibleLayer() {
  const existing = document.getElementById("invisibleClickLayer");
  if (existing) return existing;

  //div 생성
  const layer = document.createElement("div");
  layer.id = "invisibleClickLayer";

  // (선택) 디버깅 편의: 개발자도구에서 쉽게 찾도록 dataset, 따로 관리할 예정 아니면 없어도 됨 어디까지나 실험용이니
  layer.dataset.poc = "invisible-overlay";

  // 첫 클릭만 먹고 "광고"로 이동 (로컬 /ad)
  // 현실 광고는 window.open을 쓰는 경우도 많지만, 안전하게 same-origin으로
  layer.addEventListener(
    "click",
    (e) => {
      e.preventDefault(); //기본동작을 막는 함수라고 합니다.
      e.stopPropagation(); //DOM 트리를 따라서 전파되는 이벤트를 막는 함수라고 하네요.

      // 한 번 클릭만 유도하려면 레이어를 제거하고 이동 (더 현실적)
      // 레이어가 계속 남아있으면 사용성이 너무 망가짐......이건 ㅇㅈ 너무 티난다
      layer.remove();

      // 이동
      window.location.href = "/ad"; //새 탭을 띄우는거면 window.open()으로 수정하면 될 것 같네요.
    },
    { capture: true } // 캡처 단계에서 먼저 먹기(더 악질) 일단 허용해두는거임
  );

  document.documentElement.appendChild(layer);//DOM구조에서 최상단에 추가되는 효과
  return layer;
}

//콘솔에서 사용할려고 만든거라는데, 없어도 될것 같습니다.
function removeInvisibleLayer() {
  document.getElementById("invisibleClickLayer")?.remove();
}

//app.js에서 즉시 실행되는 유일한 함수임
document.addEventListener("DOMContentLoaded", () => {
  // 핵심: 페이지 로드 직후 "이미 깔려있음"상태
  makeInvisibleLayer();

  // PoC 편의용 토글 버튼, gpt가 상태 확인용으로 구현한것 같은데, 없어도 될 것 같습니다.
  const toggle = document.getElementById("toggleOverlayBtn");
  toggle?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = document.getElementById("invisibleClickLayer");
    if (layer) removeInvisibleLayer();
    else makeInvisibleLayer();
    alert(`투명 레이어: ${layer ? "OFF" : "ON"}`);
  });
});
