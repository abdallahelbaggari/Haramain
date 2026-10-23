/* Live Pi price widget — reads this app's /pi-price (OKX first, then CoinGecko and other listed exchanges; cached on the server).
   PiPrice.mount(element, { accent:'#0E7A52', style:'card'|'chip', currency:'USD'|'SAR'|'NGN' })
   Refreshes every 60 s while the app is open; keeps the last good price on the phone for offline use. */
(function () {
  'use strict';
  if (window.PiPrice) return;
  var S = { d: null, mounts: [], busy: false, last: 0, fx: null };
  var CURS = [['NGN','₦','Nigerian naira'],['PKR','Rs ','Pakistani rupee'],['INR','₹','Indian rupee'],['IDR','Rp ','Indonesian rupiah'],['BDT','৳','Bangladeshi taka'],['EGP','E£','Egyptian pound'],['TRY','₺','Turkish lira'],['MYR','RM ','Malaysian ringgit'],['GBP','£','British pound'],['EUR','€','Euro'],['AED','AED ','UAE dirham'],['XOF','CFA ','West African CFA'],['GHS','GH₵','Ghanaian cedi'],['MAD','MAD ','Moroccan dirham']];
  var LKEY = 'pi_price_local_v1';
  function local() { try { return localStorage.getItem(LKEY) || 'NGN'; } catch (e) { return 'NGN'; } }
  function localVal(d) { var c = local(); if (!d) return null; if (S.fx && S.fx[c] && d.sar) return d.sar * S.fx[c]; if (c === 'NGN') return d.ngn; return null; }
  var DN = null; try { DN = new Intl.DisplayNames(['en'], { type: 'currency' }); } catch (e) {}
  function cname(c) { var x = CURS.filter(function (k) { return k[0] === c; })[0]; if (x) return x[2]; try { return DN ? DN.of(c) : c; } catch (e) { return c; } }
  function lsym(c) {
    var x = CURS.filter(function (k) { return k[0] === c; })[0]; if (x) return x[1];
    try { var p = new Intl.NumberFormat('en', { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' }).formatToParts(0).filter(function (q) { return q.type === 'currency'; })[0]; if (p && p.value && p.value !== c) return p.value.length > 2 ? p.value + ' ' : p.value; } catch (e) {}
    return c + ' ';
  }
  function allCurs() {
    var codes = S.fx ? Object.keys(S.fx).filter(function (c) { return /^[A-Z]{3}$/.test(c) && c !== 'SAR'; }) : CURS.map(function (c) { return c[0]; });
    if (codes.indexOf('NGN') < 0) codes.push('NGN');
    return codes.map(function (c) { return { code: c, name: cname(c), sym: lsym(c).trim() }; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  function loadFx() { if (S.fx !== null) return; S.fx = false; fetch('/fx').then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok && d.rates) { S.fx = d.rates; paintAll(); } }).catch(function () {}); }
  window.hmSetLocal = function (c) { try { localStorage.setItem(LKEY, c); } catch (e) {} paintAll(); var w = document.querySelector('.pp-wrap'); if (w) { w.remove(); open(S.lastOpt || {}); } };
  var KEY = 'pi_price_last_v1';
  try { S.d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (S.d) S.d.stale = true; } catch (e) {}

  var css = document.createElement('style');
  css.textContent =
    '.pp-card{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:12px 14px;border-radius:16px;background:#fff;border:1px solid rgba(15,30,40,.10);box-shadow:0 1px 3px rgba(15,30,40,.06),0 8px 20px -12px rgba(15,30,40,.18);font:inherit;color:#13202B;text-align:left;cursor:pointer}' +
    '.pp-pi{width:40px;height:40px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:800}' +
    '.pp-main{flex:1;min-width:0}.pp-l{font-size:12px;color:#5B6B7A;font-weight:600}.pp-v{font-size:20px;font-weight:800;letter-spacing:-.01em;line-height:1.2}' +
    '.pp-c{font-size:12.5px;font-weight:700;margin-left:6px}.pp-up{color:#0E8A55}.pp-dn{color:#C0392B}.pp-sub{font-size:11.5px;color:#6B7A88}' +
    '.pp-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#fff;border:1px solid rgba(15,30,40,.12);font:inherit;font-size:13px;font-weight:700;color:#13202B;cursor:pointer}' +
    '.pp-wrap{position:fixed;inset:0;z-index:100001;background:rgba(15,30,40,.45);display:flex;align-items:flex-end;justify-content:center}' +
    '.pp-sheet{width:100%;max-width:480px;background:#fff;color:#13202B;border-radius:22px 22px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom));font-family:inherit;box-sizing:border-box}' +
    '.pp-sheet h3{margin:0 0 4px;font-size:18px}.pp-big{font-size:34px;font-weight:800;letter-spacing:-.02em}' +
    '.pp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.pp-grid div{background:#F4F6F9;border-radius:12px;padding:10px;text-align:center}.pp-grid b{display:block;font-size:15px}.pp-grid small{font-size:11.5px;color:#6B7A88}' +
    '.pp-fx{font-size:13.5px;font-weight:700;color:#13202B}.pp-pick{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13.5px;font-weight:700;margin:4px 0 10px}.pp-pick select{font:inherit;font-size:13.5px;padding:7px 8px;border-radius:10px;border:1px solid rgba(15,30,40,.15);background:#fff;max-width:60%}.pp-calc{display:flex;align-items:center;gap:10px;background:#F4F6F9;border-radius:12px;padding:10px}.pp-calc input{width:90px;font:inherit;font-size:16px;padding:8px;border-radius:10px;border:1px solid rgba(15,30,40,.15)}.pp-calc span{font-size:13.5px}' +
    '.pp-note{font-size:12px;color:#6B7A88;line-height:1.5;margin-top:10px}.pp-x{display:block;width:100%;margin-top:14px;padding:12px;border-radius:14px;border:1px solid rgba(15,30,40,.15);background:none;font:inherit;font-weight:700;color:inherit;cursor:pointer}';
  document.head.appendChild(css);

  var fmt = function (n, d) { return (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  var dec = function (v) { return v < 0.1 ? 4 : v < 10 ? 3 : 2; };
  function change(d) { var c = d && d.change24h; if (c == null || isNaN(c)) return ''; return '<span class="pp-c ' + (c >= 0 ? 'pp-up' : 'pp-dn') + '">' + (c >= 0 ? '▲ ' : '▼ ') + Math.abs(c).toFixed(2) + '%</span>'; }
  function ago(iso) { var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : new Date(iso).toLocaleDateString(); }
  function spark(arr, w, h, col) {
    if (!arr || arr.length < 2) return '';
    var mn = Math.min.apply(null, arr), mx = Math.max.apply(null, arr), r = (mx - mn) || 1;
    var pts = arr.map(function (v, i) { return (i / (arr.length - 1) * w).toFixed(1) + ',' + (h - (v - mn) / r * (h - 4) - 2).toFixed(1); }).join(' ');
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function val(d, cur) { if (!d) return null; return cur === 'SAR' ? d.sar : cur === 'NGN' ? d.ngn : d.usd; }
  function sym(cur) { return cur === 'SAR' ? 'SAR ' : cur === 'NGN' ? '₦' : '$'; }

  function paint(m) {
    var d = S.d, o = m.o, cur = o.currency || 'USD', v = val(d, cur);
    if (o.style === 'chip') { m.el.innerHTML = '<button type="button" class="pp-chip" aria-label="Pi price"><span style="color:' + o.accent + '">π</span> ' + (v ? sym(cur) + fmt(v, dec(v)) : '…') + change(d) + '</button>'; }
    else {
      m.el.innerHTML = '<button type="button" class="pp-card" aria-label="Pi price, tap for details"><span class="pp-pi" style="background:' + o.accent + '">π</span><span class="pp-main"><span class="pp-l">Pi price · live</span><br>' +
        '<span class="pp-v">' + (v ? sym(cur) + fmt(v, dec(v)) : (S.busy ? 'Loading…' : 'Unavailable')) + '</span>' + change(d) + '<br>' +
        (d && d.sar ? '<span class="pp-fx">' + (cur !== 'SAR' ? fmt(d.sar, dec(d.sar)) + ' SAR' : '$' + fmt(d.usd, dec(d.usd))) + (localVal(d) ? ' · ' + lsym(local()) + fmt(localVal(d), dec(localVal(d))) : '') + '</span><br>' : '') +
        '<span class="pp-sub">' + (d ? (d.stale ? 'Last known · ' : 'Updated ') + ago(d.updated) : 'Checking exchanges…') + '</span></span>' +
        (d && d.spark ? spark(d.spark, 64, 30, (d.change24h || 0) >= 0 ? '#0E8A55' : '#C0392B') : '') + '</button>';
    }
    m.el.firstChild.onclick = function () { open(o); };
  }
  function paintAll() { try { window.dispatchEvent(new Event('pi-price')); } catch (e) {} S.mounts = S.mounts.filter(function (m) { return document.body.contains(m.el); }); S.mounts.forEach(paint); }

  function open(o) {
    S.lastOpt = o; var d = S.d, w = document.createElement('div'); w.className = 'pp-wrap';
    w.innerHTML = '<div class="pp-sheet" role="dialog" aria-label="Pi price"><h3>Pi (PI) price</h3>' +
      (d ? '<div><span class="pp-big">$' + fmt(d.usd, dec(d.usd)) + '</span>' + change(d) + '</div>' +
        '<div style="margin-top:8px">' + spark(d.spark, 300, 64, o.accent) + '<div class="pp-sub">Last 7 days</div></div>' +
        '<div class="pp-grid"><div><b>$' + fmt(d.usd, dec(d.usd)) + '</b><small>US dollar</small></div><div><b>' + fmt(d.sar, dec(d.sar)) + '</b><small>Saudi riyal</small></div><div><b>' + (localVal(d) ? lsym(local()) + fmt(localVal(d), dec(localVal(d))) : '—') + '</b><small>' + local() + '</small></div></div>' +
        '<label class="pp-pick">My currency <select onchange="hmSetLocal(this.value)">' + allCurs().map(function (c) { return '<option value="' + c.code + '"' + (c.code === local() ? ' selected' : '') + '>' + c.code + ' · ' + c.name + '</option>'; }).join('') + '</select></label>' +
        '<div class="pp-calc"><input type="number" inputmode="decimal" value="100" min="0" oninput="var a=+this.value||0;this.nextElementSibling.innerHTML=a+\' π = <b>\'+(a*' + d.sar + ').toFixed(2)+\' SAR</b> · $\'+(a*' + d.usd + ').toFixed(2)' + (localVal(d) ? '+\' · ' + lsym(local()) + '\'+Math.round(a*' + localVal(d) + ').toLocaleString()' : '') + '"><span>100 π = <b>' + (100 * d.sar).toFixed(2) + ' SAR</b> · $' + (100 * d.usd).toFixed(2) + (localVal(d) ? ' · ' + lsym(local()) + Math.round(100 * localVal(d)).toLocaleString() : '') + '</span></div>' +
        '<div class="pp-note">Source: ' + (d.source || 'exchange data') + ' · ' + (d.stale ? 'last known price, ' : 'updated ') + ago(d.updated) + '.<br>Prices come from public market data (OKX first, then CoinGecko). They change all the time and are for information only, not financial advice.</div>'
        : '<div class="pp-note">The price could not be loaded right now. Please try again in a moment.</div>') +
      '<button type="button" class="pp-x">Close</button></div>';
    w.addEventListener('click', function (e) { if (e.target === w || e.target.classList.contains('pp-x')) w.remove(); });
    document.body.appendChild(w);
    load();
  }

  function load() {
    if (S.busy || Date.now() - S.last < 15000) return;
    S.busy = true; S.last = Date.now(); paintAll();
    fetch('/pi-price', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok || !d.usd) throw 0;
      S.d = d; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    }).catch(function () { if (S.d) S.d.stale = true; })
      .then(function () { S.busy = false; paintAll(); });
  }

  window.PiPrice = {
    mount: function (el, o) { if (!el) return; o = o || {}; loadFx(); o.accent = o.accent || '#0E7A52'; var m = { el: el, o: o }; S.mounts.push(m); paint(m); load(); },
    get: function () { return S.d; },
    refresh: function () { S.last = 0; load(); },
    local: function () { var c = local(); return { code: c, sym: lsym(c), name: cname(c), rate: localVal(S.d) }; },
    currencies: allCurs,
    rateIn: function (c) { var d = S.d; if (!d) return null; if (c === 'SAR') return d.sar; if (c === 'USD') return d.usd; if (S.fx && S.fx[c] && d.sar) return d.sar * S.fx[c]; if (c === 'NGN') return d.ngn; return null; },
    sym: lsym,
    fx: function () { return S.fx || null; },
    open: function (o) { open(o || {}); },
    watch: function () { loadFx(); load(); }
  };
  setInterval(function () { if (!document.hidden) load(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
})();
