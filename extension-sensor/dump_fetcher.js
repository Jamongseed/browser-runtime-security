chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.action !== "BRS_FETCH_TEXT") return;

  (async () => {
    try {
      const r = await fetch(msg.url, { cache: "no-store" });
      const text = await r.text();
      sendResponse({
        ok: true,
        status: r.status,
        contentType: r.headers.get("content-type") || "",
        text,
      });
    } catch (e) {
      sendResponse({ ok: false, err: String(e?.message || e) });
    }
  })();

  return true;
});