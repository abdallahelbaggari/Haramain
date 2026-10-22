/* Haramain — Currency converter (live rates, includes Pi) and Hijri ↔ Gregorian date converter. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K = window.K || 'hm_v1_';
  var get = function (k, d) { try { var v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} };
  var CUR = [['SAR', 'Saudi riyal'], ['PI', 'Pi (π)'], ['USD', 'US dollar'], ['NGN', 'Nigerian naira'], ['PKR', 'Pakistani rupee'], ['INR', 'Indian rupee'], ['IDR', 'Indonesian rupiah'],
    ['BDT', 'Bangladeshi taka'], ['EGP', 'Egyptian pound'], ['TRY', 'Turkish lira'], ['MYR', 'Malaysian ringgit'], ['GBP', 'British pound'], ['EUR', 'Euro'], ['AED', 'UAE dirham'],
    ['KWD', 'Kuwaiti dinar'], ['QAR', 'Qatari riyal'], ['XOF', 'West African CFA'], ['XAF', 'Central African CFA'], ['GHS', 'Ghanaian cedi'], ['DZD', 'Algerian dinar'], ['MAD', 'Moroccan dirham'], ['SDG', 'Sudanese pound'], ['IRR', 'Iranian rial'], ['UZS', 'Uzbek som']];
  var FX = { rates: get('fx', null), busy: false };

  function loadFx() {
    if (FX.busy) return; FX.busy = true;
    fetch('/fx').then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok && d.rates) { FX.rates = { r: d.rates, t: d.updated, stale: !!d.stale }; put('fx', FX.rates); } })
      .catch(function () {}).then(function () { FX.busy = false; convert(); });
  }
  function perSAR(code) {   // how many units of `code` equal 1 SAR
    if (!FX.rates) return null;
    if (code === 'SAR') return 1;
    if (code === 'PI') { var p = window.PiPrice && PiPrice.get(); return p && p.usd && FX.rates.r.USD ? FX.rates.r.USD / p.usd : null; }
    return FX.rates.r[code] || null;
  }
  function fmt(v) { if (v == null || isNaN(v)) return '—'; var d = v >= 1000 ? 0 : v >= 1 ? 2 : 4; return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function convert() {
    var amt = parseFloat(($('fx-amt') || {}).value), from = ($('fx-from') || {}).value, to = ($('fx-to') || {}).value, out = $('fx-out');
    if (!out) return;
    if (!FX.rates) { out.innerHTML = FX.busy ? 'Loading live rates…' : 'Rates unavailable right now. Check your connection.'; return; }
    var a = perSAR(from), b = perSAR(to);
    if (!a || !b) { out.innerHTML = from === 'PI' || to === 'PI' ? 'Pi price is loading…' : 'Rate unavailable for this currency.'; return; }
    if (!(amt >= 0)) amt = 0;
    var res = amt / a * b;
    out.innerHTML = '<div class="tl-big">' + fmt(res) + ' <span>' + to + '</span></div><div class="tl-sub">' + fmt(amt) + ' ' + from + ' · 1 ' + from + ' = ' + fmt(b / a) + ' ' + to + '</div>' +
      '<div class="tl-sub">' + (FX.rates.stale ? 'Last known rates · ' : 'Live rates · ') + 'updated ' + String(FX.rates.t || '').replace(/ \+0000$/, ' UTC') + (from === 'PI' || to === 'PI' ? ' · Pi price live from exchanges' : '') + '</div>';
    put('fxsel', { from: from, to: to });
  }
  window.hmFxSwap = function () { var f = $('fx-from'), t = $('fx-to'), x = f.value; f.value = t.value; t.value = x; convert(); };

  /* ── dates ── */
  var MEN = ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhul Qa'dah", 'Dhul Hijjah'];
  function hijri(d) { return window.HM_CAL ? HM_CAL.hijri(d) : null; }
  function gToH() {
    var v = ($('dc-g') || {}).value, out = $('dc-g-out'); if (!out) return;
    if (!v) { out.textContent = ''; return; }
    var d = new Date(v + 'T12:00:00+03:00'), h = hijri(d);
    out.innerHTML = h ? '<div class="tl-big">' + h.d + ' ' + MEN[h.m - 1] + ' ' + h.y + ' <span>AH</span></div><div class="tl-sub">' + d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Asia/Riyadh' }) + ' · Umm al-Qura calendar</div>' : 'Not available on this phone.';
  }
  function hToG() {
    var dd = parseInt(($('dc-hd') || {}).value, 10), mm = parseInt(($('dc-hm') || {}).value, 10), yy = parseInt(($('dc-hy') || {}).value, 10), out = $('dc-h-out'); if (!out) return;
    if (!(dd >= 1 && dd <= 30 && mm >= 1 && mm <= 12 && yy >= 1343 && yy <= 1500)) { out.textContent = 'Enter a day (1–30), month and year (1343–1500).'; return; }
    // estimate, then search nearby days for the exact Umm al-Qura match
    var est = Date.UTC(622, 6, 16) + ((yy - 1) * 354.36707 + (mm - 1) * 29.530588 + (dd - 1)) * 864e5, hit = null;
    for (var k = 0; k <= 60 && !hit; k++) [k, -k].forEach(function (o) { if (hit) return; var t = new Date(est + o * 864e5 + 12 * 36e5), h = hijri(t); if (h && h.y === yy && h.m === mm && h.d === dd) hit = t; });
    out.innerHTML = hit ? '<div class="tl-big">' + hit.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }) + '</div><div class="tl-sub">' + hit.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Asia/Riyadh' }) + ' · Umm al-Qura calendar</div>'
      : 'That day does not exist in this month (some months have 29 days).';
  }

  function pages() {
    var sec = $('s-utilities'); if (!sec || $('up-fx')) return;
    var grid = sec.querySelector('.tgrid');
    if (grid) grid.insertAdjacentHTML('beforeend',
      '<div class="tc tc-blue" onclick="oUtil(\'fx\')"><span class="tc-icon">💱</span><div class="tc-name">Currency Converter</div><div class="tc-desc">SAR · Pi · live rates</div></div>' +
      '<div class="tc tc-gold" onclick="oUtil(\'dates\')"><span class="tc-icon">📅</span><div class="tc-name">Date Converter</div><div class="tc-desc">Hijri ↔ Gregorian</div></div>');
    var sel = get('fxsel', { from: 'SAR', to: 'NGN' }), opts = function (v) { return CUR.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === v ? ' selected' : '') + '>' + c[0] + ' · ' + c[1] + '</option>'; }).join(''); };
    var h = window.HM_CAL && HM_CAL.hijri(new Date()) || { y: 1448, m: 1, d: 1 };
    sec.insertAdjacentHTML('beforeend',
      '<div class="up" id="up-fx"><div class="up-hdr"><button class="back-btn" onclick="cUtil()">←</button><div class="up-title">💱 Currency Converter</div></div>' +
        '<div class="ic"><div class="fg"><label class="flbl">Amount</label><input class="fi" id="fx-amt" type="number" inputmode="decimal" value="100" min="0"></div>' +
        '<div class="tl-pair"><select class="fi" id="fx-from">' + opts(sel.from) + '</select><button type="button" class="tl-swap" onclick="hmFxSwap()" aria-label="Swap">⇅</button><select class="fi" id="fx-to">' + opts(sel.to) + '</select></div>' +
        '<div class="tl-res" id="fx-out">Loading live rates…</div></div>' +
        '<div class="hm-note">For planning only. Banks and exchange shops add their own margin.</div></div>' +
      '<div class="up" id="up-dates"><div class="up-hdr"><button class="back-btn" onclick="cUtil()">←</button><div class="up-title">📅 Date Converter</div></div>' +
        '<div class="ic"><div class="ic-title">Gregorian → Hijri</div><input class="fi" id="dc-g" type="date"><div class="tl-res" id="dc-g-out"></div></div>' +
        '<div class="ic"><div class="ic-title">Hijri → Gregorian</div><div class="tl-pair3"><input class="fi" id="dc-hd" type="number" min="1" max="30" value="' + h.d + '" aria-label="Day">' +
        '<select class="fi" id="dc-hm" aria-label="Month">' + MEN.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === h.m ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>' +
        '<input class="fi" id="dc-hy" type="number" min="1343" max="1500" value="' + h.y + '" aria-label="Year"></div><div class="tl-res" id="dc-h-out"></div></div>' +
        '<div class="hm-note">Uses the Umm al-Qura calendar of Saudi Arabia. Official dates can move by one day after moon sighting.</div></div>');
    ['fx-amt', 'fx-from', 'fx-to'].forEach(function (id) { $(id).addEventListener('input', convert); $(id).addEventListener('change', convert); });
    $('dc-g').addEventListener('input', gToH); $('dc-g').value = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
    ['dc-hd', 'dc-hm', 'dc-hy'].forEach(function (id) { $(id).addEventListener('input', hToG); $(id).addEventListener('change', hToG); });
  }
  function start() {
    pages();
    var _o = window.oUtil;
    window.oUtil = function (id) { var r = _o.apply(this, arguments); if (id === 'fx') { if (!FX.rates || Date.now() - (get('fxAt', 0)) > 36e5) { put('fxAt', Date.now()); loadFx(); } convert(); } if (id === 'dates') { gToH(); hToG(); } if (id === 'fx' || id === 'dates') setTimeout(function () { var u = $('up-' + id); if (u) u.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); return r; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 90); }); else setTimeout(start, 90);
})();
