// Offline cache for the driver photo report page (/report).
// The page posts the URLs it loaded; they are cached so the page opens with
// no signal. Pages and scripts: network first, cache when offline. Reports
// themselves are queued by the page in IndexedDB, not here.
const CACHE = "dhara-report-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("dhara-report-") && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "cache-urls" || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((u) => {
    try { return new URL(u, self.location.origin).origin === self.location.origin; } catch (e) { return false; }
  });
  event.waitUntil(caches.open(CACHE).then((cache) =>
    Promise.all(urls.map((u) => cache.add(new Request(u, { cache: "reload" })).catch(() => {})))
  ));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API calls go straight to the network
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: false }) || await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
