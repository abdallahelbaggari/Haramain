/* Haramain onboarding — six photo scenes that play like a short film (slow camera movement, auto-advance),
   swipe or tap Next to move, Skip jumps to the last page. Shown whenever the sign-in page would show. */
(function () {
  'use strict';
  var STEPS = [
    { img: 'p_plane', a: 'Begin your', b: 'sacred journey', t: 'Plan, prepare and make your Hajj or Umrah with ease, from the very first step.' },
    { img: 'p_kaaba', a: 'Experience', b: 'Makkah', t: 'Every ritual step by step, Tawaf and Sa\'i counters, and prayer times for the Haram.' },
    { img: 'p_madinah', a: 'Discover', b: 'Madinah', t: 'Visit the Prophet\'s Mosque ﷺ with duas, the Quran and calm guidance.' },
    { img: 'p_airport', a: 'Travel with', b: 'confidence', t: 'Packing list, documents and your health card, from the airport to your hotel.' },
    { img: 'p_pilgrims', a: 'Safe at', b: 'every step', t: 'Saudi emergency numbers, family check-ins and crowd safety tips, always at hand.' },
    { img: 'p_quran', a: 'Your spiritual', b: 'companion', t: 'Guidance, worship tools and support for your Hajj and Umrah, in one place.' }
  ];
  var DUR = 6500, root = 'onboarding/';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function build() {
    var landing = document.getElementById('landing');
    if (!landing || getComputedStyle(landing).display === 'none') return;
    var el = document.createElement('section'); el.id = 'hob'; el.setAttribute('aria-label', 'Welcome to Haramain');
    el.innerHTML =
      '<div class="hob-media">' + STEPS.map(function (s, i) { return '<img class="hob-img' + (i === 0 ? ' on' : '') + '" alt="" ' + (i < 2 ? 'src' : 'data-src') + '="' + root + s.img + '.jpg">'; }).join('') +
        '<div class="hob-shade"></div></div>' +
      '<header class="hob-top"><div class="hob-brand"><img src="logo.svg" alt=""><div><b>Haramain</b><small>Your Hajj &amp; Umrah companion</small></div></div>' +
        '<div class="hob-right"><span class="hob-count" id="hob-count">1 / ' + STEPS.length + '</span><button type="button" class="hob-skip">Skip</button></div></header>' +
      '<div class="hob-panel">' +
        '<div class="hob-copy">' + STEPS.map(function (s, i) { return '<div class="hob-txt' + (i === 0 ? ' on' : '') + '"><h2>' + s.a + '<span>' + s.b + '</span></h2><p>' + s.t + '</p></div>'; }).join('') + '</div>' +
        '<div class="hob-bars" aria-hidden="true">' + STEPS.map(function () { return '<i><b></b></i>'; }).join('') + '</div>' +
        '<div class="hob-actions"><button type="button" class="hob-next" aria-label="Next">Next <span>→</span></button></div>' +
        '<div class="hob-final"><button type="button" class="hob-pi"><span>π</span> Sign in with Pi</button><button type="button" class="hob-guest">Continue as guest</button></div>' +
        '<p class="hob-legal"><span class="hob-full"><a href="/privacy-policy">Privacy Policy</a> · <a href="/terms-of-service">Terms of Service</a><br></span>© Haramain 2026</p>' +
      '</div>';
    document.body.appendChild(el);
    document.documentElement.classList.add('hob-on');

    var imgs = el.querySelectorAll('.hob-img'), txts = el.querySelectorAll('.hob-txt'), bars = el.querySelectorAll('.hob-bars b');
    var i = 0, t0 = performance.now(), paused = false, pausedAt = 0, raf = 0;
    function load(k) { var im = imgs[k]; if (im && im.dataset.src) { im.src = im.dataset.src; im.removeAttribute('data-src'); } }
    function go(k) {
      k = Math.max(0, Math.min(STEPS.length - 1, k)); if (k === i && k !== 0) return;
      imgs[i].classList.remove('on'); txts[i].classList.remove('on');
      i = k; load(i); load(i + 1);
      imgs[i].classList.remove('kb'); void imgs[i].offsetWidth; imgs[i].classList.add('on', reduce ? 'still' : 'kb');
      txts[i].classList.add('on');
      el.querySelector('#hob-count').textContent = (i + 1) + ' / ' + STEPS.length;
      el.classList.toggle('last', i === STEPS.length - 1);
      t0 = performance.now();
    }
    function tick(now) {
      var p = paused ? (pausedAt - t0) / DUR : (now - t0) / DUR;
      bars.forEach(function (b, k) { b.style.width = (k < i ? 100 : k > i ? 0 : Math.min(100, p * 100)) + '%'; });
      if (!paused && p >= 1 && i < STEPS.length - 1) go(i + 1);
      raf = requestAnimationFrame(tick);
    }
    imgs[0].classList.add(reduce ? 'still' : 'kb'); load(1);
    raf = requestAnimationFrame(tick);

    function close() { cancelAnimationFrame(raf); el.classList.add('out'); document.documentElement.classList.remove('hob-on'); setTimeout(function () { el.remove(); }, 380); }
    el.querySelector('.hob-skip').onclick = function () { go(STEPS.length - 1); };
    el.querySelector('.hob-next').onclick = function () { go(i + 1); };
    el.querySelector('.hob-pi').onclick = function () { close(); try { piLogin(); } catch (e) {} };
    el.querySelector('.hob-guest').onclick = function () { close(); try { guestLogin(); } catch (e) {} };
    // swipe + hold to pause
    var sx = 0, sy = 0, st = 0;
    el.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); paused = true; pausedAt = performance.now(); }, { passive: true });
    el.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      t0 += performance.now() - pausedAt; paused = false;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(i + (dx < 0 ? 1 : -1));
    }, { passive: true });
    document.addEventListener('keydown', function k(e) { if (!document.body.contains(el)) return document.removeEventListener('keydown', k); if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); });
    window.HOB = { go: go };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(build, 30); }); else setTimeout(build, 30);
})();
