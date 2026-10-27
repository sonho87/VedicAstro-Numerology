/*
 * Guru Ji AstroPalm — Batraa-method numerology rules
 * ---------------------------------------------------
 * The one numerology method used across the site: King/Queen numbers,
 * the Lo Shu birth grid, lucky / unlucky / neutral numbers, grid
 * multiples, and mobile-number analysis (2-digit pairing, triples,
 * recommended mobile total).
 *
 * The rule tables follow The Batraa Numerology course material supplied
 * by the site owner. All descriptive wording below is our own.
 *
 * Works in the browser (window.Batraa) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Batraa = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Number compatibility: lucky, enemy, hard-core enemy (both unlucky), neutral = everything else.
  var LUCKY = { 1: [9, 2, 5, 3, 1], 2: [1, 5, 3], 3: [1, 5, 2, 3], 4: [7, 6, 1], 5: [1, 2, 3, 6, 5], 6: [7, 5, 4, 6], 7: [4, 6, 5, 1], 8: [5, 6, 3], 9: [1, 5, 3] };
  var ENEMY = { 1: [], 2: [9, 4], 3: [], 4: [9, 2, 4, 8], 5: [], 6: [3], 7: [], 8: [1, 2, 4, 8], 9: [4, 2] };
  var HARD = { 1: [8], 2: [8], 3: [6], 4: [], 5: [], 6: [3], 7: [], 8: [1, 2], 9: [] };

  // Universal classes.
  var BENEFIC = [1, 3, 5, 6], NEUTRAL_U = [2, 9], MALEFIC_U = [4, 7, 8];

  // A number appearing 2 or 3+ times in the grid.
  var MULTIPLE = {
    1: ['benefic', 'neutral'], 2: ['neutral', 'neutral, with mood swings'], 3: ['benefic', 'neutral'],
    4: ['malefic', 'malefic'], 5: ['benefic', 'neutral'], 6: ['benefic', 'neutral'],
    7: ['neutral', 'malefic'], 8: ['neutral', 'malefic'], 9: ['neutral', 'neutral'], 0: ['neutral', 'malefic']
  };
  // What a heavily repeated digit (3+ times) tends to bring.
  var REPEAT_TRAIT = {
    1: 'strong ego and a fast, forceful way of speaking',
    2: 'emotional swings, low moods and blood-pressure tendencies',
    3: 'a hunger for learning, deep thinking, trusting people too easily, valuing skill over money',
    4: 'delays, struggle, headaches and joint pain',
    5: 'laziness, though communication and money can grow',
    6: 'love of luxury, travel, glamour and a good flow of money',
    7: 'mood swings, inner restlessness, overthinking and a spiritual pull',
    8: 'delays, obstacles, disturbance and legal tangles',
    9: 'debt, anger and blood-related problems'
  };

  // Mobile two-digit pairs (both orders unless noted). 78/87 is rated neutral by the site owner's choice.
  function expand(list) { var o = []; list.forEach(function (p) { o.push(p); if (p[0] !== p[1]) o.push(p[1] + p[0]); }); return o; }
  var PAIR_GOOD = ['12', '13', '31', '15', '51', '25', '52', '29', '92', '37', '73', '38', '83', '47', '74', '57', '75', '69', '96'];
  var PAIR_NEUTRAL = ['21', '17', '71', '19', '91', '24', '42', '35', '53', '36', '63', '39', '93', '49', '94', '56', '65', '58', '85', '59', '95', '79', '97', '23', '32', '98', '89', '78', '87'];
  var PAIR_MALEFIC = expand(['14', '16', '18', '26', '27', '28', '34', '45', '46', '48', '67', '68']);
  var PAIR_NOTE = {
    '14': 'health of the person', '16': 'spouse’s health', '18': 'spouse’s health', '67': 'spouse’s health',
    '26': 'sugar-related illness or fertility concerns', '27': 'joint pain or urinary trouble',
    '28': 'money going on medicines and hospitals', '34': 'tremors or paralysis affecting someone in the family',
    '45': 'repeated visits to courts or hospitals; a life of restrictions', '46': 'urinary-tract infections',
    '48': 'blood disorders', '68': 'eye problems'
  };
  var PAIR_11 = 'communication, originality, innovation, putting ideas across, confidence';
  var TRIPLE_NOTE = {
    '000': 'money crunches and setbacks that pull things into reverse',
    '777': 'mood swings, inner disturbance, overthinking and serious relationship strain'
  };

  // Preferred two-digit mobile totals for each target number, best first.
  var TOTAL_COMPOUNDS = { 1: [46, 64, 37, 55, 28], 6: [42, 24, 33, 60, 51], 5: [41, 32, 50, 59, 68], 3: [66, 39, 30, 57] };

  // What a mobile total brings into daily life (our wording).
  var TOTAL_TRAIT = {
    1: 'independence, courage and leadership; suits self-starters and people who want visibility',
    2: 'harmony, tact and sensitivity; good for hospitality, care-giving and dealing with people',
    3: 'expression, sociability, travel and new opportunities',
    4: 'discipline and attention to detail, but frequent sudden changes of plan',
    5: 'popularity, a busy phone, friends and overall balance (Mercury, communication)',
    6: 'love, romance, glamour and prosperity (Venus)',
    7: 'research, occult study and solitude; suits healing professions',
    8: 'money, power and karmic responsibility',
    9: 'tough, technical, medical or uniformed work; a phase of transformation'
  };
  // What each benefic number strengthens, used to choose between options.
  var CONCEPT = {
    1: 'position, status, name and fame, government work, immunity',
    3: 'knowledge, education, occult study, family life',
    5: 'business growth, communication, storytelling, balance',
    6: 'luxury, foreign trips, relationships, money, business'
  };

  // ───────────────────────── core ─────────────────────────
  function reduce(n) { n = Math.abs(parseInt(n, 10) || 0); while (n > 9) n = String(n).split('').reduce(function (a, b) { return a + +b; }, 0); return n; }
  function digitSum(s) { return String(s).replace(/\D/g, '').split('').reduce(function (a, b) { return a + +b; }, 0); }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  function king(day) { return reduce(day); }
  function queen(day, month, year) { return reduce(digitSum('' + day + month + year)); }
  // Born on 1–9, 10, 20 or 30: the date digit already is the King, so it is placed only once.
  function kingPlacedOnce(day) { day = parseInt(day, 10); return day <= 9 || day === 10 || day === 20 || day === 30; }

  function grid(day, month, year) {
    var dd = String(parseInt(day, 10)).padStart(2, '0'), mm = String(parseInt(month, 10)).padStart(2, '0');
    var digits = (dd + mm + year).split('').map(Number).filter(function (d) { return d > 0; });
    var K = king(day), Q = queen(dd, mm, year);
    var all = digits.slice();
    if (!kingPlacedOnce(day)) all.push(K);
    all.push(Q);
    var counts = {}; ALL.forEach(function (i) { counts[i] = 0; });
    all.forEach(function (d) { if (d >= 1 && d <= 9) counts[d]++; });
    return {
      K: K, Q: Q, digits: digits, all: all, counts: counts, kingOnce: kingPlacedOnce(day),
      present: ALL.filter(function (i) { return counts[i] > 0; }),
      missing: ALL.filter(function (i) { return counts[i] === 0; })
    };
  }

  function unluckyOf(n) { return uniq((ENEMY[n] || []).concat(HARD[n] || [])); }
  // Relationship of number b as seen from number a.
  function relation(a, b) {
    if (!a || !b) return 'Neutral';
    if (unluckyOf(a).indexOf(b) >= 0) return 'Unlucky';
    if ((LUCKY[a] || []).indexOf(b) >= 0) return 'Lucky';
    return 'Neutral';
  }

  function luckySet(K, Q) {
    var bad = unluckySet(K, Q);
    return (LUCKY[K] || []).filter(function (x) { return (LUCKY[Q] || []).indexOf(x) >= 0 && bad.indexOf(x) < 0; }).sort();
  }
  function unluckySet(K, Q) { return uniq(unluckyOf(K).concat(unluckyOf(Q))).sort(); }

  function multiples(counts) {
    return ALL.filter(function (i) { return counts[i] >= 2; }).map(function (i) {
      var c = counts[i], rating = MULTIPLE[i][c >= 3 ? 1 : 0];
      return { number: i, count: c, rating: rating, trait: c >= 3 ? REPEAT_TRAIT[i] : null };
    });
  }

  /*
   * Recommended number (used for a mobile total, and as guidance for a name total):
   *  1. a benefic number missing from the grid, unless it is unlucky;
   *  2. otherwise a lucky benefic number;
   *  3. never a number that would then appear three times.
   */
  function recommend(counts, K, Q) {
    var bad = unluckySet(K, Q), lucky = luckySet(K, Q);
    var missingBenefic = BENEFIC.filter(function (n) { return !counts[n]; });
    var luckyBenefic = lucky.filter(function (n) { return BENEFIC.indexOf(n) >= 0; });
    var notTriple = function (n) { return (counts[n] || 0) < 2; };
    var picks = missingBenefic.filter(function (n) { return bad.indexOf(n) < 0 && notTriple(n); });
    var rule;
    if (picks.length) rule = 'A benefic number missing from your grid that is not unlucky for you.';
    else {
      picks = luckyBenefic.filter(notTriple);
      rule = missingBenefic.length ? 'Your missing benefic number is unlucky for you, so a lucky benefic number is used instead.' : 'All of 1, 3, 5 and 6 are already in your grid, so a lucky benefic number is used.';
    }
    var avoidTriple = ALL.filter(function (n) { return (counts[n] || 0) >= 2; });
    return {
      numbers: picks, rule: rule, missingBenefic: missingBenefic, luckyBenefic: luckyBenefic, avoidTriple: avoidTriple,
      compounds: picks.map(function (n) { return { number: n, compounds: TOTAL_COMPOUNDS[n] || [] }; })
    };
  }

  function person(day, month, year) {
    var g = grid(day, month, year), K = g.K, Q = g.Q;
    var lucky = luckySet(K, Q), unlucky = unluckySet(K, Q);
    var neutral = ALL.filter(function (n) { return lucky.indexOf(n) < 0 && unlucky.indexOf(n) < 0; });
    return {
      K: K, Q: Q, grid: g, lucky: lucky, unlucky: unlucky, neutral: neutral,
      missing: g.missing, missingBenefic: BENEFIC.filter(function (n) { return !g.counts[n]; }),
      luckyBenefic: lucky.filter(function (n) { return BENEFIC.indexOf(n) >= 0; }),
      multiples: multiples(g.counts), recommend: recommend(g.counts, K, Q),
      kqRelation: relation(K, Q)
    };
  }

  // ───────────────────────── mobile / vehicle numbers ─────────────────────────
  function pairClass(p) {
    if (PAIR_MALEFIC.indexOf(p) >= 0) return 'malefic';
    if (PAIR_GOOD.indexOf(p) >= 0) return 'good';
    if (PAIR_NEUTRAL.indexOf(p) >= 0) return 'neutral';
    if (p === '11') return 'good';
    return 'unrated';
  }
  function pairs(numStr) {
    var s = String(numStr).replace(/\D/g, '').replace(/0/g, ''), out = [], seen = {};
    for (var i = 0; i < s.length - 1; i++) {
      var p = s.slice(i, i + 2);
      if (seen[p]) continue; seen[p] = 1;
      var c = pairClass(p), key = p[0] < p[1] ? p : p[1] + p[0];
      out.push({ pair: p, cls: c, note: c === 'malefic' ? PAIR_NOTE[key] || null : p === '11' ? PAIR_11 : null });
    }
    return out;
  }
  function triples(numStr) {
    var s = String(numStr).replace(/\D/g, ''), out = [];
    '0123456789'.split('').forEach(function (d) {
      if (s.indexOf(d + d + d) >= 0) out.push({ seq: d + d + d, note: TRIPLE_NOTE[d + d + d] || (d === '0' ? null : 'heavy repetition of ' + d + ': ' + REPEAT_TRAIT[d]) });
    });
    return out;
  }

  function analyzeNumber(numStr, p) {
    var s = String(numStr).replace(/\D/g, '');
    var compound = digitSum(s), total = reduce(compound);
    var ps = pairs(s), tr = triples(s);
    var mal = ps.filter(function (x) { return x.cls === 'malefic'; });
    var good = ps.filter(function (x) { return x.cls === 'good'; });
    var rel = p ? (p.unlucky.indexOf(total) >= 0 ? 'unlucky' : p.lucky.indexOf(total) >= 0 ? 'lucky' : 'neutral') : null;
    var issues = [], positives = [];
    mal.forEach(function (x) { issues.push('Pair ' + x.pair + ' is malefic' + (x.note ? ' (' + x.note + ')' : '') + '.'); });
    tr.forEach(function (x) { if (x.seq === '000' || x.seq === '777') issues.push('Contains ' + x.seq + ': ' + x.note + '.'); });
    if (p) {
      if (rel === 'unlucky') issues.push('Total ' + compound + ' → ' + total + ' is one of your unlucky numbers.');
      if (rel === 'lucky') positives.push('Total ' + compound + ' → ' + total + ' is one of your lucky numbers.');
      if (p.recommend.numbers.indexOf(total) >= 0) positives.push('Total ' + total + ' is your recommended mobile total.');
      if ((p.grid.counts[total] || 0) >= 2) issues.push('Total ' + total + ' already appears ' + p.grid.counts[total] + ' times in your grid; adding it makes it excessive.');
      var pref = TOTAL_COMPOUNDS[total] || [];
      if (pref.indexOf(compound) >= 0) positives.push('Compound ' + compound + ' is one of the preferred compounds for ' + total + '.');
    }
    if (good.length) positives.push(good.length + ' good pair' + (good.length > 1 ? 's' : '') + ': ' + good.map(function (x) { return x.pair; }).join(', ') + '.');
    var excessive = p && (p.grid.counts[total] || 0) >= 2;
    var badTriple = tr.some(function (x) { return x.seq === '000' || x.seq === '777'; });
    var verdict;
    if (mal.length || rel === 'unlucky' || excessive || badTriple) verdict = 'Change recommended';
    else if (tr.length) verdict = 'Acceptable';
    else if (p && p.recommend.numbers.indexOf(total) >= 0) verdict = 'Excellent';
    else if (rel === 'lucky') verdict = 'Good';
    else verdict = 'Acceptable';
    return { number: s, compound: compound, total: total, totalTrait: TOTAL_TRAIT[total] || '', pairs: ps, triples: tr, relation: rel, issues: issues, positives: positives, verdict: verdict };
  }

  // Best numbers of a given length whose pairs are all good/neutral, scored against the person.
  function suggest(p, opts) {
    opts = opts || {};
    var len = opts.length || 4, from = Math.pow(10, len - 1), to = Math.pow(10, len) - 1, out = [];
    var targets = p.recommend.numbers.length ? p.recommend.numbers : p.luckyBenefic;
    for (var n = from; n <= to; n++) {
      var s = String(n);
      if (opts.prefix && s.indexOf(opts.prefix) !== 0) continue;
      var a = analyzeNumber(s, p);
      if (targets.indexOf(a.total) < 0) continue;
      if (a.pairs.some(function (x) { return x.cls === 'malefic' || x.cls === 'unrated'; })) continue;
      if (a.triples.length) continue;
      var score = a.pairs.filter(function (x) { return x.cls === 'good'; }).length * 2 + ((TOTAL_COMPOUNDS[a.total] || []).indexOf(a.compound) >= 0 ? 3 : 0) + (p.recommend.numbers[0] === a.total ? 1 : 0);
      out.push({ number: s, total: a.total, compound: a.compound, score: score });
    }
    out.sort(function (x, y) { return y.score - x.score || x.number.localeCompare(y.number); });
    return out.slice(0, opts.limit || 24);
  }

  return {
    LUCKY: LUCKY, ENEMY: ENEMY, HARD: HARD, BENEFIC: BENEFIC, NEUTRAL_U: NEUTRAL_U, MALEFIC_U: MALEFIC_U,
    TOTAL_COMPOUNDS: TOTAL_COMPOUNDS, TOTAL_TRAIT: TOTAL_TRAIT, CONCEPT: CONCEPT, REPEAT_TRAIT: REPEAT_TRAIT,
    reduce: reduce, digitSum: digitSum, king: king, queen: queen, kingPlacedOnce: kingPlacedOnce, grid: grid,
    relation: relation, luckySet: luckySet, unluckySet: unluckySet, multiples: multiples, recommend: recommend,
    person: person, pairClass: pairClass, pairs: pairs, triples: triples, analyzeNumber: analyzeNumber, suggest: suggest
  };
}));
