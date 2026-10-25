// Offline support: keep the app and its libraries on the phone after the first visit.
const CACHE = "food-score-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const LIBS = [
  "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js",
  "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",
  "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    await Promise.all(LIBS.map(u => c.add(new Request(u, { mode: "cors" })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Product lookups always go to the network
  if (url.hostname.endsWith("openfoodfacts.org")) return;
  const sameOrigin = url.origin === self.location.origin;
  const cdn = url.hostname === "cdn.jsdelivr.net";
  if (!sameOrigin && !cdn) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: sameOrigin });
    // Library files never change at a pinned version, so a cached copy is final
    if (hit && cdn) return hit;
    const fresh = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; });
    if (hit) {
      // App files refresh in the background for next time
      e.waitUntil(fresh.catch(() => {}));
      return hit;
    }
    return fresh;
  })());
});
