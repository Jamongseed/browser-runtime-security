//정상페이지에도 app.js가 존재한다를 보여주기 위한 js입니다. 페이지 로드가 끝나면 로드 됐다고 상태 표시해주는 녀석입니다.
document.addEventListener("DOMContentLoaded", () => {
  const status = document.getElementById("status");
  if (status) status.textContent = "Ready. (main script loaded)";
});
