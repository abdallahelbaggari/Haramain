/* Professional welcome (shared by the apps; each app passes its own colours, film and words).
   Film on top, a clean panel below with the headline for each scene, then Sign in with Pi / Continue as guest.
   Shown when the app would show its sign-in screen; Skip simply reveals that screen. */
(function () {
  'use strict';
  var W = window.PRO_WELCOME; if (!W) return;
  var STARTS = [0, 5, 10, 15], END = 20;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function build() {
    var login = document.querySelector(W.loginSelector);
    if (!login || getComputedStyle(login).display === 'none') return;          // already signed in
    var conn = navigator.connection || {};
    var lite = !!(conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''));
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var slow = /(^|-)3g$/.test(conn.effectiveType || '') || (conn.downlink && conn.downlink < 4);
    var el = document.createElement('section');
    el.id = 'pw'; el.setAttribute('aria-label', 'Welcome to ' + W.name);
    el.style.setProperty('--pw-a', W.accent); el.style.setProperty('--pw-a2', W.accent2 || W.accent);
    el.style.setProperty('--pw-bg', W.panel); el.style.setProperty('--pw-ink', W.ink); el.style.setProperty('--pw-sub', W.sub);
    el.innerHTML =
      '<div class="pw-media">' +
        ((lite || calm) ? '<img class="pw-still" src="' + W.film + '-poster.jpg" alt="">' :
        '<video id="pw-v" muted playsinline autoplay preload="auto" poster="' + W.film + '-poster.jpg" disablepictureinpicture aria-hidden="true">' +
          '<source src="' + W.film + (slow ? '-sd' : '') + '.webm" type="video/webm"><source src="' + W.film + (slow ? '-sd' : '') + '.mp4" type="video/mp4"></video>') +
        '<div class="pw-top"><div class="pw-brand"><img src="' + W.logo + '" alt=""><b>' + esc(W.name) + '</b></div>' +
        '<button class="pw-skip" type="button">Skip ›</button></div>' +
      '</div>' +
      '<div class="pw-panel">' +
        '<div class="pw-bars" aria-hidden="true"><i><b></b></i><i><b></b></i><i><b></b></i><i><b></b></i></div>' +
        '<div class="pw-copy">' + W.scenes.map(function (s, i) {
          return '<div class="pw-txt' + (i === 0 ? ' on' : '') + '"><h2><span>' + esc(s[0]) + '</span><span class="pw-acc">' + esc(s[1]) + '</span></h2><p>' + esc(s[2]) + '</p></div>';
        }).join('') + '</div>' +
        '<button class="pw-pi" type="button"><span>π</span> Sign in with Pi</button>' +
        (W.guest ? '<button class="pw-guest" type="button">Continue as guest</button>' : '') +
        '<p class="pw-legal">' + esc(W.legal || '') + '</p>' +
      '</div>';
    document.body.appendChild(el);
    document.documentElement.classList.add('pw-on');
    var v = el.querySelector('#pw-v'), txts = el.querySelectorAll('.pw-txt'), bars = el.querySelectorAll('.pw-bars b');
    var t0 = Date.now(), raf = 0, scene = -1;
    function now() { return v && !v.paused && v.currentTime ? v.currentTime : ((Date.now() - t0) / 1000) % END; }
    function tick() {
      var t = now(), i = t >= 15 ? 3 : t >= 10 ? 2 : t >= 5 ? 1 : 0;
      bars.forEach(function (b, k) { b.style.width = (k < i ? 100 : k > i ? 0 : Math.min(100, (t - STARTS[k]) / 5 * 100)) + '%'; });
      if (i !== scene) { scene = i; txts.forEach(function (x, k) { x.classList.toggle('on', k === i); }); }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    if (v) { v.addEventListener('ended', function () { v.currentTime = 15; v.play().catch(function () {}); }); var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
    function close() { cancelAnimationFrame(raf); try { v && v.pause(); } catch (e) {} el.classList.add('pw-out'); document.documentElement.classList.remove('pw-on'); setTimeout(function () { el.remove(); }, 400); }
    el.querySelector('.pw-skip').onclick = close;
    el.querySelector('.pw-pi').onclick = function () { close(); try { window[W.signIn](); } catch (e) {} };
    var g = el.querySelector('.pw-guest'); if (g) g.onclick = function () { close(); try { window[W.guestIn](); } catch (e) {} };
    // tap left/right on the film to move between scenes
    el.querySelector('.pw-media').addEventListener('click', function (e) {
      if (!v || e.target.closest('button')) return;
      var r = this.getBoundingClientRect(), back = (e.clientX - r.left) / r.width < .3;
      var i = Math.max(0, Math.min(3, scene + (back ? -1 : 1))); v.currentTime = STARTS[i] + 0.05;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(build, 30); }); else setTimeout(build, 30);
})();
