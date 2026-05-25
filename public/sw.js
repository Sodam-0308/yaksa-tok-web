/* 약사톡 서비스워커.
 * (A) 구독 단계의 install/activate 뼈대 + (B') 표시 단계에서 push/notificationclick 구현.
 * 발송 측 payload: JSON 문자열 { title, body, url } — /api/push/send-near 와 형식 일치.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch (_e) {
      return {};
    }
  })();
  const title = payload.title || "약사톡 알림";
  const options = {
    body: payload.body || "",
    data: { url: payload.url || "/mypage" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url =
        (event.notification.data && event.notification.data.url) || "/mypage";
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // 이미 열린 약사톡 탭이 있으면 거기로 이동 + focus, 없으면 새 창.
      for (const client of allClients) {
        if ("focus" in client) {
          try {
            await client.navigate(url);
          } catch (_e) {
            // 일부 브라우저에서 navigate 실패 가능 — focus 만이라도 시도.
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })(),
  );
});
