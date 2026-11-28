/* Haramain languages for the app screens. The screens are written in English; this layer shows them in the
   chosen language and switches back without reloading. Quran text, hadith, duas and their meanings keep the
   wording of their sources. */
(function () {
  'use strict';
  var OK = { ar: 1, ha: 1, ur: 1, id: 1, tr: 1 }, V = 'd5bd651c5b';
  var DICT = {}, D = null, lang = 'en', want = 'en';
  try { want = localStorage.getItem('hm_v1_lang') || 'en'; } catch (e) {}
  var orig = new WeakMap(), last = new WeakMap(), aorig = new WeakMap();
  var ATTR = ['placeholder', 'title', 'aria-label'];

  function load(l) {
    if (!OK[l] || DICT[l] || document.getElementById('hmi-' + l)) return;
    var s = document.createElement('script'); s.id = 'hmi-' + l; s.async = true;
    s.src = 'haramain-i18n/' + l + '.js?v=' + V; document.head.appendChild(s);
  }
  function use(l) {
    want = OK[l] ? l : 'en';
    if (want !== 'en' && !DICT[want]) { load(want); return; }
    lang = want; D = lang === 'en' ? null : DICT[lang]; RE = null; all();
  }
  var RE = null, MONRE = null;
  function prep() {
    RE = (D['@tpl'] || []).map(function (t) { return [new RegExp(t[0]), t[1]]; });
    var ks = Object.keys(D['@mon'] || {}).sort(function (a, b) { return b.length - a.length; });
    MONRE = ks.length ? new RegExp('\\b(' + ks.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\']/g, '\\$&'); }).join('|') + ')\\b', 'g') : null;
  }
  function dates(k) {
    if (!MONRE || k.length > 70 || !/\d/.test(k)) return null;
    var M = D['@mon'], r = k.replace(MONRE, function (w) { return M[w] || w; });
    return r !== k ? r : null;
  }
  function one(k, deep) {
    if (!k) return null;
    if (D[k] && typeof D[k] === 'string') return D[k];
    for (var i = 0; i < RE.length; i++) {
      var m = RE[i][0].exec(k);
      if (m) return RE[i][1].replace(/\$(\d)/g, function (_, g) { var x = m[+g] || ''; return (deep < 2 && one(x, deep + 1)) || dates(x) || x; });
    }
    return null;
  }
  function tr(raw) {
    var k = raw.replace(/\s+/g, ' ').trim();
    if (!k || !/[A-Za-z]/.test(k)) return null;
    if (!RE) prep();
    var v = one(k, 0);
    if (!v && k.indexOf(' · ') > 0) {
      var hit = false, p = k.split(' · ').map(function (x) { var t = one(x, 0) || dates(x); if (t) hit = true; return t || x; });
      if (hit) v = p.join(' · ');
    }
    if (!v) { var br = /^(.*\S) \(([^)]*)\)$/.exec(k); if (br && one(br[1], 0)) v = one(br[1], 0) + ' (' + br[2] + ')'; }
    if (!v) v = dates(k);
    if (!v) return null;
    var lead = /^\s*/.exec(raw)[0], tail = /\s*$/.exec(raw)[0];
    return lead + v + tail;
  }
  function skip(el) { return !el || /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(el.nodeName) || (el.closest && el.closest('[data-noi18n],.notranslate')); }
  function text(n) {
    if (skip(n.parentNode)) return;
    var cur = n.nodeValue, src = (orig.has(n) && cur === last.get(n)) ? orig.get(n) : cur;
    orig.set(n, src);
    var v = D ? tr(src) : null; if (v === null) v = src;
    if (v !== cur) { last.set(n, v); n.nodeValue = v; } else last.set(n, cur);
  }
  function attrs(el) {
    var o = aorig.get(el); if (!o) { o = {}; aorig.set(el, o); }
    for (var i = 0; i < ATTR.length; i++) {
      var a = ATTR[i], cur = el.getAttribute(a); if (cur == null) continue;
      var src = (o[a] && cur === o[a][1]) ? o[a][0] : cur;
      var v = D ? tr(src) : null; if (v === null) v = src;
      o[a] = [src, v]; if (v !== cur) el.setAttribute(a, v);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { text(root); return; }
    if (root.nodeType !== 1) return;
    if (/^(TEXTAREA|INPUT)$/.test(root.nodeName) && !(root.closest && root.closest('[data-noi18n]'))) { attrs(root); return; }
    if (skip(root)) return;
    attrs(root);
    var w = document.createTreeWalker(root, 5, null), c;
    while ((c = w.nextNode())) { if (c.nodeType === 3) text(c); else if (!skip(c) || c.nodeName === 'TEXTAREA') attrs(c); }
  }
  function all() { if (document.body) walk(document.body); }

  var Q = [], busy = false;
  function flush() { busy = false; var q = Q; Q = []; for (var i = 0; i < q.length; i++) if (q[i].isConnected) walk(q[i]); }
  function queue(n) { Q.push(n); if (!busy) { busy = true; (window.requestAnimationFrame || setTimeout)(flush); } }
  function watch() {
    new MutationObserver(function (ms) {
      if (!D) return;
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'characterData') { if (m.target.nodeValue !== last.get(m.target)) queue(m.target); }
        else if (m.type === 'attributes') queue(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) queue(m.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }

  window.HMI = {
    add: function (l, d) { DICT[l] = d; if (l === want) use(l); },
    use: use, lang: function () { return lang; },
    t: function (s) { return (D && tr(String(s))) || s; }
  };
  function hook() {
    var f = window.setLang; if (typeof f !== 'function' || f.__hmi) return;
    var g = function (l) { var r = f.apply(this, arguments); use(l); return r; }; g.__hmi = 1; window.setLang = g;
  }
  function start() { hook(); watch(); use(want); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  if (want !== 'en') load(want);
})();
