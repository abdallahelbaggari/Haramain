/* Haramain — reasons to come back every day: daily goals and streak, a Quran completion (khatmah) plan,
   Friday and Sunnah-day reminders, badges (no Pi rewards), a welcome-back summary and install / offline support. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K = window.K || 'hm_v1_';
  var get = function (k, d) { try { var v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function ymd(d) { return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }); }
  var DAY = 864e5;

  /* ── daily log ── */
  function log() { return get('hab', {}); }
  function mark(k, v) { var L = log(), t = ymd(new Date()); L[t] = L[t] || {}; if (L[t][k] === v) return; L[t][k] = v; put('hab', L); check(); render(); }
  function prayersOn(key) { var p = (get('plog', {})[key] || []); return p.filter(Boolean).length; }
  function today() {
    var t = ymd(new Date()), d = log()[t] || {};
    var m = window.HMA ? HMA.done('m') : 0, mt = window.HMA ? HMA.total('m') : 1, e = window.HMA ? HMA.done('e') : 0, et = window.HMA ? HMA.total('e') : 1;
    return { m: !!d.m || m >= mt, mn: m, mt: mt, e: !!d.e || e >= et, en: e, et: et, q: !!d.q, p: prayersOn(t) };
  }
  function active(key) {
    var d = log()[key] || {};
    return !!(d.m || d.e || d.q) || prayersOn(key) > 0;
  }
  function streak() {
    var s = 0, now = Date.now();
    for (var k = 0; k < 800; k++) { var key = ymd(new Date(now - k * DAY)); if (active(key)) s++; else if (k > 0) break; }
    return s;
  }
  function best() { var b = get('habBest', 0), s = streak(); if (s > b) { put('habBest', s); b = s; } return b; }

  /* ── badges: recognition only, never Pi ── */
  var BADGES = [['s3', '🌱', '3-day streak'], ['s7', '🌿', '7-day streak'], ['s30', '🌳', '30-day streak'], ['s100', '🏅', '100-day streak'],
    ['adk', '☀️', 'Morning & evening adhkar in one day'], ['pr5', '🕌', 'All five prayers logged'], ['kh1', '📖', 'First khatmah complete']];
  function check() {
    var have = get('badges', {}), s = streak(), t = today(), k = get('khatmah', null), got = [];
    function give(id) { if (!have[id]) { have[id] = Date.now(); got.push(id); } }
    if (s >= 3) give('s3'); if (s >= 7) give('s7'); if (s >= 30) give('s30'); if (s >= 100) give('s100');
    if (t.m && t.e) give('adk'); if (t.p >= 5) give('pr5'); if (k && k.done >= 1) give('kh1');
    if (got.length) {
      put('badges', have);
      var b = BADGES.filter(function (x) { return x[0] === got[0]; })[0];
      if (b) say(b[1] + ' New badge: ' + b[2]);
    }
  }

  /* ── khatmah (Quran completion) plan by juz ── */
  var JUZ = [[1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1],
    [18, 75], [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1]];
  var SN = { 1: 'Al-Fatihah', 2: 'Al-Baqarah', 3: "Ali 'Imran", 4: "An-Nisa'", 5: "Al-Ma'idah", 6: "Al-An'am", 7: "Al-A'raf", 8: 'Al-Anfal', 9: 'At-Tawbah', 11: 'Hud', 12: 'Yusuf', 15: 'Al-Hijr', 17: "Al-Isra'", 18: 'Al-Kahf', 21: "Al-Anbiya'", 23: "Al-Mu'minun", 25: 'Al-Furqan', 27: 'An-Naml', 29: "Al-'Ankabut", 33: 'Al-Ahzab', 36: 'Ya-Sin', 39: 'Az-Zumar', 41: 'Fussilat', 46: 'Al-Ahqaf', 51: 'Adh-Dhariyat', 58: 'Al-Mujadilah', 67: 'Al-Mulk', 78: "An-Naba'" };
  function sname(n) { var L = get('qlist', null); return (L && L[n - 1] && L[n - 1].name) || SN[n] || ('Surah ' + n); }
  function kh() { return get('khatmah', null); }
  function portion(k) {
    var per = 30 / k.days, from = Math.floor(k.pos), to = Math.min(30, Math.ceil(k.pos + per - 0.0001));
    if (to <= from) to = from + 1;
    return { from: from, to: to, start: JUZ[from], label: (to - from === 1 ? 'Juz ' + (from + 1) : 'Juz ' + (from + 1) + '–' + to) };
  }
  window.hmKhatmah = function () {
    var k = kh();
    var opts = [[30, '30 days', '1 juz a day · about 20 minutes'], [15, '15 days', '2 juz a day'], [10, '10 days', '3 juz a day'], [60, '60 days', 'Half a juz a day']];
    hmSheet('📖 Quran completion plan',
      '<p style="margin:0 0 10px">Choose how many days you want to finish the whole Quran in. Each day Haramain shows your portion and opens it at the right verse.</p>' +
      opts.map(function (o) { return '<button type="button" class="hb-opt" onclick="hmKhStart(' + o[0] + ')"><b>' + o[1] + '</b><small>' + o[2] + '</small></button>'; }).join('') +
      (k ? '<button type="button" class="hb-opt hb-stop" onclick="hmKhStop()"><b>Stop current plan</b><small>Juz ' + (Math.floor(k.pos) + 1) + ' of 30 · completed ' + (k.done || 0) + ' time' + ((k.done || 0) === 1 ? '' : 's') + '</small></button>' : ''));
  };
  function closeSheet() { var w = document.querySelector('.hm-sheet-wrap'); if (w) w.remove(); }
  window.hmKhStart = function (days) { var o = kh() || {}; put('khatmah', { days: days, pos: 0, start: Date.now(), done: o.done || 0, last: '' }); closeSheet(); say('📖 Plan started: finish in ' + days + ' days'); render(); };
  window.hmKhStop = function () { var k = kh(); if (k) put('khatmah', { days: 0, pos: 0, done: k.done || 0, stopped: true }); closeSheet(); render(); };
  window.hmKhRead = function () { var k = kh(); if (!k || !k.days) return; var p = portion(k); if (window.HMQ) HMQ.open(p.start[0], p.start[1] > 1 ? p.start[1] : undefined); };
  window.hmKhDone = function () {
    var k = kh(); if (!k || !k.days) return; var p = portion(k);
    k.pos = Math.min(30, k.pos + 30 / k.days); k.last = ymd(new Date());
    if (k.pos >= 29.999) { k.done = (k.done || 0) + 1; k.pos = 0; k.start = Date.now(); say('🎉 Khatmah complete. May Allah accept it from you.'); }
    else say('✅ ' + p.label + ' done');
    put('khatmah', k); mark('q', 1);
  };

  /* ── special days from the Umm al-Qura calendar ── */
  function special() {
    var now = new Date(), wd = now.getDay();
    var h = window.HM_CAL && HM_CAL.hijri(now), tm = window.HM_CAL && HM_CAL.hijri(new Date(now.getTime() + DAY)), out = [];
    if (h) {
      if (h.m === 12 && h.d === 9) out.push(['🕋', 'Day of Arafah', 'The best day for dua. Fasting today expiates two years for those not on Hajj.', null]);
      else if (h.m === 12 && h.d <= 8) out.push(['🌟', 'First ten days of Dhul Hijjah', 'The best days of the year: dhikr, takbir, fasting and good deeds.', null]);
      if (h.m === 12 && h.d >= 10 && h.d <= 13) out.push(['🐑', h.d === 10 ? 'Eid al-Adha' : 'Days of Tashreeq', 'Days of eating, drinking and remembering Allah. Takbir after every prayer.', null]);
      if (h.m === 1 && (h.d === 9 || h.d === 10)) out.push(['🌙', h.d === 9 ? "Tasu'a" : 'Ashura', 'A Sunnah fast that expiates the previous year.', null]);
      if (h.m === 9) out.push(['🌙', 'Ramadan · day ' + h.d, 'Read more Quran, give charity and seek Laylat al-Qadr in the last ten nights.', ['Read Quran', 'hmKhRead()']]);
      if (h.m !== 9 && h.d >= 13 && h.d <= 15) out.push(['🌕', 'White Days (' + h.d + ' ' + HM_CAL.MEN[h.m - 1] + ')', 'The Sunnah fast of the 13th, 14th and 15th of each Hijri month.', null]);
      if (h.m !== 9 && tm && tm.d === 13) out.push(['🌕', 'White Days start tomorrow', 'Intend the Sunnah fast of the 13th, 14th and 15th.', null]);
    }
    if (wd === 5) out.unshift(['🕌', "Jumu'ah Mubarak", 'Read Surah Al-Kahf, send salawat on the Prophet ﷺ and make dua in the last hour before Maghrib.', ['Read Al-Kahf', 'HMQ.open(18)']]);
    if (wd === 1 || wd === 4) out.push(['🍃', (wd === 1 ? 'Monday' : 'Thursday') + ' · Sunnah fast', 'The Prophet ﷺ fasted on Mondays and Thursdays.', null]);
    if ((wd === 0 || wd === 3) && !(h && h.m === 9)) out.push(['🍃', 'Tomorrow is a Sunnah fasting day', 'Intend to fast ' + (wd === 0 ? 'Monday' : 'Thursday') + ' if you are able.', null]);
    return out.slice(0, 2);
  }

  /* ── welcome back ── */
  var lastSeen = get('lastSeen', 0); put('lastSeen', Date.now());
  var gap = lastSeen ? Math.floor((Date.now() - lastSeen) / DAY) : -1;
  var welcomed = false;

  /* ── install & offline ── */
  var promptEv = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); promptEv = e; render(); });
  window.addEventListener('appinstalled', function () { put('installed', 1); promptEv = null; render(); say('✅ Haramain installed'); });
  window.hmInstall = function () { if (!promptEv) return; promptEv.prompt(); promptEv.userChoice.then(function () { promptEv = null; render(); }); };
  window.hmInstallHide = function () { put('installHide', Date.now()); render(); };
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }

  /* ── card ── */
  function dots() {
    var out = '', now = Date.now();
    for (var k = 6; k >= 0; k--) {
      var d = new Date(now - k * DAY), key = ymd(d), on = active(key);
      out += '<span class="hb-dot' + (on ? ' on' : '') + (k === 0 ? ' now' : '') + '"><i>' + (on ? '✓' : '') + '</i><small>' + d.toLocaleDateString('en-US', { weekday: 'narrow' }) + '</small></span>';
    }
    return out;
  }
  function render() {
    var box = $('hm-habit'); if (!box) return;
    var t = today(), s = streak(), b = best(), k = kh(), sp = special(), have = get('badges', {});
    var doneN = (t.m ? 1 : 0) + (t.e ? 1 : 0) + (t.p >= 5 ? 1 : 0) + (t.q ? 1 : 0);
    var nm = '';
    try { nm = get('fullname', '') || (window.user && user.username ? '@' + user.username : ''); } catch (e) {}
    var html = '';
    if (!welcomed && gap >= 2) {
      var lq = window.HMQ && HMQ.last();
      html += '<div class="hb-wb"><b>Welcome back' + (nm ? ', ' + esc(nm.split(' ')[0]) : '') + ' 🤍</b><span>' +
        (lq ? 'Continue ' + esc(lq.name || ('Surah ' + lq.s)) + ' at verse ' + lq.a + '.' : 'Start again with today’s adhkar.') + '</span>' +
        (lq ? '<button type="button" onclick="HMQ.open(' + lq.s + ',' + lq.a + ')">Continue ›</button>' : '<button type="button" onclick="HMA.open(new Date().getHours()<14?\'m\':\'e\')">Open ›</button>') + '</div>';
    }
    html += sp.map(function (x) {
      return '<div class="hb-sp"><span class="hb-sp-i">' + x[0] + '</span><div><b>' + esc(x[1]) + '</b><small>' + esc(x[2]) + '</small></div>' +
        (x[3] ? '<button type="button" onclick="' + x[3][1] + '">' + esc(x[3][0]) + '</button>' : '') + '</div>';
    }).join('');
    html += '<div class="hb-head"><div><div class="hmt-k">Your day</div><div class="hb-sub">' + doneN + ' of 4 goals' + (doneN === 4 ? ' · MashaAllah!' : '') + '</div></div>' +
      '<div class="hb-streak">' + (s ? '<b>🔥 ' + s + '</b><small>day' + (s === 1 ? '' : 's') + ' streak' + (b > s ? ' · best ' + b : '') + '</small>' : '<b>🔥 Start today</b><small>' + (b ? 'Best streak: ' + b + ' days' : 'Complete one goal') + '</small>') + '</div></div>' +
      '<div class="hb-week">' + dots() + '</div>' +
      '<div class="hb-goals">' +
        goal('☀️', 'Morning adhkar', t.m, t.m ? 'Done' : t.mn + '/' + t.mt, "HMA.open('m')") +
        goal('🌙', 'Evening adhkar', t.e, t.e ? 'Done' : t.en + '/' + t.et, "HMA.open('e')") +
        goal('🕌', '5 prayers', t.p >= 5, t.p + '/5', "goS('analytics')") +
        goal('📖', 'Quran', t.q, t.q ? 'Done' : 'Not yet', k && k.days ? 'hmKhRead()' : "goS('quran')") +
      '</div>';
    if (k && k.days) {
      var p = portion(k), pct = Math.round(k.pos / 30 * 100), doneToday = k.last === ymd(new Date());
      html += '<div class="hb-kh"><div class="hb-kh-t"><b>📖 Khatmah · ' + k.days + '-day plan</b><button type="button" class="hb-link" onclick="hmKhatmah()">Change</button></div>' +
        '<div class="hb-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="hb-kh-s">' + (doneToday ? '✅ Today’s portion is done. Next: ' : 'Today: ') + '<b>' + p.label + '</b> · from ' + esc(sname(p.start[0])) + ' ' + p.start[0] + ':' + p.start[1] + ' · ' + pct + '% of the Quran' + (k.done ? ' · ' + k.done + ' khatmah' + (k.done > 1 ? 's' : '') + ' complete' : '') + '</div>' +
        '<div class="hb-kh-a"><button type="button" class="btn btn-gold btn-sm" onclick="hmKhRead()">Read ' + p.label + '</button><button type="button" class="btn btn-ghost btn-sm" onclick="hmKhDone()">' + (doneToday ? 'Mark next portion read' : 'Mark as read ✓') + '</button></div></div>';
    } else {
      html += '<button type="button" class="hb-kh-start" onclick="hmKhatmah()"><span>📖</span><div><b>Start a Quran completion plan</b><small>Finish the whole Quran in 10, 15, 30 or 60 days</small></div><i>›</i></button>';
    }
    var earned = BADGES.filter(function (x) { return have[x[0]]; });
    if (earned.length) html += '<div class="hb-badges">' + earned.map(function (x) { return '<span title="' + esc(x[2]) + '">' + x[1] + ' ' + esc(x[2]) + '</span>'; }).join('') + '</div>';
    if (promptEv && !get('installed', 0) && Date.now() - get('installHide', 0) > 7 * DAY) {
      html += '<div class="hb-inst"><img src="icons/icon-192.png" alt=""><div><b>Add Haramain to your home screen</b><small>Opens in one tap and works offline for the Quran, adhkar and prayer times you have opened.</small></div><button type="button" onclick="hmInstall()">Install</button><button type="button" class="hb-x" onclick="hmInstallHide()" aria-label="Not now">✕</button></div>';
    }
    box.innerHTML = html;
  }
  function goal(i, n, ok, s, act) {
    return '<button type="button" class="hb-g' + (ok ? ' ok' : '') + '" onclick="' + act + '"><span class="hb-gi">' + (ok ? '✓' : i) + '</span><b>' + n + '</b><small>' + s + '</small></button>';
  }

  function mount() {
    var t = $('hm-today'); if (!t || $('hm-habit')) return !!$('hm-habit');
    var box = document.createElement('div'); box.id = 'hm-habit'; box.className = 'hb';
    t.parentNode.insertBefore(box, t.nextSibling); render(); return true;
  }
  function start() {
    var tries = 0; (function m() { if (!mount() && tries++ < 40) setTimeout(m, 250); })();
    if (window.HMQ) {
      var _o = HMQ.open, _p = HMQ.play;
      HMQ.open = function () { var r = _o.apply(this, arguments); mark('q', 1); return r; };
      HMQ.play = function () { var r = _p.apply(this, arguments); mark('q', 1); return r; };
    }
    window.addEventListener('hm-adhkar', function () { var t = today(); if (t.m) mark('m', 1); if (t.e) mark('e', 1); render(); check(); });
    var _tp = window.hmTogglePrayer; if (_tp) window.hmTogglePrayer = function () { var r = _tp.apply(this, arguments); check(); render(); return r; };
    var _goS = window.goS; window.goS = function (id) { var r = _goS.apply(this, arguments); if (id === 'dashboard') render(); else welcomed = true; return r; };
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { render(); check(); } });
    setTimeout(function () { render(); check(); }, 1600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 140); }); else setTimeout(start, 140);
})();
