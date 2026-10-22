/* Haramain — The Holy Quran: 114 surahs, Arabic (Uthmani) + English (Saheeh International),
   verse-by-verse recitation from 7 reciters, continue where you stopped, bookmarks, works offline for recent surahs. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K = window.K || 'hm_v1_';
  var get = function (k, d) { try { var v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var arNum = function (n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); };
  var pad = function (x) { return ('00' + x).slice(-3); };

  var RECITERS = [
    ['alafasy', 'Mishary Rashid Alafasy', 'Alafasy_128kbps'], ['sudais', 'Abdurrahman As-Sudais', 'Abdurrahmaan_As-Sudais_192kbps'],
    ['shuraym', 'Saud Al-Shuraim', 'Saood_ash-Shuraym_128kbps'], ['maher', 'Maher Al-Muaiqly', 'Maher_AlMuaiqly_64kbps'],
    ['husary', 'Mahmoud Khalil Al-Husary', 'Husary_64kbps'], ['minshawi', 'Muhammad Siddiq Al-Minshawi', 'Minshawy_Murattal_128kbps'],
    ['basit', 'Abdul Basit Abdus Samad', 'Abdul_Basit_Murattal_64kbps']];
  var S = { list: null, surah: null, cur: null, playing: false, audio: new Audio(), pre: new Audio(), opt: get('qopt', { r: 'alafasy', en: true, fs: 26, rep: false }) };
  S.audio.preload = 'auto';

  /* ── data ── */
  function loadList() {
    if (S.list) return Promise.resolve(S.list);
    var c = get('qlist', null); if (c) { S.list = c; return Promise.resolve(c); }
    return fetch('/quran?list=1').then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) throw 0; S.list = d.surahs; put('qlist', d.surahs); return d.surahs;
    });
  }
  function loadSurah(n) {
    var cache = get('qs_' + n, null); if (cache) return Promise.resolve(cache);
    return fetch('/quran?surah=' + n).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) throw 0;
      var keep = get('qkeep', []).filter(function (x) { return x !== n; }); keep.unshift(n);
      while (keep.length > 6) { try { localStorage.removeItem(K + 'qs_' + keep.pop()); } catch (e) {} }
      if (!put('qs_' + n, d)) { keep.forEach(function (x, i) { if (i) try { localStorage.removeItem(K + 'qs_' + x); } catch (e) {} }); keep = [n]; put('qs_' + n, d); }
      put('qkeep', keep); return d;
    });
  }

  /* ── screen ── */
  function ensureScreen() {
    if ($('s-quran')) return;
    var sec = document.createElement('section'); sec.className = 'scr'; sec.id = 's-quran';
    sec.innerHTML = '<div id="hq-home"></div><div id="hq-read" style="display:none"></div>';
    ($('main') || document.body).appendChild(sec);
    var bar = document.createElement('div'); bar.id = 'hq-bar'; bar.style.display = 'none';
    bar.innerHTML = '<button type="button" id="hq-prev" aria-label="Previous verse">⏮</button><button type="button" id="hq-play" aria-label="Play">▶</button><button type="button" id="hq-next" aria-label="Next verse">⏭</button>' +
      '<div class="hq-now"><b id="hq-now-t">—</b><small id="hq-now-r"></small></div><button type="button" id="hq-rep" aria-label="Repeat verse">🔁</button><button type="button" id="hq-x" aria-label="Close player">✕</button>';
    document.body.appendChild(bar);
    $('hq-play').onclick = function () { if (S.playing) pause(); else if (S.cur) play(S.cur.s, S.cur.a); };
    $('hq-prev').onclick = function () { if (S.cur && S.cur.a > 1) play(S.cur.s, S.cur.a - 1); };
    $('hq-next').onclick = function () { next(); };
    $('hq-rep').onclick = function () { S.opt.rep = !S.opt.rep; put('qopt', S.opt); this.classList.toggle('on', S.opt.rep); say(S.opt.rep ? 'Repeating this verse' : 'Repeat off'); };
    $('hq-x').onclick = function () { pause(); bar.style.display = 'none'; document.documentElement.classList.remove('hq-playing'); };
    $('hq-rep').classList.toggle('on', !!S.opt.rep);
  }
  function home() {
    ensureScreen();
    $('hq-read').style.display = 'none'; var h = $('hq-home'); h.style.display = '';
    var last = get('qlast', null), bm = get('qbm', []);
    h.innerHTML = '<div class="scr-top-bar"><div><div class="scr-top-title">📖 The Holy Quran</div><div class="scr-top-sub">Read and listen · 114 surahs · 7 reciters</div></div></div>' +
      (last ? '<button type="button" class="hq-cont" onclick="HMQ.open(' + last.s + ',' + last.a + ')"><span>▶</span><div><b>Continue reading</b><small>' + esc(last.name || ('Surah ' + last.s)) + ' · verse ' + last.a + '</small></div></button>' : '') +
      (bm.length ? '<div class="sec-label">🔖 Bookmarks</div><div class="hq-bms">' + bm.slice(0, 12).map(function (b) { return '<button type="button" onclick="HMQ.open(' + b.s + ',' + b.a + ')">' + esc(b.name) + ' ' + b.s + ':' + b.a + '</button>'; }).join('') + '</div>' : '') +
      '<input class="fi hq-search" id="hq-q" type="search" placeholder="Search surah: name, meaning or number" autocomplete="off">' +
      '<div id="hq-list"><div class="empty">Loading surahs…</div></div>';
    loadList().then(drawList).catch(function () { $('hq-list').innerHTML = '<div class="empty">Could not load the surah list. Check your connection and try again.<br><button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="HMQ.home()">Try again</button></div>'; });
    $('hq-q').oninput = function () { drawList(S.list || []); };
  }
  function drawList(list) {
    var q = (($('hq-q') || {}).value || '').trim().toLowerCase();
    var f = list.filter(function (s) { return !q || String(s.n) === q || s.name.toLowerCase().replace(/[-']/g, '').indexOf(q.replace(/[-']/g, '')) >= 0 || s.tr.toLowerCase().indexOf(q) >= 0 || s.ar.indexOf(q) >= 0; });
    $('hq-list').innerHTML = f.map(function (s) {
      return '<button type="button" class="hq-row" onclick="HMQ.open(' + s.n + ')"><span class="hq-num">' + s.n + '</span><span class="hq-t"><b>' + esc(s.name) + '</b><small>' + esc(s.tr) + ' · ' + s.v + ' verses · ' + (s.t === 'Meccan' ? 'Makki' : 'Madani') + '</small></span><span class="hq-ar" lang="ar">' + esc(s.ar) + '</span></button>';
    }).join('') || '<div class="empty">No surah matches “' + esc(q) + '”.</div>';
  }

  function open(n, a) {
    ensureScreen();
    if (typeof goS === 'function' && !$('s-quran').classList.contains('on')) goS('quran');
    $('hq-home').style.display = 'none'; var r = $('hq-read'); r.style.display = '';
    r.innerHTML = '<div class="empty">Loading…</div>';
    loadSurah(n).then(function (d) { S.surah = d; drawSurah(d, a); }).catch(function () {
      r.innerHTML = '<button type="button" class="hq-back" onclick="HMQ.home()">‹ Surahs</button><div class="empty">This surah could not be loaded. Check your connection and try again.<br><button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="HMQ.open(' + n + ')">Try again</button></div>';
    });
  }
  function drawSurah(d, a) {
    var o = S.opt, r = $('hq-read');
    var bism = d.n !== 1 && d.n !== 9;
    r.innerHTML = '<div class="hq-top"><button type="button" class="hq-back" onclick="HMQ.home()">‹ Surahs</button>' +
      '<div class="hq-tools"><button type="button" onclick="HMQ.size(-2)" aria-label="Smaller text">A−</button><button type="button" onclick="HMQ.size(2)" aria-label="Larger text">A+</button>' +
      '<button type="button" class="' + (o.en ? 'on' : '') + '" onclick="HMQ.toggleEn()">EN</button></div></div>' +
      '<div class="hq-head"><div class="hq-head-ar" lang="ar">' + esc(d.ar) + '</div><div class="hq-head-en">' + esc(d.name) + ' · ' + esc(d.tr) + ' · ' + d.ayahs.length + ' verses</div>' +
      '<label class="hq-rec">Reciter <select id="hq-rsel">' + RECITERS.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === o.r ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" class="hq-playall" onclick="HMQ.play(' + d.n + ',1)">▶ Play surah</button></div>' +
      (bism ? '<div class="hq-bism" lang="ar">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>' : '') +
      d.ayahs.map(function (y) {
        var t = y.ar;
        if (bism && y.k === 1) { var w = t.split(' '); if (/^بِسْمِ/.test(w[0]) && w.length > 4) t = w.slice(4).join(' '); }
        return '<div class="hq-ay" id="hq-a' + y.k + '"><div class="hq-ay-ar" lang="ar" dir="rtl" style="font-size:' + o.fs + 'px">' + esc(t) + ' <span class="hq-end">' + arNum(y.k) + '</span></div>' +
          (o.en ? '<div class="hq-ay-en"><b>' + d.n + ':' + y.k + '</b> ' + esc(y.en) + '</div>' : '') +
          '<div class="hq-ay-act"><button type="button" onclick="HMQ.play(' + d.n + ',' + y.k + ')">▶ Listen</button><button type="button" onclick="HMQ.bm(' + d.n + ',' + y.k + ')">🔖 Bookmark</button><button type="button" onclick="HMQ.share(' + y.k + ')">Share</button></div></div>';
      }).join('') +
      '<div class="hq-foot">' + (d.n > 1 ? '<button type="button" class="btn btn-ghost btn-sm" onclick="HMQ.open(' + (d.n - 1) + ')">‹ Previous surah</button>' : '<span></span>') + (d.n < 114 ? '<button type="button" class="btn btn-gold btn-sm" onclick="HMQ.open(' + (d.n + 1) + ')">Next surah ›</button>' : '') + '</div>' +
      '<div class="hm-note">Arabic: Uthmani script · English: Saheeh International · Audio: everyayah.com</div>';
    $('hq-rsel').onchange = function () { S.opt.r = this.value; put('qopt', S.opt); if (S.playing && S.cur) play(S.cur.s, S.cur.a); };
    var target = a ? $('hq-a' + a) : null;
    if (target) setTimeout(function () { target.scrollIntoView({ block: 'center' }); mark(a); }, 60); else window.scrollTo(0, 0);
    try { var m = $('main'); if (m && !a) m.scrollTop = 0; } catch (e) {}
    saveLast(d.n, a || 1);
  }
  function saveLast(s, a) { var name = S.surah && S.surah.n === s ? S.surah.name : (S.list ? (S.list[s - 1] || {}).name : ''); put('qlast', { s: s, a: a, name: name }); }
  function mark(a) { document.querySelectorAll('.hq-ay.cur').forEach(function (e) { e.classList.remove('cur'); }); var e = $('hq-a' + a); if (e) e.classList.add('cur'); }

  /* ── audio ── */
  function rec() { return RECITERS.filter(function (x) { return x[0] === S.opt.r; })[0] || RECITERS[0]; }
  function src(s, a) { return 'https://everyayah.com/data/' + rec()[2] + '/' + pad(s) + pad(a) + '.mp3'; }
  function play(s, a) {
    ensureScreen();
    S.cur = { s: s, a: a };
    var bar = $('hq-bar'); bar.style.display = ''; document.documentElement.classList.add('hq-playing');
    var name = (S.surah && S.surah.n === s) ? S.surah.name : ('Surah ' + s);
    $('hq-now-t').textContent = name + ' ' + s + ':' + a; $('hq-now-r').textContent = rec()[1];
    var au = S.audio, tried = false;
    au.onerror = function () { if (!tried) { tried = true; au.src = '/quran-audio?r=' + S.opt.r + '&s=' + s + '&a=' + a; au.play().catch(function () {}); } else { pause(); say('Audio could not load. Check your connection.'); } };
    au.onended = function () { if (S.opt.rep) { au.currentTime = 0; au.play().catch(function () {}); } else next(); };
    au.src = src(s, a); au.play().then(function () { S.playing = true; $('hq-play').textContent = '⏸'; }).catch(function () {});
    S.playing = true; $('hq-play').textContent = '⏸';
    mark(a); var e = $('hq-a' + a); if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' });
    saveLast(s, a);
    var total = S.surah && S.surah.n === s ? S.surah.ayahs.length : 0;
    if (total && a < total) { S.pre.src = src(s, a + 1); S.pre.preload = 'auto'; }
    if ('mediaSession' in navigator) { try { navigator.mediaSession.metadata = new MediaMetadata({ title: name + ' ' + s + ':' + a, artist: rec()[1], album: 'Haramain · The Holy Quran' }); navigator.mediaSession.setActionHandler('nexttrack', next); navigator.mediaSession.setActionHandler('pause', pause); navigator.mediaSession.setActionHandler('play', function () { play(S.cur.s, S.cur.a); }); } catch (x) {} }
  }
  function pause() { try { S.audio.pause(); } catch (e) {} S.playing = false; var b = $('hq-play'); if (b) b.textContent = '▶'; }
  function next() {
    if (!S.cur) return;
    var total = S.surah && S.surah.n === S.cur.s ? S.surah.ayahs.length : 0;
    if (total && S.cur.a < total) play(S.cur.s, S.cur.a + 1);
    else { pause(); say('✅ Surah complete'); }
  }

  /* ── public ── */
  window.HMQ = {
    home: home, open: open, play: play,
    size: function (d) { S.opt.fs = Math.max(18, Math.min(40, S.opt.fs + d)); put('qopt', S.opt); document.querySelectorAll('.hq-ay-ar').forEach(function (e) { e.style.fontSize = S.opt.fs + 'px'; }); },
    toggleEn: function () { S.opt.en = !S.opt.en; put('qopt', S.opt); if (S.surah) drawSurah(S.surah, S.cur && S.cur.s === S.surah.n ? S.cur.a : null); },
    bm: function (s, a) {
      var b = get('qbm', []), name = S.surah ? S.surah.name : '';
      if (b.some(function (x) { return x.s === s && x.a === a; })) { say('Already bookmarked'); return; }
      b.unshift({ s: s, a: a, name: name }); put('qbm', b.slice(0, 50)); say('🔖 Bookmarked ' + name + ' ' + s + ':' + a);
    },
    share: function (a) {
      var d = S.surah; if (!d) return; var y = d.ayahs[a - 1];
      var text = y.ar + '\n\n' + y.en + '\n— Quran ' + d.n + ':' + a + ' (' + d.name + ')\n\nShared from Haramain · haramain.pi';
      if (navigator.share) navigator.share({ title: 'Quran ' + d.n + ':' + a, text: text }).catch(function () {}); else { try { navigator.clipboard.writeText(text); say('Copied'); } catch (e) {} }
    },
    last: function () { return get('qlast', null); }
  };

  /* ── wiring ── */
  function start() {
    ensureScreen();
    var _goS = window.goS;
    window.goS = function (id, btn) {
      if (id === 'quran') {
        document.querySelectorAll('.scr').forEach(function (s) { s.classList.remove('on'); });
        document.querySelectorAll('.bni').forEach(function (b) { b.classList.remove('on'); });
        $('s-quran').classList.add('on'); try { $('main').scrollTop = 0; } catch (e) {} window.scrollTo(0, 0);
        if ($('hq-read').style.display === 'none' || !S.surah) home();
        return;
      }
      return _goS.apply(this, arguments);
    };
    var _o = window.oUtil;
    window.oUtil = function (id) { if (id === 'quran') { goS('quran'); return; } return _o.apply(this, arguments); };
    // entry points: More hub + worship tile text
    var worshipGrid = Array.prototype.filter.call(document.querySelectorAll('#s-more .hub-grid'), function (g) { return /goS\('audio'\)/.test(g.innerHTML); })[0];
    if (worshipGrid && !/goS\('quran'\)/.test(worshipGrid.innerHTML)) worshipGrid.insertAdjacentHTML('afterbegin', '<div class="hub-item" onclick="goS(\'quran\')"><div class="hub-icon">📖</div><div class="hub-name">Quran</div></div>');
    document.querySelectorAll('[onclick="oUtil(\'quran\')"] .tc-desc').forEach(function (e) { e.textContent = '114 surahs · 7 reciters'; });
    document.querySelectorAll('[onclick="oUtil(\'quran\')"] .tc-name').forEach(function (e) { e.textContent = 'The Holy Quran'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 80); }); else setTimeout(start, 80);
})();
