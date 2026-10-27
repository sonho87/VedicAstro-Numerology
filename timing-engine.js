/*
 * Guru Ji AstroPalm — Jyotish Timing Engine
 * ------------------------------------------
 * Computes a sidereal (Lahiri) birth chart from date, time and place, the
 * Vimshottari dasha timeline, current transits (gochara), and topic-wise
 * analysis for marriage, career, abroad, health, wealth, education,
 * children, property, litigation and state of mind.
 *
 * Every conclusion is returned together with the planetary facts that
 * produced it, so the page can always show *why*.
 *
 * Conventions (stated, not hidden):
 *   - Ayanamsa: Lahiri (Chitrapaksha).
 *   - Houses: whole-sign from the lagna (Parashari practice).
 *   - Rahu/Ketu: mean node.
 *   - Aspects: sign-based graha drishti. All planets 7th; Mars 4th & 8th;
 *     Jupiter 5th & 9th; Saturn 3rd & 10th; Rahu/Ketu 5th, 7th & 9th.
 *   - Vimshottari year = 365.25 days.
 *
 * Works in the browser (uses global `Astronomy` from astronomy-engine)
 * and in Node (requires 'astronomy-engine') so it can be tested.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('astronomy-engine'));
  } else {
    root.TimingEngine = factory(root.Astronomy);
  }
}(typeof self !== 'undefined' ? self : this, function (A) {
  'use strict';

  // ───────────────────────── reference data ─────────────────────────
  var SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  var SIGNS_SKT = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
  var SIGN_LORD = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
  var PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  var NAKS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
    'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Moola', 'Purva Ashadha',
    'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
  var DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  var DASHA_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
  var NAK_LORD = function (i) { return DASHA_ORDER[i % 9]; };
  var NAK_SPAN = 360 / 27;
  var YEAR_DAYS = 365.25;
  var GANDMOOL = ['Ashwini', 'Ashlesha', 'Magha', 'Jyeshtha', 'Moola', 'Revati'];

  var EXALT = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6 };
  var OWN = { Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10] };
  var FRIENDS = {
    Sun: { f: ['Moon', 'Mars', 'Jupiter'], e: ['Venus', 'Saturn'] },
    Moon: { f: ['Sun', 'Mercury'], e: [] },
    Mars: { f: ['Sun', 'Moon', 'Jupiter'], e: ['Mercury'] },
    Mercury: { f: ['Sun', 'Venus'], e: ['Moon'] },
    Jupiter: { f: ['Sun', 'Moon', 'Mars'], e: ['Mercury', 'Venus'] },
    Venus: { f: ['Mercury', 'Saturn'], e: ['Sun', 'Moon'] },
    Saturn: { f: ['Mercury', 'Venus'], e: ['Sun', 'Moon', 'Mars'] }
  };
  var NATURAL_MALEFIC = ['Sun', 'Mars', 'Saturn', 'Rahu', 'Ketu'];
  var SPECIAL_ASPECTS = { Mars: [4, 7, 8], Jupiter: [5, 7, 9], Saturn: [3, 7, 10], Rahu: [5, 7, 9], Ketu: [5, 7, 9] };

  var HOUSE_MEANING = {
    1: 'self, body, health, overall direction',
    2: 'family, savings, speech, food',
    3: 'effort, courage, siblings, short travel, communication',
    4: 'home, mother, property, vehicles, peace of mind, schooling',
    5: 'children, intelligence, studies, romance, past merit',
    6: 'service jobs, competition, debts, disease, enemies, litigation',
    7: 'marriage, spouse, partnerships, foreign travel',
    8: 'sudden events, longevity, chronic illness, obstacles, inheritance, research',
    9: 'fortune, father, guru, higher studies, long-distance travel, dharma',
    10: 'career, status, authority, karma',
    11: 'gains, income, fulfilment of desires, elder siblings, network',
    12: 'expenses, losses, foreign residence, hospitals, sleep, moksha'
  };

  // ───────────────────────── maths helpers ─────────────────────────
  function norm(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }
  function signOf(lon) { return Math.floor(norm(lon) / 30); }
  function houseFrom(fromSign, sign) { return ((sign - fromSign + 12) % 12) + 1; }
  function signAt(fromSign, house) { return (fromSign + house - 1) % 12; }
  function fmtDeg(x) { var d = Math.floor(x); var m = Math.floor((x - d) * 60); return d + '°' + (m < 10 ? '0' : '') + m + '′'; }
  function addDays(date, days) { return new Date(date.getTime() + days * 86400000); }
  function ymd(d) { return d.toISOString().slice(0, 10); }
  function fmtDate(d) {
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return d.getUTCDate() + ' ' + M[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  // Julian centuries since J2000 for an astronomy-engine time.
  function centuries(t) { return t.tt / 36525; }

  /*
   * Lahiri ayanamsa. Anchored to the official Indian definition
   * (23°15′00.658″ on 21 March 1956) and carried by general precession
   * in longitude (IAU 2006, Capitaine et al.).
   */
  function ayanamsa(t) {
    var T = centuries(t);
    var T0 = (2435553.5 - 2451545.0) / 36525; // 21 Mar 1956 0h TT
    function pA(T) { return 5028.796195 * T + 1.1054348 * T * T + 0.00007964 * T * T * T; }
    return 23.250182778 + (pA(T) - pA(T0)) / 3600 + AYAN_CORR;
  }
  var AYAN_CORR = 0; // calibration offset vs Swiss Ephemeris Lahiri (see tests)

  function meanObliquity(t) {
    var T = centuries(t);
    return 23.43929111 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
  }

  // Tropical ecliptic longitude of date for a body.
  function tropical(body, t) {
    return A.Ecliptic(A.GeoVector(body, t, true)).elon;
  }
  function meanNode(t) {
    var T = centuries(t);
    return norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441 - T * T * T * T / 60616000);
  }
  function siderealLongitudes(t) {
    var ay = ayanamsa(t);
    var out = {
      Sun: norm(tropical(A.Body.Sun, t) - ay),
      Moon: norm(A.EclipticGeoMoon(t).lon - ay),
      Mars: norm(tropical(A.Body.Mars, t) - ay),
      Mercury: norm(tropical(A.Body.Mercury, t) - ay),
      Jupiter: norm(tropical(A.Body.Jupiter, t) - ay),
      Venus: norm(tropical(A.Body.Venus, t) - ay),
      Saturn: norm(tropical(A.Body.Saturn, t) - ay),
      Rahu: norm(meanNode(t) - ay)
    };
    out.Ketu = norm(out.Rahu + 180);
    return out;
  }
  function isRetro(body, t) {
    if (body === 'Sun' || body === 'Moon') return false;
    if (body === 'Rahu' || body === 'Ketu') return true;
    var b = A.Body[body];
    var t2 = t.AddDays(1);
    var d = norm(tropical(b, t2) - tropical(b, t) + 180) - 180;
    return d < 0;
  }

  // Sidereal ascendant (lagna) for a time and place.
  function ascendant(t, lat, lon) {
    var gast = A.SiderealTime(t); // hours, apparent
    var ramc = rad(norm(gast * 15 + lon));
    var eps = rad(meanObliquity(t));
    var phi = rad(lat);
    var asc = deg(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))));
    return norm(norm(asc) - ayanamsa(t));
  }

  // Local civil time → astronomy-engine Time.
  function makeTime(y, m, d, hh, mm, tzHours) {
    var ms = Date.UTC(y, m - 1, d, hh, mm, 0) - tzHours * 3600000;
    return A.MakeTime(new Date(ms));
  }
  // Indian Standard Time had War Time (+6:30) from 1 Sep 1942 to 15 Oct 1945.
  function indiaOffset(y, m, d) {
    var v = y * 10000 + m * 100 + d;
    return (v >= 19420901 && v <= 19451015) ? 6.5 : 5.5;
  }

  // ───────────────────────── dignity & nature ─────────────────────────
  function dignity(p, sign) {
    if (p === 'Rahu' || p === 'Ketu') return 'node';
    if (EXALT[p] === sign) return 'exalted';
    if ((EXALT[p] + 6) % 12 === sign) return 'debilitated';
    if (OWN[p].indexOf(sign) >= 0) return 'own';
    var lord = SIGN_LORD[sign];
    if (lord === p) return 'own';
    if (FRIENDS[p].f.indexOf(lord) >= 0) return 'friendly';
    if (FRIENDS[p].e.indexOf(lord) >= 0) return 'enemy';
    return 'neutral';
  }
  var DIGNITY_SCORE = { exalted: 2, own: 1.5, friendly: 0.5, neutral: 0, enemy: -0.5, debilitated: -2, node: 0 };

  // Houses (from lagna) owned by each planet.
  function lordships(lagnaSign) {
    var o = {};
    PLANETS.forEach(function (p) { o[p] = []; });
    for (var h = 1; h <= 12; h++) o[SIGN_LORD[signAt(lagnaSign, h)]].push(h);
    return o;
  }

  /*
   * Functional nature by lordship (Parashari):
   * trikona lords (1,5,9) are benefic; lords of 3,6,11 malefic;
   * 8th lord malefic unless it also rules the lagna; a planet ruling a
   * kendra and a trikona is a yogakaraka; natural benefics ruling only
   * kendras lose their beneficence (kendradhipati dosha).
   */
  function functionalNature(p, owned) {
    if (p === 'Rahu' || p === 'Ketu') return { nature: 'depends on sign lord', score: 0 };
    var tri = owned.filter(function (h) { return h === 1 || h === 5 || h === 9; });
    var ken = owned.filter(function (h) { return h === 4 || h === 7 || h === 10; });
    var bad = owned.filter(function (h) { return h === 3 || h === 6 || h === 11; });
    var eight = owned.indexOf(8) >= 0 && owned.indexOf(1) < 0;
    if ((ken.length && tri.length && tri.indexOf(1) < 0) || (owned.indexOf(1) >= 0 && ken.length && tri.length > 1)) return { nature: 'yogakaraka', score: 2 };
    if (owned.indexOf(1) >= 0) return { nature: 'benefic (lagna lord)', score: 1.5 };
    if (tri.length && !bad.length && !eight) return { nature: 'benefic', score: 1 };
    if (tri.length && (bad.length || eight)) return { nature: 'mixed', score: 0 };
    if (eight || bad.length) return { nature: 'malefic', score: -1 };
    if (ken.length && NATURAL_MALEFIC.indexOf(p) < 0) return { nature: 'neutral (kendra lord)', score: 0 };
    if (ken.length) return { nature: 'neutral', score: 0 };
    return { nature: 'neutral', score: 0 };
  }

  function aspectsSigns(p, fromSign) {
    var a = SPECIAL_ASPECTS[p] || [7];
    return a.map(function (h) { return signAt(fromSign, h); });
  }
  function aspectsSign(p, fromSign, targetSign) {
    return aspectsSigns(p, fromSign).indexOf(targetSign) >= 0;
  }

  // ───────────────────────── divisional charts ─────────────────────────
  // D9 Navamsa: nine parts of 3°20′. Counted continuously through the zodiac, which is the
  // same as the classical rule (movable signs start from themselves, fixed from the 9th, dual from the 5th).
  function d9Sign(lon) { return Math.floor(norm(lon) / (30 / 9)) % 12; }
  // D10 Dashamsa: ten parts of 3°. Odd signs start from themselves, even signs from the 9th.
  function d10Sign(lon) { var s = signOf(lon), part = Math.floor((norm(lon) - s * 30) / 3); return ((s % 2 === 0 ? s : s + 8) + part) % 12; }
  function vargaChart(chart, fn, name) {
    var L = fn(chart.lagna.lon), pl = {};
    PLANETS.forEach(function (p) {
      var sg = fn(chart.planets[p].lon);
      pl[p] = { sign: sg, signName: SIGNS[sg], house: houseFrom(L, sg), dignity: dignity(p, sg) };
    });
    return {
      name: name, lagnaSign: L, lagnaName: SIGNS[L], planets: pl,
      houseLord: function (h) { return SIGN_LORD[signAt(L, h)]; },
      occupants: function (h) { return PLANETS.filter(function (p) { return pl[p].house === h; }); }
    };
  }
  // Degrees between the lagna and the nearest edge of its divisional part.
  function partEdge(lon, size) { var x = norm(lon) % size; return Math.min(x, size - x); }
  function finishVargas(chart) {
    chart.d9 = vargaChart(chart, d9Sign, 'D9 Navamsa');
    chart.d10 = vargaChart(chart, d10Sign, 'D10 Dashamsa');
    PLANETS.forEach(function (p) {
      var pl = chart.planets[p];
      pl.d9 = chart.d9.planets[p]; pl.d10 = chart.d10.planets[p];
      pl.vargottama = pl.d9.sign === pl.sign;
    });
    var w = [];
    // The ascendant moves roughly 1° every 4 minutes, so 0.5° is about 2 minutes of birth time.
    if (partEdge(chart.lagna.lon, 30 / 9) < 0.5) w.push('The D9 (Navamsa) ascendant is within about 2 minutes of birth time of changing sign. Treat D9 house readings as uncertain unless the birth time is exact.');
    if (partEdge(chart.lagna.lon, 3) < 0.5) w.push('The D10 (Dashamsa) ascendant is within about 2 minutes of birth time of changing sign. Treat D10 career readings as uncertain unless the birth time is exact.');
    chart.vargaWarnings = w;
    return chart;
  }
  // Navamsa strength of a planet: confirms or contradicts its birth-chart dignity.
  function d9Strength(chart, p) {
    if (p === 'Rahu' || p === 'Ketu') return null;
    var pl = chart.planets[p];
    if (pl.vargottama) return { v: 1, t: p + ' is Vargottama (same sign in the birth chart and the Navamsa), which makes it reliably strong.' };
    if (pl.d9.dignity === 'exalted' || pl.d9.dignity === 'own') return { v: 1, t: p + ' is ' + pl.d9.dignity + ' in the Navamsa (D9), so it delivers more than the birth chart alone suggests.' };
    if (pl.d9.dignity === 'debilitated') return { v: -1.5, t: p + ' is debilitated in the Navamsa (D9), so it delivers less than the birth chart suggests.' };
    return null;
  }

  // ───────────────────────── chart ─────────────────────────
  function buildChart(input) {
    var tz = (input.tz === undefined || input.tz === null || input.tz === '') ?
      (input.india === false ? 0 : indiaOffset(input.year, input.month, input.day)) : Number(input.tz);
    var t = makeTime(input.year, input.month, input.day, input.hour, input.minute, tz);
    var lons = siderealLongitudes(t);
    var asc = ascendant(t, input.lat, input.lon);
    var lagnaSign = signOf(asc);
    var lord = lordships(lagnaSign);
    var planets = {};
    PLANETS.forEach(function (p) {
      var lon = lons[p], s = signOf(lon), ni = Math.floor(lon / NAK_SPAN);
      planets[p] = {
        name: p, lon: lon, sign: s, signName: SIGNS[s], deg: lon - s * 30,
        house: houseFrom(lagnaSign, s), nak: NAKS[ni], nakIndex: ni,
        pada: Math.floor((lon % NAK_SPAN) / (NAK_SPAN / 4)) + 1, nakLord: NAK_LORD(ni),
        dignity: dignity(p, s), retro: isRetro(p, t), owns: lord[p],
        func: functionalNature(p, lord[p])
      };
    });
    var moon = planets.Moon;
    var elong = norm(lons.Moon - lons.Sun);
    var ascNi = Math.floor(asc / NAK_SPAN);
    var degInSign = asc - lagnaSign * 30;
    var chart = {
      input: input, tz: tz, time: t, birthDate: t.date,
      lagna: { lon: asc, sign: lagnaSign, signName: SIGNS[lagnaSign], deg: degInSign, nak: NAKS[ascNi], lord: SIGN_LORD[lagnaSign] },
      cuspWarning: (degInSign < 1 || degInSign > 29) ?
        'Lagna is ' + fmtDeg(degInSign < 1 ? degInSign : 30 - degInSign) + ' from a sign boundary. A birth time error of a few minutes would change the ascendant and every house. Verify the exact time.' : null,
      moonSign: moon.sign, rashi: SIGNS[moon.sign] + ' (' + SIGNS_SKT[moon.sign] + ')',
      nakshatra: moon.nak, pada: moon.pada, nakLord: moon.nakLord,
      waxing: elong < 180, tithi: Math.floor(elong / 12) + 1,
      gandmool: GANDMOOL.indexOf(moon.nak) >= 0,
      planets: planets, lordOf: lord,
      houseLord: function (h) { return SIGN_LORD[signAt(lagnaSign, h)]; },
      occupants: function (h) { return PLANETS.filter(function (p) { return planets[p].house === h; }); },
      aspectsOnHouse: function (h) {
        var target = signAt(lagnaSign, h);
        return PLANETS.filter(function (p) { return planets[p].house !== h && aspectsSign(p, planets[p].sign, target); });
      }
    };
    return finishVargas(chart);
  }

  // ───────────────────────── Vimshottari dasha ─────────────────────────
  function subPeriods(lord, start, years) {
    var out = [], i0 = DASHA_ORDER.indexOf(lord), cur = start;
    for (var k = 0; k < 9; k++) {
      var q = DASHA_ORDER[(i0 + k) % 9];
      var yrs = years * DASHA_YEARS[q] / 120;
      var end = addDays(cur, yrs * YEAR_DAYS);
      out.push({ lord: q, start: cur, end: end, years: yrs });
      cur = end;
    }
    return out;
  }
  function vimshottari(chart) {
    var moon = chart.planets.Moon;
    var lord = moon.nakLord;
    var frac = (moon.lon % NAK_SPAN) / NAK_SPAN;
    var birth = chart.birthDate;
    var start = addDays(birth, -frac * DASHA_YEARS[lord] * YEAR_DAYS);
    var mds = [], i0 = DASHA_ORDER.indexOf(lord), cur = start;
    for (var k = 0; k < 10; k++) {
      var p = DASHA_ORDER[(i0 + k) % 9], yrs = DASHA_YEARS[p], end = addDays(cur, yrs * YEAR_DAYS);
      mds.push({ lord: p, start: cur, end: end, years: yrs, ads: subPeriods(p, cur, yrs) });
      cur = end;
    }
    return { balanceLord: lord, balanceYears: DASHA_YEARS[lord] * (1 - frac), mds: mds };
  }
  function dashaAt(dasha, date) {
    var t = date.getTime();
    for (var i = 0; i < dasha.mds.length; i++) {
      var md = dasha.mds[i];
      if (t >= md.start.getTime() && t < md.end.getTime()) {
        for (var j = 0; j < md.ads.length; j++) {
          var ad = md.ads[j];
          if (t >= ad.start.getTime() && t < ad.end.getTime()) {
            var pds = subPeriods(ad.lord, ad.start, ad.years), pd = null;
            for (var k = 0; k < pds.length; k++) if (t >= pds[k].start.getTime() && t < pds[k].end.getTime()) pd = pds[k];
            return { md: md, ad: ad, pd: pd, pds: pds };
          }
        }
      }
    }
    return null;
  }

  // ───────────────────────── transits ─────────────────────────
  var BODY = { Jupiter: A.Body.Jupiter, Saturn: A.Body.Saturn, Mars: A.Body.Mars, Sun: A.Body.Sun, Venus: A.Body.Venus, Mercury: A.Body.Mercury };
  function lonOn(planet, date) {
    var t = A.MakeTime(date);
    if (planet === 'Rahu') return norm(meanNode(t) - ayanamsa(t));
    if (planet === 'Ketu') return norm(meanNode(t) - ayanamsa(t) + 180);
    if (planet === 'Moon') return norm(A.EclipticGeoMoon(t).lon - ayanamsa(t));
    return norm(tropical(BODY[planet], t) - ayanamsa(t));
  }
  function signOn(planet, date) { return signOf(lonOn(planet, date)); }

  // When did the planet enter its current sign, and when does it leave?
  function signSpan(planet, date) {
    var s = signOn(planet, date), a = date, b = date, step = 1, i;
    for (i = 0; i < 1300; i++) { var p = addDays(a, -step); if (signOn(planet, p) !== s) break; a = p; }
    for (i = 0; i < 1300; i++) { var n = addDays(b, step); if (signOn(planet, n) !== s) break; b = n; }
    return { sign: s, from: a, to: addDays(b, 1) };
  }
  function ingresses(planet, from, to) {
    var out = [], d = from, prev = signOn(planet, d);
    while (d < to) {
      d = addDays(d, 1);
      var s = signOn(planet, d);
      if (s !== prev) { out.push({ planet: planet, date: d, sign: s, signName: SIGNS[s], from: SIGNS[prev] }); prev = s; }
    }
    return out;
  }

  // Gochara results counted from the natal Moon (Phaladeepika, ch. 26 tradition).
  var GOCHARA = {
    Saturn: {
      good: [3, 6, 11],
      text: {
        1: 'Peak phase of Sade Sati. Pressure on body, mind and self-image; heavy responsibility; results come slowly.',
        2: 'Final phase of Sade Sati. Strain on savings, family harmony and speech; pressure is easing.',
        3: 'Favourable. Courage and sustained effort pay off; gains through hard work.',
        4: 'Ardhashtama Shani. Unrest at home, worries about mother, property or vehicles; peace of mind suffers.',
        5: 'Worries about children or studies; poor judgement in speculation; scattered thinking.',
        6: 'Favourable. Victory over competitors, recovery from illness, debts reduce, service jobs open up.',
        7: 'Kantaka Shani. Strain in marriage and partnerships, tiring travel, spouse\'s health needs care.',
        8: 'Ashtama Shani, the hardest Saturn transit. Health problems, sudden losses, job loss, obstacles and fear.',
        9: 'Delays in fortune, obstacles from father or mentors, long journeys and dharma held back.',
        10: 'Pressure at work: change of job or role, added responsibility, results only through hard work.',
        11: 'Favourable. Income rises, gains arrive, long-held desires are fulfilled.',
        12: 'Sade Sati begins. Rising expenses, poor sleep, relocation or foreign moves, detachment.'
      }
    },
    Jupiter: {
      good: [2, 5, 7, 9, 11],
      text: {
        1: 'Mixed. Change of place, rising expenses, restlessness.',
        2: 'Favourable. Money comes in, family happiness, persuasive speech.',
        3: 'Unfavourable. Efforts meet obstacles; change of position.',
        4: 'Unfavourable. Domestic worries, trouble through relatives.',
        5: 'Favourable. Children, studies, intelligence and romance supported.',
        6: 'Unfavourable. Illness, enemies, debts need watching.',
        7: 'Favourable. Marriage, partnerships, travel and comforts supported.',
        8: 'Unfavourable. Obstacles, health worries, losses.',
        9: 'Favourable. Fortune, blessings, father, pilgrimage and long journeys.',
        10: 'Unfavourable. Trouble at work, loss of standing.',
        11: 'Favourable. Gains, income and fulfilment of wishes.',
        12: 'Unfavourable. Expenses and unproductive travel.'
      }
    },
    Rahu: {
      good: [3, 6, 11],
      text: {
        1: 'Confusion, health worries, fear and impulsive decisions.', 2: 'Family friction, money leaks, harsh speech.',
        3: 'Favourable. Courage, bold moves succeed, rivals lose ground.', 4: 'Unrest at home, mother\'s health, property disputes.',
        5: 'Anxiety over children or studies, confused thinking, speculation losses.', 6: 'Favourable. Victory over enemies, recovery from illness.',
        7: 'Strain with spouse or partners; beware deceptive partners.', 8: 'Sudden troubles, health scares, hidden enemies.',
        9: 'Friction with father or mentors, unorthodox beliefs, foreign links.', 10: 'Job uncertainty but sudden openings, including work abroad.',
        11: 'Favourable. Sudden gains and income.', 12: 'Expenses, foreign travel, disturbed sleep.'
      }
    },
    Ketu: {
      good: [3, 6, 11],
      text: {
        1: 'Health worries, detachment, confusion about direction.', 2: 'Family friction, guarded speech needed.',
        3: 'Favourable. Courage and spiritual effort.', 4: 'Unease at home, dissatisfaction with surroundings.',
        5: 'Anxiety about children or studies.', 6: 'Favourable. Victory over opponents, recovery.',
        7: 'Distance from spouse or partners.', 8: 'Sudden events, hidden health issues.',
        9: 'Spiritual pull, distance from father.', 10: 'Loss of interest in work, change of role.',
        11: 'Favourable. Gains.', 12: 'Spiritual expenses, pilgrimage, poor sleep.'
      }
    }
  };

  function transitReport(chart, date) {
    var out = { date: date, planets: {}, flags: [] };
    ['Saturn', 'Jupiter', 'Rahu', 'Ketu', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'].forEach(function (p) {
      var lon = lonOn(p, date), s = signOf(lon);
      var r = { lon: lon, sign: s, signName: SIGNS[s], deg: lon - s * 30, fromMoon: houseFrom(chart.moonSign, s), fromLagna: houseFrom(chart.lagna.sign, s) };
      if (GOCHARA[p]) {
        r.good = GOCHARA[p].good.indexOf(r.fromMoon) >= 0;
        r.text = GOCHARA[p].text[r.fromMoon];
        var sp = signSpan(p, date);
        r.since = sp.from; r.until = sp.to;
      }
      out.planets[p] = r;
    });
    var sat = out.planets.Saturn, h = sat.fromMoon;
    if (h === 12 || h === 1 || h === 2) {
      var ss = sadeSatiSpan(chart, date);
      out.sadeSati = { phase: h === 12 ? 'first (rising)' : h === 1 ? 'second (peak)' : 'third (setting)', from: ss.from, to: ss.to };
      out.flags.push({ key: 'sadesati', severity: h === 1 ? 3 : 2, text: 'Sade Sati, ' + out.sadeSati.phase + ' phase: Saturn is ' + ordinal(h) + ' from your Moon. Whole Sade Sati runs ' + fmtDate(ss.from) + ' to ' + fmtDate(ss.to) + '.' });
    }
    if (h === 8) out.flags.push({ key: 'ashtama', severity: 3, text: 'Ashtama Shani: Saturn is 8th from your Moon until ' + fmtDate(sat.until) + '. This is the transit most associated with health trouble, sudden losses and job loss.' });
    if (h === 4) out.flags.push({ key: 'ardhashtama', severity: 2, text: 'Ardhashtama Shani: Saturn is 4th from your Moon until ' + fmtDate(sat.until) + '. Home, mother, property and peace of mind come under pressure.' });
    if (h === 7) out.flags.push({ key: 'kantaka', severity: 2, text: 'Kantaka Shani: Saturn is 7th from your Moon until ' + fmtDate(sat.until) + '. Marriage, partnerships and travel are strained.' });
    if (h === 10) out.flags.push({ key: 'sat10', severity: 1, text: 'Saturn is 10th from your Moon until ' + fmtDate(sat.until) + '. Work brings pressure, change of role or heavier duties.' });
    // Saturn / Rahu / Ketu over natal Moon or lagna
    ['Saturn', 'Rahu', 'Ketu'].forEach(function (p) {
      if (out.planets[p].sign === chart.moonSign && p !== 'Saturn') out.flags.push({ key: p + 'moon', severity: 2, text: p + ' is transiting your Moon sign until ' + fmtDate(out.planets[p].until) + ': mental restlessness, confusion and indecision are typical.' });
      if (out.planets[p].sign === chart.lagna.sign) out.flags.push({ key: p + 'lagna', severity: 1, text: p + ' is transiting your ascendant sign until ' + fmtDate(out.planets[p].until) + ': health and self-confidence need care.' });
    });
    if (h === 3 || h === 6 || h === 11) out.flags.push({ key: 'satgood', severity: -1, text: 'Saturn is ' + ordinal(h) + ' from your Moon until ' + fmtDate(sat.until) + ', one of its favourable positions: ' + sat.text });
    if (!out.planets.Jupiter.good && [6, 8, 12].indexOf(out.planets.Jupiter.fromMoon) >= 0) out.flags.push({ key: 'jupbad', severity: 1, text: 'Jupiter is ' + ordinal(out.planets.Jupiter.fromMoon) + ' from your Moon until ' + fmtDate(out.planets.Jupiter.until) + ': ' + out.planets.Jupiter.text });
    if (out.planets.Jupiter.good) out.flags.push({ key: 'jupgood', severity: -1, text: 'Jupiter is ' + ordinal(out.planets.Jupiter.fromMoon) + ' from your Moon until ' + fmtDate(out.planets.Jupiter.until) + ', a supportive position: ' + out.planets.Jupiter.text });
    if (aspectsSign('Jupiter', out.planets.Jupiter.sign, chart.lagna.sign) || out.planets.Jupiter.sign === chart.lagna.sign) out.flags.push({ key: 'juplagna', severity: -1, text: 'Jupiter is aspecting your ascendant until ' + fmtDate(out.planets.Jupiter.until) + ', a protective influence on health and decisions.' });
    return out;
  }
  function sadeSatiSpan(chart, date) {
    function inSS(d) { var hh = houseFrom(chart.moonSign, signOn('Saturn', d)); return hh === 12 || hh === 1 || hh === 2; }
    var a = date, b = date, gap = 0, i;
    for (i = 0; i < 3500; i += 5) { var p = addDays(date, -i); if (inSS(p)) { a = p; gap = 0; } else if (++gap > 60) break; }
    gap = 0;
    for (i = 0; i < 3500; i += 5) { var n = addDays(date, i); if (inSS(n)) { b = n; gap = 0; } else if (++gap > 60) break; }
    return { from: a, to: b };
  }

  // ───────────────────────── topic analysis ─────────────────────────
  function ordinal(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }

  var TOPICS = {
    marriage: { label: 'Marriage & relationships', primary: 7, houses: [7, 2, 11], karakas: function (g) { return g === 'F' ? ['Jupiter', 'Venus'] : ['Venus']; } },
    career: { label: 'Career & job', primary: 10, houses: [10, 6, 11], karakas: function () { return ['Saturn', 'Sun']; } },
    abroad: { label: 'Foreign travel, work & settlement', primary: 12, houses: [12, 9, 7, 3], karakas: function () { return ['Rahu']; } },
    health: { label: 'Health', primary: 1, houses: [1, 6, 8], karakas: function () { return ['Sun', 'Moon']; } },
    wealth: { label: 'Money & wealth', primary: 11, houses: [2, 11, 9], karakas: function () { return ['Jupiter']; } },
    education: { label: 'Education & studies', primary: 5, houses: [4, 5, 9], karakas: function () { return ['Mercury', 'Jupiter']; } },
    children: { label: 'Children & progeny', primary: 5, houses: [5, 9], karakas: function () { return ['Jupiter']; } },
    property: { label: 'Home, property & vehicles', primary: 4, houses: [4, 11], karakas: function () { return ['Mars', 'Venus']; } },
    litigation: { label: 'Disputes, enemies & legal matters', primary: 6, houses: [6], karakas: function () { return ['Mars', 'Saturn']; } },
    mind: { label: 'Peace of mind & decisions', primary: 4, houses: [1, 4], karakas: function () { return ['Moon', 'Mercury']; } }
  };

  // How is planet p connected to a set of houses? Returns readable reasons.
  function links(chart, p, houses, primary, karakas) {
    var pl = chart.planets[p], L = [], lag = chart.lagna.sign;
    houses.forEach(function (h) {
      if (pl.owns.indexOf(h) >= 0) L.push('rules your ' + ordinal(h) + ' house');
      if (pl.house === h) L.push('sits in your ' + ordinal(h) + ' house');
    });
    if (primary) {
      if (pl.house !== primary && aspectsSign(p, pl.sign, signAt(lag, primary))) L.push('aspects your ' + ordinal(primary) + ' house');
      var pLord = chart.houseLord(primary);
      if (p !== pLord) {
        var ls = chart.planets[pLord].sign;
        if (pl.sign === ls) L.push('is conjunct ' + pLord + ', lord of your ' + ordinal(primary));
        else if (aspectsSign(p, pl.sign, ls)) L.push('aspects ' + pLord + ', lord of your ' + ordinal(primary));
      }
    }
    if (karakas && karakas.indexOf(p) >= 0) L.push('is the natural significator (karaka) of this matter');
    if (p === 'Rahu' || p === 'Ketu') {
      var disp = SIGN_LORD[pl.sign];
      var dh = chart.planets[disp].owns.filter(function (h) { return houses.indexOf(h) >= 0; });
      if (dh.length) L.push('acts for its sign lord ' + disp + ', which rules your ' + dh.map(ordinal).join(' & ') + ' house');
    }
    return uniq(L);
  }

  function promise(chart, key) {
    var T = TOPICS[key], H = T.primary, lag = chart.lagna.sign, g = chart.input.gender;
    var lord = chart.houseLord(H), lp = chart.planets[lord];
    var pos = [], neg = [], score = 0;
    function add(v, txt) { score += v; (v >= 0 ? pos : neg).push(txt); }

    var ds = DIGNITY_SCORE[lp.dignity];
    if (ds > 0) add(ds, 'Your ' + ordinal(H) + ' lord ' + lord + ' is ' + lp.dignity + ' in ' + lp.signName + '.');
    if (ds < 0) add(ds, 'Your ' + ordinal(H) + ' lord ' + lord + ' is ' + lp.dignity + ' in ' + lp.signName + '.');
    if ([1, 4, 7, 10, 5, 9].indexOf(lp.house) >= 0) add(1, lord + ' (' + ordinal(H) + ' lord) is placed in the ' + ordinal(lp.house) + ', a strong house.');
    if ([6, 8, 12].indexOf(lp.house) >= 0 && !(H === 6 || H === 8 || H === 12)) add(-1.5, lord + ' (' + ordinal(H) + ' lord) is placed in the ' + ordinal(lp.house) + ' (a dusthana), which weakens and delays this area.');
    if (lp.retro && lord !== 'Rahu' && lord !== 'Ketu') pos.push(lord + ' is retrograde: results come after repeated effort or delay.');
    var ld9 = d9Strength(chart, lord); if (ld9) add(ld9.v, 'Your ' + ordinal(H) + ' lord ' + ld9.t);

    chart.occupants(H).forEach(function (p) {
      var d = chart.planets[p].dignity;
      if (['Jupiter', 'Venus', 'Mercury'].indexOf(p) >= 0 || (p === 'Moon' && chart.waxing)) add(1, p + ' occupies your ' + ordinal(H) + ' house, a benefic influence.');
      else if (p !== 'Moon') {
        if ((d === 'own' || d === 'exalted') && p !== 'Rahu' && p !== 'Ketu') add(0.5, p + ' occupies your ' + ordinal(H) + ' in its ' + d + ' sign: strong but demanding.');
        else if (H === 6 || H === 3 || H === 11 || H === 10) add(0.5, p + ' (a natural malefic) in your ' + ordinal(H) + ' gives drive and competitive strength.');
        else add(-1, p + ' (a natural malefic) occupies your ' + ordinal(H) + ' house, bringing friction or delay.');
      }
    });
    chart.aspectsOnHouse(H).forEach(function (p) {
      if (p === 'Jupiter') add(1.5, 'Jupiter aspects your ' + ordinal(H) + ' house, a protective and expanding influence.');
      if (p === 'Saturn' && H !== 10 && H !== 6) add(-1, 'Saturn aspects your ' + ordinal(H) + ' house: delay, maturity required, results come late but last.');
      if (p === 'Mars' && (H === 7 || H === 4 || H === 1)) add(-0.5, 'Mars aspects your ' + ordinal(H) + ' house: friction and arguments need managing.');
    });
    T.karakas(g).forEach(function (k) {
      var kp = chart.planets[k], kd = DIGNITY_SCORE[kp.dignity];
      if (kd >= 1) add(1, 'The significator ' + k + ' is ' + kp.dignity + ' in ' + kp.signName + '.');
      if (kd <= -2) add(-1.5, 'The significator ' + k + ' is debilitated in ' + kp.signName + '.');
      if ([6, 8, 12].indexOf(kp.house) >= 0 && k !== 'Rahu') add(-0.5, 'The significator ' + k + ' is in your ' + ordinal(kp.house) + ' house.');
      if (k !== chart.houseLord(H)) { var kd9 = d9Strength(chart, k); if (kd9) add(kd9.v, 'The significator ' + kd9.t); }
    });

    var extra = topicSpecific(chart, key);
    extra.pos.forEach(function (x) { add(x[0], x[1]); });
    extra.neg.forEach(function (x) { add(x[0], x[1]); });
    var level = score >= 3 ? 'Strong' : score >= 0.5 ? 'Moderate' : score >= -1.5 ? 'Mixed' : 'Challenged';
    return { score: Math.round(score * 10) / 10, level: level, positives: pos, negatives: neg, notes: extra.notes };
  }

  function topicSpecific(chart, key) {
    var P = chart.planets, pos = [], neg = [], notes = [], lag = chart.lagna.sign;
    var L = function (h) { return chart.houseLord(h); };
    var mutual = function (a, b) { return P[a].sign === P[b].sign || aspectsSign(a, P[a].sign, P[b].sign) || aspectsSign(b, P[b].sign, P[a].sign) || (P[a].owns.indexOf(P[b].house) >= 0 && P[b].owns.indexOf(P[a].house) >= 0); };
    if (key === 'marriage') {
      var m = manglik(chart);
      if (m.present) neg.push([m.cancelled ? -0.5 : -1, m.text]);
      if (aspectsSign('Saturn', P.Saturn.sign, signAt(lag, 7)) || P.Saturn.house === 7) notes.push('Saturn influences the 7th house. Classically this delays marriage, often past 28–30, but makes it stable once it happens.');
      if (P.Rahu.house === 7 || P.Ketu.house === 7 || P.Rahu.house === 1 || P.Ketu.house === 1) neg.push([-0.5, 'Rahu/Ketu fall across your 1st–7th axis: unconventional match, or misunderstandings to manage.']);
      var v = P.Venus;
      if (Math.abs(norm(v.lon - P.Sun.lon + 180) - 180) < 10) neg.push([-0.5, 'Venus is combust (within 10° of the Sun), weakening the marriage significator.']);
      if (!chart.input.noTime) {
        var N = chart.d9, n7 = N.houseLord(7), q = N.planets[n7];
        if (q.dignity === 'exalted' || q.dignity === 'own') pos.push([1, 'In the Navamsa (D9, the marriage chart) the 7th lord ' + n7 + ' is ' + q.dignity + ' in ' + q.signName + '.']);
        if (q.dignity === 'debilitated') neg.push([-1, 'In the Navamsa (D9) the 7th lord ' + n7 + ' is debilitated in ' + q.signName + '.']);
        if ([6, 8, 12].indexOf(q.house) >= 0) neg.push([-1, 'In the Navamsa (D9) the 7th lord ' + n7 + ' falls in the ' + ordinal(q.house) + ' house: marriage needs patience and adjustment.']);
        else if ([1, 4, 7, 10, 5, 9].indexOf(q.house) >= 0) pos.push([0.5, 'In the Navamsa (D9) the 7th lord ' + n7 + ' is in the ' + ordinal(q.house) + ', a strong house.']);
        N.occupants(7).forEach(function (p) {
          if (['Jupiter', 'Venus', 'Mercury'].indexOf(p) >= 0) pos.push([0.5, p + ' occupies the 7th house of the Navamsa (D9).']);
          else if (['Saturn', 'Mars', 'Rahu', 'Ketu'].indexOf(p) >= 0) neg.push([-0.5, p + ' occupies the 7th house of the Navamsa (D9): friction or delay in married life.']);
        });
        notes.push('Navamsa (D9) ascendant: ' + N.lagnaName + '; D9 7th house: ' + SIGNS[signAt(N.lagnaSign, 7)] + ', ruled by ' + n7 + '.');
      }
    }
    if (key === 'career') {
      if (mutual(L(9), L(10)) && L(9) !== L(10)) pos.push([1.5, 'Dharma–Karma Adhipati yoga: your 9th lord ' + L(9) + ' and 10th lord ' + L(10) + ' are connected. A strong career yoga.']);
      if (chart.occupants(10).length === 0) notes.push('No planets in your 10th house: career follows the 10th lord ' + L(10) + ' and the running dasha.');
      if (P[L(10)].house === 6) notes.push('Your 10th lord sits in the 6th: you are suited to employment and service rather than your own business.');
      if (P[L(10)].house === 7) notes.push('Your 10th lord sits in the 7th: business, partnerships or client-facing work suit you.');
      if (!chart.input.noTime) {
        var D = chart.d10, t10 = D.houseLord(10), r = D.planets[t10];
        if (r.dignity === 'exalted' || r.dignity === 'own') pos.push([1, 'In the Dashamsa (D10, the career chart) the 10th lord ' + t10 + ' is ' + r.dignity + ' in ' + r.signName + '.']);
        if (r.dignity === 'debilitated') neg.push([-1, 'In the Dashamsa (D10) the 10th lord ' + t10 + ' is debilitated in ' + r.signName + '.']);
        if ([6, 8, 12].indexOf(r.house) >= 0) neg.push([-1, 'In the Dashamsa (D10) the 10th lord ' + t10 + ' falls in the ' + ordinal(r.house) + ' house: career progress comes through setbacks.']);
        else if ([1, 4, 7, 10, 5, 9].indexOf(r.house) >= 0) pos.push([0.5, 'In the Dashamsa (D10) the 10th lord ' + t10 + ' is in the ' + ordinal(r.house) + ', a strong house.']);
        var b10 = D.planets[L(10)].house;
        if ([1, 4, 7, 10, 5, 9].indexOf(b10) >= 0) pos.push([0.5, 'Your birth-chart 10th lord ' + L(10) + ' lands in the ' + ordinal(b10) + ' house of the Dashamsa (D10).']);
        if ([6, 8, 12].indexOf(b10) >= 0) neg.push([-0.5, 'Your birth-chart 10th lord ' + L(10) + ' lands in the ' + ordinal(b10) + ' house of the Dashamsa (D10).']);
        D.occupants(10).forEach(function (p) {
          var dg = D.planets[p].dignity;
          if (dg === 'debilitated') neg.push([-0.5, p + ' sits debilitated in the 10th house of the Dashamsa (D10).']);
          else pos.push([0.5, p + ' sits in the 10th house of the Dashamsa (D10), shaping the kind of work: ' + ({ Sun: 'authority and government', Moon: 'public dealing and care', Mars: 'technical, engineering or uniformed work', Mercury: 'trade, analysis, writing and communication', Jupiter: 'teaching, advisory, law and finance', Venus: 'arts, luxury, hospitality and design', Saturn: 'operations, labour-heavy industries and long-term service', Rahu: 'technology, foreign companies and unconventional fields', Ketu: 'research, niche technical and spiritual work' })[p] + '.']);
        });
        notes.push('Dashamsa (D10) ascendant: ' + D.lagnaName + '; D10 10th house: ' + SIGNS[signAt(D.lagnaSign, 10)] + ', ruled by ' + t10 + '.');
      }
    }
    if (key === 'abroad') {
      var ind = [];
      if (P[L(12)].house === 9 || P[L(9)].house === 12) ind.push('a link between your 9th and 12th lords');
      if (mutual(L(9), L(12)) && L(9) !== L(12)) ind.push('your 9th lord ' + L(9) + ' and 12th lord ' + L(12) + ' are connected');
      if ([12, 9, 7, 10].indexOf(P.Rahu.house) >= 0) ind.push('Rahu in your ' + ordinal(P.Rahu.house) + ' house');
      if (P[L(1)].house === 12 || P[L(1)].house === 9) ind.push('your lagna lord ' + L(1) + ' in the ' + ordinal(P[L(1)].house));
      if (P.Moon.house === 12) ind.push('Moon in the 12th');
      if (chart.occupants(12).length >= 2) ind.push(chart.occupants(12).length + ' planets in the 12th house');
      if ([0, 3, 6, 9].indexOf(signAt(lag, 12)) >= 0) ind.push('a movable sign on the 12th house');
      if (ind.length >= 3) pos.push([2, 'Foreign indicators present: ' + ind.join('; ') + '.']);
      else if (ind.length) pos.push([ind.length * 0.5, 'Some foreign indicators: ' + ind.join('; ') + '.']);
      else neg.push([-1, 'No classical foreign-residence combination is present in the birth chart.']);
      var settle = (P[L(1)].house === 12) || (P[L(4)].house === 12) || (P[L(12)].house === 1) || (P[L(12)].house === 4);
      notes.push(settle ? 'Settlement abroad is indicated: the lagna lord or 4th lord is tied to the 12th.' : 'The chart supports going abroad for work or study more than permanent settlement. Your 4th (home) is not tied to the 12th.');
    }
    if (key === 'health') {
      [6, 8].forEach(function (h) { if (P[L(h)].house === 1) neg.push([-1, 'Your ' + ordinal(h) + ' lord ' + L(h) + ' sits in your ascendant: recurring health matters need attention.']); });
      ['Saturn', 'Mars', 'Rahu', 'Ketu'].forEach(function (p) { if (P[p].house === 1) neg.push([-0.5, p + ' in your ascendant affects vitality.']); });
      if (DIGNITY_SCORE[P[L(1)].dignity] >= 1) pos.push([1, 'Your lagna lord ' + L(1) + ' is strong (' + P[L(1)].dignity + '), good basic constitution.']);
      notes.push('Body areas under the 6th house sign (' + SIGNS[signAt(lag, 6)] + ') and 8th house sign (' + SIGNS[signAt(lag, 8)] + ') are the usual weak points.');
    }
    if (key === 'wealth') {
      if (mutual(L(2), L(11)) && L(2) !== L(11)) pos.push([1.5, 'Dhana yoga: your 2nd lord ' + L(2) + ' and 11th lord ' + L(11) + ' are connected.']);
      if (mutual(L(9), L(11)) && L(9) !== L(11)) pos.push([1, 'Your 9th lord (fortune) and 11th lord (gains) are connected.']);
      if (P[L(2)].house === 12 || P[L(11)].house === 12) neg.push([-1, 'A wealth lord sits in the 12th: money comes but flows out quickly. Automatic saving is essential.']);
    }
    if (key === 'children') {
      if (P.Rahu.house === 5 || P.Ketu.house === 5) neg.push([-0.5, (P.Rahu.house === 5 ? 'Rahu' : 'Ketu') + ' in the 5th can delay or complicate progeny.']);
      if (P.Saturn.house === 5) neg.push([-0.5, 'Saturn in the 5th can delay children.']);
    }
    if (key === 'mind') {
      var mo = P.Moon;
      if (!chart.waxing) neg.push([-0.5, 'The Moon is waning (born in Krishna paksha).']);
      ['Rahu', 'Ketu', 'Saturn'].forEach(function (p) { if (P[p].sign === mo.sign) neg.push([-1, 'The Moon is conjunct ' + p + (p === 'Saturn' ? ' (Vish yoga)' : ' (Grahan yoga)') + ': prone to worry, doubt and indecision.']); });
      if ([6, 8, 12].indexOf(mo.house) >= 0) neg.push([-1, 'The Moon is in your ' + ordinal(mo.house) + ' house: emotional strain is internalised.']);
      if (DIGNITY_SCORE[mo.dignity] >= 1.5) pos.push([1.5, 'The Moon is ' + mo.dignity + ': strong emotional resilience.']);
    }
    if (key === 'litigation') {
      ['Saturn', 'Mars', 'Rahu', 'Sun'].forEach(function (p) { if (P[p].house === 6) pos.push([1, p + ' in your 6th: you tend to defeat opponents.']); });
    }
    return { pos: pos, neg: neg, notes: notes };
  }

  function manglik(chart) {
    var P = chart.planets, hL = P.Mars.house, hM = houseFrom(chart.moonSign, P.Mars.sign), bad = [1, 2, 4, 7, 8, 12];
    var fromL = bad.indexOf(hL) >= 0, fromM = bad.indexOf(hM) >= 0;
    if (!fromL && !fromM) return { present: false };
    var cancel = [];
    if (P.Mars.dignity === 'own' || P.Mars.dignity === 'exalted') cancel.push('Mars is in its ' + P.Mars.dignity + ' sign');
    if (P.Jupiter.sign === P.Mars.sign || aspectsSign('Jupiter', P.Jupiter.sign, P.Mars.sign)) cancel.push('Jupiter conjoins or aspects Mars');
    if (chart.lagna.sign === 0 || chart.lagna.sign === 7) cancel.push('Mars rules your ascendant');
    var where = [fromL ? ordinal(hL) + ' from lagna' : null, fromM ? ordinal(hM) + ' from Moon' : null].filter(Boolean).join(' and ');
    return {
      present: true, cancelled: cancel.length > 0, fromLagna: fromL, fromMoon: fromM,
      text: 'Manglik (Kuja) dosha: Mars is ' + where + '.' + (cancel.length ? ' Reduced because ' + cancel.join('; ') + '.' : ' Match with a partner who also has Mars in these houses.')
    };
  }

  // Dasha-lord description for "what is this period about?"
  function periodThemes(chart, p) {
    var pl = chart.planets[p], houses = pl.owns.slice();
    if (p === 'Rahu' || p === 'Ketu') houses = chart.planets[SIGN_LORD[pl.sign]].owns.slice();
    var all = uniq([pl.house].concat(houses));
    var dust = all.filter(function (h) { return h === 6 || h === 8 || h === 12; });
    var good = all.filter(function (h) { return [1, 5, 9, 10, 11].indexOf(h) >= 0; });
    var txt = p + ' sits in your ' + ordinal(pl.house) + ' house in ' + pl.signName + ' (' + pl.dignity + ')' +
      (pl.owns.length ? ' and rules your ' + pl.owns.map(ordinal).join(' & ') : ' and acts for its sign lord ' + SIGN_LORD[pl.sign] + ' (rules ' + houses.map(ordinal).join(' & ') + ')') + '.';
    return {
      planet: p, houses: all, text: txt,
      themes: all.map(function (h) { return ordinal(h) + ': ' + HOUSE_MEANING[h]; }),
      hard: dust.length > 0 && good.length === 0, mixed: dust.length > 0 && good.length > 0, supportive: dust.length === 0 && good.length > 0,
      nature: pl.func.nature
    };
  }
  // AD lord placed 6/8 or 2/12 from MD lord = friction between the two periods.
  function mdAdRelation(chart, md, ad) {
    if (md === ad) return null;
    var d = houseFrom(chart.planets[md].sign, chart.planets[ad].sign);
    if (d === 6 || d === 8) return 'The sub-period lord ' + ad + ' is ' + ordinal(d) + ' from the major-period lord ' + md + ' (shadashtaka): the two periods pull against each other, which shows up as obstacles and friction.';
    if (d === 12 || d === 2) return ad + ' is ' + ordinal(d) + ' from ' + md + ': expenses and some loss of momentum in this sub-period.';
    if ([1, 5, 9, 4, 7, 10, 3, 11].indexOf(d) >= 0) return ad + ' is ' + ordinal(d) + ' from ' + md + ': the two period lords cooperate.';
    return null;
  }

  // ───────────────────────── timing windows ─────────────────────────
  function precompute(from, days) {
    var arr = [];
    for (var i = 0; i <= days; i++) {
      var d = addDays(from, i);
      arr.push({ date: d, Jupiter: signOn('Jupiter', d), Saturn: signOn('Saturn', d), Rahu: signOn('Rahu', d) });
    }
    return arr;
  }
  function influences(p, transitSign, targetSign) {
    return transitSign === targetSign || aspectsSign(p, transitSign, targetSign);
  }

  function windowsFor(chart, dasha, key, series) {
    var T = TOPICS[key], H = T.primary, lag = chart.lagna.sign, karakas = T.karakas(chart.input.gender);
    var target = signAt(lag, H), lordSign = chart.planets[chart.houseLord(H)].sign;
    var targetMoon = signAt(chart.moonSign, H);
    var cache = {};
    function lk(p) { if (!(p in cache)) cache[p] = links(chart, p, T.houses, H, karakas); return cache[p]; }
    var days = series.map(function (s) {
      var da = dashaAt(dasha, s.date);
      if (!da) return { date: s.date, score: 0 };
      var mdL = lk(da.md.lord), adL = lk(da.ad.lord), pdL = da.pd ? lk(da.pd.lord) : [];
      var dScore = (mdL.length ? 1 : 0) + (adL.length ? 2 : 0) + (adL.length >= 2 ? 0.5 : 0) + (pdL.length ? 0.5 : 0);
      var jup = influences('Jupiter', s.Jupiter, target) || influences('Jupiter', s.Jupiter, lordSign);
      var sat = influences('Saturn', s.Saturn, target) || influences('Saturn', s.Saturn, lordSign);
      var jupM = influences('Jupiter', s.Jupiter, targetMoon);
      var tScore = (jup ? 1 : 0) + (sat ? 1 : 0) + (jup && sat ? 0.5 : 0) + (jupM ? 0.5 : 0);
      var ok = dScore >= 2 && ((jup && sat) || (dScore >= 3 && (jup || jupM)));
      return { date: s.date, ok: ok, score: dScore + tScore, md: da.md.lord, ad: da.ad.lord, pd: da.pd && da.pd.lord, jup: jup, sat: sat, jupM: jupM, s: s };
    });
    var wins = [], cur = null;
    days.forEach(function (d) {
      if (d.ok && cur && (cur.days[0].md !== d.md || cur.days[0].ad !== d.ad)) { wins.push(cur); cur = null; }
      if (d.ok) {
        if (!cur) cur = { start: d.date, end: d.date, peak: d.score, days: [d] };
        else { cur.end = d.date; cur.peak = Math.max(cur.peak, d.score); cur.days.push(d); }
      } else if (cur) { wins.push(cur); cur = null; }
    });
    if (cur) wins.push(cur);
    wins = wins.filter(function (w) { return w.days.length >= 10; });
    wins.forEach(function (w) {
      var mid = w.days[Math.floor(w.days.length / 2)];
      var r = [];
      var mdL = lk(mid.md), adL = lk(mid.ad);
      r.push(mid.md + '–' + mid.ad + ' dasha: ' + (adL.length ? mid.ad + ' ' + adL.join(', ') : '') + (mdL.length ? (adL.length ? '; ' : '') + mid.md + ' ' + mdL.join(', ') : '') + '.');
      if (mid.jup) r.push('Jupiter in ' + SIGNS[mid.s.Jupiter] + ' reaches your ' + ordinal(H) + ' house or its lord.');
      if (mid.sat) r.push('Saturn in ' + SIGNS[mid.s.Saturn] + ' reaches your ' + ordinal(H) + ' house or its lord.');
      if (mid.jup && mid.sat) r.push('Double transit of Jupiter and Saturn is active.');
      if (mid.jupM && !mid.jup) r.push('Jupiter supports the ' + ordinal(H) + ' house counted from your Moon.');
      w.reasons = r;
      w.strength = w.peak >= 5 ? 'Strong' : w.peak >= 4 ? 'Good' : 'Moderate';
      w.dasha = mid.md + '–' + mid.ad;
      delete w.days;
    });
    return wins;
  }

  // Health: sensitive periods (risk), not "windows".
  function healthRisk(chart, dasha, series) {
    var risky = {};
    PLANETS.forEach(function (p) {
      var pl = chart.planets[p];
      var hs = (p === 'Rahu' || p === 'Ketu') ? [pl.house] : uniq([pl.house].concat(pl.owns));
      risky[p] = hs.filter(function (h) { return h === 6 || h === 8; }).length > 0 && hs.indexOf(1) < 0;
    });
    var out = [], cur = null;
    series.forEach(function (s) {
      var da = dashaAt(dasha, s.date); if (!da) return;
      var satM = houseFrom(chart.moonSign, s.Saturn);
      var tr = satM === 8 || satM === 1 || s.Saturn === chart.lagna.sign;
      var dr = risky[da.ad.lord] || (risky[da.md.lord] && da.pd && risky[da.pd.lord]);
      var on = tr && dr;
      if (on) { if (!cur) cur = { start: s.date, end: s.date, ad: da.md.lord + '–' + da.ad.lord, why: [] }; else cur.end = s.date; }
      else if (cur) { out.push(cur); cur = null; }
      if (on && !cur.why.length) {
        cur.why.push('Dasha of ' + da.ad.lord + ', which is tied to your 6th/8th house (illness, chronic matters).');
        cur.why.push('Saturn in ' + SIGNS[s.Saturn] + (satM === 8 ? ' is 8th from your Moon (Ashtama Shani).' : satM === 1 ? ' is over your Moon (Sade Sati peak).' : ' is over your ascendant.'));
      }
    });
    if (cur) out.push(cur);
    return out.filter(function (w) { return (w.end - w.start) / 86400000 >= 10; });
  }

  // ───────────────────────── remedies ─────────────────────────
  var REMEDY = {
    Sun: { day: 'Sunday', mantra: 'Om Hraam Hreem Hraum Sah Suryaya Namah', deity: 'Surya. Offer water (arghya) to the rising Sun; recite Aditya Hridayam', give: 'wheat, jaggery, copper vessel', stone: 'Ruby (Manik) in gold, ring finger', conduct: 'Respect father and seniors; keep early hours.' },
    Moon: { day: 'Monday', mantra: 'Om Shraam Shreem Shraum Sah Chandraya Namah', deity: 'Shiva. Abhisheka with milk or water on Mondays', give: 'rice, milk, white cloth', stone: 'Pearl (Moti) in silver, little finger', conduct: 'Care for your mother; keep regular sleep; avoid late-night worry spirals.' },
    Mars: { day: 'Tuesday', mantra: 'Om Kraam Kreem Kraum Sah Bhaumaya Namah', deity: 'Hanuman. Hanuman Chalisa on Tuesdays; Subrahmanya worship', give: 'red lentils (masoor), jaggery, red cloth', stone: 'Red Coral (Moonga) in gold or copper, ring finger', conduct: 'Control anger; avoid rash driving; help siblings.' },
    Mercury: { day: 'Wednesday', mantra: 'Om Braam Breem Braum Sah Budhaya Namah', deity: 'Vishnu. Vishnu Sahasranama on Wednesdays', give: 'green moong, green cloth; feed cows green grass', stone: 'Emerald (Panna) in gold, little finger', conduct: 'Keep commitments in writing; speak carefully; support students.' },
    Jupiter: { day: 'Thursday', mantra: 'Om Graam Greem Graum Sah Gurave Namah', deity: 'Dakshinamurthy or Guru. Visit a temple on Thursdays', give: 'turmeric, chana dal, yellow cloth, books', stone: 'Yellow Sapphire (Pukhraj) in gold, index finger', conduct: 'Respect teachers and elders; keep your word.' },
    Venus: { day: 'Friday', mantra: 'Om Draam Dreem Draum Sah Shukraya Namah', deity: 'Mahalakshmi. Lakshmi worship on Fridays', give: 'rice, sugar, white clothes, perfume', stone: 'Diamond or White Sapphire in silver/platinum, middle or ring finger', conduct: 'Respect your spouse and women in the family; keep surroundings clean and beautiful.' },
    Saturn: { day: 'Saturday', mantra: 'Om Praam Preem Praum Sah Shanaischaraya Namah', deity: 'Hanuman and Shani. Hanuman Chalisa on Saturdays; light a sesame-oil lamp', give: 'sesame oil, black sesame, urad dal, blankets; serve labourers and the elderly', stone: 'Blue Sapphire (Neelam) in silver, middle finger, only after a 3–7 day trial', conduct: 'Be punctual and honest; never mistreat workers or servants; finish pending duties.' },
    Rahu: { day: 'Saturday', mantra: 'Om Bhraam Bhreem Bhraum Sah Rahave Namah', deity: 'Durga. Durga Saptashati or Durga Chalisa', give: 'blanket, coconut, mustard oil, to the needy', stone: 'Hessonite (Gomed): only on an expert\'s advice after full chart review', conduct: 'Avoid intoxicants, shortcuts and deception; keep routines simple.' },
    Ketu: { day: 'Tuesday', mantra: 'Om Sraam Sreem Sraum Sah Ketave Namah', deity: 'Ganesha. Ganapati worship; Ganesha Atharvashirsha', give: 'blanket to the needy; feed street dogs', stone: 'Cat\'s Eye (Lehsunia): only on an expert\'s advice after full chart review', conduct: 'Meditation and quiet time; do not leave tasks half-finished.' }
  };
  var ENEMY_STONES = [['Sun', 'Saturn'], ['Moon', 'Saturn'], ['Mars', 'Saturn'], ['Sun', 'Venus'], ['Moon', 'Rahu'], ['Jupiter', 'Venus'], ['Mars', 'Mercury']];

  function gemstoneAdvice(chart) {
    var P = chart.planets, ok = [], avoid = [];
    PLANETS.forEach(function (p) {
      if (p === 'Rahu' || p === 'Ketu') { avoid.push({ planet: p, why: 'shadow planets: stones only after a full expert review' }); return; }
      var pl = P[p], f = pl.func.nature;
      var benefic = /benefic|yogakaraka/.test(f) && f.indexOf('malefic') < 0;
      var weakPlace = [6, 8, 12].indexOf(pl.house) >= 0;
      if (benefic && !weakPlace && pl.dignity !== 'debilitated' && pl.d9.dignity === 'debilitated') avoid.push({ planet: p, why: p + ' is benefic for you but debilitated in the Navamsa (D9), so a stone is not advised. Use mantra and charity.' });
      else if (benefic && !weakPlace && pl.dignity !== 'debilitated') ok.push({ planet: p, stone: REMEDY[p].stone, why: p + ' is ' + f + ' for ' + chart.lagna.signName + ' ascendant and well placed in your ' + ordinal(pl.house) + '.' });
      else if (!benefic) avoid.push({ planet: p, why: p + ' is ' + f + ' for your ascendant (rules ' + pl.owns.map(ordinal).join(' & ') + '). Strengthening it with a stone strengthens those problems too.' });
      else avoid.push({ planet: p, why: p + ' is benefic for you but ' + (weakPlace ? 'placed in the ' + ordinal(pl.house) : 'debilitated') + '. Use mantra and charity rather than a stone.' });
    });
    ok.sort(function (a, b) { return (P[b.planet].func.score + (P[b.planet].vargottama ? 0.5 : 0)) - (P[a.planet].func.score + (P[a.planet].vargottama ? 0.5 : 0)); });
    return { recommended: ok.slice(0, 2), avoid: avoid, never: 'Never wear stones of enemy planets together (e.g. Ruby with Blue Sapphire, Pearl with Blue Sapphire, Coral with Blue Sapphire or Emerald, Yellow Sapphire with Diamond).' };
  }

  function remediesFor(chart, focusPlanets, reasons) {
    var seen = {}, list = [];
    focusPlanets.forEach(function (p, i) {
      if (!p || seen[p]) return; seen[p] = 1;
      var R = REMEDY[p];
      list.push({ planet: p, reason: reasons[i], day: R.day, mantra: R.mantra + ' (108 times on ' + R.day + 's, or daily)', worship: R.deity, charity: 'Donate ' + R.give + ' on ' + R.day + 's', conduct: R.conduct });
    });
    return list;
  }

  // ───────────────────────── question answering ─────────────────────────
  // Whole-word (prefix) patterns, so "career" never matches "car" and "health issues" never matches progeny.
  var KEYWORDS = {
    marriage: ['marri', 'marry', 'wedding', 'spouse', 'wife', 'husband', 'bride', 'groom', 'alliance', 'maduve', 'madhuve', 'shaadi', 'shadi', 'vivah', 'kalyan', 'love', 'relationship', 'partner', 'divorce', 'separat', 'engage', 'matchmak', 'horoscope match'],
    career: ['job', 'jobs', 'career', 'work', 'promotion', 'office', 'boss', 'salary', 'employ', 'unemploy', 'naukri', 'kelasa', 'business', 'profession', 'interview', 'fired', 'layoff', 'laid off', 'resign', 'company'],
    abroad: ['abroad', 'foreign', 'overseas', 'visa', 'usa\\b', 'america', 'uk\\b', 'london', 'canada', 'australia', 'dubai', 'gulf', 'europe', 'germany', 'singapore', 'settle', 'videsh', 'green card', 'immigra', 'relocat', 'onsite', 'outside india', 'other country'],
    health: ['health', 'ill\\b', 'illness', 'sick', 'disease', 'hospital', 'surgery', 'pain', 'fever', 'cancer', 'diabet', 'sugar\\b', 'bp\\b', 'blood pressure', 'heart', 'aarogya', 'operation', 'recover', 'medical', 'injur', 'accident'],
    wealth: ['money', 'wealth', 'financ', 'loan', 'debt', 'income', 'rich\\b', 'profit', 'invest', 'stock', 'share market', 'gold\\b', 'saving', 'dhana', 'paisa', 'lottery'],
    education: ['study', 'studies', 'education', 'exam', 'college', 'school', 'degree', 'admission', 'marks', 'course', 'masters', 'phd', 'neet', 'jee\\b', 'upsc'],
    children: ['child', 'children', 'baby', 'pregnan', 'conceiv', 'progeny', 'ivf', 'santana', 'kids?\\b', 'no issue'],
    property: ['house\\b', 'home\\b', 'property', 'land\\b', 'flat\\b', 'apartment', 'site\\b', 'plot\\b', 'vehicle', 'car\\b', 'bike', 'construct', 'real estate', 'mane\\b'],
    litigation: ['court', 'case\\b', 'legal', 'litigation', 'police', 'dispute', 'enem', 'lawsuit', 'opponent'],
    mind: ['mind', 'confus', 'decision', 'decide', 'stress', 'anxi', 'depress', 'peace', 'fear', 'worr', 'mental', 'sleep', 'tension', 'dilemma', 'indecis', 'two minds', 'doubt']
  };
  var HARDSHIP_WORDS = ['hardship', 'problem', 'trouble', 'bad time', 'suffer', 'struggl', 'obstacle', 'why me', 'bad luck', 'nothing works', 'failure', 'difficult', 'jathaka', 'jataka', 'kundli', 'horoscope', 'dosha', 'currently', 'current period', 'what is going on'];
  function hit(s, w) { return new RegExp('\\b' + w).test(s); }

  function classify(q) {
    var s = ' ' + (q || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ') + ' ';
    var topics = Object.keys(KEYWORDS).filter(function (k) { return KEYWORDS[k].some(function (w) { return hit(s, w); }); });
    var hardship = HARDSHIP_WORDS.some(function (w) { return hit(s, w); });
    var types = [];
    if (/\b(when|kab|yavaga|yaavaga|how long|which year|which month|by when|till when|days|deadline|date|how soon)\b/.test(s)) types.push('when');
    if (/\b(why|reason|karan|yake|yaake|cause|what is wrong|what went wrong)\b/.test(s)) types.push('why');
    if (/\b(can|will|is there|chance|chances|possible|should|any|yoga|get|true)\b/.test(s)) types.push('can');
    if (!types.length) types.push('can', 'when');
    if (!topics.length) hardship = true;
    return { topics: topics, hardship: hardship, types: uniq(types) };
  }

  function analyze(input, opts) {
    opts = opts || {};
    var chart = buildChart(input);
    var dasha = vimshottari(chart);
    var now = opts.date || new Date();
    var horizon = opts.horizonDays || 1461;
    var cur = dashaAt(dasha, now);
    var tr = transitReport(chart, now);
    var series = precompute(now, horizon);
    var md = cur.md.lord, ad = cur.ad.lord;
    var period = {
      md: cur.md, ad: cur.ad, pd: cur.pd,
      mdTheme: periodThemes(chart, md), adTheme: periodThemes(chart, ad), pdTheme: cur.pd ? periodThemes(chart, cur.pd.lord) : null,
      relation: mdAdRelation(chart, md, ad)
    };
    var yogas = detectYogas(chart);
    var gem = gemstoneAdvice(chart);
    var upcoming = [].concat(ingresses('Jupiter', now, addDays(now, 1100)), ingresses('Saturn', now, addDays(now, 1100)), ingresses('Rahu', now, addDays(now, 1100)))
      .sort(function (a, b) { return a.date - b.date; });

    function topicReport(key) {
      var T = TOPICS[key];
      var pr = promise(chart, key);
      var lkMd = links(chart, md, T.houses, T.primary, T.karakas(input.gender));
      var lkAd = links(chart, ad, T.houses, T.primary, T.karakas(input.gender));
      var wins = key === 'health' ? [] : windowsFor(chart, dasha, key, series);
      var risk = key === 'health' ? healthRisk(chart, dasha, series) : [];
      var active = wins.filter(function (w) { return w.start <= addDays(now, 1) && w.end >= now; })[0] || null;
      var next = wins.filter(function (w) { return w.start > now; })[0] || null;
      var dayMs = 86400000;
      var verdict;
      if (key === 'health') {
        var activeRisk = risk.filter(function (w) { return w.start <= addDays(now, 1) && w.end >= now; })[0];
        var hardFlags = tr.flags.filter(function (f) { return f.severity >= 2; });
        if (activeRisk) verdict = 'You are in a health-sensitive period now, until ' + fmtDate(activeRisk.end) + '. ' + activeRisk.why.join(' ');
        else if (hardFlags.length && (period.adTheme.hard || period.adTheme.mixed)) verdict = 'Health needs attention in this period. The running ' + md + '–' + ad + ' dasha touches difficult houses and ' + hardFlags[0].text;
        else if (hardFlags.length) verdict = 'There is transit pressure (' + hardFlags[0].text.split('.')[0] + '), but the running dasha does not point to serious illness. Expect fatigue and stress rather than a major illness.';
        else verdict = 'No major health affliction is active in the dasha or transits right now.';
        var nextRisk = risk.filter(function (w) { return w.start > now; })[0];
        if (nextRisk) verdict += ' The next sensitive stretch to be careful in is ' + fmtDate(nextRisk.start) + ' to ' + fmtDate(nextRisk.end) + '.';
      } else if (active) {
        var left = Math.round((active.end - now) / dayMs);
        verdict = 'The planets support this now. You are inside a favourable period that runs until ' + fmtDate(active.end) + ' (' + left + ' days from today).';
        if (next) verdict += ' After that, the next supportive period is ' + fmtDate(next.start) + ' to ' + fmtDate(next.end) + '.';
      } else if (next) {
        var wait = Math.round((next.start - now) / dayMs);
        verdict = 'Not in the current period. The next period where dasha and transits both support this is ' + fmtDate(next.start) + ' to ' + fmtDate(next.end) + ' (starts in ' + wait + ' days).';
      } else {
        verdict = 'No period in the next ' + Math.round(horizon / 365) + ' years has both dasha and transit support. The birth chart promise and the next dasha change (' + fmtDate(cur.ad.end) + ') decide when this opens.';
      }
      if (key === 'health') {
        if (pr.level === 'Challenged' || pr.level === 'Mixed') verdict += ' The birth chart shows a sensitive constitution (see below), so preventive care and regular check-ups matter more for you than for most people.';
      } else if (pr.level === 'Challenged') verdict += ' The birth chart shows real delay factors for this matter (see below), so effort and remedies matter more than timing alone.';
      else if (pr.level === 'Mixed' && pr.negatives.length) verdict += ' The birth-chart promise is mixed: ' + pr.negatives[0] + ' Timing opens the door, but it needs effort.';

      // Remedies: weak primary lord / karaka, running period lords if difficult, transit flags.
      var foc = [], why = [];
      var verb = function (p) { return chart.planets[p].func.score < 0 || p === 'Rahu' || p === 'Ketu' ? 'Pacify' : 'Strengthen'; };
      var pl = chart.houseLord(T.primary);
      if (DIGNITY_SCORE[chart.planets[pl].dignity] < 0 || [6, 8, 12].indexOf(chart.planets[pl].house) >= 0) { foc.push(pl); why.push(verb(pl) + ' ' + pl + ', lord of your ' + ordinal(T.primary) + ' house, which is weak in your chart.'); }
      T.karakas(input.gender).forEach(function (k) { if (DIGNITY_SCORE[chart.planets[k].dignity] < 0 || [6, 8, 12].indexOf(chart.planets[k].house) >= 0) { foc.push(k); why.push(verb(k) + ' ' + k + ', the significator of ' + T.label.toLowerCase() + (verb(k) === 'Pacify' ? ' (a functional malefic for your ascendant, so it is calmed, not strengthened)' : '') + '.'); } });
      if (period.adTheme.hard || period.adTheme.mixed || chart.planets[ad].func.score < 0) { foc.push(ad); why.push('Pacify ' + ad + ', the running sub-period lord, which is linked to difficult houses for you.'); }
      if (tr.flags.some(function (f) { return ['sadesati', 'ashtama', 'ardhashtama', 'kantaka'].indexOf(f.key) >= 0; })) { foc.push('Saturn'); why.push('Pacify Saturn for the current Saturn transit over your Moon.'); }
      if (key === 'marriage') { var m = manglik(chart); if (m.present && !m.cancelled) { foc.push('Mars'); why.push('Pacify Mars for Manglik dosha.'); } }
      if (key === 'abroad' && (period.adTheme.hard || ad === 'Rahu' || md === 'Rahu')) { foc.push('Rahu'); why.push('Rahu governs foreign moves; steady it so the move is clear-headed.'); }
      if (key === 'mind') { foc.push('Moon'); why.push('Steady the Moon, the mind.'); }
      if (!foc.length) { foc.push(pl); why.push(verb(pl) + ' ' + pl + ', lord of your ' + ordinal(T.primary) + ' house, during the coming period.'); }

      return {
        key: key, label: T.label, promise: pr, verdict: verdict, windows: wins.slice(0, 6), active: active, next: next, risk: risk.slice(0, 4),
        now: { md: md, ad: ad, mdLinks: lkMd, adLinks: lkAd },
        remedies: remediesFor(chart, foc, why)
      };
    }

    function whyNow(topicKeys) {
      var reasons = [];
      tr.flags.filter(function (f) { return f.severity > 0; }).sort(function (a, b) { return b.severity - a.severity; }).forEach(function (f) { reasons.push(f.text); });
      if (period.adTheme.hard) reasons.push('The running sub-period of ' + ad + ' activates only difficult houses for you (' + period.adTheme.houses.map(ordinal).join(', ') + '): ' + period.adTheme.themes.join('; ') + '.');
      else if (period.adTheme.mixed) reasons.push('The running sub-period of ' + ad + ' mixes difficult and supportive houses (' + period.adTheme.houses.map(ordinal).join(', ') + ').');
      if (period.relation && /shadashtaka|expenses/.test(period.relation)) reasons.push(period.relation);
      if (period.mdTheme.hard) reasons.push('The major period of ' + md + ' itself is tied to difficult houses (' + period.mdTheme.houses.map(ordinal).join(', ') + ').');
      topicKeys.forEach(function (k) {
        if (k === 'career') {
          var t10 = signAt(chart.lagna.sign, 10);
          ['Saturn', 'Rahu', 'Ketu'].forEach(function (p) { if (tr.planets[p].sign === t10 || (p === 'Saturn' && aspectsSign('Saturn', tr.planets.Saturn.sign, t10))) reasons.push(p + ' is transiting or aspecting your 10th house of career until ' + fmtDate(tr.planets[p].until) + '.'); });
          if (period.adTheme.houses.indexOf(12) >= 0 || period.adTheme.houses.indexOf(8) >= 0) reasons.push('The sub-period lord ' + ad + ' is linked to the 8th/12th houses, the classic signature for loss of position.');
        }
        if (k === 'abroad' || k === 'mind') {
          var a4 = period.adTheme.houses.indexOf(4) >= 0 || period.mdTheme.houses.indexOf(4) >= 0;
          var a12 = period.adTheme.houses.indexOf(12) >= 0 || period.mdTheme.houses.indexOf(12) >= 0 || period.adTheme.houses.indexOf(9) >= 0;
          if (a4 && a12) reasons.push('Your running dasha activates both your 4th house (home, roots) and your 9th/12th houses (foreign lands). That is a literal tug-of-war in the chart, and it explains being of two minds.');
          if (tr.planets.Rahu.sign === chart.moonSign || tr.planets.Ketu.sign === chart.moonSign) reasons.push('Rahu/Ketu are passing over your Moon: doubt and second-guessing are heightened until ' + fmtDate(tr.planets.Rahu.until) + '.');
          if (['Moon', 'Mercury', 'Rahu', 'Ketu'].indexOf(ad) >= 0) reasons.push('The sub-period lord ' + ad + ' governs the mind or creates doubt, which feeds indecision.');
        }
      });
      if (!reasons.length) reasons.push('No major affliction is active in your dasha or transits. Present difficulties look situational rather than a heavy planetary period.');
      var ends = [];
      tr.flags.filter(function (f) { return f.severity >= 2; }).forEach(function (f) { if (f.key === 'sadesati') ends.push('Sade Sati ends ' + fmtDate(tr.sadeSati.to)); else if (f.key === 'ashtama' || f.key === 'ardhashtama' || f.key === 'kantaka') ends.push('This Saturn transit ends ' + fmtDate(tr.planets.Saturn.until)); });
      if (period.adTheme.hard || period.adTheme.mixed) ends.push('The ' + ad + ' sub-period ends ' + fmtDate(cur.ad.end) + ', and ' + DASHA_ORDER[(DASHA_ORDER.indexOf(ad) + 1) % 9] + ' takes over');
      return { reasons: uniq(reasons), relief: uniq(ends) };
    }

    function answer(question) {
      var c = classify(question);
      var keys = c.topics.length ? c.topics : [];
      if (c.hardship && !keys.length) keys = ['career', 'health', 'mind'];
      var reps = keys.map(topicReport);
      var why = (c.types.indexOf('why') >= 0 || c.hardship) ? whyNow(keys) : null;
      return { question: question, classified: c, topics: reps, why: why };
    }

    return {
      chart: chart, dasha: dasha, current: cur, period: period, transits: tr, yogas: yogas, gemstones: gem,
      upcoming: upcoming, topicReport: topicReport, whyNow: whyNow, answer: answer, now: now
    };
  }

  function detectYogas(chart) {
    var P = chart.planets, Y = [], D = [], lag = chart.lagna.sign;
    var kendra = [1, 4, 7, 10];
    [['Mars', 'Ruchaka'], ['Mercury', 'Bhadra'], ['Jupiter', 'Hamsa'], ['Venus', 'Malavya'], ['Saturn', 'Shasha']].forEach(function (x) {
      var p = P[x[0]];
      if (kendra.indexOf(p.house) >= 0 && (p.dignity === 'own' || p.dignity === 'exalted')) Y.push(x[1] + ' yoga (Pancha Mahapurusha): ' + x[0] + ' ' + p.dignity + ' in your ' + ordinal(p.house) + '.');
    });
    var jm = houseFrom(chart.moonSign, P.Jupiter.sign);
    if (kendra.indexOf(jm) >= 0) Y.push('Gaja Kesari yoga: Jupiter is ' + ordinal(jm) + ' from the Moon.');
    if (P.Sun.sign === P.Mercury.sign) Y.push('Budha-Aditya yoga: Sun and Mercury together in ' + P.Sun.signName + '.');
    if (P.Moon.sign === P.Mars.sign) Y.push('Chandra-Mangala yoga: Moon and Mars together, earning through enterprise.');
    var vr = [6, 8, 12].filter(function (h) { var l = chart.houseLord(h); return [6, 8, 12].indexOf(P[l].house) >= 0; });
    if (vr.length) Y.push('Vipareeta Raja yoga: lord of the ' + vr.map(ordinal).join(' & ') + ' sits in a dusthana, which turns adversity into gain.');
    var v = houseFrom(chart.moonSign, P.Jupiter.sign), ve = houseFrom(chart.moonSign, P.Venus.sign);
    if ([3, 6, 10, 11].indexOf(v) >= 0 && [3, 6, 10, 11].indexOf(ve) >= 0) Y.push('Vasumati yoga: Jupiter and Venus in growth houses from the Moon, self-earned wealth.');
    // doshas
    var m = manglik(chart); if (m.present) D.push(m.text);
    var r = P.Rahu.lon, inside = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].map(function (p) { return norm(P[p].lon - r); });
    if (inside.every(function (x) { return x < 180; }) || inside.every(function (x) { return x > 180; })) D.push('Kala Sarpa: all seven planets lie on one side of the Rahu–Ketu axis. Results come in surges after long waits.');
    if (P.Jupiter.sign === P.Rahu.sign || P.Jupiter.sign === P.Ketu.sign) D.push('Guru Chandala: Jupiter with ' + (P.Jupiter.sign === P.Rahu.sign ? 'Rahu' : 'Ketu') + '. Unconventional thinking; guard against misguided advice.');
    ['Sun', 'Moon'].forEach(function (p) { if (P[p].sign === P.Rahu.sign || P[p].sign === P.Ketu.sign) D.push('Grahan yoga: ' + p + ' with ' + (P[p].sign === P.Rahu.sign ? 'Rahu' : 'Ketu') + '.'); });
    if (P.Moon.sign === P.Saturn.sign) D.push('Vish yoga: Moon with Saturn, prone to low moods and pessimism.');
    if (P.Saturn.sign === P.Rahu.sign) D.push('Shrapit yoga: Saturn with Rahu, delays from past karma.');
    var ms = chart.moonSign, around = ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].filter(function (p) { var h = houseFrom(ms, P[p].sign); return h === 2 || h === 12 || h === 1; });
    var kendraFromMoon = ['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].some(function (p) { return kendra.indexOf(houseFrom(ms, P[p].sign)) >= 0 && P[p].sign !== ms; });
    if (!around.length && !kendraFromMoon) D.push('Kemadruma: no planets beside or in a kendra from the Moon. Periods of feeling unsupported.');
    if (chart.gandmool) D.push('Gandmool nakshatra (' + chart.nakshatra + '): a Gandmool Shanti puja is traditionally done.');
    return { yogas: Y, doshas: D };
  }

  return {
    // data
    SIGNS: SIGNS, SIGNS_SKT: SIGNS_SKT, SIGN_LORD: SIGN_LORD, PLANETS: PLANETS, NAKS: NAKS, TOPICS: TOPICS,
    DASHA_ORDER: DASHA_ORDER, DASHA_YEARS: DASHA_YEARS, HOUSE_MEANING: HOUSE_MEANING, REMEDY: REMEDY,
    // core
    buildChart: buildChart, d9Sign: d9Sign, d10Sign: d10Sign, vimshottari: vimshottari, dashaAt: dashaAt, subPeriods: subPeriods,
    transitReport: transitReport, ingresses: ingresses, signSpan: signSpan, analyze: analyze, classify: classify,
    siderealLongitudes: siderealLongitudes, ascendant: ascendant, ayanamsa: ayanamsa, lonOn: lonOn,
    makeTime: makeTime, indiaOffset: indiaOffset, dignity: dignity, signOf: signOf, houseFrom: houseFrom,
    signAt: signAt, fmtDeg: fmtDeg, fmtDate: fmtDate, ymd: ymd, ordinal: ordinal, aspectsSign: aspectsSign, aspectsSigns: aspectsSigns,
    _setAyanCorr: function (x) { AYAN_CORR = x; }
  };
}));
