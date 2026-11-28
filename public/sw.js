/* eslint-disable no-restricted-globals */
/**
 * PhysioLingo v6 — Offline PWA Service Worker
 *
 * Caching policy:
 *  - /api/* & non-GET requests: NETWORK_ONLY (never cache auth/sync API calls)
 *  - Vite dev/HMR endpoints (/@vite, /@react-refresh, /src/, /node_modules/.vite): bypass SW
 *  - /models/** and /draco/*: CACHE_FIRST (instant 3D loading offline + background auto-cache)
 *  - HTML navigations: NETWORK_FIRST with cached "/" fallback for offline startup
 *  - Static assets (/assets/*, /favicon.svg, /manifest.webmanifest): STALE_WHILE_REVALIDATE
 */

const APP_CACHE_NAME = 'physiolingo-app-v9';
const MODELS_CACHE_NAME = 'physiolingo-models-v6';
const ACTIVE_CACHES = [APP_CACHE_NAME, MODELS_CACHE_NAME];

const FAST_INSTALL_URLS = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];

const DEFERRED_WARMUP_URLS = [
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
  '/models/layers/manifest.json',
  '/draco/draco_decoder.js',
  '/draco/draco_decoder.wasm',
  '/draco/draco_wasm_wrapper.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          FAST_INSTALL_URLS.map((url) =>
            fetch(url, { cache: 'no-cache' })
              .then((res) => {
                if (res && res.ok) {
                  return cache.put(url, res.clone());
                }
                return undefined;
              })
              .catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('physiolingo-') && !ACTIVE_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Warm up Draco decoders & icons in background without delaying SW activation / beforeinstallprompt
        caches.open(APP_CACHE_NAME).then((cache) => {
          DEFERRED_WARMUP_URLS.forEach((url) => {
            cache.match(url).then((existing) => {
              if (!existing) {
                fetch(url)
                  .then((res) => {
                    if (res && res.ok) cache.put(url, res.clone());
                  })
                  .catch(() => undefined);
              }
            });
          });
        });
      }),
  );
});

self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isViteDevPath(pathname) {
  return (
    pathname.startsWith('/@vite') ||
    pathname.startsWith('/@react-refresh') ||
    pathname.startsWith('/@fs/') ||
    pathname.startsWith('/@id/') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/')
  );
}

function isModelOrDracoPath(pathname) {
  return (
    (pathname.startsWith('/models/') && (pathname.endsWith('.glb') || pathname.endsWith('.json'))) ||
    pathname.startsWith('/draco/')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Only manage same-origin requests; leave external origins to normal browser handling
  if (url.origin !== self.location.origin) return;

  // Never intercept or cache backend API calls or Vite dev HMR modules
  if (url.pathname.startsWith('/api/') || isViteDevPath(url.pathname)) {
    return;
  }

  // 1. 3D Models (.glb), layers manifest, and Draco decoders -> CACHE_FIRST
  if (isModelOrDracoPath(url.pathname)) {
    const cacheName = url.pathname.endsWith('.glb') ? MODELS_CACHE_NAME : APP_CACHE_NAME;
    event.respondWith(
      caches.open(cacheName).then(async (cache) => {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;

        // Also check the other cache bucket just in case
        const fallbackCached = await caches.match(request, { ignoreSearch: true });
        if (fallbackCached) return fallbackCached;

        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          cache.put(request, networkResponse.clone()).catch(() => undefined);
        }
        return networkResponse;
      }),
    );
    return;
  }

  // 2. HTML document navigations -> NETWORK_FIRST (bypassing browser HTTP cache) with cached "/" fallback
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches
              .open(APP_CACHE_NAME)
              .then((cache) => cache.put('/', copy))
              .catch(() => undefined);
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedRoot = await caches.match('/');
          if (cachedRoot) return cachedRoot;
          return new Response(
            '<!doctype html><html lang="pl"><meta charset="utf-8"><title>PhysioLingo Offline</title><body style="font-family:sans-serif;padding:24px;background:#f4faf6;color:#064e3b"><h1>PhysioLingo — Tryb offline</h1><p>Połącz się jednorazowo z siecią, aby zapisać aplikację i modele 3D w pamięci urządzenia.</p></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
          );
        }),
    );
    return;
  }

  // 3. Static built assets (/assets/*, /icons/*, favicon, manifest) -> STALE_WHILE_REVALIDATE
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      caches.open(APP_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              cache.put(request, networkResponse.clone()).catch(() => undefined);
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      }),
    );
  }
});
