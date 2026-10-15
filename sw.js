/* ═══════════════════════════════════════════
   Infineon 2S3G — Service Worker
   Cache-first strategy for offline support
   ═══════════════════════════════════════════ */

const CACHE_NAME = 'fab2s3g-cache-v9';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',   // ← tambah
  './icon-maskable-512.png',   // ← tambah
  'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700;800&family=JetBrains+Mono:wght@600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

// ══ INSTALL: Cache semua file inti
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Service Worker terinstall, mulai cache...');
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting())
  );
});

// ══ ACTIVATE: Hapus cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ══ FETCH: Cache-first, network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Hanya cache GET request
  if (request.method !== 'GET') return;

  // Untuk font dan CDN, gunakan stale-while-revalidate
  const isFont = url.hostname.includes('fonts.') || url.hostname.includes('gstatic.');
  const isCDN = url.hostname.includes('cdn.');

  if (isFont || isCDN) {
    // Stale-while-revalidate: kasih cache dulu, lalu update dari network
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached || Response.error());
        return cached || networkFetch;
      })
    );
    return;
  }

  // Untuk app shell: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Fallback ke index.html untuk navigasi
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return Response.error();
        });
    })
  );
});

// ══ MESSAGE: Kontrol dari aplikasi
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearCache') {
    caches.delete(CACHE_NAME);
  }
});