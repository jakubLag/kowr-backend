const TILE_CACHE_NAME = "kowr-map-tiles-v2";

const TILE_HOSTS = [
  "mapy.geoportal.gov.pl",
  "integracja.gugik.gov.pl",
  "server.arcgisonline.com",
  "services.arcgisonline.com",
  "tile.openstreetmap.org",
];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("kowr-map-tiles-") && k !== TILE_CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isMapTileRequest(urlStr) {
  try {
    const url = new URL(urlStr);
    return TILE_HOSTS.some((host) => url.hostname.endsWith(host));
  } catch {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !isMapTileRequest(request.url)) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(TILE_CACHE_NAME);
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        const networkResponse = await fetch(request);
        if (
          networkResponse &&
          (networkResponse.status === 200 || networkResponse.type === "opaque")
        ) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        return Response.error();
      }
    })()
  );
});
