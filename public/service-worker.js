/* global caches, self */

const CACHE_NAME = "grass-blade-v4";
const CACHE_PREFIX = "grass-blade-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname === "/service-worker.js") {
    return;
  }

  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (requestUrl.pathname.startsWith("/assets/")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

function cacheFirst(request) {
  return caches.match(request).then((cachedResponse) => {
    if (cachedResponse !== undefined) {
      return cachedResponse;
    }

    return fetchAndCache(request);
  });
}

function networkFirst(request, fallbackUrl) {
  return fetchAndCache(request).catch(() =>
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse !== undefined) {
        return cachedResponse;
      }
      if (fallbackUrl !== undefined) {
        return caches.match(fallbackUrl);
      }
      return Response.error();
    }),
  );
}

function fetchAndCache(request) {
  return fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const responseCopy = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
    }
    return networkResponse;
  });
}
