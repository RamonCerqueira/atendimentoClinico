const CACHE_NAME = 'cuidaamor-clinico-shell-v2'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([OFFLINE_URL, '/manifest.json', '/icon.svg', '/logo01.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }
  if (url.pathname === '/manifest.json' || url.pathname === '/icon.svg') {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)))
  }
})
