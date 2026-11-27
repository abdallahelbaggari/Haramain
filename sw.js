/* Haramain offline support.
   Pages and app files open at once from the phone; the newest copy is fetched in the background
   and used from the next opening (first visit and offline work the same way).
   Versioned files (?v=), icons, logo and onboarding photos: cache first.
   Server functions (payments, prices, live location, AI…) are never cached. */
var CACHE = 'haramain-v20';
var SHELL = ['/', '/index.html', '/logo.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
var LIVE = /^\/(approve|complete|cancel-payment|pi-price|fx|ai|alerts|live|family|lf|quran|quran-audio|verify|transfer|users|file|f|r|history|setup\.html|validation-key\.txt|recover|staff|report|merchants)(\/|$|\?)/;

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
  // app pages and files open at once from the phone and refresh in the background;
  // anything else (live data) stays network first, with the saved copy when offline
  var fileLike = r.mode === 'navigate' || /\.(js|css|json|png|jpe?g|webp|svg|ico|woff2?|html|webmanifest)$/.test(u.pathname);
  if (!fileLike) {
    e.respondWith(fetch(r).then(function (res) { if (res && res.ok) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); } return res; })
      .catch(function () { return caches.match(r).then(function (hit) { return hit || Response.error(); }); }));
    return;
  }
  e.respondWith(caches.match(r).then(function (hit) {
    if (hit) { refreshLater(e, r, hit); return hit; }
    return fetch(r).then(function (res) {
      if (res && res.ok && !res.redirected) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); }
      return res;
    }).catch(function () { return r.mode === 'navigate' ? caches.match('/index.html').then(function (h) { return h || caches.match('/'); }) : Response.error(); });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { if ('focus' in cs[i]) return cs[i].focus(); }
    return self.clients.openWindow ? self.clients.openWindow('/') : null;
  }));
});

function SKIP(u) { return LIVE.test(u.pathname) || !(/\.(js|css|json|png|jpe?g|webp|svg|ico|woff2?|html|webmanifest)$/.test(u.pathname) || u.pathname === '/' || u.pathname === '/wallet'); }
// the app sends the list of its own files once loaded, so the next opening needs no network
self.addEventListener('message', function (e) {
  var L = e.data && e.data.warm; if (!Array.isArray(L)) return;
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(L.slice(0, 120).map(function (p) {
      var u; try { u = new URL(p, self.location.origin); } catch (x) { return null; }
      if (u.origin !== self.location.origin || SKIP(u)) return null;
      return c.match(u.href).then(function (hit) { if (hit) return null; return fetch(u.href).then(function (res) { if (res && res.ok && !res.redirected) return c.put(u.href, res); }).catch(function () {}); });
    }));
  }));
});

// the saved copy is refreshed quietly, at most every 10 minutes and 20 seconds after opening,
// so sign-in and payments always get the connection first
function refreshLater(e, r, hit) {
  var d = hit.headers.get('date'), age = d ? Date.now() - Date.parse(d) : Infinity;
  if (age < 600000) return;
  e.waitUntil(new Promise(function (ok) { setTimeout(ok, 20000); }).then(function () {
    return fetch(r).then(function (res) { if (res && res.ok && !res.redirected) return caches.open(CACHE).then(function (c) { return c.put(r, res); }); });
  }).catch(function () {}));
}
