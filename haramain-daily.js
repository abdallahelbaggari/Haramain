/* Haramain — "Today" card: verse/dua of the day, prayer reminders, today's prayers, countdowns.
   Everything is on the phone (no account needed). Reminders work while Haramain is open in Pi Browser. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var K = window.K || 'hm_v1_';
  var get = function (k, d) { try { var v = localStorage.getItem(K + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  var put = function (k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} };
  var say = function (m) { try { toast(m); } catch (e) {} };

  /* Authentic texts only: Quran with surah:ayah, duas with their hadith source */
  var DAILY = [
    { ar: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ', en: 'And when My servants ask you about Me, indeed I am near.', ref: 'Quran 2:186' },
    { ar: 'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ، لَا شَرِيكَ لَكَ', en: 'Here I am, O Allah, here I am. You have no partner. All praise, blessing and dominion are Yours. You have no partner. (The Talbiyah)', ref: 'Bukhari and Muslim' },
    { ar: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', en: 'For indeed, with hardship comes ease.', ref: 'Quran 94:5' },
    { ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ', en: 'Glory be to Allah and praise be to Him; glory be to Allah the Almighty. Two phrases light on the tongue and heavy on the scale.', ref: 'Bukhari and Muslim' },
    { ar: 'فَاذْكُرُونِي أَذْكُرْكُمْ', en: 'So remember Me; I will remember you.', ref: 'Quran 2:152' },
    { ar: 'لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ', en: 'None has the right to be worshipped but Allah alone, with no partner. His is the dominion and the praise, and He is able to do all things. The best of what is said on the Day of Arafat.', ref: 'Tirmidhi' },
    { ar: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', en: 'Surely, in the remembrance of Allah do hearts find rest.', ref: 'Quran 13:28' },
    { ar: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', en: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.', ref: 'Quran 2:201' },
    { ar: 'وَلِلَّهِ عَلَى النَّاسِ حِجُّ الْبَيْتِ مَنِ اسْتَطَاعَ إِلَيْهِ سَبِيلًا', en: 'Pilgrimage to the House is a duty owed to Allah by all who are able to make the journey.', ref: 'Quran 3:97' },
    { ar: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', en: 'There is no power and no strength except with Allah. A treasure from the treasures of Paradise.', ref: 'Bukhari and Muslim' },
    { ar: 'وَتَزَوَّدُوا فَإِنَّ خَيْرَ الزَّادِ التَّقْوَىٰ', en: 'And take provisions, but the best provision is God-consciousness.', ref: 'Quran 2:197' },
    { ar: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ', en: 'O Allah, open for me the doors of Your mercy. (Said when entering the mosque)', ref: 'Muslim' },
    { ar: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', en: 'And whoever relies upon Allah, He is sufficient for him.', ref: 'Quran 65:3' },
    { ar: 'أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ', en: 'I seek Allah\'s forgiveness and turn to Him in repentance. The Prophet ﷺ said this more than seventy times a day.', ref: 'Bukhari' },
    { ar: 'لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ', en: 'Do not despair of the mercy of Allah.', ref: 'Quran 39:53' },
    { ar: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَٰذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ، وَإِنَّا إِلَىٰ رَبِّنَا لَمُنقَلِبُونَ', en: 'Glory be to the One who placed this at our service, for we could never have done it ourselves, and to our Lord we will surely return. (Dua for travel)', ref: 'Quran 43:13–14' },
    { ar: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', en: 'Indeed, Allah is with the patient.', ref: 'Quran 2:153' },
    { ar: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي', en: 'O Allah, You are Pardoning and You love to pardon, so pardon me.', ref: 'Tirmidhi' },
    { ar: 'رَّبِّ زِدْنِي عِلْمًا', en: 'My Lord, increase me in knowledge.', ref: 'Quran 20:114' },
    { ar: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', en: 'Allah is sufficient for us, and He is the best Disposer of affairs.', ref: 'Quran 3:173' },
    { ar: 'وَأَذِّن فِي النَّاسِ بِالْحَجِّ يَأْتُوكَ رِجَالًا', en: 'And proclaim the Hajj to the people; they will come to you on foot.', ref: 'Quran 22:27' },
    { ar: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي', en: 'My Lord, expand my chest for me and make my task easy for me.', ref: 'Quran 20:25–26' },
    { ar: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ', en: 'If you are grateful, I will surely give you more.', ref: 'Quran 14:7' },
    { ar: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا', en: 'Our Lord, do not let our hearts deviate after You have guided us.', ref: 'Quran 3:8' },
    { ar: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ', en: 'Our Lord, grant us from our spouses and children the comfort of our eyes.', ref: 'Quran 25:74' }
  ];
  function dayIndex() { var d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5)) % DAILY.length; }
  var shown = dayIndex();

  /* ── reminders ── */
  var PR = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  function cfg() { return get('rem', { on: false, before: false }); }
  function tone() { try { var A = window.AudioContext || window.webkitAudioContext; var c = new A(); [0, .35].forEach(function (s, i) { var o = c.createOscillator(), g = c.createGain(); o.frequency.value = i ? 784 : 659; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(.0001, c.currentTime + s); g.gain.exponentialRampToValueAtTime(.18, c.currentTime + s + .03); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + s + .32); o.start(c.currentTime + s); o.stop(c.currentTime + s + .34); }); } catch (e) {} }
  function notify(title, body) {
    tone();
    try { if (window.hmSysNotify) hmSysNotify('🕌 ' + title, body, 'hm-prayer'); } catch (e) {}
    try { addNotif('🕌', title, body, 'now'); } catch (e) {}
    banner(title, body);
  }
  function banner(t, b) {
    var old = $('hm-rem-banner'); if (old) old.remove();
    var d = document.createElement('div'); d.id = 'hm-rem-banner';
    d.innerHTML = '<b>🕌 ' + t + '</b><span>' + b + '</span><button type="button">OK</button>';
    d.querySelector('button').onclick = function () { d.remove(); };
    document.body.appendChild(d); setTimeout(function () { if (d.parentNode) d.remove(); }, 60000);
  }
  function check() {
    var c = cfg(); if (!c.on) return;
    var t = window.prayerData; if (!t) return;
    var now = new Date(), key = now.toDateString(), done = get('remDone', {}); if (done.day !== key) done = { day: key };
    PR.forEach(function (p) {
      var m = /(\d{1,2}):(\d{2})/.exec(t[p] || ''); if (!m) return;
      var at = new Date(now); at.setHours(+m[1], +m[2], 0, 0);
      var diff = (now - at) / 60000;
      if (diff >= 0 && diff < 3 && !done[p]) { done[p] = 1; notify('Time for ' + p, 'It is ' + m[1].padStart(2, '0') + ':' + m[2] + '. May Allah accept your prayer.'); }
      if (c.before && diff >= -10 && diff < -7 && !done[p + '-b']) { done[p + '-b'] = 1; notify(p + ' in 10 minutes', 'Prepare for ' + p + ' at ' + m[1].padStart(2, '0') + ':' + m[2] + '.'); }
    });
    put('remDone', done);
  }
  window.hmToggleRem = function (which) {
    var c = cfg();
    if (which === 'on') {
      c.on = !c.on;
      if (c.on && 'Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
      say(c.on ? '🔔 Prayer reminders on' : 'Prayer reminders off');
    } else c.before = !c.before;
    put('rem', c); render();
  };

  /* ── countdowns from the Umm al-Qura calendar ── */
  function countdowns() {
    var cal = window.HM_CAL; if (!cal) return [];
    return [['🌙', 'Ramadan', 9, 1], ['🎉', 'Eid al-Fitr', 10, 1], ['🕋', 'Arafat', 12, 9], ['🐑', 'Eid al-Adha', 12, 10]]
      .map(function (e) { var n = cal.nextHijri(e[2], e[3]); return n && { i: e[0], n: e[1], d: n.days }; }).filter(Boolean)
      .sort(function (a, b) { return a.d - b.d; });
  }

  /* ── today's prayers (shared with "My worship") ── */
  function ymd(d) { return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }); }
  function plog() { return get('plog', {}); }
  function todayCount() { return ((plog()[ymd(new Date())]) || []).filter(Boolean).length; }
  function prayStreak() { var L = plog(), s = 0; for (var k = 0; k < 400; k++) { var a = L[ymd(new Date(Date.now() - k * 864e5))] || []; if (a.filter(Boolean).length === 5) s++; else if (k > 0 || a.length) break; } return s; }

  function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function render() {
    var box = $('hm-today'); if (!box) return;
    var it = DAILY[shown], c = cfg(), h = window.hijriCache || {}, n = todayCount(), st = prayStreak();
    box.innerHTML =
      '<div class="hmt-head"><div><div class="hmt-k">Today</div><div class="hmt-d">' + (h.day ? h.day + ' ' + h.monthEn + ' ' + h.year + ' AH' : '') + '</div></div>' +
        '<button type="button" class="hmt-bell' + (c.on ? ' on' : '') + '" onclick="hmToggleRem(\'on\')" aria-pressed="' + c.on + '">' + (c.on ? '🔔 Reminders on' : '🔕 Prayer reminders') + '</button></div>' +
      '<div class="hmt-verse"><div class="hmt-ar" lang="ar" dir="rtl">' + esc(it.ar) + '</div><div class="hmt-en">' + esc(it.en) + '</div>' +
        '<div class="hmt-row"><span class="hmt-ref">' + esc(it.ref) + '</span><span><button type="button" onclick="hmDailyMore()">Another ›</button><button type="button" onclick="hmDailyShare()">Share</button></span></div></div>' +
      (c.on ? '<label class="hmt-before"><input type="checkbox" ' + (c.before ? 'checked' : '') + ' onchange="hmToggleRem(\'before\')"> Also remind me 10 minutes before</label>' : '') +
      (window.HMA ? '<div class="hmt-adk"><button type="button" onclick="HMA.open(\'m\')"><span>☀️</span><b>Morning Adhkar</b><small>' + HMA.done('m') + ' / ' + HMA.total('m') + (HMA.done('m') === HMA.total('m') ? ' ✓' : '') + '</small></button><button type="button" onclick="HMA.open(\'e\')"><span>🌙</span><b>Evening Adhkar</b><small>' + HMA.done('e') + ' / ' + HMA.total('e') + (HMA.done('e') === HMA.total('e') ? ' ✓' : '') + '</small></button><button type="button" onclick="goS(\'quran\')"><span>📖</span><b>Quran</b><small>' + (window.HMQ && HMQ.last() ? 'Continue' : 'Read · listen') + '</small></button></div>' : '') +
      '<button type="button" class="hmt-pray" onclick="goS(\'analytics\')"><span>🕌 Prayers today <b>' + n + '/5</b>' + (st ? ' · 🔥 ' + st + '-day streak' : '') + '</span><span class="hmt-bar"><i style="width:' + (n * 20) + '%"></i></span></button>' +
      '<div class="hmt-cd">' + countdowns().map(function (x) { return '<div><b>' + (x.d === 0 ? 'Today' : x.d) + '</b><small>' + x.i + ' ' + (x.d === 0 ? x.n : (x.d === 1 ? 'day to ' : 'days to ') + x.n) + '</small></div>'; }).join('') + '</div>' +
      (c.on ? '<div class="hmt-note">Reminders sound while Haramain is open.</div>' : '');
  }
  window.hmDailyMore = function () { shown = (shown + 1) % DAILY.length; render(); };
  window.hmDailyShare = function () {
    var it = DAILY[shown], text = it.ar + '\n\n' + it.en + '\n— ' + it.ref + '\n\nShared from Haramain · haramain.pi';
    if (navigator.share) navigator.share({ title: 'Haramain', text: text }).catch(function () {});
    else { try { navigator.clipboard.writeText(text); say('Copied'); } catch (e) {} }
  };

  function mount() {
    var dash = $('s-dashboard'); if (!dash || $('hm-today')) return;
    var box = document.createElement('div'); box.id = 'hm-today'; box.className = 'hmt';
    var hdr = dash.querySelector('.scr-hdr'); if (hdr && hdr.nextSibling) dash.insertBefore(box, hdr.nextSibling); else dash.prepend(box);
    render();
  }
  function start() {
    mount();
    setInterval(check, 30000); setTimeout(check, 4000);
    var _goS = window.goS; window.goS = function (id) { var r = _goS.apply(this, arguments); if (id === 'dashboard') render(); return r; };
    var _tp = window.hmTogglePrayer; if (_tp) window.hmTogglePrayer = function () { var r = _tp.apply(this, arguments); render(); return r; };
    setInterval(function () { if (!document.hidden) render(); }, 600000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { render(); check(); } });
    setTimeout(render, 1500);   // after the Hijri date is ready
    window.addEventListener('hm-adhkar', render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 60); }); else setTimeout(start, 60);
})();
