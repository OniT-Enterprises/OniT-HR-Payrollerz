// Service Worker for Meza HR/Payroll
// Bump version to clear old caches after deployments
const CACHE_NAME = 'meza-v1';

// Install event - activate immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - runtime caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (Firebase, APIs, CDNs, etc.)
  if (url.origin !== self.location.origin) return;

  // 1. Navigation requests (HTML) — network only, always fresh index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        () =>
          caches.match('/') ||
          new Response('Offline - please check your connection', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
      )
    );
    return;
  }

  // 2. JS/CSS chunks — network first, fall back to cache
  if (url.pathname.startsWith('/assets/') && /\.(js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. Images and fonts — cache first (hashed filenames or static)
  if (/\.(png|jpg|jpeg|webp|svg|ico|gif|woff2)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. Everything else — network only
});

// Allow the app to trigger skipWaiting or cache clear
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearCache') {
    caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
  }
});
