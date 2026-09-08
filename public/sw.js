// Service Worker for ADD SmartRegnskab PWA
// Feature-detected registration — fails gracefully in sandboxed iframes

const CACHE_NAME = "smartregnskab-v1.2.0";
const STATIC_ASSETS = ["/", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Network-first strategy for API calls
  if (event.request.url.includes("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return offline indicator for API failures
        return new Response(JSON.stringify({ error: "Offline — data synkroniseres når forbindelsen er genoprettet" }), {
          headers: { "Content-Type": "application/json" },
          status: 503,
        });
      })
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "ADD SmartRegnskab", {
      body: data.body || "",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: data.url || "/",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow(event.notification.data || "/");
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "smartdrift-sync") {
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        clientList.forEach((client) => client.postMessage({ type: "BACKGROUND_SYNC" }));
      })
    );
  }
});
