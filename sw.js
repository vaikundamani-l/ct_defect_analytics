'use strict';
const CACHE_NAME = 'ct-defect-analytics-v1';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './enhancements.css',
  './engine.js',
  './app.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Do not intercept non-GET requests
  if (event.request.method !== 'GET') return;

  // Cache-first for CDN resources (Chart.js, SheetJS) and precached files
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(networkResponse => {
        // Cache successful external CDN assets or local scripts
        if (networkResponse && networkResponse.status === 200 && (
          url.origin === location.origin ||
          url.hostname.includes('cdn.jsdelivr.net') ||
          url.hostname.includes('cdn.sheetjs.com')
        )) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for HTML navigation when offline
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
