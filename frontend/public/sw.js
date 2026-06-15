// Minimal service worker — satisfies Chrome/Safari PWA installability requirements.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));
self.addEventListener("fetch", () => {});
