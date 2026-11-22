/* MotoTrip V6.9.1 — online-first updates, offline-safe fallback.
 * Original application © 2026 Satish Kumar Gupta.
 * IMPORTANT: cache cleanup here does not delete trips/expenses in localStorage.
 */
const CACHE_NAME = 'mototrip-v8.0';
const PREVIOUS_CACHE_PREFIX = 'mototrip-';
const APP_SHELL = [
  './index.html','./app-update.js?v=80','./style.css?v=81',
  './app.js?v=81','./account.js?v=80','./split.js?v=80','./route.js?v=80','./ui.js?v=80',
  './exports.js?v=80','./firebase-config.js?v=80','./qr-code.js?v=80','./shared-ride.js?v=80','./group-gear.js?v=80','./safety.js?v=80','./qr-scanner.js?v=80',
  './report.html','./report.js?v=80','./privacy.html',
  './terms.html','./ownership.html','./manifest.json',
  './mt80-planner.js?v=81','./icon-192.png','./icon-512.png'
];
const appIndex = new URL('./index.html', self.registration.scope).href;

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // A newly deployed bundle must be complete before it replaces an old one.
    await cache.addAll(APP_SHELL.map(path => new Request(path, {cache: 'reload'})));
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
  // Query parameters should never make the HTML shell inaccessible offline.
  return new Request(url.origin + url.pathname);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const key = cacheKey(request);
    try {
      // Always fetch the newest HTML, JS, Firebase configuration, icons and CSS.
      // Avoid browser HTTP cache retaining old credentials/configuration or bundles.
      const response = await fetch(request, {cache: 'no-store'});
      if (!response.ok) throw new Error('Network response: ' + response.status);
      await cache.put(key, response.clone());
      return response;
    } catch (err) {
      const cached = await cache.match(key);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const offline = await cache.match(appIndex);
        if (offline) return offline;
      }
      return Response.error();
    }
  })());
});
