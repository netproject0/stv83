/* ============================================================
   STV 83 — Service Worker
   Scope: /preprod/
   Strategy:
     - Cache-first  → static assets (CSS, JS, fonts, images)
     - Network-first with cache fallback → HTML pages
     - Offline fallback → inline message when both fail
   ============================================================ */

'use strict';

const CACHE_VERSION = 'stv83-v3';

const PRECACHE_ASSETS = [
  '/preprod/index.html',
  '/preprod/css/style.css',
  '/preprod/js/main.js',
  '/preprod/fonts/Inter-Regular.woff2',
  '/preprod/fonts/Inter-Bold.woff2',
  '/preprod/public/images/logo-noir.webp',
];

const STATIC_EXTENSIONS = /\.(css|js|woff2|webp|jpg|jpeg|png|svg|ico)(\?.*)?$/i;

/* ── INSTALL : pre-cache critical assets ──────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Take control immediately without waiting for old SW to stop
  self.skipWaiting();
});

/* ── ACTIVATE : clean up old caches ──────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Claim all existing clients so this SW takes effect immediately
  self.clients.claim();
});

/* ── FETCH ────────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests (POST, etc.)
  if (request.method !== 'GET') return;

  // Skip cross-origin requests — only cache same-origin
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isStaticAsset = STATIC_EXTENSIONS.test(requestUrl.pathname);
  const isHtmlPage    = request.headers.get('accept')?.includes('text/html')
                        || requestUrl.pathname.endsWith('.html')
                        || requestUrl.pathname.endsWith('/');

  if (isStaticAsset) {
    // Cache-first: serve from cache, fall back to network and cache the response
    event.respondWith(cacheFirst(request));
  } else if (isHtmlPage) {
    // Network-first: try network, fall back to cache, then offline page
    event.respondWith(networkFirstHtml(request));
  }
  // All other requests (non-static, non-HTML) go through normally
});

/* ── STRATEGY : Cache-first ───────────────────────────────── */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Nothing to fall back to for static assets — return a minimal error response
    return new Response('Asset unavailable offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/* ── STRATEGY : Network-first with cache fallback (HTML) ─── */
async function networkFirstHtml(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Network failed — try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Nothing cached — serve offline fallback
    return offlineFallback();
  }
}

/* ── OFFLINE FALLBACK ─────────────────────────────────────── */
function offlineFallback() {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hors ligne — STV 83</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter','Helvetica Neue',Arial,sans-serif;background:#FAFAF7;color:#222;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center}
    .card{max-width:400px;background:#fff;border:1px solid #E2E1DC;border-radius:4px;padding:2.5rem 2rem}
    h1{font-size:1.5rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:1rem;color:#1A1A1A}
    p{font-size:.9375rem;color:#6B6B6B;line-height:1.7;margin-bottom:1.5rem}
    a{display:inline-block;padding:.75rem 1.75rem;background:#C05200;color:#fff;font-weight:700;font-size:.875rem;text-transform:uppercase;letter-spacing:.08em;border-radius:4px;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <h1>Vous êtes hors ligne</h1>
    <p>Cette page n'est pas disponible sans connexion internet. Vérifiez votre réseau et réessayez.</p>
    <a href="/preprod/">Retour à l'accueil</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
