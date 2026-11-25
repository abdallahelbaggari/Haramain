/* Haramain Home — big live Pi card, quick actions, Hadith and Dua of the day, every tool in clear groups with
   search, Wallet in the centre of the bottom bar, "My Pi QR" for merchants, and a Security center
   (hide amounts, payment alerts, safety tips). Everything runs on the phone. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K = window.K || 'hm_v1_';
  var get = function (k, d) { try { var v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var uname = function () { return (typeof user !== 'undefined' && user && !user.guest) ? user.username : ''; };
  var num = function (n, d) { return Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); };
  var dayNo = function () { var d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); };
  function sheet(title, inner, id) {
    var old = id && $(id); if (old) old.remove();
    var w = document.createElement('div'); w.className = 'hm-sheet-wrap'; if (id) w.id = id;
    w.innerHTML = '<div class="hm-sheet" role="dialog" aria-label="' + esc(title) + '"><div class="hm-sheet-t">' + title + '</div>' + inner + '<button type="button" class="hm-sheet-x">Close</button></div>';
    w.addEventListener('click', function (e) { if (e.target === w || (e.target.classList.contains('hm-sheet-x') && e.target.tagName === 'BUTTON')) w.remove(); });
    document.body.appendChild(w); return w;
  }

  /* ───────── Security: hide amounts, safety tips ───────── */
  function sec() { var s = get('sec', null); return s && typeof s === 'object' ? s : { hide: false }; }
  window.hmSecSet = function (k, v) { var s = sec(); s[k] = v; put('sec', s); applyHide(); };
  function applyHide() { document.documentElement.classList.toggle('hm-hide-amt', !!sec().hide); }
  window.hmToggleHide = function () { hmSecSet('hide', !sec().hide); say(sec().hide ? 'Amounts hidden' : 'Amounts shown'); };
  window.hmSecurity = function () {
    var s = sec();
    var w = sheet('🛡️ Security center',
      '<div class="hm-secg"><div class="hm-sec-i">🙈</div><div><b>Hide amounts</b><small>Hide prices and amounts on screen in public places</small></div><label class="hm-tg"><input type="checkbox" ' + (s.hide ? 'checked' : '') + ' onchange="hmSecSet(\'hide\',this.checked)"><span></span></label></div>' +
      '<div class="hm-secg"><div class="hm-sec-i">⟳</div><div><b>Resolve a pending payment</b><small>Finishes or clears an unfinished payment</small></div><button type="button" onclick="hmResolvePending(true)">Resolve</button></div>' +
      '<div class="hm-secg"><div class="hm-sec-i">🔔</div><div><b>Payment alerts</b><small>Sound and vibration for every payment</small></div><button type="button" onclick="hmFxSettings()">Open</button></div>' +
      '<div class="hm-tips"><b>Stay safe</b><ul>' +
        '<li>Haramain never asks for your Pi passphrase. Anyone who asks is a scammer.</li>' +
        '<li>Check the amount and the @username before every payment.</li>' +
        '<li>Payments on the Pi blockchain cannot be reversed. Pay only people you trust.</li>' +
        '<li>Every receipt has a transaction ID you can check on the Pi blockchain. An edited receipt will not match.</li>' +
        '<li>Use the Mainnet only with real Pi; the Testnet uses test Pi with no value.</li></ul></div>', 'hm-security');
    return w;
  };
  /* ───────── My Pi QR: customers scan to pay you inside Haramain ───────── */
  function enc(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  window.hmMyQr = function () {
    if (!uname()) { say('Sign in with Pi to get your payment QR'); try { piLogin(); } catch (e) {} return; }
    var name = get('bizName', '') || get('fullname', '') || '@' + uname(), url = location.origin + '/#send=' + enc({ u: uname(), a: 0, x: 'Payment to ' + name.slice(0, 50) });
    var w = sheet('▦ My Pi QR', '<div class="hm-qr"><div class="hm-qr-k">HARAMAIN · PAY WITH PI</div><canvas id="myqr"></canvas><b>' + esc(name) + '</b><span>' + (name === '@' + uname() ? 'Scan to pay' : '@' + esc(uname()) + ' · Scan to pay') + '</span></div>' +
      '<div class="wf-two"><button type="button" class="wf-cta" id="qr-save">⬇️ Save QR</button><button type="button" class="wf-cta wf-cta2" id="qr-share">📤 Share link</button></div>', 'hm-myqr');
    var cv = $('myqr');
    try { HMQR.toCanvas(cv, url, { width: 260, margin: 1, color: { dark: '#07462F', light: '#FFFFFF' } }); } catch (e) {}
    $('qr-share').onclick = function () { var t = 'Pay ' + name + ' with Pi in Haramain:'; if (navigator.share) navigator.share({ title: 'Pay with Pi', text: t, url: url }).catch(function () {}); else { try { navigator.clipboard.writeText(t + ' ' + url); say('Link copied'); } catch (e) {} } };
    $('qr-save').onclick = function () {
      var c = document.createElement('canvas'), W = 900, H = 1200, x = c.getContext('2d'); c.width = W; c.height = H;
      var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0E7A52'); g.addColorStop(1, '#07462F'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      var big = document.createElement('canvas'); try { HMQR.toCanvas(big, url, { width: 560, margin: 2, color: { dark: '#07462F', light: '#FFFFFF' } }); } catch (e) {}
      x.fillStyle = '#fff'; x.fillRect(150, 300, 600, 600); x.imageSmoothingEnabled = false; x.drawImage(big, 170, 320, 560, 560);
      x.textAlign = 'center'; x.fillStyle = '#E6BD5C'; x.font = '800 44px DM Sans, sans-serif'; x.fillText('HARAMAIN', W / 2, 130);
      x.fillStyle = '#fff'; x.font = '800 56px DM Sans, sans-serif'; x.fillText('Pay with Pi', W / 2, 220);
      x.font = '800 46px DM Sans, sans-serif'; x.fillText(name.slice(0, 28), W / 2, 990); x.font = '600 34px DM Sans, sans-serif'; x.fillStyle = 'rgba(255,255,255,.85)'; x.fillText(name === '@' + uname() ? 'Scan to pay' : '@' + uname() + ' · scan to pay', W / 2, 1050);
      x.font = '500 26px DM Sans, sans-serif'; x.fillText('Secure payments on Pi Network', W / 2, 1130);
      c.toBlob(function (b) { if (window.HMFiles) HMFiles.save(b, 'Haramain-pay-QR-' + uname() + '.jpg', 'image/jpeg', 'QR code'); }, 'image/jpeg', 0.92);
    };
  };

  /* ───────── Home ───────── */
  var QA = [['💎', 'Wallet', "goS('payments')", 'w'], ['📖', 'Quran', "goS('quran')", 'g'], ['🕰️', 'Prayer times', "hmOpen('worship')", 'g'], ['🧭', 'Qibla', "hmOpen('worship','qibla')", 'g'],
    ['🕋', 'Tawaf', "hmOpen('worship','tawaf')", 'o'], ['🤲', 'Duas', "hmOpen('worship','dua-lib')", 'o'], ['📜', '40 Hadith', "goS('hadith')", 'o'], ['🆘', 'Emergency', "hmOpen('emergency')", 'r']];
  function piCard() {
    var p = window.PiPrice && PiPrice.get && PiPrice.get(), l = window.PiPrice && PiPrice.local ? PiPrice.local() : { code: 'NGN', sym: '₦', rate: null };
    var ch = p && typeof p.change24h === 'number' ? p.change24h : null;
    var big = !p || !p.usd ? '—' : (l.rate && l.code !== 'SAR' && l.code !== 'USD' ? l.sym + num(l.rate, l.rate < 10 ? 3 : 2) : 'SAR ' + num(p.sar, 4));
    return '<div class="hh-pi" role="button" tabindex="0" onclick="goS(\'payments\')">' +
      '<div class="hh-pi-t"><span><i class="hh-live' + (p && p.usd && !p.stale ? '' : ' off') + '"></i>Pi price · live</span><span class="hh-pi-net">π Pi Network</span></div>' +
      '<div class="hh-pi-v"><small>1 π =</small><b class="hm-amt">' + big + '</b>' + (ch !== null ? '<em class="' + (ch >= 0 ? 'up' : 'dn') + '">' + (ch >= 0 ? '▲ ' : '▼ ') + Math.abs(ch).toFixed(2) + '%</em>' : '') + '</div>' +
      '<div class="hh-pi-s hm-amt">' + (p && p.usd ? 'SAR ' + num(p.sar, 4) + ' · $' + num(p.usd, 4) + ' · ' + esc(l.code) + ' live' : 'Loading live price…') + '</div>' +
      '<div class="hh-pi-a"><button type="button" onclick="event.stopPropagation();goS(\'payments\')">💎 Open wallet</button><button type="button" class="tx-only" onclick="event.stopPropagation();hmSendSheet()">↗ Send</button><button type="button" onclick="event.stopPropagation();hmMyQr()">▦ My Pi QR</button></div></div>';
  }
  function dayCards() {
    var out = '', dn = dayNo();
    var D = []; try { if (typeof DUAS !== 'undefined' && DUAS) Object.keys(DUAS).forEach(function (k) { (DUAS[k] || []).forEach(function (d) { if (d && d.ar && d.en) D.push(d); }); }); } catch (e) {}
    out += '<div class="hh-day" id="hh-hadith"><div class="hh-day-k">📜 Hadith of the day</div><div class="hh-day-b">Loading…</div></div>';
    if (D.length) { var d = D[dn % D.length]; out += '<div class="hh-day hh-dua"><div class="hh-day-k">🤲 Dua of the day · ' + esc(d.title || '') + '</div><div class="hh-day-ar" lang="ar" dir="rtl">' + esc(d.ar) + '</div><div class="hh-day-en">' + esc(d.en) + '</div><div class="hh-day-f"><button type="button" onclick="hmOpen(\'worship\',\'dua-lib\')">All duas ›</button><button type="button" onclick="hmShareDay(this)">Share</button></div></div>'; }
    return '<div class="hh-days">' + out + '</div>';
  }
  window.hmShareDay = function (b) { var c = b.closest('.hh-day'); if (!c) return; var t = [c.querySelector('.hh-day-ar'), c.querySelector('.hh-day-en')].map(function (e) { return e ? e.textContent : ''; }).join('\n\n') + '\n\nShared from Haramain · haramain.pi'; if (navigator.share) navigator.share({ title: 'Haramain', text: t }).catch(function () {}); else { try { navigator.clipboard.writeText(t); say('Copied'); } catch (e) {} } };
  function fillHadith() {
    fetch('/haramain-hadith.json?v=1').then(function (r) { return r.json(); }).then(function (d) {
      var L = d.hadith || [], x = L[dayNo() % L.length], e = $('hh-hadith'); if (!x || !e) return;
      var en = x.en.replace(/\s+/g, ' '); var shortEn = en.length > 260 ? en.slice(0, 257) + '…' : en;
      e.innerHTML = '<div class="hh-day-k">📜 Hadith of the day · ' + x.n + ' of 42</div><div class="hh-day-en">' + esc(shortEn) + '</div><div class="hh-day-f"><span>An-Nawawi’s Forty Hadith</span><button type="button" onclick="goS(\'hadith\');setTimeout(function(){HMH.open(' + x.n + ')},60)">Read ›</button></div>';
    }).catch(function () { var e = $('hh-hadith'); if (e) e.remove(); });
  }
  function organise() {
    var dash = $('s-dashboard'); if (!dash || $('hh-top')) return;
    var top = document.createElement('div'); top.id = 'hh-top';
    top.innerHTML = '<div id="hh-picard">' + piCard() + '</div>' +
      '<div class="hh-sec"><h3>Quick actions</h3></div><div class="hh-qa">' + QA.map(function (q) { return '<button type="button" class="c-' + q[3] + '" onclick="' + q[2] + '"><i>' + q[0] + '</i><span>' + q[1] + '</span></button>'; }).join('') + '</div>' +
      dayCards() +
      '<div class="hh-sec"><h3>All tools</h3><span>Find anything in seconds</span></div><input class="fi hh-q" id="hh-q2" type="search" placeholder="🔍  Search tools: Qibla, Zakat, Tawaf, Wallet…" autocomplete="off"><div class="hh-chips" id="hh-chips"></div>';
    var today = $('hm-today'); if (today) dash.insertBefore(top, today); else dash.insertBefore(top, dash.children[1] || null);
    var old = $('hm-pi-dash'); if (old) old.style.display = 'none';
    // move the full tools map right under the search and show it one group at a time
    var nv = $('nv-home');
    if (nv) {
      top.appendChild(nv); var lbl = nv.querySelector('.sec-label'); if (lbl) lbl.style.display = 'none';
      var groups = Array.prototype.slice.call(nv.querySelectorAll('.nv-g'));
      $('hh-chips').innerHTML = groups.map(function (g, i) { var h = g.querySelector('.nv-h'); return '<button type="button" data-g="' + i + '" class="' + (i === 0 ? 'on' : '') + '">' + esc(h ? h.textContent : 'Tools') + '</button>'; }).join('');
      var show = function (i) { groups.forEach(function (g, k) { g.style.display = k === i ? '' : 'none'; }); document.querySelectorAll('#hh-chips button').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-g') === i); }); };
      show(get('hhG', 0) < groups.length ? get('hhG', 0) : 0);
      document.querySelectorAll('#hh-chips button').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-g'); put('hhG', i); $('hh-q2').value = ''; filter(''); show(i); }; });
      var filter = function (q) {
        q = q.trim().toLowerCase(); nv.classList.toggle('hh-searching', !!q);
        if (!q) { show(get('hhG', 0)); nv.querySelectorAll('.nv-t').forEach(function (t) { t.style.display = ''; }); var e0 = $('hh-none'); if (e0) e0.remove(); return; }
        var n = 0; groups.forEach(function (g) { var any = false; g.querySelectorAll('.nv-t').forEach(function (t) { var hit = t.textContent.toLowerCase().indexOf(q) >= 0; t.style.display = hit ? '' : 'none'; if (hit) { any = true; n++; } }); g.style.display = any ? '' : 'none'; });
        var e = $('hh-none'); if (!n) { if (!e) nv.insertAdjacentHTML('beforeend', '<div class="empty" id="hh-none">No tool matches “' + esc(q) + '”.</div>'); } else if (e) e.remove();
      };
      $('hh-q2').oninput = function () { filter(this.value); };
    }
    fillHadith();
  }
  function refreshPi() { var c = $('hh-picard'); if (c) c.innerHTML = piCard(); }

  /* ───────── Wallet in the centre of the bottom bar ───────── */
  function nav() {
    var bn = $('bnav'); if (!bn || bn.querySelector('.bni-c')) return;
    var ai = bn.querySelector('[data-s="ai"]'), pr = bn.querySelector('[data-s="profile"]'), gd = bn.querySelector('[data-s="guide"]');
    if (ai) ai.remove(); if (pr) pr.remove();
    var w = document.createElement('button'); w.className = 'bni bni-c'; w.setAttribute('data-s', 'payments'); w.setAttribute('onclick', "goS('payments',this)");
    w.innerHTML = '<span class="bni-i">💎</span><span class="bni-l">Wallet</span>';
    if (gd) bn.insertBefore(w, gd); else bn.appendChild(w);
    var hu = $('hdr-user'); if (hu) { hu.style.cursor = 'pointer'; hu.title = 'Profile'; hu.onclick = function () { goS('profile'); }; }
  }

  /* tap ripple on the main buttons */
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.hm-qa i, .hh-qa i, .wf-cta, .hm-sheet-a, .hh-pi-a button, #bnav .bni-c .bni-i'); if (!b) return;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative'; b.style.overflow = 'hidden';
    var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height), s = document.createElement('span'); s.className = 'hm-rip';
    s.style.width = s.style.height = d + 'px'; s.style.left = (e.clientX - r.left - d / 2) + 'px'; s.style.top = (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(s); setTimeout(function () { s.remove(); }, 600);
  }, true);
  function start() {
    try { var s0 = sec(); if (s0.pin || s0.salt) { delete s0.pin; delete s0.salt; delete s0.lockMin; put('sec', s0); } } catch (e) {}   // the wallet PIN was removed
    try { nav(); } catch (e) {}
    try { organise(); } catch (e) {}
    applyHide();
    window.addEventListener('pi-price', refreshPi);
    setInterval(function () { if (!document.hidden) refreshPi(); }, 30000);
    // Security center, QR and hide amounts on the wallet screen (added whenever the wallet is drawn)
    var addTools = function () { var q = document.querySelector('#wl-top .hm-qa'); if (q && !$('hm-wsec')) q.insertAdjacentHTML('afterend', '<div class="hm-wtools" id="hm-wsec"><button type="button" onclick="hmSecurity()">🛡️ Security</button><button type="button" onclick="hmMyQr()">▦ My Pi QR</button><button type="button" onclick="hmToggleHide()">🙈 Hide amounts</button></div>'); };
    new MutationObserver(addTools).observe(document.body, { childList: true, subtree: true });
    // the Pi card on the old dashboard position stays hidden even if redrawn
    setInterval(function () { var old = $('hm-pi-dash'); if (old && old.style.display !== 'none') old.style.display = 'none'; if (!$('hh-top')) organise(); }, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 260); }); else setTimeout(start, 260);
})();
