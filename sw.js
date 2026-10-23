/* Haramain offline support.
   Pages: network first, cached copy only when offline (so a new deploy is always picked up).
   Versioned files (?v=), icons, logo and onboarding photos: cache first.
   Server functions (payments, prices, live location, AI…) are never cached. */
var CACHE = 'haramain-v1';
var SHELL = ['/', '/index.html', '/logo.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
var LIVE = /^\/(approve|complete|cancel-payment|pi-price|fx|ai|alerts|live|family|lf|quran|quran-audio|validation-key\.txt)(\/|$|\?)/;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET') return;
  var u = new URL(r.url); if (u.origin !== self.location.origin) return;
  if (LIVE.test(u.pathname)) return;
  var stat = /[?&]v=/.test(u.search) || /^\/(icons|onboarding)\//.test(u.pathname) || u.pathname === '/logo.svg';
  if (stat) {
    e.respondWith(caches.match(r).then(function (hit) {
      return hit || fetch(r).then(function (res) { if (res && res.ok) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); } return res; });
    }));
    return;
  }
  e.respondWith(fetch(r).then(function (res) {
    if (res && res.ok) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); }
    return res;
  }).catch(function () {
    return caches.match(r).then(function (hit) { return hit || (r.mode === 'navigate' ? caches.match('/index.html').then(function (h) { return h || caches.match('/'); }) : Response.error()); });
  }));
});
