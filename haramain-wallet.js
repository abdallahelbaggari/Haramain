/* Haramain — Wallet screen and professional receipt images.
   Every Pi payment made in the app is recorded on the phone with its full details, and can be shared as a PNG receipt
   (logo, HARAMAIN, haramain.pi, the payer's name and the transaction details). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K = window.K || 'hm_v1_';
  var get = function (k, d) { try { var v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var uname = function () { return (typeof user !== 'undefined' && user && !user.guest) ? user.username : ''; };
  var fullName = function () { return get('fullname', '') || (uname() ? '@' + uname() : 'Guest'); };
  var TESTNET = /(^|[.-])testnet[.-]/i.test(location.hostname);
  var TYPES = { pilgrim_pass: 'Supporter Pass' };

  /* ── record every payment the app makes ── */
  function wrapPi() {
    if (!window.Pi || !Pi.createPayment || Pi._hmWrapped) return;
    var orig = Pi.createPayment.bind(Pi); Pi._hmWrapped = true;
    Pi.createPayment = function (data, cb) {
      var rec = { amount: data.amount, memo: data.memo, kind: (data.metadata && data.metadata.type) || 'payment', ts: Date.now(), name: fullName(), user: uname(), net: TESTNET ? 'Pi Testnet' : 'Pi Mainnet' };
      var p = window.PiPrice && PiPrice.get(); if (p && p.usd) { rec.usd = p.usd; rec.sar = p.sar; }
      var c = Object.assign({}, cb);
      c.onReadyForServerApproval = function (pid) { rec.pid = pid; return cb.onReadyForServerApproval && cb.onReadyForServerApproval.apply(this, arguments); };
      c.onReadyForServerCompletion = function (pid, txid) {
        rec.pid = pid; rec.txid = txid; rec.ts = Date.now(); rec.status = 'Completed';
        var all = get('rcpts', []); all.unshift(rec); put('rcpts', all.slice(0, 100));
        setTimeout(function () { drawTx(); }, 300);
        return cb.onReadyForServerCompletion && cb.onReadyForServerCompletion.apply(this, arguments);
      };
      return orig(data, c);
    };
  }

  /* ── receipt image ── */
  function loadImg(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function rr(x, c, y, w, h, r) { x.beginPath(); x.moveTo(c + r, y); x.arcTo(c + w, y, c + w, y + h, r); x.arcTo(c + w, y + h, c, y + h, r); x.arcTo(c, y + h, c, y, r); x.arcTo(c, y, c + w, y, r); x.closePath(); }
  function receiptCanvas(r) {
    return loadImg('icons/icon-512.png').then(function (logo) {
      var F = "'DM Sans','Segoe UI',Roboto,Arial,sans-serif", W = 1080;
      var rows = [['Name', r.name || '—'], ['Pi username', r.user ? '@' + r.user : '—'], ['Payment for', TYPES[r.kind] || r.memo || 'Pi payment'],
        ['Date', new Date(r.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })], ['Time', new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })],
        ['Network', r.net || 'Pi Network'], ['Payment ID', r.pid || '—'], ['Transaction ID', r.txid || '—']];
      var mx = document.createElement('canvas').getContext('2d'), extra = 0;
      rows.forEach(function (row, i) { mx.font = (i >= 6 ? "600 26px 'DM Mono',Menlo,monospace" : '700 32px ' + F); if (mx.measureText(String(row[1])).width > W - 540) extra += 36; });
      var H = 870 + rows.length * 86 + extra + 250, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d');
      x.fillStyle = '#F6F4EE'; x.fillRect(0, 0, W, H);
      x.save(); rr(x, 60, 60, W - 120, H - 120, 44); x.fillStyle = '#FFFFFF'; x.shadowColor = 'rgba(19,38,30,.12)'; x.shadowBlur = 40; x.fill(); x.restore();
      x.save(); rr(x, 60, 60, W - 120, 360, 44); x.clip(); var g = x.createLinearGradient(60, 60, W - 60, 420); g.addColorStop(0, '#13925F'); g.addColorStop(1, '#07462F'); x.fillStyle = g; x.fillRect(60, 60, W - 120, 380); x.restore();
      if (logo) x.drawImage(logo, W / 2 - 75, 110, 150, 150);
      x.textAlign = 'center'; x.fillStyle = '#FFFFFF'; x.font = '800 66px ' + F; x.fillText('H A R A M A I N', W / 2, 340);
      x.fillStyle = '#E6BD5C'; x.font = '700 32px ' + F; x.fillText('haramain.pi', W / 2, 392);
      x.fillStyle = '#13261E'; x.font = '800 44px ' + F; x.fillText('Payment receipt', W / 2, 520);
      var ok = r.status !== 'Pending'; x.fillStyle = ok ? '#E7F6EE' : '#FFF4E0'; rr(x, W / 2 - 150, 548, 300, 58, 29); x.fill();
      x.fillStyle = ok ? '#0E7A52' : '#B26B00'; x.font = '800 30px ' + F; x.fillText(ok ? '✓  Completed' : 'Pending', W / 2, 588);
      x.fillStyle = '#13261E'; x.font = '800 120px ' + F; x.fillText(r.amount + ' π', W / 2, 740);
      if (r.usd) { x.fillStyle = '#6E7B73'; x.font = '600 32px ' + F; x.fillText('≈ ' + (r.amount * r.sar).toFixed(2) + ' SAR · $' + (r.amount * r.usd).toFixed(2) + ' at payment time', W / 2, 792); }
      var y = 870; x.textAlign = 'left';
      rows.forEach(function (row, i) {
        x.fillStyle = '#6E7B73'; x.font = '600 30px ' + F; x.fillText(row[0], 120, y);
        x.fillStyle = '#13261E'; x.font = (i >= 6 ? '600 26px ' : '700 32px ') + (i >= 6 ? "'DM Mono',Menlo,monospace" : F);
        var v = String(row[1]), maxW = W - 120 - 420;
        if (x.measureText(v).width > maxW) { var a = v.slice(0, Math.ceil(v.length / 2)), b = v.slice(Math.ceil(v.length / 2)); x.textAlign = 'right'; x.fillText(a, W - 120, y); x.fillText(b, W - 120, y + 36); y += 36; x.textAlign = 'left'; }
        else { x.textAlign = 'right'; x.fillText(v, W - 120, y); x.textAlign = 'left'; }
        y += 34; x.strokeStyle = '#ECE7DA'; x.lineWidth = 2; x.beginPath(); x.moveTo(120, y); x.lineTo(W - 120, y); x.stroke(); y += 52;
      });
      x.textAlign = 'center'; x.fillStyle = '#0E7A52'; x.font = '800 34px ' + F; x.fillText('Thank you for supporting Haramain', W / 2, H - 200);
      x.fillStyle = '#6E7B73'; x.font = '500 26px ' + F; x.fillText('Check this payment on the Pi blockchain explorer with the Transaction ID.', W / 2, H - 150);
      x.fillText('© Haramain 2026 · haramain.pi', W / 2, H - 112);
      return cv;
    });
  }
  function showReceipt(i) {
    var r = get('rcpts', [])[i]; if (!r) return;
    say('Preparing receipt…');
    receiptCanvas(r).then(function (cv) {
      var url = cv.toDataURL('image/png'), fname = 'Haramain-receipt-' + (r.txid ? r.txid.slice(0, 8) : r.ts) + '.png';
      var text = 'HARAMAIN · Payment receipt\n' + r.amount + ' π · ' + (TYPES[r.kind] || r.memo || 'Pi payment') + '\nName: ' + (r.name || '—') + '\nDate: ' + new Date(r.ts).toLocaleString() + '\nTransaction ID: ' + (r.txid || '—') + '\nharamain.pi';
      var w = document.createElement('div'); w.className = 'hm-sheet-wrap';
      w.innerHTML = '<div class="hm-sheet"><div class="hm-sheet-t">Receipt</div><img src="' + url + '" alt="Payment receipt" style="width:100%;border-radius:14px;border:1px solid #E6E1D3;display:block">' +
        '<button type="button" class="hm-sheet-a" id="rc-share">📤 Share receipt image</button>' +
        '<a class="hm-sheet-x" style="text-align:center;text-decoration:none" href="' + url + '" download="' + fname + '">⬇️ Save image</a>' +
        '<div class="hm-note" style="text-align:center">Tip: you can also press and hold the image to save it.</div><button type="button" class="hm-sheet-x">Close</button></div>';
      w.addEventListener('click', function (e) { if (e.target === w || (e.target.classList.contains('hm-sheet-x') && e.target.tagName === 'BUTTON')) w.remove(); });
      document.body.appendChild(w);
      $('rc-share').onclick = function () {
        cv.toBlob(function (blob) {
          try { var f = new File([blob], fname, { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: 'Haramain receipt', text: 'Haramain payment receipt' }).catch(function () {}); return; } } catch (e) {}
          if (navigator.share) navigator.share({ title: 'Haramain receipt', text: text }).catch(function () {}); else window.open('https://wa.me/?text=' + encodeURIComponent(text));
        }, 'image/png');
      };
    });
  }
  window.hmReceipt = showReceipt;

  /* ── transactions list (structured receipts + older entries) ── */
  function drawTx() {
    var R = get('rcpts', []), html = R.length ? R.map(function (r, i) {
      return '<div class="wl-tx"><span class="wl-txi">' + (r.kind === 'pilgrim_pass' ? '⭐' : 'π') + '</span><div class="wl-txt"><b>' + esc(TYPES[r.kind] || r.memo || 'Pi payment') + '</b><small>' + new Date(r.ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + esc(r.status || 'Completed') + '</small></div><div class="wl-txa"><b>−' + r.amount + ' π</b><button type="button" onclick="hmReceipt(' + i + ')">Receipt</button></div></div>';
    }).join('') : '<div class="wl-empty"><span>🧾</span><b>No payments yet</b><small>When you support Haramain, your receipt appears here and you can share it as an image.</small></div>';
    var old = (window.txLog || []).filter(function (t) { return t && t.t && !/^📨|Request/.test(t.t); }).slice(0, 15);
    if (old.length) html += '<div class="nv-h" style="margin-top:10px">Earlier activity</div>' + old.map(function (t) { return '<div class="wl-old">' + esc(t.t) + '<small>' + esc(t.d) + '</small></div>'; }).join('');
    ['wl-tx', 'tx-list'].forEach(function (id) { var e = $(id); if (e) e.innerHTML = html; });
  }
  window.renderTx = drawTx;

  /* ── wallet screen ── */
  window.hmEditName = function () {
    var n = prompt('Your full name, as it should appear on receipts:', get('fullname', '') || ''); if (n === null) return;
    put('fullname', n.trim().slice(0, 50)); drawWallet(); say('✅ Name saved');
  };
  window.hmSendSheet = function () {
    hmSheet('💸 Send Pi', 'Pi is sent from <b>Pi Wallet</b> in the Pi app, so it goes straight to the person you choose.<ol style="margin:10px 0 0 18px;line-height:1.7"><li>Tap <b>Open Pi Wallet</b></li><li>Choose <b>Send</b> and enter the username or wallet address</li><li>Enter the amount and confirm</li></ol>', 'Open Pi Wallet', 'https://wallet.pinet.com');
  };
  window.hmRequestSheet = function () {
    var w = document.createElement('div'); w.className = 'hm-sheet-wrap';
    w.innerHTML = '<div class="hm-sheet"><div class="hm-sheet-t">📨 Request Pi</div><div class="hm-sheet-b">Send a message asking someone to pay you in Pi Wallet.</div>' +
      '<input class="fi" id="rq-amt" type="number" inputmode="decimal" placeholder="Amount in π" style="margin-top:12px"><input class="fi" id="rq-why" placeholder="What for? e.g. Hajj travel" style="margin-top:8px">' +
      '<button type="button" class="hm-sheet-a" id="rq-go">📤 Share request</button><button type="button" class="hm-sheet-x">Close</button></div>';
    w.addEventListener('click', function (e) { if (e.target === w || e.target.classList.contains('hm-sheet-x')) w.remove(); });
    document.body.appendChild(w);
    $('rq-go').onclick = function () {
      var a = parseFloat($('rq-amt').value), why = $('rq-why').value.trim(); if (!(a > 0)) { say('Enter an amount'); return; }
      var t = 'Assalamu alaikum! Could you send ' + a + ' π' + (why ? ' for ' + why : '') + ' to ' + (uname() ? '@' + uname() : 'my Pi username') + '? You can send it from Pi Wallet in the Pi app.';
      if (navigator.share) navigator.share({ title: 'Pi request', text: t }).catch(function () {}); else window.open('https://wa.me/?text=' + encodeURIComponent(t));
      w.remove();
    };
  };
  function drawWallet() {
    var sec = $('s-payments'); if (!sec) return;
    var prem = get('prem', null) === 1 || (function () { try { return localStorage.getItem(K + 'prem') === '1'; } catch (e) { return false; } })();
    var top = $('wl-top');
    if (!top) {
      ['.wallet-hero'].forEach(function (s) { var e = sec.querySelector(s); if (e) e.style.display = 'none'; });
      Array.prototype.forEach.call(sec.children, function (c) {
        if (c.classList.contains('ic') && /Send Pi|Request Pi/.test(c.textContent)) c.style.display = 'none';
        if (c.classList.contains('sec-label') && /Charitable/.test(c.textContent)) c.style.display = 'none';
        if (c.classList.contains('tgrid')) c.style.display = 'none';
      });
      top = document.createElement('div'); top.id = 'wl-top';
      var hdr = sec.querySelector('.scr-hdr'); if (hdr && hdr.nextSibling) sec.insertBefore(top, hdr.nextSibling); else sec.prepend(top);
      var price = $('hm-pi-pay'); var rest = document.createElement('div'); rest.id = 'wl-rest';
      top.parentNode.insertBefore(rest, top.nextSibling); if (price) rest.appendChild(price);
      rest.insertAdjacentHTML('beforeend', '<div class="nv-h" style="margin-top:6px">🧰 Pi tools</div><div class="nv-grid wl-tools">' +
        [['🤲', 'Zakat', "oUtil('zakat')"], ['💝', 'Sadaqah', "oUtil('sadaqah')"], ['🐑', 'Qurbani', "oUtil('qurbani')"], ['π', 'Pi calculator', "oUtil('pi-calc')"]].map(function (t) { return '<button type="button" class="nv-t" onclick="' + t[2] + '"><span class="nv-i">' + t[0] + '</span><span class="nv-l">' + t[1] + '</span></button>'; }).join('') +
        '</div><div class="nv-h" style="margin-top:14px">🧾 Payments &amp; receipts</div><div id="wl-tx"></div>');
    }
    top.innerHTML = '<div class="wl-card"><div class="wl-row"><img src="icons/icon-192.png" alt=""><div class="wl-who"><b>' + esc(fullName()) + ' <button type="button" onclick="hmEditName()" aria-label="Edit name">✎</button></b><small>' + (uname() ? '@' + esc(uname()) : 'Guest · sign in with Pi to pay') + '</small></div>' + (prem ? '<span class="wl-badge">⭐ Supporter</span>' : '') + '</div>' +
      '<div class="wl-net">' + (TESTNET ? 'Pi Testnet' : 'Pi Network') + ' · haramain.pi</div></div>' +
      '<div class="wl-acts"><button type="button" onclick="hmSendSheet()"><span>💸</span>Send</button><button type="button" onclick="hmRequestSheet()"><span>📨</span>Request</button><button type="button" onclick="buyPrem()"><span>⭐</span>Support</button><button type="button" onclick="document.getElementById(\'wl-tx\').scrollIntoView({behavior:\'smooth\',block:\'start\'})"><span>🧾</span>Receipts</button></div>';
    drawTx();
  }

  /* zakat: live price, no invented causes */
  function fixZakat() {
    var up = $('up-zakat'); if (!up || up.dataset.fixed) return; up.dataset.fixed = 1;
    Array.prototype.forEach.call(up.querySelectorAll('.ic'), function (c) { if (/Send Zakat in Pi/.test(c.textContent)) c.innerHTML = '<div class="ic-title">Give your Zakat</div><div class="hm-li">🤲 Give it to people in need directly, or through a registered charity or your local mosque.</div><div class="hm-li">🇸🇦 In Saudi Arabia, the official Ehsan platform lists verified projects: <a href="https://ehsan.sa" target="_blank" rel="noopener" style="color:var(--grn);font-weight:700">ehsan.sa ›</a></div><div class="hm-li">💸 To give in Pi, send it from Pi Wallet to the person or charity.</div>'; });
    var pr = $('zk-price'); if (pr) { pr.value = ''; pr.placeholder = 'loading live price…'; var d = window.PiPrice && PiPrice.get(); if (d && d.usd) pr.value = d.usd.toFixed(4); }
    var lbl = up.querySelector('.ibox'); if (lbl) lbl.textContent = 'Zakat is 2.5% of savings you have held for a full lunar year, if they are above the nisab (the value of 85 g of gold). This calculator works out 2.5% of your Pi; ask a scholar about your own situation.';
  }

  function start() {
    wrapPi(); setTimeout(wrapPi, 2000);
    var _goS = window.goS;
    window.goS = function (id) { var r = _goS.apply(this, arguments); if (id === 'payments') { drawWallet(); fixZakat(); } if (id === 'profile') drawTx(); return r; };
    var _o = window.oUtil; window.oUtil = function (id) { var r = _o.apply(this, arguments); if (id === 'zakat') { fixZakat(); var pr = $('zk-price'), d = window.PiPrice && PiPrice.get(); if (pr && !pr.value && d && d.usd) { pr.value = d.usd.toFixed(4); try { calcZakat(); } catch (e) {} } } return r; };
    drawTx();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 110); }); else setTimeout(start, 110);
})();
