// Service Worker for ADD SmartRegnskab PWA
// Feature-detected registration — fails gracefully in sandboxed iframes

const CACHE_NAME = "smartregnskab-v3.15.4";
const STATIC_ASSETS = ["/manifest.json", "/favicon.svg"];

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

  const url = new URL(event.request.url);

  // API-kald og HTML-navigationer må aldrig komme fra en gammel cache.
  if (url.pathname.includes("/api/") || event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => {
        if (event.request.mode === "navigate") {
          return new Response("ADD SmartRegnskab er offline. Forbind til internettet og prøv igen.", {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            status: 503,
          });
        }
        // Return offline indicator for API failures
        return new Response(JSON.stringify({ error: "Offline — forbindelsen skal genoprettes for at hente data" }), {
          headers: { "Content-Type": "application/json" },
          status: 503,
        });
      })
    );
    return;
  }

  // Cache-first er kun sikkert for versionshash'ede build-filer og faste ikoner.
  const cacheable = url.pathname.startsWith("/assets/") || STATIC_ASSETS.includes(url.pathname);
  if (!cacheable) return;
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
