/* Haramain — notifications that work: phone notifications through the service worker (required on Android),
   real times on every notification ("5 min ago", not "now" forever), one prayer alert instead of two, and a settings card with a test button. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K = window.K || 'hm_v1_';
  var get = function (k, d) { try { var v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  window.scheduleAdhanAlerts = function () {};       // the old alert scheduled duplicates every minute; haramain-daily.js handles reminders
  var supported = 'Notification' in window;
  function perm() { return supported ? Notification.permission : 'unsupported'; }

  /* phone notification: service worker first (Android Chrome refuses `new Notification`), page API as fallback */
  window.hmSysNotify = function (title, body, tag) {
    if (perm() !== 'granted') return Promise.resolve(false);
    var o = { body: body, icon: '/icons/icon-192.png', badge: '/icons/favicon-32.png', tag: tag || 'hm', renotify: true, vibrate: [120, 60, 120], data: { url: location.pathname } };
    var page = function () { try { new Notification(title, o); return true; } catch (e) { return false; } };
    if ('serviceWorker' in navigator) {
      return navigator.serviceWorker.getRegistration().then(function (reg) { if (reg && reg.showNotification) return reg.showNotification(title, o).then(function () { return true; }, page); return page(); }).catch(page);
    }
    return Promise.resolve(page());
  };
  window.hmAskNotify = function () {
    if (!supported) { say('This browser does not support phone notifications. Haramain shows alerts inside the app instead.'); return; }
    if (perm() === 'denied') { hmSheet('🔔 Notifications are blocked', 'Notifications were blocked for Haramain. To turn them on, open your browser’s <b>site settings</b> for this app and allow <b>Notifications</b>, then come back.'); return; }
    Notification.requestPermission().then(function () { drawCard(); if (perm() === 'granted') { say('✅ Notifications allowed'); hmSysNotify('Haramain', 'Notifications are on. You will be reminded at prayer times while Haramain is open.', 'hm-test'); } });
  };
  window.hmTestNotify = function () {
    var t = 'Test notification', b = 'This is how Haramain reminders look. ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try { addNotif('🔔', t, b, 'now'); } catch (e) {}
    hmSysNotify('🔔 ' + t, b, 'hm-test').then(function (ok) { say(ok ? '✅ Sent. Check your notification bar.' : '✅ Added to your notifications in the app'); });
    try { var A = window.AudioContext || window.webkitAudioContext; var c = new A(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 660; g.gain.setValueAtTime(.12, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .5); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + .5); } catch (e) {}
  };

  /* real times on notifications */
  function ago(ts) {
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'now'; if (m < 60) return m + ' min'; var h = Math.round(m / 60); if (h < 24) return h + ' h';
    var d = Math.round(h / 24); return d < 7 ? d + ' d' : new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' });
  }
  function wrapNotifs() {
    if (typeof window.addNotif !== 'function' || window.addNotif._hm) return;
    var orig = window.addNotif;
    window.addNotif = function (icon, title, text, time) {
      orig.apply(this, arguments);
      try { if (window.notifs && notifs[0] && !notifs[0].ts) { notifs[0].ts = Date.now(); saveSt(); } } catch (e) {}
      renderList();
    };
    window.addNotif._hm = true;
    window.renderNotifs = renderList;
    try { (window.notifs || []).forEach(function (n) { if (!n.ts) n.ts = Date.now() - 864e5; }); } catch (e) {}
  }
  function renderList() {
    var el = $('notif-list'); if (!el) return;
    var N = window.notifs || [];
    if (!N.length) { el.innerHTML = '<div class="wl-empty"><span>🔔</span><b>No notifications yet</b><small>Prayer reminders, payments received and safety alerts appear here.</small></div>'; return; }
    el.innerHTML = N.slice(0, 40).map(function (n, i) {
      return '<div class="ncard' + (n.read ? '' : ' unread') + '" onclick="readNotif(' + i + ')"><div class="ncard-icon">' + esc(n.icon) + '</div><div class="ncard-body"><div class="ncard-title">' + esc(n.title) + '</div><div class="ncard-text">' + esc(n.text) + '</div></div><div class="ncard-time">' + (n.ts ? ago(n.ts) : esc(n.time || '')) + '</div></div>';
    }).join('');
  }
  window.hmClearNotifs = function () { if (!confirm('Clear all notifications?')) return; try { notifs.length = 0; saveSt(); } catch (e) {} var bd = $('bell-dot'); if (bd) bd.classList.remove('on'); renderList(); };

  /* settings card on the Notifications screen */
  function drawCard() {
    var sec = $('s-notifs'); if (!sec) return;
    var c = $('nt-card'); if (!c) { c = document.createElement('div'); c.id = 'nt-card'; var l = $('notif-list'); sec.insertBefore(c, l); }
    var p = perm(), rem = get('rem', { on: false, before: false });
    var pt = p === 'granted' ? ['ok', 'Allowed'] : p === 'denied' ? ['bad', 'Blocked'] : p === 'unsupported' ? ['bad', 'Not supported here'] : ['wait', 'Not allowed yet'];
    c.innerHTML = '<div class="nt-row"><div><b>Phone notifications</b><small>' + (p === 'unsupported' ? 'This browser cannot show phone notifications. Haramain shows alerts inside the app.' : 'Shows reminders in your notification bar.') + '</small></div><span class="nt-pill ' + pt[0] + '">' + pt[1] + '</span></div>' +
      (p !== 'granted' && p !== 'unsupported' ? '<button type="button" class="wf-cta" onclick="hmAskNotify()">Allow notifications</button>' : '') +
      '<div class="nt-row"><div><b>Prayer time reminders</b><small>Sound and alert at each prayer time' + (rem.before ? ', and 10 minutes before' : '') + '.</small></div><button type="button" class="nt-sw' + (rem.on ? ' on' : '') + '" onclick="hmToggleRem(\'on\');setTimeout(function(){document.getElementById(\'nt-card\')&&window.hmNtCard()},50)" aria-pressed="' + !!rem.on + '"><i></i></button></div>' +
      '<div class="nt-row"><div><b>Payments received</b><small>Haramain Pay sales are confirmed on the Pi blockchain and announced here.</small></div><span class="nt-pill ok">On</span></div>' +
      '<div class="nt-acts"><button type="button" class="wf-btn" onclick="hmTestNotify()">🔔 Send a test</button><button type="button" class="wf-btn" onclick="hmClearNotifs()">🗑 Clear all</button></div>' +
      '<div class="wf-hint">Reminders work while Haramain is open or running in the background. A browser cannot wake a closed app.</div>';
  }
  window.hmNtCard = drawCard;

  function start() {
    wrapNotifs(); setTimeout(wrapNotifs, 1500);
    var _goS = window.goS;
    window.goS = function (id) { var r = _goS.apply(this, arguments); if (id === 'notifs') { drawCard(); renderList(); } return r; };
    renderList();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 100); }); else setTimeout(start, 100);
})();
