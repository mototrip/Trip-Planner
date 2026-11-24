/* MotoTrip V6.9.1 — online-first updates, offline-safe fallback.
 * Original application © 2026 Satish Kumar Gupta.
 * IMPORTANT: cache cleanup here does not delete trips/expenses in localStorage.
 */
const CACHE_NAME = 'mototrip-v9.28';
const PREVIOUS_CACHE_PREFIX = 'mototrip-';
const APP_SHELL = [
  './index.html','./app-update.js?v=80','./style.css?v=928',
  './app.js?v=928','./account.js?v=80','./split.js?v=928','./route.js?v=915','./ui.js?v=920',
  './exports.js?v=928','./firebase-config.js?v=80','./qr-code.js?v=80','./shared-ride.js?v=927','./group-gear.js?v=927','./safety.js?v=927','./qr-scanner.js?v=80',
  './report.html','./report.js?v=928','./privacy.html',
  './terms.html','./ownership.html','./manifest.json',
  './mt80-planner.js?v=923','./boot-ready.js?v=923','./icon-192.png','./icon-512.png'
];
const OPTIONAL_IMAGE_ASSETS = ['./assets/trip-himalayas.webp','./assets/traveling-obsession-banner.svg'];
const appIndex = new URL('./index.html', self.registration.scope).href;

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // A newly deployed bundle must be complete before it replaces an old one.
    await cache.addAll(APP_SHELL.map(path => new Request(path, {cache: 'reload'})));
    // Images are already embedded in index.html; don't block an update if
    // someone uploaded only the Quick Update files without assets/.
    await Promise.allSettled(OPTIONAL_IMAGE_ASSETS.map(path =>
      cache.add(new Request(path, {cache: 'reload'}))));
    // Do NOT force-activate a new version. The user chooses Update now or Later.
    // First install activates normally; upgrades stay waiting while an old client is open.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const previous = names.filter(n => n.startsWith(PREVIOUS_CACHE_PREFIX) && n !== CACHE_NAME);
    await Promise.all(previous.map(n => caches.delete(n)));
    await self.clients.claim();
    // Keep existing tabs unchanged. If the user approved Update now, the client
    // listens for controllerchange and reloads once on that explicit action.
  })());
});

function cacheKey(request) {
  if (request.mode !== 'navigate') return request;
  const url = new URL(request.url);
  // PWA root and index.html are the same cached application entry point.
  const pathname = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
  return new Request(url.origin + pathname);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const key = cacheKey(request);
    // Serve the versioned, atomic app bundle from the current service worker.
    // Network-first JS/CSS caused a half-rendered interface and taps before
    // handlers were installed when mobile networks were slow or intermittent.
    const cached = await cache.match(key);
    if (cached) return cached;
    try {
      const response = await fetch(request, {cache: 'no-store'});
      if (!response.ok) throw new Error('Network response: ' + response.status);
      // Non-shell local files (user-requested reports, etc.) can still be used offline.
      await cache.put(key, response.clone());
      return response;
    } catch (err) {
      if (request.mode === 'navigate') {
        const offline = await cache.match(appIndex);
        if (offline) return offline;
      }
      return Response.error();
    }
  })());
});
