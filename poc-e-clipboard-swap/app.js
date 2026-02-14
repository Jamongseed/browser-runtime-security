const VISIBLE_TEXT = "aaa.com";
const CLIPBOARD_TEXT = "bbb.com";

const visibleEl = document.getElementById("visibleText");
const copyBtn = document.getElementById("copyBtn");
const pasteBox = document.getElementById("pasteBox");
const statusEl = document.getElementById("status");

visibleEl.textContent = VISIBLE_TEXT;

function setStatus(msg, isErr = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("err", !!isErr);
}

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(CLIPBOARD_TEXT);//요즘 클립보드의 문제점, 그냥 봤을 때에는 수상한 행동이라고 정의할 수가 없다.
    setStatus('실제 클립보드에는 bbb.com이 복사되었습니다. Ctrl+V로 확인해보세요.');
    pasteBox.focus();
  } catch (err) {
    setStatus('클립보드 복사 실패: ${err?.message ?? String(err)}', true);
  }
});
