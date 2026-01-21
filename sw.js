// sw.js - Network-first (HTML + JSON) + precache sicuro (NO "./")
const CACHE_NAME = "menu-sw-cache-v4";

// Precache SOLO entry reali (evita "./" che può fissare vecchi index)
const PRECACHE_URLS = [
  "./index.html",
  "./menu/",              // -> /menu/index.html
  "./menu_online.json",
  "./sw.js"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {})
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();

    // Forza refresh delle pagine aperte (aiuta tanto su iOS/Safari)
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach((client) => client.navigate(client.url).catch(() => {}));
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo stessa origin
  if (url.origin !== self.location.origin) return;

  const accept = req.headers.get("accept") || "";
  const isHTML = req.mode === "navigate" || accept.includes("text/html");
  const isJSON = url.pathname.endsWith("/menu_online.json") || url.pathname.endsWith("menu_online.json");

  if (isHTML || isJSON) {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // usa no-store per evitare risposte “intermedie” in cache del browser
    const fresh = await fetch(req, { cache: "no-store" });
    cache.put(req, fresh.clone()).catch(() => {});
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    return cached || new Response("Offline", { status: 503 });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  cache.put(req, fresh.clone()).catch(() => {});
  return fresh;
}
