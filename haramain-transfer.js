/* Haramain in-app transfers: send Pi to any Haramain user by @username without leaving the app.
   The sender approves in Pi's own payment pop-up inside Haramain; Haramain's app wallet then pays the recipient
   (official Pi App-to-User flow). Both get a Haramain receipt verified on the Pi blockchain.
   Also: keeps the focused field visible above the phone keyboard in every sheet. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K = window.K || 'hm_v1_';
  var get = function (k, d) { try { var v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} };
  var say = function (m) { try { toast(m); } catch (e) {} };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var num = function (n, d) { return Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: d }); };
  var TESTNET = /(^|[.-])testnet[.-]/i.test(location.hostname), NETN = TESTNET ? 'Pi Testnet' : 'Pi Mainnet';
  var me = function () { return (typeof user !== 'undefined' && user && !user.guest) ? user.username : ''; };
  var fullName = function () { return get('fullname', '') || (me() ? '@' + me() : 'Guest'); };
  var price = function () { return window.PiPrice && PiPrice.get(); };
  var loc = function () { return window.PiPrice && PiPrice.local ? PiPrice.local() : { code: 'NGN', sym: '₦', rate: null }; };
  var r7 = function (n) { return Math.round(Number(n) * 1e7) / 1e7; };
  var api = function (path, body) { return fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}).then(function (r) { return r.json(); }); };
  var CFG = { enabled: false, fee: 0.01, max: 500 };

  function conv(a) { var p = price(); if (!p || !p.sar || !(a > 0)) return ''; var l = loc(); return '≈ ' + num(a * p.sar, 2) + ' SAR · $' + num(a * p.usd, 2) + (l.rate && l.code !== 'SAR' && l.code !== 'USD' ? ' · ' + l.sym + num(a * l.rate, a * l.rate < 10 ? 2 : 0) : ''); }
  function sheet(title, inner) {
    var w = document.createElement('div'); w.className = 'hm-sheet-wrap';
    w.innerHTML = '<div class="hm-sheet" role="dialog" aria-label="' + esc(title) + '"><div class="hm-sheet-t">' + title + '</div>' + inner + '<button type="button" class="hm-sheet-x">Close</button></div>';
    w.addEventListener('click', function (e) { if (e.target === w || (e.target.classList.contains('hm-sheet-x') && e.target.tagName === 'BUTTON')) w.remove(); });
    document.body.appendChild(w); return w;
  }

  /* ── register this user so others can send to their @username ── */
  var registered = false;
  function register() {
    if (registered || !window.HM_TOKEN || !me()) return;
    registered = true;
    api('/users', { accessToken: window.HM_TOKEN }).then(function (d) { if (!d.ok) registered = false; else sync(); }).catch(function () { registered = false; });
  }

  /* ── receipts ── */
  function saveReceipt(t, dir) {
    var R = get('rcpts', []); if (!t.txid || R.some(function (x) { return x.txid === t.txid; })) return false;
    var p = price(), l = loc(), inn = dir === 'in';
    R.unshift({ amount: t.amount, kind: 'p2p', send: true, inapp: true, dir: dir, narr: t.narr, item: t.narr, memo: t.narr,
      name: inn ? '@' + t.from : fullName(), user: inn ? '' : me(), toName: inn ? fullName() + (me() ? ' (@' + me() + ')' : '') : '@' + t.to, seller: '@' + t.to,
      other: inn ? '@' + t.from : '@' + t.to, to: t.to_addr, ref: t.pid, ts: t.done_ts || Date.now(), net: NETN, txid: t.txid, status: 'Verified',
      usd: p && p.usd, sar: p && p.sar, lc: l.code, lr: l.rate, ls: l.sym });
    put('rcpts', R.slice(0, 200)); return true;
  }
  /* fetch my sent and received transfers: add receipts, finish any payout still pending */
  function sync() {
    if (!window.HM_TOKEN || !CFG.enabled) return;
    api('/transfer', { a: 'list', accessToken: window.HM_TOKEN }).then(function (d) {
      if (!d.ok) return; var news = 0;
      (d.items || []).forEach(function (t) {
        if (t.status === 'paid') {
          if (saveReceipt(t, t.dir) && t.dir === 'in') {
            news++; var msg = num(t.amount, 7) + ' π from @' + t.from + (t.narr ? ' · ' + t.narr : '');
            try { addNotif('💰', 'You received Pi', msg, 'now'); } catch (e) {}
            if (window.hmSysNotify) hmSysNotify('💰 You received Pi', msg, 'hm-in-' + t.pid);
          }
        } else if (t.dir === 'out' && (t.status === 'failed' || t.status === 'received' || t.status === 'paying')) {
          api('/transfer', { a: 'payout', paymentId: t.pid }).then(function (x) { if (x.ok && x.row) { saveReceipt(x.row, 'out'); redraw(); } }).catch(function () {});
        }
      });
      if (news) { say('💰 You received Pi'); redraw(); }
    }).catch(function () {});
  }
  function redraw() { try { if ($('s-payments') && $('s-payments').classList.contains('on')) goS('payments'); } catch (e) {} }

  /* ── the Send sheet ── */
  var sendAddr = window.hmSendSheet;   // the wallet-address version (needs Pi Wallet)
  window.hmSendAddress = sendAddr;
  window.hmPay = function () { if (sendAddr) sendAddr(); setTimeout(function () { var e = $('sd-to'); if (e) e.placeholder = 'Paste the Haramain Pay link here'; }, 60); };
  window.hmSendSheet = function () {
    if (!CFG.enabled) {
      var w0 = sheet('💸 Send Pi',
        '<div class="hm-sheet-b">In-app sending to Haramain users is being switched on. Meanwhile you can send to any wallet address with Pi Wallet.</div>' +
        '<button type="button" class="hm-sheet-a" id="tr-addr">Send to a wallet address</button>');
      $('tr-addr').onclick = function () { w0.remove(); sendAddr && sendAddr(); };
      return;
    }
    var w = sheet('💸 Send Pi',
      '<div class="hm-sheet-b">Send Pi to any Haramain user. You approve in Pi’s own pop-up right here, and the money arrives in their Pi wallet with a Haramain receipt for both of you.</div>' +
      '<label class="wf-l">To</label><div class="tr-to"><span>@</span><input id="tr-u" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="username"></div><div class="wf-hint" id="tr-uh"></div>' +
      '<label class="wf-l">Amount</label><div class="wf-amt"><input id="tr-a" type="number" inputmode="decimal" min="0" step="any" placeholder="0"><span>π</span></div><div class="wf-conv" id="tr-c"></div>' +
      '<label class="wf-l">Narration</label><input class="fi" id="tr-x" maxlength="80" placeholder="What is it for? e.g. Hotel deposit, gift for Umrah">' +
      '<div class="tr-sum" id="tr-sum"></div>' +
      '<button type="button" class="hm-sheet-a" id="tr-go">Continue</button>' +
      '<button type="button" class="tr-alt" id="tr-addr">Send to a wallet address instead ›</button>' +
      '<div class="wf-hint" style="margin-top:8px">🔒 You approve every payment yourself in Pi’s pop-up. Haramain never sees your passphrase.</div>');
    var u = $('tr-u'), a = $('tr-a'), ok = null, timer = null;
    var sum = function () {
      var v = r7(a.value); $('tr-c').textContent = conv(v);
      $('tr-sum').innerHTML = v > 0 ? '<div><span>They receive</span><b>' + num(v, 7) + ' π</b></div><div><span>Blockchain fee</span><b>' + CFG.fee + ' π</b></div><div class="tot"><span>You pay</span><b>' + num(r7(v + CFG.fee), 7) + ' π</b></div>' : '';
    };
    a.oninput = sum;
    u.oninput = function () {
      var name = u.value.trim().replace(/^@/, ''); ok = null; clearTimeout(timer);
      if (!/^[A-Za-z0-9_.-]{2,40}$/.test(name)) { $('tr-uh').textContent = ''; return; }
      $('tr-uh').textContent = 'Checking…';
      timer = setTimeout(function () {
        api('/users?u=' + encodeURIComponent(name)).then(function (d) {
          if (u.value.trim().replace(/^@/, '') !== name) return;
          if (d.exists && d.username.toLowerCase() === (me() || '').toLowerCase()) { $('tr-uh').innerHTML = '<span class="tr-bad">That is you.</span>'; return; }
          if (d.exists) { ok = d.username; $('tr-uh').innerHTML = '<span class="tr-ok">✓ @' + esc(d.username) + ' is on Haramain</span>'; }
          else $('tr-uh').innerHTML = '<span class="tr-bad">@' + esc(name) + ' has not used Haramain yet. Ask them to open Haramain and sign in with Pi once.</span>';
        }).catch(function () { $('tr-uh').textContent = 'No connection. Try again.'; });
      }, 450);
    };
    $('tr-addr').onclick = function () { w.remove(); sendAddr && sendAddr(); };
    $('tr-go').onclick = function () {
      var v = r7(a.value), x = $('tr-x').value.trim();
      if (!me() || !window.HM_TOKEN) { say('Sign in with Pi first'); try { w.remove(); piLogin(); } catch (e) {} return; }
      if (!ok) return say('Enter a Haramain user’s @username');
      if (!(v >= 0.01)) return say('The smallest transfer is 0.01 π');
      if (v > CFG.max) return say('The most you can send at once is ' + CFG.max + ' π');
      if (!x) return say('Add a narration: what is this payment for?');
      w.remove(); pay(ok, v, x);
    };
    setTimeout(function () { u.focus(); }, 80);
  };

  function pay(to, amt, narr) {
    if (typeof Pi === 'undefined' || !Pi.createPayment) return say('Open Haramain in the Pi Browser to send Pi');
    var st = sheet('💸 Sending ' + num(amt, 7) + ' π to @' + esc(to),
      '<div class="wf-req"><div class="wf-req-a">' + num(amt, 7) + ' π</div><div class="wf-req-c">' + esc(conv(amt)) + '</div><div class="wf-req-i">To @' + esc(to) + ' · ' + esc(narr) + '</div></div>' +
      '<div class="tr-steps"><div id="trs1" class="on">1 · Approve in Pi’s pop-up</div><div id="trs2">2 · Confirming your payment</div><div id="trs3">3 · Paying @' + esc(to) + ' on the blockchain</div></div><div class="wf-status wait" id="tr-st">Waiting for your approval…</div>');
    var step = function (n, msg, cls) { for (var i = 1; i <= 3; i++) { var e = $('trs' + i); if (e) e.className = i < n ? 'done' : i === n ? 'on' : ''; } var s = $('tr-st'); if (s) { s.className = 'wf-status ' + (cls || 'wait'); s.innerHTML = msg; } };
    try {
      Pi.createPayment({ amount: r7(amt + CFG.fee), memo: ('Haramain transfer to @' + to).slice(0, 60), metadata: { type: 'transfer', to: to, amt: amt, narr: narr } }, {
        onReadyForServerApproval: function (pid) {
          api('/approve', { paymentId: pid }).then(function (d) { if (d && d.approved === false) step(1, '✕ ' + esc(d.error || 'This transfer was refused.') + ' You have not been charged.', 'err'); }).catch(function () {});
        },
        onReadyForServerCompletion: function (pid, txid) {
          step(2, 'Confirming your payment on the blockchain…');
          api('/complete', { paymentId: pid, txid: txid }).then(function (d) {
            step(3, 'Paying @' + esc(to) + '…');
            var t = d && d.transfer;
            var finish = function (row) { saveReceipt(row, 'out'); st.remove(); var msg = num(amt, 7) + ' π to @' + to + ' · ' + narr; try { addNotif('✅', 'Transfer sent', msg, 'now'); } catch (e) {} if (window.hmSysNotify) hmSysNotify('✅ Transfer sent', msg, 'hm-out-' + pid); redraw(); if (window.hmReceiptByTx) hmReceiptByTx(row.txid); };
            if (t && t.ok && t.row) return finish(t.row);
            var tries = 0;
            (function retry() {
              api('/transfer', { a: 'payout', paymentId: pid }).then(function (x) {
                if (x.ok && x.row && x.row.txid) return finish(x.row);
                if (++tries < 12) { step(3, 'Paying @' + esc(to) + '… (' + tries + ')'); setTimeout(retry, 8000); }
                else step(3, 'Your payment is safe and recorded. The payout to @' + esc(to) + ' is taking longer; Haramain keeps trying and will notify you.', 'wait');
              }).catch(function () { if (++tries < 12) setTimeout(retry, 8000); });
            })();
          }).catch(function () { step(2, 'Connection problem. Your payment is recorded; Haramain will finish it when you reopen the wallet.', 'err'); });
        },
        onCancel: function () { step(1, 'You cancelled. Nothing was paid.', 'err'); },
        onError: function (err) { step(1, '✕ ' + esc((err && err.message) || 'Payment error') + '. Nothing was paid.', 'err'); }
      });
    } catch (e) { step(1, '✕ ' + esc(e.message || e), 'err'); }
  }

  /* ── keyboard: keep the focused field visible inside sheets ── */
  function vv() { var v = window.visualViewport; document.documentElement.style.setProperty('--hm-vvh', (v ? v.height : window.innerHeight) + 'px'); }
  if (window.visualViewport) { visualViewport.addEventListener('resize', vv); visualViewport.addEventListener('scroll', vv); }
  window.addEventListener('resize', vv); vv();
  document.addEventListener('focusin', function (e) {
    var t = e.target; if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    setTimeout(function () { try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) { t.scrollIntoView(); } }, 320);
  });

  function start() {
    api('/transfer?a=status').then(function (d) { if (d && d.ok) { CFG.enabled = !!d.enabled; CFG.fee = d.fee || 0.01; CFG.max = d.max || 500; } sync(); }).catch(function () {});
    var n = 0, iv = setInterval(function () { register(); if (registered || ++n > 90) clearInterval(iv); }, 2000);
    setInterval(function () { if (!document.hidden) sync(); }, 60000);
    var _goS = window.goS; window.goS = function (id) { var r = _goS.apply(this, arguments); if (id === 'payments') { register(); sync(); } return r; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 160); }); else setTimeout(start, 160);
})();
