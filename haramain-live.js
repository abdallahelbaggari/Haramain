/* Haramain — Live location, Family groups and the shared Lost & Found board.
   Uses the app's server (/live, /family, /lf, Cloudflare D1). If the database is not connected yet,
   each screen falls back to sharing by message so nothing is ever empty or broken. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K = window.K || 'hm_v1_';
  var get = function (k, d) { try { var v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  var put = function (k, v) { try { if (v === null) localStorage.removeItem(K + k); else localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var me = function () { return (typeof user !== 'undefined' && user && !user.guest) ? user.username : ''; };
  var ago = function (ts) { var s = Math.max(0, (Date.now() - ts) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; };
  var hav = function (a, b, c, d) { var R = 6371e3, r = Math.PI / 180, x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2); return 2 * R * Math.asin(Math.sqrt(x * x + Math.cos(a * r) * Math.cos(c * r) * y * y)); };
  var dist = function (m) { return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km'; };
  var origin = location.origin;
  var DB = get('dbok', null);   // null = unknown, true/false after the first server reply
  function api(path, body) {
    return fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.setup) { DB = false; put('dbok', false); } else if (d && d.ok !== undefined) { DB = true; put('dbok', true); } return d; });
  }
  function shareText(title, text) {
    if (navigator.share) { navigator.share({ title: title, text: text }).catch(function () {}); return; }
    try { hmSheet(title, '<div style="white-space:pre-wrap;margin-bottom:10px">' + esc(text) + '</div>', 'Send on WhatsApp', 'https://wa.me/?text=' + encodeURIComponent(text)); } catch (e) {}
  }

  /* ── map helper (Leaflet + OpenStreetMap), loaded only when a map is shown ── */
  var leafletP = null;
  function leaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletP) return leafletP;
    leafletP = new Promise(function (ok, no) {
      var c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(c);
      var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = function () { ok(window.L); }; s.onerror = no; document.head.appendChild(s);
    });
    return leafletP;
  }
  function makeMap(el, ll, z) {
    return leaflet().then(function (L) {
      if (el._map) return el._map;
      var m = L.map(el, { zoomControl: false, attributionControl: true }).setView(ll || [21.4225, 39.8262], z || 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
      el._map = m; setTimeout(function () { m.invalidateSize(); }, 200); return m;
    }).catch(function () { el.innerHTML = '<div class="empty">Map could not load. Check your connection.</div>'; return null; });
  }
  function dotIcon(color, label) {
    return L.divIcon({ className: 'hl-pin', html: '<span style="background:' + color + '">' + esc(label || '') + '</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
  }

  /* ════════ LIVE LOCATION ════════ */
  var T = { watch: null, pos: null, path: [], dist: 0, t0: 0, sess: get('live', null), lastSent: 0, lastSentPos: null, map: null, mk: null, line: null, timer: null };
  function zone(lat, lng) { try { var z = detectZone(lat, lng); return z && (z.name || z); } catch (e) { return ''; } }
  function trackerUI() {
    var sec = $('s-tracker'); if (!sec) return;
    var live = !!T.sess, on = !!T.watch;
    sec.innerHTML = '<div class="scr-top-bar"><div><div class="scr-top-title">📍 Live location</div><div class="scr-top-sub">See where you are · let your family follow you</div></div></div>' +
      '<div id="hl-map" class="hl-map"></div>' +
      '<div class="hl-stats"><div><b id="hl-d">' + dist(T.dist) + '</b><small>walked</small></div><div><b id="hl-t">' + (T.t0 ? Math.round((Date.now() - T.t0) / 60000) + ' min' : '0 min') + '</b><small>time</small></div><div><b id="hl-a">' + (T.pos ? '±' + Math.round(T.pos.acc) + ' m' : '—') + '</b><small>accuracy</small></div></div>' +
      '<div class="hl-zone" id="hl-zone">' + (T.pos ? '📍 ' + esc(zone(T.pos.lat, T.pos.lng) || 'Location found') : (on ? 'Finding your location…' : 'Tap Start to show where you are.')) + '</div>' +
      (on ? '<button type="button" class="btn btn-red" onclick="HML.stop()">■ Stop</button>' : '<button type="button" class="btn btn-gold" onclick="HML.start()">📍 Start</button>') +
      (DB !== false ? (live ? '<div class="hl-live"><b>🟢 Your family can follow you live</b><small>Link works until you tap Stop or for 12 hours.</small><div class="hl-row"><button type="button" class="btn btn-ghost btn-sm" onclick="HML.shareLink()">📤 Send link again</button></div></div>'
        : '<button type="button" class="btn btn-ghost" style="margin-top:8px" onclick="HML.goLive()">👨‍👩‍👧 Share live with family</button>') : '') +
      '<button type="button" class="btn btn-ghost" style="margin-top:8px" onclick="HML.shareOnce()">📤 Send my location now (one time)</button>' +
      '<div class="hm-note">Your position stays on this phone unless you share it. Keep Haramain open while sharing live.</div>';
    if (T.map) { try { T.map.remove(); } catch (e) {} T.map = T.mk = T.line = null; }
    makeMap($('hl-map'), T.pos ? [T.pos.lat, T.pos.lng] : null, T.pos ? 17 : 14).then(function (m) { T.map = m; drawMe(); });
  }
  function drawMe() {
    if (!T.map || !T.pos || !window.L) return;
    var ll = [T.pos.lat, T.pos.lng];
    if (!T.mk) { T.mk = L.marker(ll, { icon: dotIcon('#0E7A52', '') }).addTo(T.map); T.map.setView(ll, 17); } else T.mk.setLatLng(ll);
    if (T.path.length > 1) { if (!T.line) T.line = L.polyline(T.path, { color: '#C99A3A', weight: 4 }).addTo(T.map); else T.line.setLatLngs(T.path); }
  }
  function onPos(p) {
    var c = p.coords, n = { lat: c.latitude, lng: c.longitude, acc: c.accuracy || 0 };
    if (T.pos && n.acc < 60) { var dd = hav(T.pos.lat, T.pos.lng, n.lat, n.lng); if (dd > 4 && dd < 300) T.dist += dd; }
    T.pos = n; T.posAt = Date.now(); if (n.acc < 80) T.path.push([n.lat, n.lng]); if (T.path.length > 2000) T.path.shift();
    var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    set('hl-d', dist(T.dist)); set('hl-a', '±' + Math.round(n.acc) + ' m'); set('hl-zone', '📍 ' + (zone(n.lat, n.lng) || 'Location found'));
    try { window.emerLat = n.lat; window.emerLng = n.lng; } catch (e) {}
    drawMe(); send();
  }
  function send(force) {
    if (!T.sess || !T.pos) return;
    var now = Date.now(), moved = T.lastSentPos ? hav(T.lastSentPos.lat, T.lastSentPos.lng, T.pos.lat, T.pos.lng) : 999;
    if (!force && now - T.lastSent < 15000 && moved < 25) return;
    T.lastSent = now; T.lastSentPos = { lat: T.pos.lat, lng: T.pos.lng };
    api('/live', { a: 'update', id: T.sess.id, token: T.sess.token, lat: T.pos.lat, lng: T.pos.lng, acc: T.pos.acc }).then(function (d) { if (d && d.ok === false && !d.setup) { T.sess = null; put('live', null); trackerUI(); } }).catch(function () {});
  }
  function start() {
    if (!navigator.geolocation) { say('Location is not available on this phone'); return; }
    if (T.watch) return;
    T.t0 = T.t0 || Date.now();
    T.watch = navigator.geolocation.watchPosition(onPos, function (e) { say(e && e.code === 1 ? 'Please allow location for Haramain' : 'Location not available right now'); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    clearInterval(T.timer); T.timer = setInterval(function () { var e = $('hl-t'); if (e && T.t0) e.textContent = Math.round((Date.now() - T.t0) / 60000) + ' min'; send(); }, 20000);
    trackerUI();
  }
  function stop() {
    if (T.watch) navigator.geolocation.clearWatch(T.watch); T.watch = null; clearInterval(T.timer);
    if (T.sess) { api('/live', { a: 'stop', id: T.sess.id, token: T.sess.token }).catch(function () {}); T.sess = null; put('live', null); say('Live sharing stopped. The link no longer works.'); }
    T.t0 = 0; T.dist = 0; T.path = []; trackerUI();
  }
  function link() { return origin + '/live.html?id=' + T.sess.id; }
  function goLive() {
    api('/live', { a: 'start', name: me() ? '@' + me() : (get('livename', '') || 'A pilgrim') }).then(function (d) {
      if (!d || !d.ok) { if (d && d.setup) { say('Live sharing is not available yet. Sending your location once instead.'); shareOnce(); } else say('Could not start live sharing'); trackerUI(); return; }
      T.sess = { id: d.id, token: d.token }; put('live', T.sess); start(); send(true); shareLink();
    }).catch(function () { say('No connection. Sending your location once instead.'); shareOnce(); });
  }
  function shareLink() { if (!T.sess) return; shareText('Follow my location', 'Assalamu alaikum! Follow my live location here:\n' + link() + '\n— Haramain'); }
  function shareOnce() {
    var go = function (p) { shareText('My location', 'My location now:\nhttps://maps.google.com/?q=' + p.lat.toFixed(5) + ',' + p.lng.toFixed(5) + '\n— Haramain'); };
    if (T.pos) return go(T.pos);
    if (!navigator.geolocation) return say('Location is not available on this phone');
    say('Getting your location…');
    navigator.geolocation.getCurrentPosition(function (p) { go({ lat: p.coords.latitude, lng: p.coords.longitude }); }, function () { say('Please allow location for Haramain'); }, { enableHighAccuracy: true, timeout: 15000 });
  }
  window.HML = { start: start, stop: stop, goLive: goLive, shareLink: shareLink, shareOnce: shareOnce };
  window.openTracker = window.openLiveTracker = function () { goS('tracker'); };
  window.shareEmergencyLocation = function () {
    var msg = ''; try { msg = buildEmerMessage(); } catch (e) {}
    if (T.sess) msg += '\n\nLive location: ' + link();
    shareText('🆘 Emergency', msg || 'I need help.');
  };

  /* ════════ FAMILY GROUP ════════ */
  var F = { g: get('fam', null), members: [], map: null, layer: null, timer: null };
  function famUI() {
    var sec = $('s-family'); if (!sec) return;
    if (DB === false) { sec.dataset.mode = 'share'; return; }   // keep the message-based screen
    var g = F.g, mp = get('mtg5', '');
    if (!g) {
      sec.innerHTML = '<div class="scr-top-bar"><div><div class="scr-top-title">👨‍👩‍👧 Family</div><div class="scr-top-sub">Stay together · see each other on a map</div></div></div>' +
        '<div class="ibox hl-card"><b>Create a family group</b><p>You get a short code. Send it to your family; when they join, you all see each other\'s last location and check-ins.</p>' +
        '<input class="fi" id="hf-name" placeholder="Your name (shown to your family)" value="' + esc(me() ? '@' + me() : '') + '">' +
        '<button type="button" class="btn btn-gold" onclick="HMF.create()">Create group</button></div>' +
        '<div class="ibox hl-card"><b>Join with a code</b><input class="fi" id="hf-code" placeholder="e.g. 7KQ2MX" maxlength="8" style="text-transform:uppercase">' +
        '<input class="fi" id="hf-name2" placeholder="Your name" value="' + esc(me() ? '@' + me() : '') + '"><button type="button" class="btn btn-ghost" onclick="HMF.join()">Join group</button></div>' +
        '<div class="hm-note">Only people with your code can see the group. Your location is shared with the group only when you tap a check-in or turn on sharing.</div>';
      return;
    }
    sec.innerHTML = '<div class="scr-top-bar"><div><div class="scr-top-title">👨‍👩‍👧 ' + esc(g.title || 'My family') + '</div><div class="scr-top-sub">Group code <b>' + esc(g.code) + '</b></div></div><span class="scr-top-action" onclick="HMF.invite()">+ Invite</span></div>' +
      '<div id="hf-map" class="hl-map"></div>' +
      '<div id="hf-list"><div class="empty">Loading your family…</div></div>' +
      '<div class="sec-label">✅ Check in</div><div class="hl-grid2">' +
        ['I am safe ✅', 'At the Haram 🕋', 'At the hotel 🏨', 'I need help 🚨'].map(function (s, i) { return '<button type="button" class="btn ' + (i === 3 ? 'btn-red' : 'btn-ghost') + ' btn-sm" onclick="HMF.checkin(\'' + s + '\')">' + s + '</button>'; }).join('') + '</div>' +
      '<label class="hmt-before" style="margin:12px 2px"><input type="checkbox" ' + (get('famauto', false) ? 'checked' : '') + ' onchange="HMF.auto(this.checked)"> Keep my location updated for the group while Haramain is open</label>' +
      '<div class="sec-label">📍 Meeting point</div><div class="ibox"><div style="font-weight:700;margin-bottom:6px" id="meeting-point">' + (mp ? '📍 ' + esc(mp) : 'Not set') + '</div>' +
        '<div class="hl-row"><button type="button" class="btn btn-ghost btn-sm" onclick="setMeetingPoint(\'Masjid al-Haram, King Abdulaziz Gate (Gate 1)\');HMF.checkin(\'Meeting point: King Abdulaziz Gate\')">🕋 King Abdulaziz Gate</button><button type="button" class="btn btn-ghost btn-sm" onclick="var p=prompt(\'Where should everyone meet?\');if(p){setMeetingPoint(p);HMF.checkin(\'Meeting point: \'+p)}">📝 Other</button></div></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="HMF.leave()">Leave group</button>';
    makeMap($('hf-map'), null, 15).then(function (m) { F.map = m; refresh(); });
  }
  function refresh() {
    var g = F.g; if (!g) return;
    api('/family?code=' + encodeURIComponent(g.code) + '&uid=' + encodeURIComponent(g.uid) + '&key=' + encodeURIComponent(g.key)).then(function (d) {
      if (!d || !d.ok) { if (d && d.error === 'not a member') { F.g = null; put('fam', null); famUI(); } return; }
      F.members = d.members || []; drawFam();
    }).catch(function () {});
  }
  function drawFam() {
    var list = $('hf-list'); if (!list) return;
    var mine = F.members.filter(function (m) { return m.me; })[0];
    list.innerHTML = F.members.map(function (m) {
      var far = (mine && mine.lat != null && m.lat != null && !m.me) ? ' · ' + dist(hav(mine.lat, mine.lng, m.lat, m.lng)) + ' away' : '';
      return '<div class="hl-mem"><span class="hl-av">' + esc((m.name || '?').replace('@', '').charAt(0).toUpperCase()) + '</span><div class="hl-mt"><b>' + esc(m.name) + (m.me ? ' (you)' : '') + '</b><small>' + esc(m.status || '') + ' · ' + ago(m.ts) + far + '</small></div>' +
        (m.lat != null && !m.me ? '<a class="hl-go" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + m.lat + ',' + m.lng + '">Go ›</a>' : '') + '</div>';
    }).join('') + (F.members.length < 2 ? '<div class="hm-note">Only you so far. Tap “+ Invite” to send the code to your family.</div>' : '');
    if (F.map && window.L) {
      if (F.layer) F.layer.remove(); F.layer = L.layerGroup().addTo(F.map); var pts = [];
      F.members.forEach(function (m) { if (m.lat == null) return; pts.push([m.lat, m.lng]); L.marker([m.lat, m.lng], { icon: dotIcon(m.me ? '#0E7A52' : '#C99A3A', (m.name || '?').replace('@', '').charAt(0).toUpperCase()) }).bindPopup(esc(m.name) + '<br>' + esc(m.status || '') + '<br>' + ago(m.ts)).addTo(F.layer); });
      if (pts.length === 1) F.map.setView(pts[0], 16); else if (pts.length > 1) F.map.fitBounds(pts, { padding: [30, 30], maxZoom: 17 });
    }
  }
  function withPos(cb) {
    if (T.pos && Date.now() - (T.posAt || 0) < 60000) return cb(T.pos);
    if (!navigator.geolocation) return cb(null);
    navigator.geolocation.getCurrentPosition(function (p) { cb({ lat: p.coords.latitude, lng: p.coords.longitude }); }, function () { cb(null); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }
  function joinDone(d, title) {
    if (!d || !d.ok) { say((d && d.error) || 'Could not connect. Try again.'); return; }
    F.g = { code: d.code, uid: d.uid, key: d.key, title: title }; put('fam', F.g); famUI(); setTimeout(HMF.checkin.bind(null, 'Joined the group'), 500);
  }
  window.HMF = {
    create: function () { var n = ($('hf-name') || {}).value || ''; api('/family', { a: 'create', name: n.trim() || 'Family member' }).then(function (d) { joinDone(d, 'My family'); if (d && d.ok) setTimeout(HMF.invite, 900); }).catch(function () { say('No connection'); }); },
    join: function () { var c = (($('hf-code') || {}).value || '').trim().toUpperCase(), n = ($('hf-name2') || {}).value || ''; if (c.length < 4) { say('Enter the group code'); return; } api('/family', { a: 'join', code: c, name: n.trim() || 'Family member' }).then(function (d) { joinDone(d, 'My family'); }).catch(function () { say('No connection'); }); },
    invite: function () { if (F.g) shareText('Join my family group', 'Assalamu alaikum! Join our family group on Haramain so we can find each other.\nOpen Haramain → More → Family → Join, and enter the code: ' + F.g.code + '\n' + origin); },
    checkin: function (s) {
      if (!F.g) return; say('Sending check-in…');
      withPos(function (p) { api('/family', Object.assign({ a: 'update', code: F.g.code, uid: F.g.uid, key: F.g.key, status: s }, p ? { lat: p.lat, lng: p.lng } : {})).then(function () { say('✅ ' + s); refresh(); }).catch(function () { say('No connection'); }); });
    },
    auto: function (on, quiet) { put('famauto', !!on); clearInterval(F.timer); if (on) { F.timer = setInterval(function () { if (!F.g || document.hidden) return; withPos(function (p) { if (p) api('/family', { a: 'update', code: F.g.code, uid: F.g.uid, key: F.g.key, lat: p.lat, lng: p.lng }).then(refresh).catch(function () {}); }); }, 60000); if (!quiet) HMF.checkin('Sharing location'); } },
    leave: function () { if (!F.g || !confirm('Leave this family group?')) return; api('/family', { a: 'leave', code: F.g.code, uid: F.g.uid, key: F.g.key }).catch(function () {}); F.g = null; put('fam', null); put('famauto', false); clearInterval(F.timer); famUI(); }
  };

  /* ════════ LOST & FOUND (shared board) ════════ */
  var B = { kind: 'lost', items: [] };
  function lfUI() {
    var sec = $('s-lostfound'); if (!sec || DB === false) return;
    sec.innerHTML = '<div class="scr-top-bar"><div><div class="scr-top-title">🔍 Lost &amp; Found</div><div class="scr-top-sub">Shared with every Haramain user</div></div><span class="scr-top-action" onclick="HMB.form()">+ Post</span></div>' +
      '<div id="hm-lf-guide" class="ibox" style="margin-bottom:.6rem"><div class="hm-li">👮 Lost something at the Haram? Tell the nearest security officer or staff and ask for the lost property office.</div><div class="hm-li">🧒 Missing person: call <b>911</b> at once.</div><div class="hm-li">📢 Post a notice below; every Haramain user can see it and contact you.</div></div>' +
      '<div class="hl-tabs"><button type="button" class="' + (B.kind === 'lost' ? 'on' : '') + '" onclick="HMB.tab(\'lost\')">🔴 Lost</button><button type="button" class="' + (B.kind === 'found' ? 'on' : '') + '" onclick="HMB.tab(\'found\')">🟢 Found</button></div>' +
      '<input class="fi" id="hb-q" type="search" placeholder="Search: bag, phone, passport, place…" oninput="clearTimeout(window._hbq);window._hbq=setTimeout(HMB.load,350)">' +
      '<div id="hb-form" style="display:none"></div><div id="hb-list"><div class="empty">Loading notices…</div></div>';
    load();
  }
  function load() {
    var q = (($('hb-q') || {}).value || '').trim();
    api('/lf?kind=' + B.kind + (q ? '&q=' + encodeURIComponent(q) : '')).then(function (d) {
      if (!d || !d.ok) { if (DB === false) lfFallback(); else $('hb-list').innerHTML = '<div class="empty">Could not load notices.</div>'; return; }
      B.items = d.items || []; drawB();
    }).catch(function () { var l = $('hb-list'); if (l) l.innerHTML = '<div class="empty">No connection. Pull to refresh later.</div>'; });
  }
  function contactBtn(c) {
    if (!c) return '';
    var digits = c.replace(/[^\d+]/g, '');
    if (digits.replace('+', '').length >= 8) return '<a class="btn btn-gold btn-sm" href="https://wa.me/' + digits.replace('+', '') + '" target="_blank" rel="noopener">WhatsApp</a><a class="btn btn-ghost btn-sm" href="tel:' + esc(digits) + '">Call</a>';
    return '<span class="hl-contact">Contact: ' + esc(c) + '</span>';
  }
  function drawB() {
    var l = $('hb-list'); if (!l) return; var u = me();
    l.innerHTML = B.items.length ? B.items.map(function (x) {
      return '<div class="lf-item"><div class="lf-badge ' + (x.kind === 'found' ? 'lf-found' : 'lf-lost') + '">' + (x.kind === 'found' ? 'FOUND' : 'LOST') + '</div><div class="lf-title">' + esc(x.item) + '</div>' +
        (x.descr ? '<div class="lf-desc">' + esc(x.descr) + '</div>' : '') + '<div class="hl-meta">' + (x.place ? '📍 ' + esc(x.place) + ' · ' : '') + ago(x.ts) + ' · @' + esc(x.user) + '</div>' +
        '<div class="hl-row">' + contactBtn(x.contact) + (u && u === x.user ? '<button type="button" class="btn btn-ghost btn-sm" onclick="HMB.done(' + x.id + ')">✓ Resolved</button>' : '<button type="button" class="hl-rep" onclick="HMB.report(' + x.id + ')">Report</button>') + '</div></div>';
    }).join('') : '<div class="empty">No ' + B.kind + ' notices right now. ' + (B.kind === 'lost' ? 'Lost something? Tap “+ Post”.' : 'Found something? Tap “+ Post” so the owner can find it.') + '</div>';
  }
  function lfFallback() { /* database not connected: the message-based Lost & Found screen stays */ }
  window.HMB = {
    tab: function (k) { B.kind = k; lfUI(); },
    load: load,
    form: function () {
      var f = $('hb-form'); if (!f) return;
      if (!me()) { try { hmSheet('Sign in with Pi', 'Posting a notice needs Pi sign-in, so people know who posted it.<button class="hm-sheet-a" type="button" onclick="this.closest(\'.hm-sheet-wrap\').remove();piLogin()">Sign in with Pi</button>'); } catch (e) {} return; }
      f.style.display = 'block';
      f.innerHTML = '<div class="ibox hl-card"><b>New notice</b><div class="hl-tabs"><button type="button" id="hb-k1" class="' + (B.kind === 'lost' ? 'on' : '') + '" onclick="this.classList.add(\'on\');document.getElementById(\'hb-k2\').classList.remove(\'on\')">I lost</button><button type="button" id="hb-k2" class="' + (B.kind === 'found' ? 'on' : '') + '" onclick="this.classList.add(\'on\');document.getElementById(\'hb-k1\').classList.remove(\'on\')">I found</button></div>' +
        '<input class="fi" id="hb-item" maxlength="80" placeholder="What? e.g. Black bag, Nigerian passport"><textarea class="fi" id="hb-descr" rows="2" maxlength="300" placeholder="Colour, marks, what is inside…"></textarea>' +
        '<input class="fi" id="hb-place" maxlength="80" placeholder="Where? e.g. Gate 79, Mina camp 12"><input class="fi" id="hb-contact" maxlength="60" placeholder="Your WhatsApp or phone (shown to everyone)">' +
        '<div class="hl-row"><button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById(\'hb-form\').style.display=\'none\'">Cancel</button><button type="button" class="btn btn-gold btn-sm" onclick="HMB.post()">Post notice</button></div></div>';
      f.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    post: function () {
      var item = ($('hb-item') || {}).value || ''; if (!item.trim()) { say('Describe the item'); return; }
      var kind = $('hb-k2') && $('hb-k2').classList.contains('on') ? 'found' : 'lost';
      api('/lf', { a: 'add', kind: kind, item: item, descr: ($('hb-descr') || {}).value, place: ($('hb-place') || {}).value, contact: ($('hb-contact') || {}).value, accessToken: window.HM_TOKEN || '' })
        .then(function (d) { if (!d || !d.ok) { say((d && d.error) || 'Could not post'); return; } say('✅ Notice posted'); B.kind = kind; lfUI(); })
        .catch(function () { say('No connection'); });
    },
    done: function (id) { api('/lf', { a: 'done', id: id, accessToken: window.HM_TOKEN || '' }).then(function () { say('Marked as resolved'); load(); }).catch(function () {}); },
    report: function (id) { if (!confirm('Report this notice as wrong or abusive?')) return; api('/lf', { a: 'report', id: id }).then(function () { say('Thank you. We will hide it if others report it too.'); }).catch(function () {}); }
  };

  /* ── wiring ── */
  function start2() {
    var _goS = window.goS;
    window.goS = function (id) {
      var r = _goS.apply(this, arguments);
      if (id === 'tracker') trackerUI();
      if (id === 'family') { if (DB === null) api('/family?code=X&uid=X&key=X').then(famUI).catch(famUI); else famUI(); }
      if (id === 'lostfound') { if (DB === null) api('/lf?kind=lost').then(function () { lfUI(); }).catch(function () {}); else lfUI(); }
      return r;
    };
    if (T.sess) { start(); }   // resume a live share after reopening the app
    if (F.g && get('famauto', false)) HMF.auto(true, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start2, 100); }); else setTimeout(start2, 100);
})();
