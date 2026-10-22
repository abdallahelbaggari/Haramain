/* Haramain — professional pass (Oct 2026)
   Loaded last. Replaces parts that showed invented data or fixed dates:
   • Islamic dates from the Umm al-Qura calendar (the official Saudi calendar) built into the browser
   • Hajj countdown, events, moon and itinerary always computed for the coming season
   • No made-up weather, crowd numbers, distances, phone numbers, readings or listings
   • Translation, family check-in, lost & found and SOS do what they say */
(function () {
  'use strict';
  var TZ = 'Asia/Riyadh';
  var MEN = ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhul Qa'dah", 'Dhul Hijjah'];
  var MAR = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var say = function (m) { try { toast(m); } catch (e) {} };

  /* ── Umm al-Qura calendar ─────────────────────────────────────── */
  var hf = null, gf = null;
  try { hf = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: TZ }); } catch (e) {}
  try { gf = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }); } catch (e) {}
  function hijri(d) {
    if (!hf) return null;
    var o = {}; hf.formatToParts(d || new Date()).forEach(function (p) { o[p.type] = p.value; });
    var y = parseInt(o.year, 10), m = parseInt(o.month, 10), dd = parseInt(o.day, 10);
    return (y && m && dd) ? { y: y, m: m, d: dd } : null;
  }
  function ymd(d) { return gf ? gf.format(d) : d.toISOString().slice(0, 10); }
  function longDate(d) { return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }); }
  function shortDate(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ }); }
  /* next date (from today, inclusive) with Hijri month m, day d → {date, days, h} */
  function nextHijri(m, d, from) {
    var base = from || new Date();
    for (var i = 0; i < 420; i++) {
      var t = new Date(base.getTime() + i * 864e5), h = hijri(t);
      if (h && h.m === m && h.d === d) return { date: t, days: i, h: h };
    }
    return null;
  }
  function hText(h) { return h.d + ' ' + MEN[h.m - 1] + ' ' + h.y + ' AH'; }
  window.HM_CAL = { hijri: hijri, nextHijri: nextHijri, MEN: MEN };

  /* today's Hijri date everywhere */
  var _origFetchHijri = window.fetchHijriDate;
  window.fetchHijriDate = function () {
    var h = hijri(new Date());
    if (!h) { if (_origFetchHijri) _origFetchHijri(); return; }
    window.hijriCache = { day: h.d, month: h.m, monthEn: MEN[h.m - 1], monthAr: MAR[h.m - 1], year: String(h.y) };
    try { hijriCache = window.hijriCache; } catch (e) {}
    window.renderHijriWidget();
  };
  window.renderHijriWidget = function () {
    var h = window.hijriCache; if (!h || !h.day) return;
    var ar = (typeof curLang !== 'undefined' && curLang === 'ar');
    var text = h.day + ' ' + (ar ? h.monthAr : h.monthEn) + ' ' + h.year + (ar ? ' هـ' : ' AH');
    ['hijri-header', 'lc-hijri'].forEach(function (id) { var e = $(id); if (e) e.textContent = '🌙 ' + text; });
    var tw = $('tick-hijri'); if (tw) tw.textContent = '🌙 ' + text;
  };

  /* ── Hajj countdown: next Day of Arafat ───────────────────────── */
  var arafat = null;
  function findArafat() {
    var n = nextHijri(12, 9, new Date());
    if (!n) return;
    arafat = { t: Date.parse(ymd(n.date) + 'T00:00:00+03:00'), y: n.h.y, when: longDate(n.date), days: n.days };
    var l = $('hc-label'); if (l) l.textContent = 'Day of Arafat · Hajj ' + n.h.y + ' AH';
    var s = $('hc-sub'); if (s) s.textContent = arafat.when + ' · may move a day with moon sighting';
  }
  window._tickHajj = function () {
    if (!arafat) findArafat(); if (!arafat) return;
    var diff = arafat.t - Date.now();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    if (arafat.days === 0) { set('hc-days', 'Today is the Day of Arafat'); ['hc-d', 'hc-h', 'hc-m', 'hc-s'].forEach(function (i) { set(i, '00'); }); return; }
    if (diff < 0) diff = 0;
    var d = Math.floor(diff / 864e5), h = Math.floor(diff % 864e5 / 36e5), m = Math.floor(diff % 36e5 / 6e4), s = Math.floor(diff % 6e4 / 1e3);
    set('hc-d', d); set('hc-h', pad(h)); set('hc-m', pad(m)); set('hc-s', pad(s));
    set('hc-days', d + (d === 1 ? ' Day' : ' Days'));
  };
  function restartCountdown() { try { clearInterval(window.hajjInterval); } catch (e) {} window.hajjInterval = setInterval(window._tickHajj, 1000); window._tickHajj(); }

  /* ── Islamic events with real dates ───────────────────────────── */
  var EVENTS = [['🌙', 'Ramadan begins', 9, 1], ['🎉', 'Eid al-Fitr', 10, 1], ['🕋', 'Day of Arafat', 12, 9], ['🐑', 'Eid al-Adha', 12, 10], ['🌙', 'Islamic New Year', 1, 1], ['📿', 'Day of Ashura', 1, 10]];
  function upcoming() {
    return EVENTS.map(function (e) { var n = nextHijri(e[2], e[3]); return n && { icon: e[0], name: e[1], n: n }; })
      .filter(Boolean).sort(function (a, b) { return a.n.days - b.n.days; });
  }
  window.renderMoonEvents = function () {
    var el = $('moon-events-list'); if (!el) return;
    el.innerHTML = upcoming().map(function (ev) {
      var d = ev.n.days, lbl = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : 'In ' + d + ' days';
      return '<div class="moon-event"><div class="moon-event-icon">' + ev.icon + '</div><div style="flex:1"><div class="moon-event-name">' + ev.name + '</div>' +
        '<div class="moon-event-date">' + hText(ev.n.h) + ' · ' + longDate(ev.n.date) + '</div></div><div class="moon-event-days">' + lbl + '</div></div>';
    }).join('') + '<div class="hm-note">Dates follow the Umm al-Qura calendar. Saudi authorities confirm each month by moon sighting, so a date can move by one day.</div>';
  };

  /* ── Moon: real phase from astronomy ──────────────────────────── */
  var SYN = 29.530588853, NEW0 = Date.UTC(2000, 0, 6, 18, 14);
  function moonAge(d) { var a = ((d.getTime() - NEW0) / 864e5) % SYN; return a < 0 ? a + SYN : a; }
  var PH_ICON = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'], PH_NAME = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  function phaseOf(d) { var a = moonAge(d); return { index: Math.floor(a / SYN * 8 + 0.5) % 8, illumination: Math.round((1 - Math.cos(2 * Math.PI * a / SYN)) / 2 * 100), age: a }; }
  window.calculateMoonPhase = function () { return phaseOf(new Date()); };
  window.renderMoonPhase = function (p) {
    p = p || phaseOf(new Date());
    var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    set('moon-phase-icon', PH_ICON[p.index]); set('moon-phase-name', PH_NAME[p.index]);
    set('moon-illumination', 'Illumination ' + p.illumination + '% · ' + PH_NAME[p.index]);
    var nn = new Date(Date.now() + (SYN - p.age) * 864e5); set('moon-next-new', longDate(nn));
  };
  window.renderMoonCalendar = function () {
    var el = $('moon-calendar-grid'); if (!el) return;
    var today = new Date(), h = hijri(today); if (!h) return;
    var first = new Date(today.getTime() - (h.d - 1) * 864e5), days = [];
    for (var i = 0; i < 31; i++) { var t = new Date(first.getTime() + i * 864e5), q = hijri(t); if (!q || q.m !== h.m) break; days.push({ t: t, q: q }); }
    var wd = new Date(ymd(first) + 'T12:00:00Z').getUTCDay(), cells = '';
    for (var k = 0; k < wd; k++) cells += '<div></div>';
    days.forEach(function (x) {
      cells += '<div class="moon-day' + (x.q.d === h.d ? ' today' : '') + '"><div class="moon-day-icon">' + PH_ICON[phaseOf(x.t).index] + '</div><div class="moon-day-num">' + x.q.d + '</div><div class="moon-day-g">' + shortDate(x.t) + '</div></div>';
    });
    el.innerHTML = cells;
    var tt = $('moon-cal-title'); if (tt) tt.textContent = '📅 ' + MEN[h.m - 1] + ' ' + h.y + ' AH';
  };

  /* ── Itinerary dates for the coming Hajj ──────────────────────── */
  function itineraryDates() {
    if (typeof HAJJ_ITINERARY === 'undefined') return;
    var n = nextHijri(12, 8, new Date(Date.now() - 6 * 864e5)); if (!n) return;
    var base = n.date, at = function (k) { return new Date(base.getTime() + k * 864e5); };
    HAJJ_ITINERARY.forEach(function (day) {
      var t = day.day || '';
      if (/^Days 11-12/.test(t)) day.date = shortDate(at(3)) + ' – ' + longDate(at(4));
      else if (/^Final Day/.test(t)) day.date = 'By ' + longDate(at(5)) + ' (13 Dhul Hijjah) if you stay';
      else { var m = /Day (\d+)/.exec(t); if (m) day.date = longDate(at(+m[1] - 8)); }
    });
  }

  /* ── Weather: real or clearly unavailable ─────────────────────── */
  window.fetchWeather = function () {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=21.3891&longitude=39.8579&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,uv_index,weather_code&timezone=Asia%2FRiyadh';
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.current) throw 0;
      window.weatherCache = d.current; try { weatherCache = d.current; } catch (e) {}
      try { renderWeatherWidget(); updateLandingWeather(); } catch (e) {}
      try { updateHeatRisk(); renderHeatIndex(); } catch (e) {}
    }).catch(function () {
      window.weatherCache = null; try { weatherCache = null; } catch (e) {}
      var w = $('weather-widget'); if (w) w.innerHTML = '<div class="empty">Makkah weather is unavailable right now. Pull down or tap Refresh to try again.</div>';
      var lw = $('lc-weather'); if (lw) lw.textContent = '—';
      var ls = $('lc-weather-sub'); if (ls) ls.textContent = 'Unavailable';
      try { updateHeatRisk(); renderHeatIndex(); } catch (e) {}
    });
  };
  window.updateHeatRisk = function () {
    var el = $('heat-risk-display'), txt = $('heat-risk-text'); if (!el || !txt) return;
    var w = window.weatherCache;
    if (!w) { el.className = 'heat-risk low'; txt.textContent = 'Current temperature unavailable'; return; }
    var t = Math.round(w.apparent_temperature || w.temperature_2m);
    var lv = t >= 46 ? ['extreme', '🚨 Extreme heat · feels like ' + t + '°C · stay indoors'] : t >= 41 ? ['high', '⚠️ High heat · feels like ' + t + '°C · avoid midday sun'] : t >= 35 ? ['med', '🟡 Hot · feels like ' + t + '°C · drink water often'] : ['low', '✅ Feels like ' + t + '°C · normal care'];
    el.className = 'heat-risk ' + lv[0]; txt.textContent = lv[1];
  };
  var _origHeatIndex = window.renderHeatIndex;
  window.renderHeatIndex = function () {
    var el = $('hydro-heat-index'); if (!el) return;
    if (!window.weatherCache) { el.innerHTML = '<div class="hm-note" style="margin:0">Current temperature unavailable. In Makkah, drink at least a glass of water every hour in daytime.</div>'; return; }
    if (_origHeatIndex) _origHeatIndex();
  };

  /* ── Health: your own readings only ───────────────────────────── */
  window.updateHealthScore = function () {};
  function showVitals() {
    var v = (window.vitalsLog || [])[0] || {};
    var set = function (id, x) { var e = $(id); if (e) e.textContent = x || '—'; };
    set('vi-heart', v.hr); set('vi-bp', v.bp); set('vi-spo2', v.spo2); set('vi-temp', v.temp);
  }
  window.logVitals = function () {
    var hr = prompt('Heart rate (beats per minute). Leave empty to skip:', ''); if (hr === null) return;
    var bp = prompt('Blood pressure (e.g. 120/80). Leave empty to skip:', ''); if (bp === null) return;
    var sp = prompt('Oxygen level SpO2 % (e.g. 97). Leave empty to skip:', ''); if (sp === null) return;
    var tp = prompt('Temperature °C (e.g. 36.8). Leave empty to skip:', ''); if (tp === null) return;
    if (!hr && !bp && !sp && !tp) return;
    var e = { time: new Date().toLocaleString(), hr: hr.trim(), bp: bp.trim(), spo2: sp.trim(), temp: tp.trim() };
    window.vitalsLog = window.vitalsLog || []; vitalsLog.unshift(e);
    try { localStorage.setItem(K + 'vitalsLog', JSON.stringify(vitalsLog.slice(0, 50))); } catch (x) {}
    showVitals(); say('✅ Reading saved on this phone');
  };
  var HOSP = [
    ['King Abdullah Medical City', 'Makkah · specialist hospital'], ['Al-Noor Specialist Hospital', 'Makkah · general and emergency'],
    ['Ajyad Emergency Hospital', 'Makkah · next to the Haram'], ['King Faisal Hospital', 'Makkah · general hospital'],
    ['King Fahd Hospital', 'Madinah · general and emergency']];
  window.renderHospitals = function () {
    var el = $('hospital-list'); if (!el) return;
    el.innerHTML = '<div class="hm-note" style="margin-top:0">For an emergency call <b>997</b> (ambulance) or <b>911</b>. For health advice call <b>937</b> (Ministry of Health, 24 hours).</div>' +
      HOSP.map(function (h) {
        return '<a class="hm-place" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(h[0] + ' ' + h[1].split(' ·')[0]) + '"><span class="hm-place-i">🏥</span><span class="hm-place-t"><b>' + h[0] + '</b><small>' + h[1] + '</small></span><span class="hm-place-go">Directions ›</span></a>';
      }).join('');
  };
  window.renderCoolingStations = function () {
    var el = $('cooling-stations-list'); if (!el) return;
    el.innerHTML = '<div class="ibox">' + [
      '💧 Zamzam water coolers stand throughout Masjid al-Haram and Masjid an-Nabawi. Drink often, even before you feel thirsty.',
      '🏛️ Rest inside the air-conditioned prayer halls during the hottest hours.',
      '🌫️ Misting fans in the courtyards and in Mina help cool you down.',
      '☂️ Use an umbrella and light-coloured clothes. Wet a cloth for your head and neck.',
      '🆘 Dizziness, confusion or no sweating can mean heat stroke. Call 997 at once.'
    ].map(function (x) { return '<div class="hm-li">' + x + '</div>'; }).join('') + '</div>';
  };

  /* ── Emergency ────────────────────────────────────────────────── */
  var COUNTRIES = ['Nigeria', 'Pakistan', 'India', 'Indonesia', 'Bangladesh', 'Egypt', 'Türkiye', 'Malaysia', 'Algeria', 'Morocco', 'Sudan', 'Iran', 'Iraq', 'Niger', 'Senegal', 'Ghana', 'Cameroon', 'Mali', 'Afghanistan', 'Uzbekistan', 'United Kingdom', 'United States', 'France', 'Other'];
  window.renderEmbassy = function () {
    var el = $('emer-embassy-box'); if (!el) return;
    var c = ''; try { c = localStorage.getItem(K + 'country') || ''; } catch (e) {}
    var opts = '<option value="">Choose your country</option>' + COUNTRIES.map(function (x) { return '<option' + (x === c ? ' selected' : '') + '>' + x + '</option>'; }).join('');
    var links = c && c !== 'Other' ?
      '<div style="display:flex;gap:.4rem;margin-top:.5rem"><a class="btn btn-gold btn-sm" style="flex:1;text-decoration:none;text-align:center" target="_blank" rel="noopener" href="https://www.google.com/search?q=' + encodeURIComponent(c + ' consulate Jeddah') + '">Consulate in Jeddah</a>' +
      '<a class="btn btn-ghost btn-sm" style="flex:1;text-decoration:none;text-align:center" target="_blank" rel="noopener" href="https://www.google.com/search?q=' + encodeURIComponent(c + ' embassy Riyadh') + '">Embassy in Riyadh</a></div>' : '';
    el.innerHTML = '<div class="ibox"><select class="fi" onchange="try{localStorage.setItem(K+\'country\',this.value)}catch(e){};renderEmbassy()">' + opts + '</select>' + links +
      '<div class="hm-note" style="margin-bottom:0">Lost passport? Tell your Hajj group leader first, then your country\'s Hajj mission or consulate.</div></div>';
  };
  window.toggleNoMovement = function () {}; window.checkNoMovement = function () {};
  window.activateFullSOS = function () {
    var msg = ''; try { msg = buildEmerMessage(); } catch (e) {}
    var contacts = (window.emerContacts || []);
    var rows = contacts.map(function (c) {
      return '<a class="hm-sos-row" href="sms:' + encodeURIComponent(c.phone) + '?body=' + encodeURIComponent(msg) + '">💬 Text ' + esc(c.name || c.phone) + '</a>';
    }).join('');
    hmSheet('🆘 Emergency',
      '<a class="hm-sos-call" href="tel:911">📞 Call 911</a><a class="hm-sos-call alt" href="tel:997">🚑 Call 997 · Ambulance</a>' +
      (rows || '<div class="hm-note">Add emergency contacts below to text them your location in one tap.</div>') +
      '<button class="hm-sos-row" onclick="shareEmergencyLocation()">📤 Share my location message</button>');
  };

  /* ── Family: share-based check-ins ────────────────────────────── */
  function withLocation(cb) {
    var done = false, fin = function (t) { if (!done) { done = true; cb(t); } };
    if (!navigator.geolocation) return fin('');
    setTimeout(function () { fin(''); }, 6000);
    navigator.geolocation.getCurrentPosition(function (p) { fin('https://maps.google.com/?q=' + p.coords.latitude.toFixed(5) + ',' + p.coords.longitude.toFixed(5)); }, function () { fin(''); }, { enableHighAccuracy: true, timeout: 5500, maximumAge: 60000 });
  }
  function shareText(title, text) {
    if (navigator.share) { navigator.share({ title: title, text: text }).catch(function () {}); return; }
    hmSheet(title, '<div style="white-space:pre-wrap;margin-bottom:10px">' + esc(text) + '</div>', 'Send on WhatsApp', 'https://wa.me/?text=' + encodeURIComponent(text));
  }
  window.setMeetingPoint = function (p) {
    if (!p) return; try { localStorage.setItem(K + 'mtg5', p); } catch (e) {}
    var e = $('meeting-point'); if (e) e.textContent = '📍 ' + p; say('✅ Meeting point saved');
  };
  window.hmShareMeeting = function () {
    var p = ''; try { p = localStorage.getItem(K + 'mtg5') || ''; } catch (e) {}
    if (!p) { say('Choose a meeting point first'); return; }
    shareText('Meeting point', 'If we get separated, let us meet at: ' + p + '\n— sent from Haramain');
  };
  window.sendCheckin = function (s) {
    say('Getting your location…');
    withLocation(function (loc) {
      var name = (typeof user !== 'undefined' && user && !user.guest) ? '@' + user.username + ': ' : '';
      shareText('Check-in', name + s + (loc ? '\n📍 ' + loc : '') + '\n🕐 ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });
  };

  /* ── Lost & found: guidance + a notice you can share ──────────── */
  function lfGuide() {
    var sec = $('s-lostfound'); if (!sec || $('hm-lf-guide')) return;
    var bar = sec.querySelector('.scr-top-bar');
    var g = document.createElement('div'); g.id = 'hm-lf-guide'; g.className = 'ibox'; g.style.marginBottom = '.6rem';
    g.innerHTML = '<div style="font-weight:700;font-size:.72rem;color:var(--t1);margin-bottom:.3rem">If you lose something or someone</div>' +
      '<div class="hm-li">👮 Tell the nearest security officer or mosque staff member and ask for the lost property office.</div>' +
      '<div class="hm-li">🧒 A missing person: call <b>911</b> at once and stay where you are if you agreed a meeting point.</div>' +
      '<div class="hm-li">🛂 A lost passport: tell your Hajj group leader, then your country\'s Hajj mission.</div>' +
      '<div class="hm-li">📤 Below you can write a notice and share it with your group on WhatsApp.</div>';
    if (bar && bar.nextSibling) sec.insertBefore(g, bar.nextSibling); else sec.prepend(g);
  }
  function lfList() {
    var box = $('lf-lost-list'); if (!box) return;
    var list = []; try { list = JSON.parse(localStorage.getItem(K + 'lf') || '[]'); } catch (e) {}
    box.innerHTML = list.length ? list.map(function (n) {
      return '<div class="lf-item"><div class="lf-badge ' + (n.m === 'found' ? 'lf-found' : 'lf-lost') + '">' + (n.m === 'found' ? 'FOUND' : 'LOST') + '</div><div class="lf-title">' + esc(n.item) + '</div>' + (n.desc ? '<div class="lf-desc">' + esc(n.desc) + '</div>' : '') + '<div style="font-size:.5rem;color:var(--t3)">' + esc(n.date) + ' · saved on this phone</div></div>';
    }).join('') : '<div class="empty">No notices yet. Tap “Report Lost” or “Report Found”.</div>';
    var f = $('lf-found-list'); if (f) f.innerHTML = '';
  }
  window.submitLfReport = function () {
    var item = $('lf-item'); if (!item || !item.value.trim()) { say('Describe the item first'); return; }
    var m = ($('lf-form').getAttribute('data-m') || 'lost'), desc = ($('lf-desc') || {}).value || '', contact = ($('lf-contact') || {}).value || '';
    var n = { m: m, item: item.value.trim(), desc: desc.trim(), contact: contact.trim(), date: new Date().toLocaleString() };
    var list = []; try { list = JSON.parse(localStorage.getItem(K + 'lf') || '[]'); } catch (e) {}
    list.unshift(n); try { localStorage.setItem(K + 'lf', JSON.stringify(list.slice(0, 30))); } catch (e) {}
    $('lf-form').style.display = 'none'; item.value = ''; if ($('lf-desc')) $('lf-desc').value = '';
    lfList();
    shareText(m === 'found' ? 'Found item' : 'Lost item', (m === 'found' ? '🟢 FOUND: ' : '🔴 LOST: ') + n.item + (n.desc ? '\n' + n.desc : '') + (n.contact ? '\nContact: ' + n.contact : '') + '\n— shared from Haramain');
  };

  /* ── Translation that really translates ───────────────────────── */
  window.doTr = function () {
    var inp = $('tr-inp'); if (!inp || !inp.value.trim()) return;
    var txt = inp.value.trim(), code = (typeof _trLang !== 'undefined' ? _trLang : 'ar'), L = (window._trMap || {})[code] || { n: code, p: {} };
    var out = $('tr-out'), res = $('tr-res'), lbl = $('tr-lbl');
    if (out) out.style.display = 'block'; if (lbl) lbl.textContent = (L.n || code).toUpperCase();
    var show = function (t, note) { if (res) { res.textContent = t; res.style.direction = (code === 'ar' || code === 'ur') ? 'rtl' : 'ltr'; } var nn = $('tr-note'); if (!nn && out) { nn = document.createElement('div'); nn.id = 'tr-note'; nn.className = 'hm-note'; out.appendChild(nn); } if (nn) nn.textContent = note || ''; };
    if (L.p && L.p[txt]) { show(L.p[txt], 'From the phrase book.'); return; }
    show('Translating…', '');
    fetch('/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      system: 'You are a translator. Translate the user text into ' + L.n + '. Reply with the translation only, no notes, no quotes, no transliteration.',
      messages: [{ role: 'user', content: txt }] }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { var t = d && d.content && d.content[0] && d.content[0].text; if (!t) throw 0; show(t.trim(), 'Machine translation. For anything important, ask a person to check it.'); })
      .catch(function () { show('Translation is unavailable right now.', 'Try a phrase from the phrase book below, which works offline.'); });
  };
  window.setTrLang = function (c) {
    window._trLang = c; try { _trLang = c; } catch (e) {}
    document.querySelectorAll('#s-translation [onclick^="setTrLang"]').forEach(function (b) { var on = b.getAttribute('onclick').indexOf("'" + c + "'") > 0; b.classList.toggle('btn-gold', on); b.classList.toggle('btn-ghost', !on); });
    var inp = $('tr-inp'); if (inp && inp.value.trim()) window.doTr();
  };

  /* ── Duas read aloud in Arabic when the phone has an Arabic voice ── */
  window._playDua5 = function () {
    if (!('speechSynthesis' in window)) { say('Read-aloud is not available on this phone'); return; }
    speechSynthesis.cancel();
    var d = _DL5[_di5], voices = speechSynthesis.getVoices(), ar = voices.filter(function (v) { return /^ar/i.test(v.lang); })[0];
    var u = new SpeechSynthesisUtterance(ar ? d.a : (d.t || d.n));
    if (ar) { u.voice = ar; u.lang = ar.lang; } else u.lang = 'en-US';
    u.rate = 0.8;
    u.onstart = function () { window._auPlaying = true; try { _rdp5(); _rdl5(); } catch (e) {} };
    u.onend = u.onerror = function () { window._auPlaying = false; try { _rdp5(); _rdl5(); } catch (e) {} };
    speechSynthesis.speak(u);
    say(ar ? '🔊 ' + d.n : '🔊 ' + d.n + ' (no Arabic voice on this phone; reading the transliteration)');
  };

  /* ── My worship: real numbers from your own log ───────────────── */
  function plog() { try { return JSON.parse(localStorage.getItem(K + 'plog') || '{}'); } catch (e) { return {}; } }
  function dayKey(d) { return ymd(d); }
  window.hmTogglePrayer = function (i) {
    var L = plog(), k = dayKey(new Date()), a = L[k] || [0, 0, 0, 0, 0]; a[i] = a[i] ? 0 : 1; L[k] = a;
    try { localStorage.setItem(K + 'plog', JSON.stringify(L)); } catch (e) {} window.initAnalytics();
  };
  var PR = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  window.renderAnalyticsWeek = function () {
    var el = $('analytics-week'); if (!el) return;
    var L = plog(), today = L[dayKey(new Date())] || [0, 0, 0, 0, 0];
    var html = '<div class="hm-pray-row">' + PR.map(function (p, i) { return '<button class="hm-pray' + (today[i] ? ' on' : '') + '" onclick="hmTogglePrayer(' + i + ')">' + (today[i] ? '✓ ' : '') + p + '</button>'; }).join('') + '</div><div class="hm-week">';
    for (var k = 6; k >= 0; k--) {
      var d = new Date(Date.now() - k * 864e5), a = L[dayKey(d)] || [], n = a.filter(Boolean).length;
      html += '<div class="analytics-day-col"><div class="analytics-day-name">' + d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: TZ }) + '</div><div class="analytics-day-bar' + (k === 0 ? ' today' : '') + '" style="height:' + (6 + n * 12) + 'px"></div><div class="analytics-day-name">' + n + '/5</div></div>';
    }
    el.innerHTML = html + '</div>';
    var hd = el.parentNode && el.parentNode.firstElementChild; if (hd && hd !== el) hd.textContent = 'Tick each prayer you have prayed today';
  };
  window.renderAnalyticsStats = function () {
    var el = $('analytics-stats'); if (!el) return;
    var L = plog(), week = 0; for (var k = 0; k < 7; k++) week += (L[dayKey(new Date(Date.now() - k * 864e5))] || []).filter(Boolean).length;
    var water = (window.hydroData && hydroData.intake) ? (hydroData.intake / 1000).toFixed(1) + 'L' : '0L';
    var g = function (v, d) { var x = window[v]; return (x === undefined || x === null) ? d : x; };
    var stats = [[g('streak', 0) + 'd', 'Streak'], [g('pts', 0), 'Points'], [(g('tawafHistory', []) || []).length, 'Tawaf'], [g('dhikrTotal', 0) || 0, 'Dhikr'], [week + '/35', 'Prayers (7d)'], [water, 'Water today']];
    el.innerHTML = stats.map(function (s) { return '<div class="analytics-stat"><div class="analytics-stat-val">' + s[0] + '</div><div class="analytics-stat-lbl">' + s[1] + '</div></div>'; }).join('');
  };
  window.renderPrayerChart = function () {
    var el = $('prayer-chart'); if (!el) return;
    var L = plog();
    el.innerHTML = '<div class="ibox">' + PR.map(function (p, i) {
      var c = 0; for (var k = 0; k < 7; k++) c += (L[dayKey(new Date(Date.now() - k * 864e5))] || [])[i] ? 1 : 0;
      var pct = Math.round(c / 7 * 100);
      return '<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.45rem"><div style="font-size:.6rem;color:var(--t2);min-width:58px">' + p + '</div><div style="flex:1;height:8px;background:var(--g2);border-radius:4px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:var(--grn);border-radius:4px"></div></div><div style="font-size:.58rem;color:var(--t2);min-width:34px;text-align:right">' + c + '/7</div></div>';
    }).join('') + '</div>';
  };
  window.renderSpiritualInsights = function () {
    var el = $('spiritual-insights'); if (!el) return;
    el.innerHTML = [
      ['🕌', 'The Prophet ﷺ said: “The most beloved deeds to Allah are those done regularly, even if small.” (Bukhari, Muslim)'],
      ['📖', 'Indeed, prayer prohibits immorality and wrongdoing. (Quran 29:45)'],
      ['📿', 'Saying SubhanAllah 100 times takes about two minutes.']
    ].map(function (x) { return '<div class="insight-card"><div class="insight-icon">' + x[0] + '</div><div class="insight-text">' + x[1] + '</div></div>'; }).join('');
  };
  window.renderWorshipGoals = function () {
    var el = $('worship-goals'); if (!el) return;
    var t = (plog()[dayKey(new Date())] || []).filter(Boolean).length;
    var dz = 0; try { dz = window.dhikrTotal || 0; } catch (e) {}
    var goals = [['Pray all 5 prayers today', t, 5], ['Dhikr (total count)', Math.min(dz, 100), 100]];
    el.innerHTML = goals.map(function (g) { var p = Math.round(g[1] / g[2] * 100); return '<div class="ibox" style="margin-bottom:.4rem"><div style="display:flex;justify-content:space-between;font-size:.62rem;margin-bottom:.3rem"><span>' + g[0] + '</span><b style="color:var(--grn)">' + g[1] + '/' + g[2] + '</b></div><div style="height:6px;background:var(--g2);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + p + '%;background:var(--grn)"></div></div></div>'; }).join('');
  };
  window.initAnalytics = function () { window.renderAnalyticsWeek(); window.renderAnalyticsStats(); window.renderPrayerChart(); window.renderSpiritualInsights(); window.renderWorshipGoals(); };

  /* ── Crowd tips: general guidance, clearly labelled ───────────── */
  window.initCrowdIntel = function () {
    var el = $('jamarat-timing-list'); if (!el) return;
    el.innerHTML = '<div class="ibox">' + [['After Fajr', 'Usually calmer and cooler'], ['Late afternoon to night', 'Cooler; often lighter crowds'], ['Late morning to mid-afternoon', 'Hottest and often the busiest']]
      .map(function (x, i) { return '<div class="hm-li"><b>' + (i === 2 ? '🔴 ' : '🟢 ') + x[0] + '</b> — ' + x[1] + '</div>'; }).join('') + '</div>';
  };
  window.updateCrowdData = function () {};

  /* ── Request Pi: a message you share (payer uses Pi Wallet) ───── */
  window.requestPi = function () {
    var amt = parseFloat(($('req-amt') || {}).value) || 0, reason = (($('req-reason') || {}).value || '').trim();
    if (!(amt > 0)) { say('Enter an amount'); return; }
    var who = (typeof user !== 'undefined' && user && !user.guest) ? '@' + user.username : 'my Pi username';
    shareText('Pi request', 'Assalamu alaikum! Could you send ' + amt + ' π' + (reason ? ' for ' + reason : '') + ' to ' + who + '? You can send it from Pi Wallet in the Pi app.');
  };

  /* ── Guests can look around; payments need Pi sign-in ─────────── */
  window.guestLogin = function () { window.user = { username: 'Guest', guest: true }; try { user = window.user; } catch (e) {} try { genPilgrimId(); } catch (e) {} launchApp(); };
  var _buy = window.buyPrem;
  window.buyPrem = function () {
    var u = (typeof user !== 'undefined') ? user : null;
    if (!u || u.guest) { hmSheet('Sign in with Pi', 'Supporting the app is a Pi payment, so please sign in with Pi first.<button class="hm-sheet-a" type="button" onclick="this.closest(\'.hm-sheet-wrap\').remove();piLogin()">Sign in with Pi</button>'); return; }
    return _buy && _buy.apply(this, arguments);
  };
  window.initPiAds = function () {}; window.renderAdSlots = function () {};

  /* ── light-styled sheet (shared by Pi Wallet hand-off, SOS, sharing) ── */
  window.hmSheet = function (title, html, actionLabel, actionHref) {
    var d = document.createElement('div'); d.className = 'hm-sheet-wrap';
    d.innerHTML = '<div class="hm-sheet" role="dialog" aria-label="' + esc(title) + '"><div class="hm-sheet-t">' + title + '</div><div class="hm-sheet-b">' + html + '</div>' +
      (actionHref ? '<a class="hm-sheet-a" href="' + actionHref + '" target="' + (/^https?:/.test(actionHref) ? '_blank' : '_self') + '" rel="noopener">' + actionLabel + '</a>' : '') +
      '<button class="hm-sheet-x" type="button">Close</button></div>';
    d.addEventListener('click', function (e) { if (e.target === d || e.target.classList.contains('hm-sheet-x')) d.remove(); });
    document.body.appendChild(d);
  };


  /* ── Budget: a plan in your own currency, no invented "spent" figures ── */
  var BUD = ['b-transport', 'b-hotel', 'b-food', 'b-shop', 'b-health', 'b-emerg', 'b-zakat'];
  window.calcBudget = function () {
    var total = BUD.reduce(function (s, id) { var e = $(id); return s + (e && e.value ? parseFloat(e.value) || 0 : 0); }, 0);
    var te = $('budget-total'); if (te) te.textContent = total.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' SAR';
    var sp = $('budget-spent'); if (sp && sp.parentNode && sp.parentNode.parentNode) sp.parentNode.parentNode.style.display = 'none';
    var bar = $('budget-bar'); if (bar && bar.parentNode) bar.parentNode.style.display = 'none';
  };
  function budgetUnits() {
    document.querySelectorAll('#s-budget .bud-pi').forEach(function (e) { e.textContent = 'SAR'; });
    try { window.calcBudget(); } catch (e) {}
  }


  /* ── Prayer times: online service, or the same method calculated on the phone ── */
  function localTimes() {
    var lat = window.userLat || 21.3891, lng = window.userLng || 39.8579;
    var makkah = Math.abs(lat - 21.3891) < 1e-6 && Math.abs(lng - 39.8579) < 1e-6;
    var tz = makkah ? 3 : -new Date().getTimezoneOffset() / 60, h = hijri(new Date());
    return window.HM_PRAYER ? HM_PRAYER(new Date(), lat, lng, tz, !!(h && h.m === 9)) : null;
  }
  window._fetchPrayerAPI = function () {
    var d = new Date(), lat = window.userLat || 21.3891, lng = window.userLng || 39.8579;
    var useLocal = function () { var t = localTimes(); if (!t) return; window.prayerData = t; try { prayerData = t; } catch (e) {} try { renderPrayerList(); updatePrayerCountdown(); } catch (e) {} };
    fetch('https://api.aladhan.com/v1/timings/' + d.getDate() + '-' + (d.getMonth() + 1) + '-' + d.getFullYear() + '?latitude=' + lat + '&longitude=' + lng + '&method=4')
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j || j.code !== 200 || !j.data || !j.data.timings) throw 0; window.prayerData = j.data.timings; try { prayerData = j.data.timings; } catch (e) {} renderPrayerList(); updatePrayerCountdown(); })
      .catch(useLocal);
  };


  /* show guest status honestly on the payments card */
  var _launch = window.launchApp;
  window.launchApp = function () {
    var r = _launch.apply(this, arguments);
    var g = (typeof user !== 'undefined' && user && user.guest);
    document.querySelectorAll('.wh-live').forEach(function (e) { e.innerHTML = g ? 'Guest · sign in with Pi to send or support' : '<div class="live-dot"></div>Signed in with Pi'; });
    return r;
  };


  /* ── Live Pi price (OKX first, then CoinGecko; server-cached) ── */
  window.fetchPiValue = function () {
    var el = $('lc-pi'); if (!window.PiPrice) return;
    var show = function () { var d = PiPrice.get(); if (el) el.textContent = d && d.usd ? '$' + d.usd.toFixed(4) : '—'; };
    show(); PiPrice.refresh(); setTimeout(show, 2500); setInterval(show, 30000);
  };
  function mountPrice() {
    if (!window.PiPrice) return;
    var dash = $('s-dashboard'); var wx = $('weather-widget');
    if (dash && wx && !$('hm-pi-dash')) { var d = document.createElement('div'); d.id = 'hm-pi-dash'; d.style.margin = '0 0 .8rem'; wx.parentNode.insertBefore(d, wx.nextSibling); PiPrice.mount(d, { accent: '#0E7A52', currency: 'USD' }); }
    var pay = $('s-payments'); if (pay && !$('hm-pi-pay')) { var h = pay.querySelector('.scr-hdr'); var p = document.createElement('div'); p.id = 'hm-pi-pay'; p.style.margin = '0 0 .8rem'; if (h) h.parentNode.insertBefore(p, h.nextSibling); else pay.prepend(p); PiPrice.mount(p, { accent: '#0E7A52', currency: 'SAR' }); }
  }


  /* ── Pi calculator uses the live price ── */
  window.calcPi = function () {
    var a = parseFloat(($('pi-a') || {}).value) || 0, inp = $('pi-p'), d = window.PiPrice && PiPrice.get();
    if (inp && !inp.value && d && d.usd) inp.value = d.usd.toFixed(4);
    var p = parseFloat((inp || {}).value) || (d && d.usd) || 0, el = $('pi-res'); if (!el) return;
    if (!a) { el.textContent = 'Enter amount above'; return; }
    if (!p) { el.textContent = 'Live price unavailable — enter a price'; return; }
    var r = d && d.usd ? { sar: d.sar / d.usd, ngn: d.ngn ? d.ngn / d.usd : null } : { sar: 3.75, ngn: null };
    el.innerHTML = a + 'π = $' + (a * p).toFixed(2) + ' · ' + (a * p * r.sar).toFixed(2) + ' SAR' + (r.ngn ? ' · ₦' + Math.round(a * p * r.ngn).toLocaleString() : '');
  };
  /* document tiles open the form with that type chosen */
  window.hmAddDoc = function (type) {
    var f = $('doc-add'), t = $('doc-type'); if (!f) return;
    f.style.display = 'block'; if (t) t.value = type; var n = $('doc-title'); if (n) n.focus();
  };

  /* ── start ─────────────────────────────────────────────────────── */
  function start() {
    // some screens were written after <main> closed: move them in so spacing and scrolling match the rest
    var main = $('main'); if (main) document.querySelectorAll('#app > section.scr').forEach(function (sec) { main.appendChild(sec); });
    try { window.fetchHijriDate(); } catch (e) {}
    findArafat(); restartCountdown(); itineraryDates();
    try { if ($('itinerary-days')) initItinerary(); } catch (e) {}
    try { window.fetchWeather(); } catch (e) {}
    try { if (!window.prayerData || !window.prayerData.Sunrise) window._fetchPrayerAPI(); } catch (e) {}
    try { showVitals(); renderHealthProfile(); } catch (e) {}
    lfGuide(); lfList(); budgetUnits(); mountPrice(); window.fetchPiValue();
    var mp = ''; try { mp = localStorage.getItem(K + 'mtg5') || ''; } catch (e) {}
    if (mp && $('meeting-point')) $('meeting-point').textContent = '📍 ' + mp;
    // the moon-sighting 'region' picker changed nothing; hide it
    var mm = $('moon-method'); if (mm) { var box = mm.closest('.ibox,.card,.ic') || mm.parentNode; box.style.display = 'none'; var lb = box.previousElementSibling; if (lb && lb.classList.contains('sec-label')) lb.style.display = 'none'; }
    var ly = $('lc-hijri-year'); if (ly) ly.textContent = 'Umm al-Qura';
    var _oUtil = window.oUtil;
    window.oUtil = function (id) { var r = _oUtil.apply(this, arguments); if (id === 'pi-calc') { var pp = $('pi-p'); if (pp && !pp.value) window.calcPi(); } return r; };
    // the screen-switcher calls init functions by name; make sure it reaches the new ones
    var _goS = window.goS;
    window.goS = function (id, btn) {
      var r; try { r = _goS.apply(this, arguments); } catch (e) {}
      try {
        if (id === 'analytics') window.initAnalytics();
        if (id === 'crowd') window.initCrowdIntel();
        if (id === 'moon') { window.renderMoonPhase(); window.renderMoonCalendar(); window.renderMoonEvents(); }
        if (id === 'health-intel') { showVitals(); window.renderHospitals(); window.updateHeatRisk(); }
        if (id === 'hydration') { window.renderCoolingStations(); window.renderHeatIndex(); }
        if (id === 'emergency') window.renderEmbassy();
        if (id === 'lostfound') { lfGuide(); lfList(); }
        if (id === 'itinerary') { itineraryDates(); initItinerary(); }
        if (id === 'budget') budgetUnits();
        if (id === 'utilities') { var pp = $('pi-p'); if (pp && !pp.value) window.calcPi(); }
      } catch (e) {}
      return r;
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
