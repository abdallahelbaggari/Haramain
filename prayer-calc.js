/* Offline prayer times (Umm al-Qura method: Fajr 18.5°, Isha 90 min after Maghrib, 120 in Ramadan; Asr standard).
   Standard solar-position formulas (as used by PrayTimes). HM_PRAYER(date, lat, lng, tzHours, ramadan) → {Fajr,Sunrise,Dhuhr,Asr,Maghrib,Isha} as "HH:MM". */
(function () {
  var r = Math.PI / 180, sin = function (d) { return Math.sin(d * r); }, cos = function (d) { return Math.cos(d * r); }, tan = function (d) { return Math.tan(d * r); };
  var asin = function (x) { return Math.asin(x) / r; }, acos = function (x) { return Math.acos(x) / r; }, atan2 = function (y, x) { return Math.atan2(y, x) / r; }, acot = function (x) { return Math.atan(1 / x) / r; };
  var fix = function (a, b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
  function julian(y, m, d) { if (m <= 2) { y -= 1; m += 12; } var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5; }
  function sun(jd) {
    var D = jd - 2451545.0, g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
    var L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360), e = 23.439 - 0.00000036 * D;
    var RA = fix(atan2(cos(e) * sin(L), cos(L)) / 15, 24);
    return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - RA };
  }
  window.HM_PRAYER = function (date, lat, lng, tz, ramadan) {
    var jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
    var mid = function (t) { return fix(12 - sun(jd + t).eqt, 24); };
    var angleTime = function (angle, t, ccw) {
      var d = sun(jd + t).decl, noon = mid(t);
      var T = acos((-sin(angle) - sin(d) * sin(lat)) / (cos(d) * cos(lat))) / 15;
      return noon + (ccw ? -T : T);
    };
    var asr = function (f, t) { var d = sun(jd + t).decl; return angleTime(-acot(f + tan(Math.abs(lat - d))), t); };
    var t = { Fajr: angleTime(18.5, 5 / 24, true), Sunrise: angleTime(0.833, 6 / 24, true), Dhuhr: mid(12 / 24), Asr: asr(1, 13 / 24), Maghrib: angleTime(0.833, 18 / 24) };
    t.Isha = t.Maghrib + (ramadan ? 2 : 1.5);
    var out = {};
    Object.keys(t).forEach(function (k) {
      var h = fix(t[k] + tz - lng / 15, 24), mins = Math.round(h * 60) % 1440;
      out[k] = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    });
    return out;
  };
})();
