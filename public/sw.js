const CACHE_NAME = 'sanbi-v0.1.3'
const STATIC_ASSETS = ['/']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(STATIC_ASSETS)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')))
    return
  }

  if (request.method !== 'GET') return

  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached

    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      try {
        await cache.put(request, response.clone())
      } catch (err) {
        console.warn('Cache.put failed:', err)
      }
    }
    return response
  })())
})
