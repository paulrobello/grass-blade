/* global caches, self */

const CACHE_NAME = "grass-blade-v1";
const APP_SHELL_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./pwa-icon.svg",
  "./pwa-maskable-icon.svg",
  "./pwa-icon-180.png",
  "./pwa-icon-192.png",
  "./pwa-icon-512.png",
  "./pwa-maskable-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
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

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse !== undefined) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const responseCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
          }
          return networkResponse;
        })
        .catch(() => caches.match("./index.html"));
    }),
  );
});
