/**
 * TaskFlow Service Worker
 * Strategy: cache-first for app shell, network-first for navigation.
 * No background revalidation fetches — this is a local-first app.
 * Only caches same-origin .html, .js, .css, and font files.
 */
const CACHE_NAME = 'taskflow-v2'
const CACHE_URLS = ['./', './index.html']

// Assets we bother caching (by extension)
function isCacheable(url) {
  const u = new URL(url)
  return /\.(js|css|html|woff2?|svg|png|ico|webmanifest)(\?|$)/.test(u.pathname)
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = request.url
  // Never intercept Google APIs or non-http
  if (!url.startsWith('http')) return
  if (url.includes('googleapis.com') || url.includes('accounts.google.com') ||
      url.includes('fonts.g') || url.includes('gstatic.com')) return

  // Navigation: network-first, fall back to cached index.html (SPA)
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(resp => {
          if (resp.ok) caches.open(CACHE_NAME).then(c => c.put(request, resp.clone()))
          return resp
        })
        .catch(() => caches.match('./index.html').then(r => r ?? Response.error()))
    )
    return
  }

  // Assets: cache-first, no background revalidation
  if (isCacheable(url)) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(resp => {
          if (resp.ok) caches.open(CACHE_NAME).then(c => c.put(request, resp.clone()))
          return resp
        })
      })
    )
  }
  // All other requests (API calls, HMR, etc.) — fall through to network naturally
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const w = list.find(c => c.url && !c.url.includes('about:blank'))
      return w ? w.focus() : clients.openWindow(self.registration.scope)
    })
  )
})
