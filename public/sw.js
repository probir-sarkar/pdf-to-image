const CACHE_NAME = "pdf2img-cache-v1"
const APP_SHELL = ["/", "/manifest.webmanifest", "/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k === CACHE_NAME ? undefined : caches.delete(k))))),
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const req = event.request

  // HTML navigations: try network, fallback to cache, then offline page
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone))
          return res
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME)
          return (await cache.match(req)) || (await cache.match("/offline.html"))
        }),
    )
    return
  }

  // Static assets: cache first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req)
        .then((res) => {
          const resClone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone))
          return res
        })
        .catch(() => cached) // last resort
    }),
  )
})
