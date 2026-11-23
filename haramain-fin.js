/* Haramain Wallet+ — history backed up for the Pi account, monthly statement (PDF) and CSV, Business (invoices with
   items, sales summary, reports), payment sounds and vibration, and An-Nawawi's 40 Hadith.
   Payments still go Pi Wallet → Pi Wallet and are verified on the Pi blockchain. Haramain never holds Pi. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K = window.K || 'hm_v1_';
  var get = function (k, d) { try { var v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var uname = function () { return (typeof user !== 'undefined' && user && !user.guest) ? user.username : ''; };
  var tok = function () { return window.HM_TOKEN || ''; };
  var fullName = function () { return get('fullname', '') || (uname() ? '@' + uname() : 'Guest'); };
  var TESTNET = /(^|[.-])testnet[.-]/i.test(location.hostname), NETN = TESTNET ? 'Pi Testnet' : 'Pi Mainnet';
  var fmt = function (n, d) { n = +n || 0; return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d == null ? 4 : d }); };
  var P = function (v) { return +(+v || 0).toFixed(7); };
  var isoDay = function (t) { var d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var dstr = function (t, o) { return new Date(t).toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }); };
  var rows = function () { try { return hmRows(); } catch (e) { return []; } };
  var redraw = function () { try { hmDrawWallet(); } catch (e) {} };
  function sheet(title, inner, id) {
    var old = id && $(id); if (old) old.remove();
    var w = document.createElement('div'); w.className = 'hm-sheet-wrap'; if (id) w.id = id;
    w.innerHTML = '<div class="hm-sheet hm-sheet-l" role="dialog" aria-label="' + esc(title) + '"><div class="hm-sheet-t">' + title + '</div>' + inner + '<button type="button" class="hm-sheet-x">Close</button></div>';
    w.addEventListener('click', function (e) { if (e.target === w || (e.target.classList.contains('hm-sheet-x') && e.target.tagName === 'BUTTON')) w.remove(); });
    document.body.appendChild(w); return w;
  }
  /* Start the Pi SDK once, as soon as the app opens (like FinPi): Pi is ready before anyone taps Sign in,
     and a second Pi.init before a sign-in can no longer leave Pi.authenticate waiting. */
  (function () {
    if (!window.Pi || !Pi.init || Pi._hmOnce) return;
    var orig = Pi.init.bind(Pi), done = false; Pi._hmOnce = true;
    Pi.init = function (o) { if (done) return; done = true; try { return orig(o); } catch (e) { done = false; throw e; } };
    try { Pi.init({ version: '2.0', sandbox: !!window.PI_SANDBOX }); } catch (e) {}
  })();
  /* keep web links inside the Pi Browser (no jump to another browser) */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var h = a.getAttribute('href') || '';
    if (a.target === '_blank' && /^https?:\/\//.test(h) && !a.hasAttribute('download')) { e.preventDefault(); location.assign(h); }
  }, true);
  var closeAll = function () { document.querySelectorAll('.hm-sheet-wrap').forEach(function (x) { x.remove(); }); };

  /* ───────── history, backed up for this Pi account (never lost, restored on any phone) ───────── */
  function hKey(r) { var t = String(r.txid || '').toLowerCase(); if (/^[a-f0-9]{64}$/.test(t)) return 'tx:' + t + (r.refund ? ':r' : '') + (r.dir ? ':' + r.dir : ''); var f = String(r.ref || r.pid || ''); return f ? 'ref:' + f : ''; }
  function hApi(b) { return fetch('/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); }
  var hBusy = false, hT = null;
  function hPush() {
    if (!tok()) return Promise.resolve();
    var A = get('rcpts', []), todo = A.filter(function (r) { return !r.hs && hKey(r) && !/pending/i.test(r.status || ''); }).slice(0, 200);
    if (!todo.length) return Promise.resolve();
    var items = todo.map(function (r) { var o = {}; for (var k in r) if (k !== 'hs') o[k] = r[k]; return o; });
    return hApi({ a: 'push', accessToken: tok(), items: items }).then(function (d) {
      if (!d || !d.ok) return; todo.forEach(function (r) { r.hs = 1; }); put('rcpts', A);
      if (todo.length === 200) return hPush();
    });
  }
  function hMerge(items) {
    var A = get('rcpts', []), have = {}, n = 0;
    A.forEach(function (r) { have[hKey(r)] = 1; });
    items.forEach(function (r) { var k = hKey(r); if (!k || have[k]) return; have[k] = 1; n++; r.hs = 1; A.push(r); });
    if (n) { A.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }); put('rcpts', A.slice(0, 3000)); }
    return n;
  }
  function hSync() {
    if (hBusy || !tok()) return; hBusy = true;
    hPush().then(function () { return hApi({ a: 'pull', accessToken: tok(), limit: 500 }); }).then(function (d) {
      if (!d || !d.ok) return; try { hmSetMore(d.more); } catch (e) {}
      if (hMerge(d.items || [])) redraw();
    }).catch(function () {}).then(function () { hBusy = false; });
  }
  window.hmHistSoon = function () { clearTimeout(hT); hT = setTimeout(hSync, 1500); };
  window.hmHistOlder = function (btn) {
    if (!tok()) return say('Sign in with Pi to load your full history');
    var oldest = rows().reduce(function (m, r) { return Math.min(m, r.ts || m); }, Date.now() + 864e5);
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    hApi({ a: 'pull', accessToken: tok(), before: oldest, limit: 500 }).then(function (d) {
      if (!d || !d.ok) { say((d && d.error) || 'Could not load older history'); return; }
      try { hmSetMore(d.more); } catch (e) {} var n = hMerge(d.items || []); say(n ? n + ' older payments loaded' : 'You have reached the start of your history');
    }).catch(function () { say('No connection. Try again.'); }).then(function () { try { hmDrawTx(); } catch (e) {} });
  };
  (function () { var n = 0, iv = setInterval(function () { if (tok()) { clearInterval(iv); hSync(); } else if (++n > 150) clearInterval(iv); }, 2000); })();
  // back up new receipts soon after they are saved
  (function () { var last = (get('rcpts', []) || []).length; setInterval(function () { var n = (get('rcpts', []) || []).length; if (n !== last) { last = n; hmHistSoon(); } }, 5000); })();

  /* ───────── CSV and monthly statement (PDF) ───────── */
  function csvSave(lines, name, what) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    HMFiles.save(new Blob(['﻿' + lines.map(function (l) { return l.map(q).join(','); }).join('\n')], { type: 'text/csv' }), name, 'text/csv', what || 'file');
  }
  window.hmCsv = function () {
    var R = rows(); if (!R.length) return say('No payments yet');
    var L = [['Date', 'Time', 'Direction', 'Details', 'Description', 'Status', 'Amount (Pi)', 'Value at payment time (USD)', 'Network', 'Transaction ID']];
    R.forEach(function (r) { var d = new Date(r.ts), x = r.raw || {}; L.push([isoDay(r.ts), d.toTimeString().slice(0, 5), r.dir === 'in' ? 'Received' : 'Sent', r.title, r.sub, r.st, (r.dir === 'in' ? '' : '-') + r.amt, x.usd ? (+r.amt * x.usd).toFixed(2) : '', x.net || NETN, x.txid || '']); });
    csvSave(L, 'Haramain-payments-' + isoDay(Date.now()) + '.csv', 'payments file');
  };
  function monthRange(k) { var d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() + k); var e = new Date(d); e.setMonth(e.getMonth() + 1); return [d.getTime(), e.getTime(), d]; }
  window.hmStatement = function () {
    var R = rows(), opts = [], sel = 0;
    for (var k = 0; k > -12; k--) { var m = monthRange(k); if (k === 0 || R.some(function (r) { return r.ts >= m[0] && r.ts < m[1]; })) opts.push(k); }
    var w = sheet('📄 Monthly statement', '<div class="hm-sheet-b">A PDF of all your Haramain wallet payments for a month, with values and transaction IDs.</div>' +
      '<div class="wf-tabs" id="st-m" style="margin-top:12px;flex-wrap:wrap">' + opts.map(function (k) { return '<button type="button" data-m="' + k + '" class="' + (k === 0 ? 'on' : '') + '">' + monthRange(k)[2].toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) + '</button>'; }).join('') + '</div>' +
      '<div class="hm-stats" id="st-s" style="margin-top:10px"></div><div class="wf-two"><button type="button" class="wf-cta" id="st-d">⬇️ Download</button><button type="button" class="wf-cta wf-cta2" id="st-h">📤 Share</button></div>', 'hm-stmt');
    function info() {
      var m = monthRange(sel), inn = 0, o = 0, n = 0; R.forEach(function (r) { if (r.ts >= m[0] && r.ts < m[1]) { n++; if (r.dir === 'in') inn += +r.amt; else o += +r.amt; } });
      $('st-s').innerHTML = '<div><small>Sent</small><b>' + fmt(o, 4) + ' π</b></div><div><small>Received</small><b class="pos">' + fmt(inn, 4) + ' π</b></div><div><small>Payments</small><b>' + n + '</b></div>';
    }
    w.querySelectorAll('#st-m button').forEach(function (b) { b.onclick = function () { sel = +b.getAttribute('data-m'); w.querySelectorAll('#st-m button').forEach(function (x) { x.classList.toggle('on', x === b); }); info(); }; });
    info();
    function make(sh) {
      say('Preparing your statement…');
      buildStatement(sel).then(function (o) { if (sh) HMFiles.shareFile(o.blob, o.name, 'application/pdf', 'Haramain statement', 'Haramain statement · ' + o.label); else HMFiles.save(o.blob, o.name, 'application/pdf', 'statement'); })
        .catch(function () { say('Could not create the statement. Please try again.'); });
    }
    $('st-d').onclick = function () { make(false); }; $('st-h').onclick = function () { make(true); };
  };
  function buildStatement(off) {
    var m = monthRange(off), R = rows().filter(function (r) { return r.ts >= m[0] && r.ts < m[1]; }).sort(function (a, b) { return a.ts - b.ts; });
    var F = "'DM Sans','Segoe UI',Roboto,Arial,sans-serif", MF = "ui-monospace,Menlo,Consolas,monospace", W = 1240, H = 1754, X = 80;
    var mon = m[2].toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), inn = 0, o = 0; R.forEach(function (r) { if (r.dir === 'in') inn += +r.amt; else o += +r.amt; });
    var pages = [R.slice(0, 11)]; for (var i = 11; i < R.length; i += 15) pages.push(R.slice(i, i + 15));
    function txt(x, t, px, py, font, col, al) { x.font = font; x.fillStyle = col; x.textAlign = al || 'left'; x.fillText(t, px, py); }
    function fit(x, t, mw) { t = String(t || ''); if (x.measureText(t).width <= mw) return t; while (t.length > 1 && x.measureText(t + '…').width > mw) t = t.slice(0, -1); return t + '…'; }
    return new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = '/icons/icon-192.png'; }).then(function (logo) {
      return Promise.all(pages.map(function (list, pg) {
        var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d'), y;
        x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
        if (pg === 0) {
          var g = x.createLinearGradient(0, 0, W, 300); g.addColorStop(0, '#07462F'); g.addColorStop(.7, '#0A6B45'); g.addColorStop(1, '#C9A227'); x.fillStyle = g; x.fillRect(0, 0, W, 300);
          if (logo) x.drawImage(logo, X, 62, 76, 76);
          txt(x, 'Haramain', X + 96, 116, '800 44px ' + F, '#FFFFFF');
          txt(x, 'MONTHLY STATEMENT', W - X, 92, '700 22px ' + F, 'rgba(255,255,255,.85)', 'right'); txt(x, mon, W - X, 140, '800 40px ' + F, '#FFFFFF', 'right');
          txt(x, fullName() + (uname() && fullName() !== '@' + uname() ? ' · @' + uname() : ''), X, 214, '700 28px ' + F, '#FFFFFF');
          txt(x, NETN + ' · Wallet payments', X, 254, '500 22px ' + F, 'rgba(255,255,255,.85)');
          var bx = [['Sent', fmt(o, 4) + ' π'], ['Received', fmt(inn, 4) + ' π'], ['Net', (inn - o >= 0 ? '+' : '−') + fmt(Math.abs(inn - o), 4) + ' π'], ['Payments', String(R.length)]], bw = (W - 2 * X - 60) / 4;
          bx.forEach(function (b, k) { var bX = X + k * (bw + 20); x.fillStyle = '#F1F7F3'; x.fillRect(bX, 340, bw, 130); txt(x, b[0].toUpperCase(), bX + 22, 382, '700 18px ' + F, '#4B5B53'); x.font = '700 32px ' + MF; txt(x, fit(x, b[1], bw - 44), bX + 22, 436, '700 32px ' + MF, k === 1 ? '#0A6B45' : '#13261E'); });
          y = 540;
        } else { x.fillStyle = '#07462F'; x.fillRect(0, 0, W, 130); if (logo) x.drawImage(logo, X, 35, 60, 60); txt(x, 'Haramain', X + 76, 78, '800 32px ' + F, '#FFFFFF'); txt(x, 'Statement · ' + mon, W - X, 78, '600 24px ' + F, '#FFFFFF', 'right'); y = 190; }
        x.fillStyle = '#13261E'; x.fillRect(X, y, W - 2 * X, 2);
        txt(x, 'DATE', X, y + 38, '700 17px ' + F, '#4B5B53'); txt(x, 'DETAILS', X + 170, y + 38, '700 17px ' + F, '#4B5B53'); txt(x, 'AMOUNT', W - X - 200, y + 38, '700 17px ' + F, '#4B5B53', 'right'); txt(x, 'VALUE', W - X, y + 38, '700 17px ' + F, '#4B5B53', 'right');
        y += 58; x.fillStyle = '#E3E9E5'; x.fillRect(X, y, W - 2 * X, 1);
        if (!list.length) txt(x, 'No payments this month.', W / 2, y + 90, '500 26px ' + F, '#4B5B53', 'center');
        list.forEach(function (r) {
          var d = new Date(r.ts), ii = r.dir === 'in', raw = r.raw || {};
          txt(x, d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), X, y + 40, '700 22px ' + F, '#13261E'); txt(x, d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), X, y + 70, '500 18px ' + F, '#4B5B53');
          x.font = '700 22px ' + F; txt(x, fit(x, r.title, 600), X + 170, y + 40, '700 22px ' + F, '#13261E');
          var sub = [r.sub, r.st, raw.txid ? 'Tx ' + String(raw.txid).slice(0, 10) + '…' : ''].filter(Boolean).join(' · '); x.font = '500 18px ' + F; txt(x, fit(x, sub, 600), X + 170, y + 70, '500 18px ' + F, '#4B5B53');
          txt(x, (ii ? '+' : '−') + fmt(+r.amt, 7) + ' π', W - X - 200, y + 40, '700 22px ' + MF, ii ? '#0A6B45' : '#13261E', 'right');
          txt(x, raw.usd ? '$' + fmt(+r.amt * raw.usd, 2) : '—', W - X, y + 40, '600 20px ' + F, '#13261E', 'right');
          y += 92; x.fillStyle = '#EEF3EF'; x.fillRect(X, y, W - 2 * X, 1);
        });
        x.fillStyle = '#E3E9E5'; x.fillRect(X, H - 120, W - 2 * X, 1);
        txt(x, 'Generated by Haramain on ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '. Check any payment on the Pi blockchain with its transaction ID.', X, H - 80, '500 17px ' + F, '#4B5B53');
        txt(x, '© Haramain ' + new Date().getFullYear() + ' · haramain.pi', X, H - 52, '500 17px ' + F, '#7A8A81'); txt(x, 'Page ' + (pg + 1) + ' of ' + pages.length, W - X, H - 80, '700 17px ' + F, '#4B5B53', 'right');
        return new Promise(function (ok, no) { cv.toBlob(function (b) { if (!b) return no(new Error('jpg')); b.arrayBuffer().then(function (ab) { ok({ w: W, h: H, bytes: new Uint8Array(ab) }); }, no); }, 'image/jpeg', 0.9); });
      }));
    }).then(function (imgs) { return { blob: makePdf(imgs), name: 'Haramain-statement-' + isoDay(m[2]).slice(0, 7) + '.pdf', label: mon }; });
  }
  function makePdf(imgs) {
    var te = new TextEncoder(), chunks = [], len = 0, offs = [];
    function add(v) { if (typeof v === 'string') v = te.encode(v); chunks.push(v); len += v.length; }
    function obj(id, body) { offs[id] = len; add(id + ' 0 obj\n' + body + '\nendobj\n'); }
    add('%PDF-1.4\n'); add(new Uint8Array([37, 226, 227, 207, 211, 10]));
    var n = imgs.length, kids = []; for (var k = 0; k < n; k++) kids.push((3 + k * 3) + ' 0 R');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>');
    imgs.forEach(function (im, k) {
      var p = 3 + k * 3, img = p + 1, ct = p + 2, st = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
      obj(p, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ' + img + ' 0 R >> >> /Contents ' + ct + ' 0 R >>');
      offs[img] = len; add(img + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>\nstream\n'); add(im.bytes); add('\nendstream\nendobj\n');
      obj(ct, '<< /Length ' + st.length + ' >>\nstream\n' + st + '\nendstream');
    });
    var total = 3 + n * 3, xr = len, t = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (var id = 1; id < total; id++) t += String(offs[id]).padStart(10, '0') + ' 00000 n \n';
    add(t + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  }

  /* ───────── payment sounds and vibration ───────── */
  var AC = null;
  function ac() {
    if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { AC = new C(); } catch (e) { return null; } }
    if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
    return AC;
  }
  document.addEventListener('pointerdown', function unlock() { try { ac(); } catch (e) {} document.removeEventListener('pointerdown', unlock, true); }, true);
  var SOUNDS = { in: [[880, 0, .2], [1175, .11, .22], [1568, .22, .42]], out: [[1047, 0, .14], [784, .09, .26]], ok: [[659, 0, .14], [880, .1, .16], [1319, .2, .36]], err: [[392, 0, .2, 'triangle'], [294, .16, .3, 'triangle']] };
  var VIB = { in: [70, 50, 140], out: [60], ok: [40, 40, 60], err: [160, 90, 160] };
  function fxPrefs() { var o = get('fx', null); return o && typeof o === 'object' ? o : { s: true, v: true }; }
  function tone(seq) {
    var c = ac(); if (!c) return; var t = c.currentTime + .03;
    seq.forEach(function (n) {
      var o = c.createOscillator(), g = c.createGain(); o.type = n[3] || 'sine'; o.frequency.setValueAtTime(n[0], t + n[1]);
      g.gain.setValueAtTime(.0001, t + n[1]); g.gain.exponentialRampToValueAtTime(.25, t + n[1] + .015); g.gain.exponentialRampToValueAtTime(.0001, t + n[1] + n[2]);
      o.connect(g); g.connect(c.destination); o.start(t + n[1]); o.stop(t + n[1] + n[2] + .05);
    });
  }
  window.hmFx = function (k, force) {
    var o = fxPrefs();
    try { if (o.s || force === 's') tone(SOUNDS[k] || SOUNDS.ok); } catch (e) {}
    try { if ((o.v || force === 'v') && navigator.vibrate) navigator.vibrate(VIB[k] || 60); } catch (e) {}
  };
  window.hmFxSet = function (k, on) { var o = fxPrefs(); o[k] = !!on; put('fx', o); if (on) hmFx('in', k); };
  window.hmFxSettings = function () {
    var o = fxPrefs(), sw = function (k, t, s) { return '<label class="hm-sw"><span><b>' + t + '</b><small>' + s + '</small></span><input type="checkbox" ' + (o[k] ? 'checked' : '') + ' onchange="hmFxSet(\'' + k + '\',this.checked)"></label>'; };
    sheet('🔔 Sounds & vibration', '<div class="wf-sec" style="margin-top:6px">' + sw('s', 'Payment sounds', 'A short chime when Pi arrives, is sent or a payment completes') + sw('v', 'Vibration', 'The phone vibrates with each payment alert') + '</div>' +
      '<div class="wf-l">Try them</div><div class="hm-try">' + [['in', '💰', 'Pi received'], ['out', '↗', 'Pi sent'], ['ok', '✓', 'Payment complete'], ['err', '↩', 'Refund / problem']].map(function (x) { return '<button type="button" onclick="hmFx(\'' + x[0] + '\')"><i>' + x[1] + '</i>' + x[2] + '</button>'; }).join('') + '</div>' +
      '', 'hm-fx');
  };
  function hookSounds() {
    if (typeof window.addNotif === 'function' && !window.addNotif._fx) {
      var orig = window.addNotif;
      window.addNotif = function (icon) { var r = orig.apply(this, arguments); try { if (icon === '💰') hmFx('in'); else if (icon === '✅') hmFx('out'); else if (icon === '↩️') hmFx('err'); } catch (e) {} return r; };
      window.addNotif._fx = true; window.addNotif._hm = orig._hm;
    }
    if (window.Pi && Pi.createPayment && !Pi._fxWrapped) {
      var cp = Pi.createPayment.bind(Pi); Pi._fxWrapped = true;
      Pi.createPayment = function (data, cb) {
        var c = Object.assign({}, cb), meta = (data && data.metadata) || {};
        c.onReadyForServerCompletion = function () { if (meta.type !== 'transfer') { try { hmFx('ok'); } catch (e) {} } return cb.onReadyForServerCompletion && cb.onReadyForServerCompletion.apply(this, arguments); };
        return cp(data, c);
      };
    }
  }

  /* ───────── Business: invoices, sales summary and reports ───────── */
  function sales() { return get('sales', []) || []; }
  function invState(s) { if (s.paid) return ['Paid', 'ok']; if (s.due && isoDay(Date.now()) > s.due) return ['Overdue', 'bad']; return [s.no ? 'Unpaid' : 'Waiting', 'wait']; }
  function nextNo() {
    var d = new Date(), k = 'INV-' + String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + '-', n = 1;
    sales().forEach(function (s) { if (s.no && s.no.indexOf(k) === 0) n = Math.max(n, (parseInt(s.no.slice(k.length), 10) || 0) + 1); });
    return k + String(n).padStart(3, '0');
  }
  function itemRow(v) {
    v = v || ['', 1, ''];
    return '<div class="hm-it"><input class="fi hm-d" maxlength="40" placeholder="Item or service" value="' + esc(v[0]) + '" oninput="hmInvTotal()">' +
      '<input class="fi hm-q" type="number" inputmode="numeric" min="1" step="1" value="' + esc(v[1]) + '" oninput="hmInvTotal()" aria-label="Quantity">' +
      '<input class="fi hm-p" type="number" inputmode="decimal" min="0" step="any" placeholder="π" value="' + esc(v[2]) + '" oninput="hmInvTotal()" aria-label="Price in Pi">' +
      '<button type="button" class="hm-x" onclick="this.parentNode.remove();hmInvTotal()" aria-label="Remove">✕</button></div>';
  }
  function readItems() {
    var L = [];
    document.querySelectorAll('#hm-items .hm-it').forEach(function (r) {
      var d = r.querySelector('.hm-d').value.trim(), q = Math.max(1, Math.round(+r.querySelector('.hm-q').value || 1)), p = P(r.querySelector('.hm-p').value);
      if (d || p) L.push([d, q, p]);
    });
    return L;
  }
  window.hmInvTotal = function () {
    var t = P(readItems().reduce(function (a, x) { return a + x[1] * x[2]; }, 0)), e = $('hm-tot');
    if (e) e.innerHTML = '<span>Total</span><b>' + fmt(t, 7) + ' π</b><small>' + esc(window.hmConvLine ? hmConvLine(t) : '') + '</small>';
    return t;
  };
  window.hmInvAdd = function () { var box = $('hm-items'); if (!box) return; if (box.children.length >= 10) return say('Up to 10 items per invoice'); box.insertAdjacentHTML('beforeend', itemRow()); var d = box.lastElementChild.querySelector('.hm-d'); if (d) d.focus(); };
  window.hmInvoice = function () {
    closeAll(); var due = new Date(); due.setDate(due.getDate() + 7);
    sheet('🧾 New invoice',
      '<div class="wf-two"><div><label class="wf-l">Invoice number</label><input class="fi" id="iv-no" maxlength="20" value="' + nextNo() + '"></div><div><label class="wf-l">Due date</label><input class="fi" id="iv-due" type="date" value="' + isoDay(due) + '"></div></div>' +
      '<label class="wf-l">Bill to (customer)</label><input class="fi" id="iv-c" maxlength="50" placeholder="Customer or company name (optional)">' +
      '<div class="hm-lh"><span>Item</span><span>Qty</span><span>Price π</span><span></span></div><div id="hm-items">' + itemRow() + '</div>' +
      '<button type="button" class="hm-add" onclick="hmInvAdd()">＋ Add item</button><div class="hm-tot" id="hm-tot"></div>' +
      '<label class="wf-l">Note to customer</label><input class="fi" id="iv-x" maxlength="80" placeholder="e.g. Thank you for your business (optional)">' +
      '<label class="wf-l">Business or shop name</label><input class="fi" id="iv-n" maxlength="50" value="' + esc(get('bizName', '') || get('fullname', '')) + '" placeholder="Shown on the invoice">' +
      '<label class="wf-l">Your Pi wallet address (to receive payment)</label><input class="fi wf-mono" id="iv-t" maxlength="56" autocapitalize="characters" autocomplete="off" value="' + esc(get('myaddr', '')) + '" placeholder="G… (56 characters)">' +
      '<div class="wf-hint">Pi Wallet → Receive → copy. Saved on this phone.</div>' +
      '<button type="button" class="hm-sheet-a" onclick="hmInvCreate()">Create invoice</button>', 'hm-newinv');
    hmInvTotal();
  };
  window.hmInvCreate = function () {
    var L = readItems(), tot = hmInvTotal(), no = $('iv-no').value.trim().toUpperCase(), c = $('iv-c').value.trim(), due = $('iv-due').value, x = $('iv-x').value.trim(),
      n = $('iv-n').value.trim(), to = $('iv-t').value.trim().toUpperCase().replace(/\s+/g, '');
    if (!L.length) return say('Add at least one item');
    if (L.some(function (it) { return !it[0]; })) return say('Give every item a name');
    if (L.some(function (it) { return !(it[2] > 0); })) return say('Give every item a price in π');
    if (!(tot > 0)) return say('The total must be more than 0 π');
    if (!no) return say('Add an invoice number');
    if (sales().some(function (s) { return s.no === no; })) return say('Invoice ' + no + ' already exists');
    if (!uname()) return say('Sign in with Pi to create invoices. Customers pay you inside Haramain.');
    if (!n) return say('Add your business name');
    if (!/^G[A-Z2-7]{55}$/.test(to)) return say('That wallet address is not valid. It starts with G and has 56 characters.');
    put('myaddr', to); put('bizName', n);
    var s = { t: to, a: tot, i: L.length === 1 ? L[0][0] : 'Invoice ' + no + ' · ' + L.length + ' items', n: n, u: uname(), r: hmNewRef(), d: Date.now(), no: no, l: L };
    if (c) s.c = c; if (due) s.due = due; if (x) s.x = x;
    var all = sales(); all.unshift(s); put('sales', all.slice(0, 300));
    closeAll(); redraw(); try { hmFx('ok'); } catch (e) {}
    hmReqOpen(0);
  };
  window.hmInvoiceInfo = function (s, i) {
    var st = invState(s);
    return '<div class="hm-ii"><div class="hm-ih"><b>' + esc(s.no) + '</b><span class="hm-pill ' + st[1] + '">' + st[0] + '</span></div>' +
      (s.c ? '<div class="hm-kv"><span>Bill to</span><b>' + esc(s.c) + '</b></div>' : '') +
      (s.l || []).map(function (x) { return '<div class="hm-kv"><span>' + esc(x[1] + ' × ' + x[0]) + '</span><b>' + fmt(P(x[1] * x[2]), 7) + ' π</b></div>'; }).join('') +
      '<div class="hm-kv tot"><span>Total</span><b>' + fmt(s.a, 7) + ' π</b></div>' +
      (s.due ? '<div class="hm-kv"><span>Due</span><b>' + dstr(s.due + 'T12:00:00') + '</b></div>' : '') +
      (s.x ? '<div class="hm-kv"><span>Note</span><b>' + esc(s.x) + '</b></div>' : '') +
      '<button type="button" class="hm-add" style="width:100%;margin-top:10px" onclick="hmInvoiceImg(' + i + ')">🧾 Invoice image to share or save</button></div>';
  };
  window.hmInvoiceImg = function (i) {
    var s = sales()[i]; if (!s || !window.HMReceipt) return; var st = invState(s);
    var rows2 = [['Invoice', s.no], ['Bill to', s.c || ''], ['From', s.n + (s.u ? ' (@' + s.u + ')' : '')]]
      .concat((s.l || []).map(function (x) { return [x[1] + ' × ' + x[0], fmt(P(x[1] * x[2]), 7) + ' π']; }))
      .concat([['Total', fmt(s.a, 7) + ' π'], ['Issued', dstr(s.d)], ['Due', s.due ? dstr(s.due + 'T12:00:00') : ''], ['Note', s.x || ''], ['Reference', s.r, 1], ['Network', NETN], ['Pay to address', s.t, 1]]);
    HMReceipt.sheet({ title: 'Invoice ' + s.no, status: { text: s.paid ? '✓  Paid' : st[0] === 'Overdue' ? 'Overdue' : 'Unpaid' + (s.due ? ' · due ' + dstr(s.due + 'T12:00:00', { day: 'numeric', month: 'short' }) : ''), ok: !!s.paid },
      amount: fmt(s.a, 7), sub: window.hmConvLine ? hmConvLine(+s.a) : '', rows: rows2, verify: '',
      thanks: s.paid ? 'Paid with Haramain Pay' : 'Pay securely with Haramain Pay',
      note: s.paid ? 'Verified on the Pi blockchain. Haramain never holds funds.' : 'Open the payment link to pay inside Haramain. Reference ' + s.r + '.' },
      'Haramain-invoice-' + s.no + '.png', 'Invoice ' + s.no + ' from ' + s.n + ': ' + s.a + ' π', 'Invoice ' + s.no);
  };
  /* an invoice or request paid inside Haramain carries its reference in the narration: mark it paid */
  function reconcile() {
    var S = sales(), R = get('rcpts', []), ch = 0;
    S.forEach(function (s) {
      if (s.paid) return;
      var hit = R.filter(function (r) { return r.dir === 'in' && String(r.narr || r.memo || '').indexOf(s.r) >= 0 && +r.amount >= +s.a - 1e-7; })[0];
      if (hit) { s.paid = hit.txid || ('pid:' + (hit.pid || hit.ref || '')); s.at = hit.ts; ch++; }
    });
    if (ch) put('sales', S);
    return ch;
  }
  window.hmReconcile = reconcile;
  setInterval(function () { if (!document.hidden && reconcile()) redraw(); }, 15000);
  function income() { return rows().filter(function (r) { return r.dir === 'in' && !/cancel|fail|refund/i.test(r.st || ''); }); }
  function valSar(r) { var x = r.raw || {}, p = (window.PiPrice && PiPrice.get && PiPrice.get()) || {}; var sar = x.sar || (x.usd ? x.usd * 3.75 : 0) || p.sar || 0; return sar ? +r.amt * sar : null; }
  function sum(L) { var pi = 0, sar = 0, ok = true; L.forEach(function (r) { pi += +r.amt; var v = valSar(r); if (v == null) ok = false; else sar += v; }); return { pi: P(pi), sar: ok ? sar : null, n: L.length }; }
  window.hmBusiness = function () {
    closeAll(); reconcile();
    var I = income(), now = Date.now(), t0 = new Date(); t0.setHours(0, 0, 0, 0); t0 = t0.getTime(); var w0 = t0 - 6 * 864e5, m = new Date(); m.setDate(1); m.setHours(0, 0, 0, 0);
    var today = sum(I.filter(function (r) { return r.ts >= t0; })), week = sum(I.filter(function (r) { return r.ts >= w0; })), month = sum(I.filter(function (r) { return r.ts >= m.getTime(); }));
    var S = sales(), inv = S.filter(function (s) { return s.no; }), open = S.filter(function (s) { return !s.paid; }), over = open.filter(function (s) { return invState(s)[0] === 'Overdue'; });
    var owed = P(open.reduce(function (a, s) { return a + +s.a; }, 0));
    var days = []; for (var k = 6; k >= 0; k--) { var a = t0 - k * 864e5, b = a + 864e5; days.push([a, P(I.filter(function (r) { return r.ts >= a && r.ts < b; }).reduce(function (x, r) { return x + +r.amt; }, 0))]); }
    var mx = Math.max.apply(null, days.map(function (d) { return d[1]; })) || 1;
    var top = {}; I.filter(function (r) { return r.ts >= m.getTime(); }).forEach(function (r) { var k = (r.raw && (r.raw.item || r.raw.narr || r.raw.memo)) || 'Other'; top[k] = (top[k] || 0) + +r.amt; });
    var topL = Object.keys(top).sort(function (a, b) { return top[b] - top[a]; }).slice(0, 5);
    var tile = function (t, o) { return '<div class="hm-k"><small>' + t + '</small><b>' + fmt(o.pi, 4) + ' π</b><span>' + (o.sar != null && o.pi ? '≈ ' + fmt(o.sar, 2) + ' SAR · ' : '') + o.n + ' sale' + (o.n === 1 ? '' : 's') + '</span></div>'; };
    sheet('📊 Business',
      '<div class="hm-bz"><small>Sales this month · ' + dstr(now, { month: 'long', year: 'numeric' }) + '</small><b>' + fmt(month.pi, 4) + ' π</b>' +
      '<span>' + (month.sar != null && month.pi ? '≈ ' + fmt(month.sar, 2) + ' SAR · ' : '') + month.n + ' payment' + (month.n === 1 ? '' : 's') + ' received' + (month.n ? ' · average ' + fmt(month.pi / month.n, 4) + ' π' : '') + '</span>' +
      '<div class="hm-bars">' + days.map(function (d) { return '<div><i style="height:' + Math.max(4, Math.round(d[1] / mx * 100)) + '%"' + (d[1] ? '' : ' class="z"') + '></i><small>' + dstr(d[0], { weekday: 'short' }).slice(0, 2) + '</small></div>'; }).join('') + '</div></div>' +
      '<div class="hm-kpi">' + tile('Today', today) + tile('Last 7 days', week) + '<div class="hm-k' + (over.length ? ' warn' : '') + '"><small>Outstanding</small><b>' + fmt(owed, 4) + ' π</b><span>' + open.length + ' unpaid' + (over.length ? ' · ' + over.length + ' overdue' : '') + '</span></div></div>' +
      '<div class="hm-qa hm-qa-s"><button type="button" onclick="hmInvoice()"><i>＋</i>Invoice</button><button type="button" onclick="closeHm();hmGetPaid()"><i class="g">↙</i>Request</button><button type="button" onclick="hmSalesCsv()"><i class="n">⬇</i>Report</button><button type="button" onclick="closeHm();hmStatement()"><i class="b">📄</i>Statement</button></div>' +
      '<div class="wf-sec-h" style="margin-top:14px"><b>🧾 Invoices</b>' + (open.length ? '<button type="button" class="wf-link" onclick="hmCheckSales()">Check payments</button>' : '') + '</div>' +
      (inv.length ? inv.slice(0, 20).map(function (s) { var i = S.indexOf(s), st = invState(s); return '<button type="button" class="hm-sale" onclick="closeHm();hmReqOpen(' + i + ')"><span class="hm-si ' + (s.paid ? 'ok' : '') + '">' + (s.paid ? '✓' : '🧾') + '</span><span class="hm-st"><b>' + esc(s.no) + (s.c ? ' · ' + esc(s.c) : '') + '</b><small>' + dstr(s.d, { day: 'numeric', month: 'short' }) + (s.due ? ' · due ' + dstr(s.due + 'T12:00:00', { day: 'numeric', month: 'short' }) : '') + '</small></span><span class="hm-sa"><b>' + fmt(s.a, 4) + ' π</b><small class="hm-pill ' + st[1] + '">' + st[0] + '</small></span></button>'; }).join('')
        : '<div class="wf-how"><div><span>1</span>Create an invoice with items, quantities and a due date</div><div><span>2</span>Share the payment link or the invoice image with your customer</div><div><span>3</span>The customer pays inside Haramain; the invoice is marked paid with a receipt</div></div>') +
      '<button type="button" class="hm-sheet-a" onclick="hmInvoice()">＋ New invoice</button>' +
      (topL.length ? '<div class="wf-sec-h" style="margin-top:16px"><b>⭐ Top sellers this month</b></div>' + topL.map(function (k) { return '<div class="hm-kv"><span>' + esc(k) + '</span><b>' + fmt(P(top[k]), 4) + ' π</b></div>'; }).join('') : '') +
      '<div class="wf-sec-h" style="margin-top:16px"><b>📁 Reports</b></div>' +
      '<div class="wf-two"><button type="button" class="wf-cta" onclick="hmSalesCsv()">⬇ Sales (CSV)</button><button type="button" class="wf-cta wf-cta2" onclick="hmInvCsv()">🧾 Invoices (CSV)</button></div>', 'hm-biz');
  };
  window.closeHm = function () { var b = $('hm-biz'); if (b) b.remove(); };
  window.hmSalesCsv = function () {
    var I = income(); if (!I.length) return say('No sales yet. Received payments appear here.');
    var L = [['Date', 'Time', 'Customer / from', 'Item', 'Reference', 'Amount (Pi)', 'Value at payment time (SAR)', 'Value at payment time (USD)', 'Network', 'Transaction ID']];
    I.slice().sort(function (a, b) { return a.ts - b.ts; }).forEach(function (r) { var x = r.raw || {}, d = new Date(r.ts); L.push([isoDay(r.ts), d.toTimeString().slice(0, 5), x.user ? '@' + x.user : (x.from || r.title.replace(/^From /, '')), x.item || x.narr || x.memo || '', x.ref || '', r.amt, x.sar ? (+r.amt * x.sar).toFixed(2) : '', x.usd ? (+r.amt * x.usd).toFixed(2) : '', x.net || NETN, x.txid || '']); });
    csvSave(L, 'Haramain-sales-' + isoDay(Date.now()) + '.csv', 'report');
  };
  window.hmInvCsv = function () {
    var S = sales().filter(function (s) { return s.no; }); if (!S.length) return say('No invoices yet');
    var L = [['Invoice', 'Issued', 'Due', 'Customer', 'Items', 'Total (Pi)', 'Status', 'Reference', 'Transaction ID']];
    S.forEach(function (s) { L.push([s.no, isoDay(s.d), s.due || '', s.c || '', (s.l || []).map(function (x) { return x[1] + ' x ' + x[0] + ' @ ' + x[2]; }).join('; '), s.a, invState(s)[0], s.r, s.paid || '']); });
    csvSave(L, 'Haramain-invoices-' + isoDay(Date.now()) + '.csv', 'report');
  };

  /* ───────── An-Nawawi's 40 Hadith ───────── */
  var HD = null, HS = get('hfs', 20);
  function loadH() { if (HD) return Promise.resolve(HD); return fetch('/haramain-hadith.json?v=1').then(function (r) { return r.json(); }).then(function (d) { HD = d.hadith; return HD; }); }
  function ensureH() {
    if ($('s-hadith')) return; var sec = document.createElement('section'); sec.className = 'scr'; sec.id = 's-hadith';
    sec.innerHTML = '<div id="hh-home"></div>'; ($('main') || document.body).appendChild(sec);
  }
  function hList() {
    ensureH(); var h = $('hh-home');
    h.innerHTML = '<div class="scr-top-bar"><div><div class="scr-top-title">📜 40 Hadith</div><div class="scr-top-sub">Imam an-Nawawi · 42 hadith in Arabic and English</div></div></div>' +
      '<input class="fi hq-search" id="hh-q" type="search" placeholder="Search the hadith" autocomplete="off"><div id="hh-list"><div class="empty">Loading…</div></div>';
    var draw = function () {
      var q = (($('hh-q') || {}).value || '').trim().toLowerCase();
      $('hh-list').innerHTML = HD.filter(function (x) { return !q || String(x.n) === q || x.en.toLowerCase().indexOf(q) >= 0 || x.ar.indexOf(q) >= 0; }).map(function (x) {
        return '<button type="button" class="hq-row" onclick="HMH.open(' + x.n + ')"><span class="hq-num">' + x.n + '</span><span class="hq-t"><b>Hadith ' + x.n + '</b><small>' + esc(x.en.replace(/\s+/g, ' ').slice(0, 90)) + '…</small></span></button>';
      }).join('') || '<div class="empty">No match</div>';
    };
    loadH().then(draw).catch(function () { $('hh-list').innerHTML = '<div class="empty">Could not load. Check your connection and try again.</div>'; });
    $('hh-q').oninput = function () { if (HD) draw(); };
  }
  function hOpen(n) {
    ensureH();
    loadH().then(function () {
      var x = HD.filter(function (y) { return y.n === n; })[0]; if (!x) return;
      $('hh-home').innerHTML = '<div class="hq-top"><button type="button" class="hq-back" onclick="HMH.list()">‹ 40 Hadith</button><div class="hq-tools"><button type="button" onclick="HMH.size(-2,' + n + ')">A−</button><button type="button" onclick="HMH.size(2,' + n + ')">A+</button></div></div>' +
        '<div class="hq-head"><div class="hq-head-ar">الحديث ' + n.toLocaleString('ar-EG') + '</div><div class="hq-head-en">Hadith ' + n + ' of ' + HD.length + ' · Forty Hadith of an-Nawawi</div></div>' +
        '<div class="hq-ay"><div class="hq-ay-ar" lang="ar" dir="rtl" style="font-size:' + (HS + 4) + 'px;font-family:Amiri,serif">' + esc(x.ar) + '</div><div class="hq-ay-en" style="white-space:pre-line;font-size:' + HS * .75 + 'px">' + esc(x.en) + '</div>' +
        '<div class="hq-ay-act"><button type="button" onclick="HMH.share(' + n + ')">Share</button></div></div>' +
        '<div class="hq-foot">' + (n > 1 ? '<button type="button" class="btn btn-ghost btn-sm" onclick="HMH.open(' + (n - 1) + ')">‹ Previous</button>' : '<span></span>') + (n < HD.length ? '<button type="button" class="btn btn-primary btn-sm" onclick="HMH.open(' + (n + 1) + ')">Next ›</button>' : '') + '</div>' +
        '<div class="hq-src">Imam Yahya ibn Sharaf an-Nawawi · Arabic and English text</div>';
      try { $('main').scrollTop = 0; } catch (e) {} window.scrollTo(0, 0);
    });
  }
  window.HMH = {
    list: hList, open: hOpen,
    size: function (d, n) { HS = Math.max(14, Math.min(34, HS + d)); put('hfs', HS); hOpen(n); },
    share: function (n) { var x = (HD || []).filter(function (y) { return y.n === n; })[0]; if (!x) return; var t = x.ar + '\n\n' + x.en + '\n\n— Forty Hadith of an-Nawawi, ' + n + '\nShared from Haramain · haramain.pi'; if (navigator.share) navigator.share({ title: 'Hadith ' + n, text: t }).catch(function () {}); else { try { navigator.clipboard.writeText(t); say('Copied'); } catch (e) {} } }
  };

  /* Heat safety page: the live heat card was never filled in (it stayed on "Loading weather…") */
  if (typeof window.renderHeatFull !== 'function') window.renderHeatFull = function () {
    var el = $('heat-full-widget'); if (!el) return;
    var w = (typeof weatherCache !== 'undefined' && weatherCache) ? weatherCache : null, t = w && typeof w.temperature_2m === 'number' ? w.temperature_2m : null;
    if (t === null) { el.innerHTML = '<div class="ic"><div class="ic-title">🌡️ Heat today</div><div class="hm-li">Live weather is not available right now. Drink water often, rest in the shade and avoid the sun from 11 am to 3 pm.</div></div>'; return; }
    var lv = t >= 45 ? ['Extreme heat', '#B42318', 'Stay indoors 11 am–4 pm · drink 4–5 L of water · wet cloth on head and neck'] : t >= 42 ? ['Very hot', '#D9480F', 'Avoid 11 am–3 pm outdoors · drink about 4 L · rest often in the shade'] : t >= 38 ? ['Hot', '#B26B00', 'Drink about 3 L · use an umbrella · rest often'] : ['Normal', '#0E7A52', 'Drink about 2 L · take breaks in the shade'];
    el.innerHTML = '<div class="ic" style="border-left:5px solid ' + lv[1] + '"><div class="ic-title">🌡️ Now: ' + Math.round(t) + '°C · <span style="color:' + lv[1] + '">' + lv[0] + '</span></div><div class="hm-li">' + lv[2] + '</div></div>';
  };
  function start() {
    hookSounds(); setTimeout(hookSounds, 2500);
    var _goS = window.goS;
    window.goS = function (id) {
      if (id === 'hadith') {
        ensureH(); document.querySelectorAll('.scr').forEach(function (s) { s.classList.remove('on'); }); document.querySelectorAll('.bni').forEach(function (b) { b.classList.remove('on'); });
        $('s-hadith').classList.add('on'); try { document.body.setAttribute('data-scr', 'hadith'); $('main').scrollTop = 0; } catch (e) {} window.scrollTo(0, 0); hList(); return;
      }
      return _goS.apply(this, arguments);
    };
    var worship = Array.prototype.filter.call(document.querySelectorAll('#s-more .hub-grid'), function (g) { return /goS\('audio'\)|goS\('quran'\)/.test(g.innerHTML); })[0];
    if (worship && !/goS\('hadith'\)/.test(worship.innerHTML)) worship.insertAdjacentHTML('afterbegin', '<div class="hub-item" onclick="goS(\'hadith\')"><div class="hub-icon">📜</div><div class="hub-name">40 Hadith</div></div>');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 150); }); else setTimeout(start, 150);
})();
