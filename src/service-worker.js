/* Build replaces these two placeholders. No remote assets, auth traffic or card data. */
const CACHE_PREFIX = 'kanso-pro-shell-'
const CACHE_NAME = CACHE_PREFIX + '__BUILD_ID__'
const PRECACHE_URLS = __PRECACHE_URLS__
const PRECACHE_PATHS = new Set(PRECACHE_URLS)

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)))
  // An update waits for consent or for all old app windows to close. Never discard a draft.
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const old = (await caches.keys()).filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    // Retain one prior shell for an already-open tab's lazy-loaded assets.
    await Promise.all(old.slice(0, -1).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || /^\/(?:api|__)\//.test(url.pathname)) return
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) return response
      } catch { /* The cached shell renders the requested route and query offline. */ }
      return await (await caches.open(CACHE_NAME)).match('/index.html') ?? new Response('Kanso Pro is not cached on this device yet. Reconnect and open the app once to enable offline use.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    })())
    return
  }
  if (!PRECACHE_PATHS.has(url.pathname) && !/^\/(?:assets|icons)\//.test(url.pathname)) return
  event.respondWith((async () => {
    const current = await caches.open(CACHE_NAME)
    const hit = await current.match(url.pathname)
    if (hit) return hit
    const old = (await caches.keys()).filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    for (const key of old.reverse()) {
      const previous = await (await caches.open(key)).match(url.pathname)
      if (previous) return previous
    }
    // Never cache arbitrary requests or overwrite an old shell's HTML with new HTML.
    return fetch(request)
  })())
})
