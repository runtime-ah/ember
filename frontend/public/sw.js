self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data?.json() ?? {}; } catch { data = { body: e.data?.text() ?? "" }; }
  e.waitUntil(
    self.registration.showNotification(data.title ?? "Ember", {
      body: data.body ?? "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      data: { url: data.url ?? "./" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? "./";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) return w.focus();
      }
      return clients.openWindow(url);
    })
  );
});
