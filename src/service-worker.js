/* Build stamps the cache, app version and precache list. No remote assets, auth traffic or card data. */
const CACHE_PREFIX = '__CACHE_PREFIX__'
const CACHE_NAME = CACHE_PREFIX + '__BUILD_ID__'
const APP_VERSION = '__APP_VERSION__'
const APP_BASE_PATH = '__APP_BASE_PATH__'
const APP_INDEX_URL = '__APP_INDEX_URL__'
const PRECACHE_URLS = __PRECACHE_URLS__
const PRECACHE_PATHS = new Set(PRECACHE_URLS)

function withinApp(pathname) { return pathname.startsWith(APP_BASE_PATH) }
function appRelativePath(pathname) { return pathname.slice(APP_BASE_PATH.length - 1) }
function appUrl(path) { return new URL(path.replace(/^\/+/, ''), new URL(APP_BASE_PATH, self.location.origin)) }

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
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage({ version: APP_VERSION })
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || !withinApp(url.pathname) || /^\/(?:api|__)\//.test(appRelativePath(url.pathname))) return
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) return response
      } catch { /* The cached shell renders the requested route and query offline. */ }
      return await (await caches.open(CACHE_NAME)).match(APP_INDEX_URL) ?? new Response('Kanso Pro is not cached on this device yet. Reconnect and open the app once to enable offline use.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    })())
    return
  }
  if (!PRECACHE_PATHS.has(url.pathname)) return
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

// No push subscription or scheduler: these are user-permitted, page-generated reminders.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const path = event.notification.data?.url || '/notifications'
    if (typeof path !== 'string' || path.length >= 4096 || !/^\/(?:notifications|settings(?:#about)?|calendar(?:\/[^/?#]+)?|tasks(?:\/[^/?#]+)?|projects(?:\/[^/?#]+)?)$/.test(path)) return
    const url = appUrl(path)
    const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(client => client.frameType !== 'nested' && withinApp(new URL(client.url).pathname))
    const client = windows.find(window => window.focused) || windows[0]
    if (client) {
      await client.focus()
      // Let the page protect an open form and route without a destructive navigation/reload.
      client.postMessage({ type: 'OPEN_NOTIFICATION', url: path, id: event.notification.data?.id })
    } else {
      if (typeof event.notification.data?.id === 'string') url.hash = `notification=${encodeURIComponent(event.notification.data.id)}`
      await self.clients.openWindow(url.href)
    }
  })())
})
