const CACHE_NAME = "still-open-release-20260711-v2-analytics-dev";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./mobile_ui.css",
  "./main.js",
  "./config/analytics.config.js",
  "./systems/AnalyticsSystem.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

function shouldUseNetworkFirst(request, requestUrl) {
  if (request.mode === "navigate") {
    return true;
  }

  if (["script", "style", "worker"].includes(request.destination)) {
    return true;
  }

  return /\.(?:js|css|html|json)$/i.test(requestUrl.pathname);
}

async function fetchNetworkFirst(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });

    if (response && response.status === 200 && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (_error) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.mode === "navigate") {
      return caches.match("./index.html");
    }

    return Response.error();
  }
}

async function fetchCacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    if (response && response.status === 200 && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (_error) {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    shouldUseNetworkFirst(event.request, requestUrl)
      ? fetchNetworkFirst(event.request)
      : fetchCacheFirst(event.request)
  );
});
