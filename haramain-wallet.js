/* Haramain Wallet — live Pi rate, Haramain Pay (buy & sell with verified receipts), in-app payment receipts, converter and activity.
   Haramain never holds Pi: payments go from Pi Wallet to Pi Wallet, and Haramain verifies them on the Pi blockchain. */
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
  var NETN = TESTNET ? 'Pi Testnet' : 'Pi Mainnet';
  var TYPES = { pilgrim_pass: 'Supporter Pass' };
  var short = function (a) { a = String(a || ''); return a.length > 16 ? a.slice(0, 6) + '…' + a.slice(-6) : a; };
  var num = function (n, d) { return Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); };
  function price() { return window.PiPrice && PiPrice.get(); }
  function loc() { return window.PiPrice && PiPrice.local ? PiPrice.local() : { code: 'NGN', sym: '₦', rate: null }; }
  function sheetEl(title, inner) {
    var w = document.createElement('div'); w.className = 'hm-sheet-wrap';
    w.innerHTML = '<div class="hm-sheet" role="dialog" aria-label="' + esc(title) + '"><div class="hm-sheet-t">' + title + '</div>' + inner + '<button type="button" class="hm-sheet-x">Close</button></div>';
    w.addEventListener('click', function (e) { if (e.target === w || (e.target.classList.contains('hm-sheet-x') && e.target.tagName === 'BUTTON')) w.remove(); });
    document.body.appendChild(w); return w;
  }

  /* ── record every in-app payment ── */
  function wrapPi() {
    if (!window.Pi || !Pi.createPayment || Pi._hmWrapped) return;
    var orig = Pi.createPayment.bind(Pi); Pi._hmWrapped = true;
    Pi.createPayment = function (data, cb) {
      // Payments not switched on yet on the server: do not start a payment that could not be approved (it would block the user's next payment)
      if (window.HM_PAY_READY === false) { try { cb && cb.onCancel && cb.onCancel(); } catch (e) {} setTimeout(function () { if (window.toast) toast('Pi payments open soon, in shaa Allah. Nothing was charged.'); }, 60); return; }
      if (data && data.metadata && data.metadata.type === 'transfer') return orig(data, cb);   // in-app transfers keep their own receipts
      var rec = { amount: data.amount, memo: data.memo, kind: (data.metadata && data.metadata.type) || 'payment', dir: 'out', ts: Date.now(), name: fullName(), user: uname(), net: NETN };
      var p = price(); if (p && p.usd) { rec.usd = p.usd; rec.sar = p.sar; }
      var c = Object.assign({}, cb);
      c.onReadyForServerApproval = function (pid) { rec.pid = pid; return cb.onReadyForServerApproval && cb.onReadyForServerApproval.apply(this, arguments); };
      c.onReadyForServerCompletion = function (pid, txid) {
        rec.pid = pid; rec.txid = txid; rec.ts = Date.now(); rec.status = 'Completed';
        var all = get('rcpts', []); all.unshift(rec); put('rcpts', all.slice(0, 200));
        setTimeout(drawWallet, 300);
        return cb.onReadyForServerCompletion && cb.onReadyForServerCompletion.apply(this, arguments);
      };
      return orig(data, c);
    };
  }

  /* ── receipts ── */
  function spec(r) {
    var d = new Date(r.ts), when = [['Date', d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })], ['Time', d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })]];
    var sub = r.usd ? '≈ ' + (r.amount * r.sar).toFixed(2) + ' SAR · $' + (r.amount * r.usd).toFixed(2) + (r.lr && r.lc && r.lc !== 'SAR' && r.lc !== 'USD' ? ' · ' + (r.ls || r.lc + ' ') + num(r.amount * r.lr, r.amount * r.lr < 10 ? 2 : 0) : '') + ' at payment time' : '';
    if (r.kind === 'p2p' && r.send) {
      return { title: r.dir === 'in' ? 'Transfer received' : 'Transfer receipt', status: { text: '✓  Verified on the Pi blockchain', ok: true }, amount: r.amount, sub: sub,
        rows: [['From', (r.name || '—') + (r.user ? ' (@' + r.user + ')' : '')], ['To', (r.toName ? r.toName + ' · ' : '') + short(r.to)], ['Narration', r.narr || '—'], ['Reference', r.ref]]
          .concat(when, [['Network', r.net], ['Recipient address', r.to, 1], ['Transaction ID', r.txid, 1]]),
        thanks: r.dir === 'in' ? 'Received with Haramain' : 'Sent with Haramain', note: r.inapp ? 'Paid in Haramain and delivered from the Haramain app wallet. Check it on the Pi blockchain with the code above.' : 'Verified by Haramain on the Pi blockchain. Haramain never holds funds.' };
    }
    if (r.kind === 'p2p') {
      var inn = r.dir === 'in';
      return { title: inn ? 'Sale receipt' : 'Payment receipt', status: { text: '✓  Verified on the Pi blockchain', ok: true }, amount: r.amount, sub: sub,
        rows: [['Paid to', inn ? (r.name || r.seller || '—') + (r.user ? ' (@' + r.user + ')' : '') : r.other], ['Paid by', inn ? short(r.from) : (r.name || short(r.from))], ['For', r.item || r.memo || 'Payment'], ['Reference', r.ref]]
          .concat(when, [['Network', r.net], ['Seller address', r.to, 1], ['Transaction ID', r.txid, 1]]),
        thanks: 'Paid with Haramain Pay', note: 'Verified by Haramain on the Pi blockchain. Haramain never holds funds.' };
    }
    return { title: 'Payment receipt', status: { text: r.status === 'Pending' ? 'Pending' : '✓  Completed', ok: r.status !== 'Pending' }, amount: r.amount, sub: sub,
      rows: [['Name', r.name || '—'], ['Pi username', r.user ? '@' + r.user : '—'], ['Payment for', TYPES[r.kind] || r.memo || 'Pi payment']].concat(when, [['Network', r.net || 'Pi Network'], ['Payment ID', r.pid, 1], ['Transaction ID', r.txid, 1]]),
      thanks: 'Thank you for supporting Haramain' };
  }
  function verifyUrl(r) { return r && /^[a-f0-9]{64}$/i.test(r.txid || '') ? location.origin + '/receipt.html#tx=' + r.txid.toLowerCase() + '&net=' + (/Testnet/.test(r.net || '') ? 'test' : 'main') : ''; }
  window.hmReceipt = function (i) {
    var r = get('rcpts', [])[i]; if (!r || !window.HMReceipt) return;
    var text = 'HARAMAIN · ' + (r.send ? 'Transfer receipt' : r.kind === 'p2p' ? 'Verified payment' : 'Payment receipt') + '\n' + r.amount + ' π · ' + (r.narr || TYPES[r.kind] || r.item || r.memo || 'Pi payment') + '\nDate: ' + new Date(r.ts).toLocaleString() + '\nTransaction ID: ' + (r.txid || '—') + '\nharamain.pi';
    var sp = spec(r); sp.verify = verifyUrl(r); if (sp.verify) text += '\nVerify: ' + sp.verify;
    HMReceipt.sheet(sp, 'Haramain-receipt-' + (r.txid ? r.txid.slice(0, 8) : r.ts) + '.png', text);
  };

  /* ── Haramain Pay: payment requests ── */
  function enc(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function newRef() { var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(6), s = 'HM-'; try { crypto.getRandomValues(b); } catch (e) { for (var j = 0; j < 6; j++) b[j] = Math.random() * 256; } for (var i = 0; i < 6; i++) s += A[b[i] % A.length]; return s; }
  function link(s) { return location.origin + '/pay.html#' + enc({ v: 1, t: s.t, a: s.a, i: s.i, n: s.n, u: s.u, r: s.r, k: TESTNET ? 'test' : 'main', d: s.d }); }
  function convLine(a) {
    var p = price(); if (!p || !p.sar || !(a > 0)) return '';
    var l = loc(); return '≈ ' + num(a * p.sar, 2) + ' SAR · $' + num(a * p.usd, 2) + (l.rate && l.code !== 'SAR' && l.code !== 'USD' ? ' · ' + l.sym + Math.round(a * l.rate).toLocaleString() : '');
  }
  window.hmGetPaid = function () {
    var w = sheetEl('💰 Get paid in Pi',
      '<div class="hm-sheet-b">Create a payment request. Your buyer pays from Pi Wallet, and Haramain confirms it on the Pi blockchain and makes a receipt for both of you.</div>' +
      '<label class="wf-l">Amount</label><div class="wf-amt"><input id="gp-a" type="number" inputmode="decimal" min="0" step="any" placeholder="0"><span>π</span></div><div class="wf-conv" id="gp-c"></div>' +
      '<label class="wf-l">What is it for?</label><input class="fi" id="gp-i" maxlength="60" placeholder="e.g. Prayer mat, taxi to Mina, hotel deposit">' +
      '<label class="wf-l">Your name (shown to the buyer)</label><input class="fi" id="gp-n" maxlength="50" value="' + esc(get('fullname', '')) + '" placeholder="Full name or shop name">' +
      '<label class="wf-l">Your Pi wallet address</label><input class="fi wf-mono" id="gp-t" maxlength="56" autocapitalize="characters" autocomplete="off" value="' + esc(get('myaddr', '')) + '" placeholder="G… (56 characters)">' +
      '<div class="wf-hint">Find it in Pi Wallet → <b>Receive</b> → copy. It is saved on this phone for next time.</div>' +
      '<button type="button" class="hm-sheet-a" id="gp-go">Create payment request</button>');
    var a = $('gp-a'); a.oninput = function () { $('gp-c').textContent = convLine(parseFloat(a.value)); }; setTimeout(function () { a.focus(); }, 80);
    $('gp-go').onclick = function () {
      var amt = Math.round(parseFloat(a.value) * 1e7) / 1e7, it = $('gp-i').value.trim(), nm = $('gp-n').value.trim(), to = $('gp-t').value.trim().toUpperCase().replace(/\s+/g, '');
      if (!(amt > 0)) return say('Enter the amount in π');
      if (!it) return say('Say what the payment is for');
      if (!/^G[A-Z2-7]{55}$/.test(to)) return say('That wallet address is not valid. It starts with G and has 56 characters.');
      put('myaddr', to); if (nm && !get('fullname', '')) put('fullname', nm);
      var s = { t: to, a: amt, i: it, n: nm || fullName(), u: uname(), r: newRef(), d: Date.now() };
      var sales = get('sales', []); sales.unshift(s); put('sales', sales.slice(0, 100));
      w.remove(); drawWallet(); showRequest(s);
    };
  };
  function showRequest(s) {
    var url = link(s);
    var t = 'Payment request from ' + (s.n || 'me') + ': ' + s.a + ' π for ' + s.i + '. Pay securely with Haramain Pay:\n' + url;
    var w = sheetEl('✅ Payment request ready',
      '<div class="wf-req"><div class="wf-req-a">' + s.a + ' π</div><div class="wf-req-c">' + esc(convLine(s.a)) + '</div><div class="wf-req-i">' + esc(s.i) + ' · <span class="wf-mono">' + s.r + '</span></div></div>' +
      '<div class="hm-sheet-b">Send this link to your buyer. When they pay, Haramain finds the payment automatically and adds your sale receipt here.</div>' +
      '<button type="button" class="hm-sheet-a" id="rq-sh">📤 Share with buyer</button>' +
      '<div class="wf-two"><button type="button" class="wf-btn" id="rq-cp">🔗 Copy link</button><a class="wf-btn" href="' + url + '" target="_blank" rel="noopener">👁 Open request</a></div>');
    $('rq-sh').onclick = function () { if (navigator.share) navigator.share({ title: 'Haramain Pay', text: t }).catch(function () {}); else window.open('https://wa.me/?text=' + encodeURIComponent(t)); };
    $('rq-cp').onclick = function () { try { navigator.clipboard.writeText(url); say('✅ Link copied'); } catch (e) { prompt('Copy this link', url); } };
  }
  window.hmReqOpen = function (i) { var s = get('sales', [])[i]; if (s) showRequest(s); };
  window.hmReqDel = function (i) { var s = get('sales', []); if (!s[i] || !confirm('Remove this payment request?')) return; s.splice(i, 1); put('sales', s); drawWallet(); };
  window.hmPay = function () {
    var w = sheetEl('💳 Pay a Haramain Pay request',
      '<div class="hm-sheet-b">When a seller sends you a Haramain Pay link, open it to see who you are paying, the amount and the item. Or paste the link here.</div>' +
      '<input class="fi" id="py-l" placeholder="Paste the payment link" autocomplete="off" style="margin-top:12px">' +
      '<button type="button" class="hm-sheet-a" id="py-go">Open payment request</button>' +
      '<div class="wf-hint" style="margin-top:10px">🔒 Haramain never holds your Pi and never asks for your passphrase. Payments on the Pi blockchain cannot be reversed, so check the seller first.</div>');
    $('py-go').onclick = function () { var v = $('py-l').value.trim(), m = /pay\.html#([A-Za-z0-9_-]+)/.exec(v); if (!m) return say('That is not a Haramain Pay link'); w.remove(); location.href = '/pay.html#' + m[1]; };
  };

  /* watch open requests and notify when paid */
  var checking = false;
  function checkSales(manual) {
    if (checking) return; var sales = get('sales', []), open = [];
    sales.forEach(function (s, i) { if (!s.paid && Date.now() - s.d < 30 * 864e5) open.push(i); });
    if (!open.length) { if (manual) say('No open payment requests'); return; }
    checking = true; if (manual) say('Checking the Pi blockchain…');
    var jobs = open.slice(0, 6).map(function (i) {
      var s = sales[i];
      return fetch('/verify?to=' + s.t + '&ref=' + s.r + '&amt=' + s.a + '&net=' + (TESTNET ? 'test' : 'main')).then(function (r) { return r.json(); }).then(function (d) {
        if (!(d.ok && d.found)) return 0;
        var tx = d.tx, all = get('rcpts', []);
        s.paid = tx.hash; s.at = Date.parse(tx.at) || Date.now(); s.from = tx.from;
        if (!all.some(function (x) { return x.txid === tx.hash; })) {
          var p = price();
          all.unshift({ amount: +parseFloat(tx.amount).toFixed(7), memo: s.i, item: s.i, kind: 'p2p', dir: 'in', ts: s.at, name: s.n, user: s.u, other: tx.from, from: tx.from, to: s.t, ref: s.r, seller: s.n, net: NETN, txid: tx.hash, status: 'Verified', usd: p && p.usd, sar: p && p.sar });
          put('rcpts', all.slice(0, 200));
        }
        var msg = s.a + ' π for ' + s.i + ' · verified on the Pi blockchain';
        try { addNotif('💰', 'Payment received', msg, 'now'); } catch (e) {}
        if (window.hmSysNotify) hmSysNotify('💰 Payment received', msg, 'hm-pay-' + s.r);
        return 1;
      }).catch(function () { return 0; });
    });
    Promise.all(jobs).then(function (r) {
      checking = false; put('sales', sales);
      var n = r.reduce(function (a, b) { return a + b; }, 0);
      if (n) { say('💰 ' + n + ' payment' + (n > 1 ? 's' : '') + ' received'); drawWallet(); } else if (manual) say('No payment yet. Haramain keeps checking while the app is open.');
    });
  }
  window.hmCheckSales = function () { checkSales(true); checkSends(); };

  /* ── wallet screen ── */
  window.hmEditName = function () {
    var w = sheetEl('✎ Name on receipts', '<input class="fi" id="nm-v" maxlength="50" value="' + esc(get('fullname', '')) + '" placeholder="Your full name" style="margin-top:6px"><button type="button" class="hm-sheet-a" id="nm-go">Save</button>');
    setTimeout(function () { $('nm-v').focus(); }, 80);
    $('nm-go').onclick = function () { put('fullname', $('nm-v').value.trim().slice(0, 50)); w.remove(); drawWallet(); say('✅ Name saved'); };
  };
  /* ── Send Pi: everything in Haramain, approval in Pi Wallet, receipt from the blockchain ── */
  function decLink(v) {
    var m = /pay\.html#([A-Za-z0-9_-]+)/.exec(v || ''); if (!m) return null;
    try { var t = m[1].replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var o = JSON.parse(decodeURIComponent(escape(atob(t)))); return /^G[A-Z2-7]{55}$/.test(o.t || '') && typeof o.a === 'number' && isFinite(o.a) && o.a > 0 && o.a <= 1e7 && /^HM-[A-Z0-9]{6}$/.test(o.r || '') ? o : null; } catch (e) { return null; }
  }
  window.hmSendSheet = function () {
    var payees = get('payees', []), lock = null;
    var w = sheetEl('💸 Send Pi',
      '<div class="hm-sheet-b">Fill in your transfer here. You approve it in Pi Wallet, and Haramain confirms it on the Pi blockchain and gives you a receipt with your narration.</div>' +
      (payees.length ? '<label class="wf-l">Recent</label><div class="wf-payees">' + payees.slice(0, 6).map(function (p, i) { return '<button type="button" data-i="' + i + '">' + esc(p.n || short(p.t)) + '</button>'; }).join('') + '</div>' : '') +
      '<label class="wf-l">To · wallet address or Haramain Pay link</label><input class="fi wf-mono" id="sd-to" autocomplete="off" autocapitalize="characters" placeholder="G… address, or paste a payment link">' +
      '<div class="wf-hint" id="sd-tohint"></div>' +
      '<label class="wf-l">Recipient name (optional)</label><input class="fi" id="sd-n" maxlength="50" placeholder="e.g. Abdullahi, Al-Safwa Hotel">' +
      '<label class="wf-l">Amount</label><div class="wf-amt"><input id="sd-a" type="number" inputmode="decimal" min="0" step="any" placeholder="0"><span>π</span></div><div class="wf-conv" id="sd-c"></div>' +
      '<label class="wf-l">Narration</label><input class="fi" id="sd-x" maxlength="80" placeholder="What is it for? e.g. Hotel deposit, gift for Umrah">' +
      '<button type="button" class="hm-sheet-a" id="sd-go">Continue</button>' +
      '<div class="wf-hint" style="margin-top:8px">🔒 Only you can approve a payment, in Pi Wallet. Haramain never holds your Pi and never asks for your passphrase.</div>');
    var to = $('sd-to'), a = $('sd-a');
    a.oninput = function () { $('sd-c').textContent = convLine(parseFloat(a.value)); };
    to.oninput = function () {
      var o = decLink(to.value), h = $('sd-tohint');
      if (o) { lock = o; to.value = o.t; $('sd-n').value = o.n || ''; a.value = o.a; a.readOnly = true; $('sd-x').value = o.i || ''; a.oninput(); h.innerHTML = '✅ Haramain Pay request from <b>' + esc(o.n || 'the seller') + '</b> · reference <span class="wf-mono">' + esc(o.r) + '</span>'; return; }
      var v = to.value.trim().toUpperCase().replace(/\s+/g, ''); h.textContent = v.length >= 56 && !/^G[A-Z2-7]{55}$/.test(v) ? 'This address does not look right: it starts with G and has 56 characters.' : '';
    };
    w.querySelectorAll('.wf-payees button').forEach(function (b) { b.onclick = function () { var p = payees[+b.getAttribute('data-i')]; to.value = p.t; $('sd-n').value = p.n || ''; a.focus(); }; });
    setTimeout(function () { to.focus(); }, 80);
    $('sd-go').onclick = function () {
      var t = to.value.trim().toUpperCase().replace(/\s+/g, ''), amt = Math.round(parseFloat(a.value) * 1e7) / 1e7, nm = $('sd-n').value.trim(), nx = $('sd-x').value.trim();
      if (!/^G[A-Z2-7]{55}$/.test(t)) return say('Enter the recipient’s wallet address (starts with G, 56 characters)');
      if (!(amt > 0)) return say('Enter the amount in π');
      if (!nx) return say('Add a narration: what is this payment for?');
      var p = price(), l = loc();
      var sd = { t: t, a: amt, n: nm, x: nx, r: lock && lock.t === t ? lock.r : newRef(), d: Date.now(), usd: p && p.usd, sar: p && p.sar, lc: l.code, lr: l.rate, ls: l.sym, seller: lock && lock.t === t };
      var all = get('sends', []); all.unshift(sd); put('sends', all.slice(0, 100));
      var py = payees.filter(function (x) { return x.t !== t; }); py.unshift({ t: t, n: nm }); put('payees', py.slice(0, 12));
      w.remove(); drawWallet(); showSend(0);
    };
  };
  window.hmPay = function () { hmSendSheet(); setTimeout(function () { var e = $('sd-to'); if (e) e.placeholder = 'Paste the Haramain Pay link here'; }, 60); };
  function copyBtn(v, label) { return '<div class="wf-copy"><code>' + esc(v) + '</code><button type="button" data-c="' + esc(v) + '">' + (label || 'Copy') + '</button></div>'; }
  var sendTimer = null;
  function showSend(i) {
    var sd = get('sends', [])[i]; if (!sd) return;
    if (sd.paid) return hmReceiptByTx(sd.paid);
    var w = sheetEl('💸 Approve in Pi Wallet',
      '<div class="wf-req"><div class="wf-req-a">' + sd.a + ' π</div><div class="wf-req-c">' + esc(convLine(sd.a)) + '</div><div class="wf-req-i">To ' + esc(sd.n || short(sd.t)) + ' · ' + esc(sd.x) + '</div></div>' +
      '<div class="wf-steps">' +
        '<div class="wf-step"><i>1</i><div><b>Copy the recipient’s address</b>' + copyBtn(sd.t) + '</div></div>' +
        '<div class="wf-step"><i>2</i><div><b>Copy the amount</b>' + copyBtn(String(sd.a)) + '</div></div>' +
        '<div class="wf-step"><i>3</i><div><b>Copy the memo</b><small>Put it in the memo so Haramain can find your payment.</small>' + copyBtn(sd.r) + '</div></div>' +
        '<div class="wf-step"><i>4</i><div><b>Open Pi Wallet, tap Send, paste and approve</b><button type="button" class="hm-sheet-a" style="margin-top:8px" onclick="hmOpenPiWallet()">Open Pi Wallet</button><small>After approving, tap Back to return to Haramain. Your transfer waits here.</small></div></div>' +
      '</div>' +
      '<button type="button" class="wf-cta" id="sd-chk">✅ I have sent it · confirm</button><div class="wf-status" id="sd-st"></div>' +
      '<details class="wf-alt"><summary>Forgot the memo? Use the transaction ID</summary><input class="fi wf-mono" id="sd-tx" placeholder="64-character transaction ID" autocomplete="off" style="margin-top:8px"><button type="button" class="wf-btn" id="sd-txb" style="margin-top:8px;width:100%">Verify this transaction</button></details>');
    w.querySelectorAll('[data-c]').forEach(function (b) { b.onclick = function () { var v = b.getAttribute('data-c'); try { navigator.clipboard.writeText(v); } catch (e) {} var o = b.textContent; b.textContent = '✓ Copied'; setTimeout(function () { b.textContent = o; }, 1300); }; });
    var st = function (c, h) { var e = $('sd-st'); if (e) { e.className = 'wf-status ' + c; e.innerHTML = h; } };
    var tries = 0;
    var poll = function () {
      if (!document.body.contains(w)) return;
      st('wait', '⏳ Looking for your payment on the Pi blockchain…');
      fetch('/verify?to=' + sd.t + '&ref=' + sd.r + '&amt=' + sd.a + '&net=' + (TESTNET ? 'test' : 'main')).then(function (r) { return r.json(); }).then(function (d) {
        if (d.ok && d.found) { w.remove(); finishSend(i, d.tx); return; }
        if (d.ok && d.account === false) { st('err', 'This address has no activity on the ' + NETN + ' yet. Check that it is right before you send.'); return; }
        st('wait', '⏳ Not found yet. Haramain checks every 10 seconds' + (tries > 30 ? '; tap the button to check again' : '') + '.');
        if (++tries <= 60) sendTimer = setTimeout(poll, 10000);
      }).catch(function () { st('err', 'No connection. Haramain will try again.'); if (++tries <= 60) sendTimer = setTimeout(poll, 10000); });
    };
    $('sd-chk').onclick = function () { clearTimeout(sendTimer); tries = 0; poll(); };
    $('sd-txb').onclick = function () {
      var h = ($('sd-tx').value || '').trim().toLowerCase(); if (!/^[a-f0-9]{64}$/.test(h)) return st('err', 'A transaction ID has 64 letters and numbers. Copy it from the payment in Pi Wallet.');
      st('wait', '⏳ Checking this transaction…');
      fetch('/verify?tx=' + h + '&net=' + (TESTNET ? 'test' : 'main')).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.ok) return st('err', esc(d.error));
        if (!d.tx.ok) return st('err', 'This transaction failed, so no Pi was sent.');
        var p = (d.tx.payments || []).filter(function (x) { return x.to === sd.t && parseFloat(x.amount) + 1e-7 >= sd.a; })[0];
        if (!p) return st('err', 'This transaction did not send ' + sd.a + ' π to this address.');
        w.remove(); finishSend(i, { hash: d.tx.hash, at: d.tx.at, from: p.from, to: p.to, amount: p.amount });
      }).catch(function () { st('err', 'No connection. Try again.'); });
    };
  }
  window.hmShowSend = showSend;
  /* Pi Wallet opens in the same tab (new tabs are blocked in the Pi Browser); Back returns to Haramain */
  window.hmOpenPiWallet = function () {
    try { sessionStorage.setItem('hm_back_to', 'payments'); } catch (e) {}
    try { location.href = 'https://wallet.pinet.com'; } catch (e) { say('Open the Wallet from the Pi Browser home screen.'); }
  };
  function finishSend(i, tx) {
    var all = get('sends', []), sd = all[i]; if (!sd || sd.paid) return;
    sd.paid = tx.hash; sd.at = Date.parse(tx.at) || Date.now(); sd.from = tx.from; put('sends', all);
    var R = get('rcpts', []);
    if (!R.some(function (x) { return x.txid === tx.hash; })) {
      R.unshift({ amount: +parseFloat(tx.amount).toFixed(7), kind: 'p2p', send: true, dir: 'out', narr: sd.x, item: sd.x, memo: sd.x, toName: sd.n, seller: sd.n, other: sd.n || short(sd.t), to: sd.t, from: tx.from, ref: sd.r, ts: sd.at, name: fullName(), user: uname(), net: NETN, txid: tx.hash, status: 'Verified', usd: sd.usd, sar: sd.sar, lc: sd.lc, lr: sd.lr, ls: sd.ls });
      put('rcpts', R.slice(0, 200));
    }
    var msg = sd.a + ' π to ' + (sd.n || short(sd.t)) + ' · ' + sd.x;
    try { addNotif('✅', 'Transfer confirmed', msg, 'now'); } catch (e) {}
    if (window.hmSysNotify) hmSysNotify('✅ Transfer confirmed', msg, 'hm-send-' + sd.r);
    drawWallet(); hmReceiptByTx(tx.hash);
  }
  function checkSends() {
    var all = get('sends', []);
    all.forEach(function (sd, i) {
      if (sd.paid || Date.now() - sd.d > 7 * 864e5) return;
      fetch('/verify?to=' + sd.t + '&ref=' + sd.r + '&amt=' + sd.a + '&net=' + (TESTNET ? 'test' : 'main')).then(function (r) { return r.json(); }).then(function (d) {
        if (d.ok && d.found) { var cur = get('sends', []); var j = cur.findIndex ? cur.findIndex(function (x) { return x.r === sd.r && x.t === sd.t; }) : i; if (j >= 0) { var open = document.querySelector('.hm-sheet-wrap'); if (open && /Approve in Pi Wallet/.test(open.textContent)) open.remove(); finishSend(j, d.tx); } }
      }).catch(function () {});
    });
  }

  /* ── any currency ── */
  window.hmPickCurrency = function () {
    var L = (window.PiPrice && PiPrice.currencies) ? PiPrice.currencies() : [], cur = loc().code;
    var w = sheetEl('💱 Your currency',
      '<input class="fi" id="cu-q" type="search" placeholder="Search: naira, dollar, PKR…" autocomplete="off">' +
      '<div class="wf-cur" id="cu-l"></div><div class="wf-hint">Rates: OKX / CoinGecko for Pi, open.er-api.com for currencies. For information only.</div>');
    var draw = function () {
      var q = ($('cu-q').value || '').trim().toLowerCase();
      $('cu-l').innerHTML = L.filter(function (c) { return !q || c.code.toLowerCase().indexOf(q) >= 0 || c.name.toLowerCase().indexOf(q) >= 0; }).map(function (c) {
        var r = PiPrice.rateIn ? PiPrice.rateIn(c.code) : null;
        return '<button type="button" data-c="' + c.code + '" class="' + (c.code === cur ? 'on' : '') + '"><b>' + c.code + '</b><span>' + esc(c.name) + '</span><small>' + (r ? '1 π = ' + esc(c.sym) + (r < 10 ? num(r, 3) : num(r, 2)) : '') + '</small></button>';
      }).join('') || '<div class="wl-empty"><b>No match</b></div>';
      $('cu-l').querySelectorAll('button').forEach(function (b) { b.onclick = function () { hmSetLocal(b.getAttribute('data-c')); w.remove(); drawWallet(); say('💱 ' + b.getAttribute('data-c') + ' selected'); }; });
    };
    $('cu-q').oninput = draw; draw(); setTimeout(function () { $('cu-q').focus(); }, 80);
  };
  window.hmRequestSheet = window.hmGetPaid;
  var filter = 'all';
  window.hmTxFilter = function (f) { filter = f; drawTx(); };
  function heroPrice() {
    var p = price(), l = loc(), e = $('wf-price'); if (!e) return;
    if (!p || !p.usd) { e.innerHTML = '<div class="wf-p-k"><i class="wf-live"></i>Pi price</div><div class="wf-p-v">Loading…</div>'; return; }
    var ch = typeof p.change24h === 'number' ? p.change24h : null, ago = p.updated ? Math.max(0, Math.round((Date.now() - Date.parse(p.updated)) / 60000)) : null;
    e.innerHTML = '<div class="wf-p-k"><i class="wf-live' + (p.stale ? ' off' : '') + '"></i>' + (p.stale ? 'Last known Pi price' : 'Pi price · live') + (ch !== null ? '<span class="wf-ch ' + (ch >= 0 ? 'up' : 'dn') + '">' + (ch >= 0 ? '▲ ' : '▼ ') + Math.abs(ch).toFixed(2) + '%</span>' : '') + '</div>' +
      (l.rate && l.code !== 'SAR' && l.code !== 'USD' ? '<div class="wf-p-v">1 π = <b>' + esc(l.sym) + num(l.rate, l.rate < 10 ? 3 : 2) + '</b><button type="button" class="wf-cur-b" onclick="event.stopPropagation();hmPickCurrency()">' + esc(l.code) + ' ▾</button></div>' +
        '<div class="wf-p-s">SAR ' + p.sar.toFixed(4) + ' · $' + p.usd.toFixed(4) + ' · ' + (ago === null ? 'refreshes automatically' : ago < 1 ? 'updated just now' : 'updated ' + ago + ' min ago') + '</div>' :
       '<div class="wf-p-v">1 π = <b>SAR ' + p.sar.toFixed(4) + '</b><button type="button" class="wf-cur-b" onclick="event.stopPropagation();hmPickCurrency()">' + esc(l.code) + ' ▾</button></div>' +
        '<div class="wf-p-s">$' + p.usd.toFixed(4) + ' · ' + (ago === null ? 'refreshes automatically' : ago < 1 ? 'updated just now' : 'updated ' + ago + ' min ago') + '</div>');
  }
  function stats() {
    var R = get('rcpts', []), m = new Date(); m.setDate(1); m.setHours(0, 0, 0, 0);
    var inn = 0, out = 0; R.forEach(function (r) { if (r.ts >= m.getTime()) { if (r.dir === 'in') inn += +r.amount; else out += +r.amount; } });
    return { inn: +inn.toFixed(4), out: +out.toFixed(4) };
  }
  function convert(from) {
    var p = price(), l = loc(); if (!p || !p.sar) return;
    var pi = $('wc-pi'), sar = $('wc-sar'), lc = $('wc-loc'); if (!pi) return;
    var v = from === 'pi' ? parseFloat(pi.value) : from === 'sar' ? parseFloat(sar.value) / p.sar : (l.rate ? parseFloat(lc.value) / l.rate : NaN);
    if (!(v >= 0)) v = 0;
    if (from !== 'pi') pi.value = v ? +v.toFixed(4) : '';
    if (from !== 'sar') sar.value = v ? (v * p.sar).toFixed(2) : '';
    if (lc && from !== 'loc') lc.value = v && l.rate ? Math.round(v * l.rate) : '';
  }
  window.hmConv = convert;
  function drawWallet() {
    var sec = $('s-payments'); if (!sec) return;
    var prem = (function () { try { var v = localStorage.getItem(K + 'prem'); return v === '1' || v === 'true'; } catch (e) { return false; } })();
    var top = $('wl-top');
    if (!top) {
      var hp = sec.querySelector('.wallet-hero'); if (hp) hp.style.display = 'none';
      Array.prototype.forEach.call(sec.children, function (c) {
        if (c.classList.contains('ic') && /Send Pi|Request Pi/.test(c.textContent)) c.style.display = 'none';
        if (c.classList.contains('sec-label') && /Charitable/.test(c.textContent)) c.style.display = 'none';
        if (c.classList.contains('tgrid')) c.style.display = 'none';
      });
      top = document.createElement('div'); top.id = 'wl-top';
      var hdr = sec.querySelector('.scr-hdr'); if (hdr && hdr.nextSibling) sec.insertBefore(top, hdr.nextSibling); else sec.prepend(top);
      var rest = document.createElement('div'); rest.id = 'wl-rest'; top.parentNode.insertBefore(rest, top.nextSibling);
      var pc = $('hm-pi-pay'); if (pc) pc.style.display = 'none';
    }
    var st = stats(), l = loc(), sales = get('sales', []);
    top.innerHTML =
      '<div class="wf-card"><div class="wf-row"><img src="icons/icon-192.png" alt=""><div class="wf-who"><small>Haramain Wallet</small><b>' + esc(fullName()) + '<button type="button" onclick="hmEditName()" aria-label="Edit name">✎</button></b><span>' + (uname() ? '@' + esc(uname()) : 'Guest · sign in with Pi to pay') + '</span></div>' + (prem ? '<span class="wf-badge">⭐ Supporter</span>' : '') + '</div>' +
        '<div class="wf-price" id="wf-price" role="button" tabindex="0" onclick="PiPrice.open && PiPrice.open()"></div>' +
        '<div class="wf-stats"><div><small>Received this month</small><b>+' + st.inn + ' π</b></div><div><small>Paid this month</small><b>−' + st.out + ' π</b></div></div>' +
        '<div class="wf-net">' + NETN + ' · haramain.pi</div></div>' +
      '<div class="wf-acts"><button type="button" class="tx-only" onclick="hmSendSheet()"><span>💸</span>Send</button><button type="button" class="tx-only" onclick="hmGetPaid()"><span>📩</span>Request</button><button type="button" onclick="document.getElementById(\'wf-act\').scrollIntoView({behavior:\'smooth\',block:\'start\'})"><span>🧾</span>Receipts</button><button type="button" onclick="hmPickCurrency()"><span>💱</span>Currency</button></div>';
    heroPrice();
    var sends = get('sends', []);
    var items = sales.map(function (s, i) { return { k: 'in', d: s.d, s: s, i: i }; }).concat(sends.map(function (s, i) { return { k: 'out', d: s.d, s: s, i: i }; })).sort(function (a, b) { return b.d - a.d; }).slice(0, 8);
    var openN = sales.filter(function (s) { return !s.paid; }).length + sends.filter(function (s) { return !s.paid; }).length;
    $('wl-rest').innerHTML =
      '<div class="wf-sec tx-only"><div class="wf-sec-h"><b>💸 Send &amp; request Pi</b></div>' +
        '<div class="wf-how"><div><span>1</span>Choose a Haramain user by @username</div><div><span>2</span>Approve in Pi’s pop-up, right here in Haramain</div><div><span>3</span>They receive it in seconds, with a receipt for both of you</div></div>' +
        '<div class="wf-two"><button type="button" class="wf-cta" style="margin-top:12px" onclick="hmSendSheet()">💸 Send Pi</button><button type="button" class="wf-cta wf-cta2" style="margin-top:12px" onclick="hmGetPaid()">📩 Request Pi</button></div></div>' +
      '<div class="wf-sec"><div class="wf-sec-h"><b>💱 Converter · live rate</b><button type="button" class="wf-link" onclick="hmPickCurrency()">' + esc(l.code) + ' ▾</button></div>' +
        '<div class="wf-conv3"><label><span>π</span><input id="wc-pi" type="number" inputmode="decimal" placeholder="1" oninput="hmConv(\'pi\')"></label><label><span>SAR</span><input id="wc-sar" type="number" inputmode="decimal" placeholder="0" oninput="hmConv(\'sar\')"></label>' +
        (l.code !== 'SAR' ? '<label><span>' + esc(l.code) + '</span><input id="wc-loc" type="number" inputmode="decimal" placeholder="0" oninput="hmConv(\'loc\')"></label>' : '') + '</div></div>' +
      '<div class="wf-sec"><div class="wf-sec-h"><b>🤲 Give &amp; support</b></div><div class="nv-grid wl-tools">' +
        [['🤲', 'Zakat', "oUtil('zakat')"], ['💝', 'Sadaqah', "oUtil('sadaqah')"], ['🐑', 'Qurbani', "oUtil('qurbani')"], ['⭐', 'Support Haramain', 'buyPrem()']].map(function (t) { return '<button type="button" class="nv-t" onclick="' + t[2] + '"><span class="nv-i">' + t[0] + '</span><span class="nv-l">' + t[1] + '</span></button>'; }).join('') + '</div></div>' +
      '<div class="wf-sec" id="wf-act"><div class="wf-sec-h"><b>🧾 Activity &amp; receipts</b></div><div class="wf-tabs">' +
        [['all', 'All'], ['in', 'Received'], ['out', 'Paid']].map(function (t) { return '<button type="button" data-f="' + t[0] + '" onclick="hmTxFilter(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '</div><div id="wl-tx"></div></div>' +
      '<div class="wf-safe">🔒 <span><b>You approve every payment yourself.</b> Haramain never asks for your passphrase and cannot move Pi from your wallet. Sending to a Haramain user passes through the Haramain app wallet for a few seconds, and every step is recorded on the Pi blockchain. Your balance is shown in Pi Wallet.</span></div>';
    var w = $('wc-pi'); if (w) { w.value = 1; convert('pi'); }
    drawTx();
  }
  window.hmReceiptByTx = function (h) { var R = get('rcpts', []); for (var i = 0; i < R.length; i++) if (R[i].txid === h) return hmReceipt(i); say('Receipt not found on this phone'); };
  function drawTx() {
    var R = get('rcpts', []), rows = [];
    R.forEach(function (r, i) { var d = r.dir || 'out'; if (filter === 'all' || filter === d) rows.push([r, i]); });
    document.querySelectorAll('.wf-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-f') === filter); });
    var html = rows.length ? rows.slice(0, 60).map(function (x) {
      var r = x[0], inn = r.dir === 'in', title = r.kind === 'p2p' ? (inn ? 'From ' + short(r.other) : 'To ' + (r.toName || r.seller || short(r.to))) : (TYPES[r.kind] || r.memo || 'Pi payment');
      var icon = r.kind === 'pilgrim_pass' ? '⭐' : inn ? '↓' : '↑';
      return '<div class="wl-tx"><span class="wl-txi ' + (inn ? 'in' : 'out') + '">' + icon + '</span><div class="wl-txt"><b>' + esc(title) + '</b><small>' + (r.kind === 'p2p' ? esc(r.item || '') + ' · ' : '') + new Date(r.ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + esc(r.status || 'Completed') + '</small></div><div class="wl-txa"><b class="' + (inn ? 'in' : '') + '">' + (inn ? '+' : '−') + r.amount + ' π</b><button type="button" onclick="hmReceipt(' + x[1] + ')">Receipt</button></div></div>';
    }).join('') : '<div class="wl-empty"><span>🧾</span><b>' + (filter === 'in' ? 'No payments received yet' : filter === 'out' ? 'No payments made yet' : 'No activity yet') + '</b><small>Payments in Haramain and Haramain Pay sales appear here with a receipt you can share as an image.</small></div>';
    var old = filter === 'in' ? [] : (window.txLog || []).filter(function (t) { return t && t.t && !/^📨|Request/.test(t.t); }).slice(0, 10);
    if (old.length) html += '<div class="nv-h" style="margin-top:10px">Earlier activity</div>' + old.map(function (t) { return '<div class="wl-old">' + esc(t.t) + '<small>' + esc(t.d) + '</small></div>'; }).join('');
    ['wl-tx', 'tx-list'].forEach(function (id) { var e = $(id); if (e) e.innerHTML = html; });
  }
  window.renderTx = drawTx;

  /* zakat: live price, no invented causes */
  function fixZakat() {
    var up = $('up-zakat'); if (!up || up.dataset.fixed) return; up.dataset.fixed = 1;
    Array.prototype.forEach.call(up.querySelectorAll('.ic'), function (c) { if (/Send Zakat in Pi/.test(c.textContent)) c.innerHTML = '<div class="ic-title">Give your Zakat</div><div class="hm-li">🤲 Give it to people in need directly, or through a registered charity or your local mosque.</div><div class="hm-li">🇸🇦 In Saudi Arabia, the official Ehsan platform lists verified projects: <a href="https://ehsan.sa" target="_blank" rel="noopener" style="color:var(--grn);font-weight:700">ehsan.sa ›</a></div><div class="hm-li">💸 To give in Pi, send it from Pi Wallet to the person or charity.</div>'; });
    var pr = $('zk-price'); if (pr) { pr.value = ''; pr.placeholder = 'loading live price…'; var d = price(); if (d && d.usd) pr.value = d.usd.toFixed(4); }
    var lbl = up.querySelector('.ibox'); if (lbl) lbl.textContent = 'Zakat is 2.5% of savings you have held for a full lunar year, if they are above the nisab (the value of 85 g of gold). This calculator works out 2.5% of your Pi; ask a scholar about your own situation.';
  }

  function onWallet() { var s = $('s-payments'); return s && s.classList.contains('on'); }
  function backFromWallet() {
    var b = null; try { b = sessionStorage.getItem('hm_back_to'); sessionStorage.removeItem('hm_back_to'); } catch (e) {}
    if (b !== 'payments') return;
    setTimeout(function () { try { goS('payments'); } catch (e) {} say('Welcome back. Checking for your payment…'); checkSends(); }, 900);
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted) backFromWallet(); });
  function start() {
    backFromWallet();
    wrapPi(); setTimeout(wrapPi, 2000);
    if (window.PiPrice && PiPrice.watch) PiPrice.watch();
    var _goS = window.goS;
    window.goS = function (id) { var r = _goS.apply(this, arguments); if (id === 'payments') { drawWallet(); fixZakat(); checkSales(false); checkSends(); } if (id === 'profile') drawTx(); return r; };
    var _o = window.oUtil; window.oUtil = function (id) { var r = _o.apply(this, arguments); if (id === 'zakat') { fixZakat(); var pr = $('zk-price'), d = price(); if (pr && !pr.value && d && d.usd) { pr.value = d.usd.toFixed(4); try { calcZakat(); } catch (e) {} } } return r; };
    window.addEventListener('pi-price', function () { if (onWallet()) { heroPrice(); var w = $('wc-pi'); if (w && document.activeElement !== w && !/wc-/.test((document.activeElement || {}).id || '')) convert('pi'); } });
    setInterval(function () { if (!document.hidden && onWallet()) heroPrice(); }, 30000);
    setInterval(function () { if (!document.hidden) { checkSales(false); checkSends(); } }, 60000);
    setTimeout(function () { checkSales(false); }, 5000);
    drawTx();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 110); }); else setTimeout(start, 110);
})();
