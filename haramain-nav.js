/* Haramain — one clear map of every tool. Same grid on Home and on More: any tool is two taps away. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  window.hmOpen = function (screen, util) {
    goS(screen);
    if (util) setTimeout(function () {
      try { oUtil(util); } catch (e) {}
      var u = $('up-' + util); if (u) setTimeout(function () { u.scrollIntoView({ block: 'start' }); try { $('main').scrollTop = Math.max(0, $('main').scrollTop - 8); } catch (e) {} }, 60);
    }, 40);
    else { try { $('main').scrollTop = 0; } catch (e) {} window.scrollTo(0, 0); }
  };
  var G = [
    ['🕌 Worship', [
      ['📖', 'Quran', "goS('quran')"], ['☀️', 'Morning Adhkar', "HMA.open('m')"], ['🌙', 'Evening Adhkar', "HMA.open('e')"], ['🕰️', 'Prayer times', "hmOpen('worship')"],
      ['🧭', 'Qibla', "hmOpen('worship','qibla')"], ['🤲', 'Duas', "hmOpen('worship','dua-lib')"], ['📿', 'Tasbih', "hmOpen('worship','dhikr')"], ['✨', '99 Names', "hmOpen('worship','99names')"]]],
    ['🕋 Hajj & Umrah', [
      ['📘', 'Step-by-step guide', "hmOpen('guide')"], ['🕋', 'Tawaf counter', "hmOpen('worship','tawaf')"], ['🏃', "Sa'i counter", "hmOpen('worship','sai')"], ['🪨', 'Jamarat', "hmOpen('worship','jamarat')"],
      ['✅', 'Checklist', "hmOpen('checklist')"], ['🗓️', 'Itinerary', "hmOpen('itinerary')"], ['👘', 'Ihram guide', "hmOpen('utilities','ihram')"], ['💧', 'Zamzam', "hmOpen('utilities','zamzam')"]]],
    ['🛡️ Safety & family', [
      ['🆘', 'Emergency', "hmOpen('emergency')"], ['📍', 'Live location', "hmOpen('tracker')"], ['👨‍👩‍👧', 'Family', "hmOpen('family')"], ['🔍', 'Lost & Found', "hmOpen('lostfound')"],
      ['💊', 'Health card', "hmOpen('health-intel')"], ['🌡️', 'Heat safety', "hmOpen('profile','heat')"], ['🗺️', 'Places', "hmOpen('map')"], ['🌊', 'Crowd tips', "hmOpen('crowd')"]]],
    ['π Pi & tools', [
      ['💎', 'Wallet', "hmOpen('payments')"], ['💱', 'Currency', "hmOpen('utilities','fx')"], ['📅', 'Date converter', "hmOpen('utilities','dates')"], ['🌍', 'Translator', "hmOpen('translation')"],
      ['📂', 'Documents', "hmOpen('documents')"], ['🧮', 'Budget', "hmOpen('budget')"], ['🤲', 'Zakat', "hmOpen('payments','zakat')"], ['📸', 'Memories', "hmOpen('memories')"]]]
  ];
  function grid() {
    return G.map(function (g) {
      return '<div class="nv-g"><div class="nv-h">' + g[0] + '</div><div class="nv-grid">' + g[1].map(function (t) {
        return '<button type="button" class="nv-t" onclick="' + t[2] + '"><span class="nv-i">' + t[0] + '</span><span class="nv-l">' + t[1] + '</span></button>';
      }).join('') + '</div></div>';
    }).join('');
  }
  function home() {
    var dash = $('s-dashboard'); if (!dash || $('nv-home')) return;
    var qa = dash.querySelector('.qa-grid'); var lbl = qa && qa.previousElementSibling;
    var box = document.createElement('div'); box.id = 'nv-home'; box.innerHTML = '<div class="sec-label">⚡ Everything in Haramain</div>' + grid();
    if (qa) { qa.parentNode.insertBefore(box, qa); qa.remove(); if (lbl && lbl.classList.contains('sec-label')) lbl.remove(); }
    else { var t = $('hm-today'); if (t && t.nextSibling) dash.insertBefore(box, t.nextSibling); else dash.appendChild(box); }
  }
  function more() {
    var m = $('s-more'); if (!m || $('nv-more')) return;
    var div = m.querySelector('.divider');
    Array.prototype.slice.call(m.children).forEach(function (c) { if (c === div) return; if (div && (c.compareDocumentPosition(div) & Node.DOCUMENT_POSITION_FOLLOWING) && !c.classList.contains('scr-top-bar')) c.remove(); });
    var box = document.createElement('div'); box.id = 'nv-more'; box.innerHTML = grid() +
      '<div class="nv-g"><div class="nv-h">👤 Account</div><div class="nv-grid">' +
      [['👤', 'Profile', "hmOpen('profile')"], ['🪪', 'Pilgrim ID', "hmOpen('profile','pilgrim-id')"], ['🔔', 'Notifications', "hmOpen('notifs')"], ['💬', 'Ask', "hmOpen('ai')"]].map(function (t) { return '<button type="button" class="nv-t" onclick="' + t[2] + '"><span class="nv-i">' + t[0] + '</span><span class="nv-l">' + t[1] + '</span></button>'; }).join('') + '</div></div>';
    if (div) m.insertBefore(box, div); else m.appendChild(box);
  }
  function start() { home(); more(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 120); }); else setTimeout(start, 120);
})();
