/**
 * dustCore.js — shared core for "Dust delete" (AI image card: generate → reveal → glass menu → dust delete).
 *
 * Used verbatim by the HTML preview (WebGL) and the RN component (Skia). Everything is in "units":
 * 1 unit = 1 px of the 720×720 reference video; the card is 326×427 units.
 *
 *  - frame(t, ev)        closed-form state at time t for an event schedule ev (pure; parity entry point)
 *  - shaderSource(kind)  'glsl' | 'sksl' — one card shader body, two thin preludes
 *  - dust(tau, out)      closed-form particle positions (shared by WebGL points and Skia Atlas)
 *  - Controller          interaction state machine (hover / press / regenerate) producing ev
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DustCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ───────────────────────────── geometry (units) ─────────────────────────────
  var CARD = { w: 326, h: 427, r: 19, color: [28, 28, 28] };
  var PAD = { x: 60, top: 220, bottom: 40 };               // canvas overflow for wobble + dust
  var CANVAS = { w: CARD.w + 2 * PAD.x, h: CARD.h + PAD.top + PAD.bottom };
  var STAGE = { bg: '#141414', dot: '#1c1c1c', pitch: 24, dotSize: 2 };
  var RING = { cx: 162.5, cy: 192.5, r: 35.5, stroke: 5, track: 0.09 };
  var TEXT = {
    pct: { size: 21.5, weight: 500, baseline: 200 },
    label: { size: 20, weight: 400, baseline: 273, base: 0.36, band: 15 },
  };
  var MENU = { x: 284, cy: 213.5, gap: 71.3, r: 26, r0: 16.5, icon: 24, stroke: 2.3 };
  var CELL = 3, NX = 109, NY = 143;                          // dust particle grid
  var SRC = { x: 53, y: 62 };                                // aurora ripple source

  // ───────────────────────────── timeline (seconds) ───────────────────────────
  var T = {
    enter: 0.33,
    reveal: 256 / 60,       // generation done → reveal starts
    uiOut: 0.17,
    revealDur: 1.5,
    demo: { open: 418 / 60, hover: 446 / 60, close: 458 / 60, dust: 476 / 60, loop: 10.8 },
    dustDur: 2.25,
  };

  // percent readings (frame → %), measured from the ring arc and the digits
  var PCT = [[13, 0], [16, 2], [24, 11], [30, 16], [36, 22], [48, 31], [60, 40], [72, 47], [84, 54], [96, 60],
    [108, 66], [120, 71], [135, 76], [140, 77], [160, 83], [175, 87], [190, 90], [205, 93], [220, 95], [232, 97], [240, 99]];
  // aurora ripple radius (frame → units) and intensity / star envelopes
  var AUR_R = [[16, 20], [24, 55], [32, 88], [40, 118], [48, 148], [56, 172], [64, 194], [72, 215], [80, 240], [88, 262],
    [96, 285], [104, 308], [112, 334], [120, 358], [128, 381], [136, 404], [144, 422], [160, 455], [180, 495], [220, 565]];
  var AUR_I = [[16, 0], [24, 0.15], [32, 0.5], [40, 0.8], [48, 0.92], [56, 1], [72, 0.95], [100, 0.88], [140, 0.82], [170, 0.62], [200, 0.3], [235, 0]];
  var STAR_I = [[36, 0], [64, 0.6], [90, 1], [140, 0.9], [180, 0.5], [220, 0.12], [250, 0]];

  // card edge wobble: radial outward displacement (units) along rays from the card centre,
  // 36 angles (0° = up, clockwise, 10° steps) × 31 samples every 6 frames from frame 16.
  var WOB_T0 = 16 / 60, WOB_DT = 0.1;
  var WOB = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [2.5,1.8,1.2,0.6,0.2,0.1,0,0,0,0,0,0,0,0.1,0.2,0.2,0.1,0,0,0,0.1,0.2,0.2,0.1,0.2,0.4,0.9,1.6,2.4,3.3,4.5,5.8,6.2,5.3,4.2,3.2],
    [7.4,5.5,3.5,1.8,0.7,0.3,0.2,0.1,0,0,0,0,0,0.1,0.3,0.3,0.1,0,0,0,0.2,0.3,0.3,0.4,0.8,1.7,3,4.6,6.6,8.8,11.3,13.5,13.9,12.5,10.9,9.3],
    [11,8.7,6.2,3.9,2.1,1.1,0.5,0.2,0,0,0,0,0,0.1,0.3,0.3,0.1,0,0,0,0.2,0.3,0.5,0.9,1.8,3.4,5.5,7.8,10.3,12.7,14.8,15.9,15.2,14,13.4,12.6],
    [12.2,10.8,8.8,6.6,4.6,2.7,1.4,0.7,0.3,0.1,0,0,0,0.1,0.3,0.3,0.1,0,0,0,0.2,0.4,0.7,1.7,3.5,5.9,8.3,10.4,12.3,13.6,14.1,13.7,12.1,11.2,11.7,12.4],
    [11.8,11.9,10.9,9.3,7.3,5,3,1.8,1.2,0.7,0.4,0.1,0,0.1,0.3,0.3,0.1,0,0,0.1,0.2,0.5,1.3,3.3,6.1,8.7,10.6,11.9,12.7,12.7,12,10.6,8.8,8.1,9.1,10.7],
    [10.3,11.6,11.9,11.4,10,7.9,5.4,3.7,3,2.2,1.3,0.6,0.2,0.1,0.3,0.3,0.1,0.1,0.1,0.4,0.6,1.2,2.7,5.6,8.7,10.8,11.8,12,11.7,10.7,9.4,8.1,6.6,5.8,6.6,8.5],
    [8.3,10.2,11.8,12.6,12.2,10.3,7.6,5.7,4.8,3.8,2.6,1.4,0.5,0.2,0.4,0.5,0.3,0.4,0.8,1.5,2.2,3.1,5.1,8.2,10.6,11.7,11.7,10.9,9.8,8.3,7,6.2,5.1,4.1,4.6,6.2],
    [6.2,8.3,10.8,12.8,13.5,12.1,9.5,7.7,6.8,5.8,4.4,2.7,1.2,0.5,0.6,0.7,0.8,1.1,1.8,2.9,4,5.5,7.9,10.5,11.8,11.6,10.5,9,7.4,6.1,5.1,4.5,3.6,2.8,3.1,4.4],
    [4.4,6.5,9.1,11.9,13.4,12.8,10.7,9.3,8.6,7.8,6.6,5,3.2,1.6,1,1.1,1.5,2.2,3.4,4.7,6,7.7,10.1,11.8,11.8,10.5,8.7,6.9,5.4,4.3,3.5,3,2.4,1.9,2,2.9],
    [3.1,4.8,7.4,10.4,12.5,12.4,10.8,9.9,9.6,9.1,8.1,6.8,5.1,3.2,2.2,2.1,2.8,3.9,5.2,6.4,7.7,9.4,11.4,12.1,10.8,8.7,6.7,5.1,3.9,3,2.4,2.2,1.9,1.4,1.3,1.9],
    [2,3.4,5.7,8.5,10.8,11.3,10.2,9.7,9.8,9.6,9,8.2,6.9,5.3,3.9,3.6,4.3,5.4,6.5,7.6,8.8,10.4,11.8,11.5,9.3,6.9,5.1,3.8,2.9,2.2,1.9,1.9,1.6,1.1,0.8,1.2],
    [1.2,2.3,4.2,6.7,8.9,9.5,8.8,8.6,9.2,9.5,9.4,9,8.4,7.3,6,5.6,5.9,6.7,7.6,8.6,9.5,10.7,11.4,10.2,7.6,5.3,3.8,2.8,2.1,1.6,1.6,1.6,1.3,0.7,0.5,0.6],
    [0.6,1.4,3,5.1,7,7.5,7,7.1,8,8.7,9,9,8.9,8.4,7.7,7.1,7.1,7.4,8.1,8.8,9.6,10.3,10.4,8.6,6.1,4.1,2.9,2.1,1.6,1.4,1.5,1.5,1.1,0.5,0.2,0.3],
    [0.4,0.9,2.1,3.7,5.3,5.8,5.4,5.5,6.5,7.4,8,8.4,8.8,8.9,8.7,8.2,7.7,7.7,8,8.6,9.1,9.4,8.9,7,4.8,3.1,2.1,1.5,1.2,1.2,1.4,1.5,1.1,0.4,0.1,0.2],
    [0.3,0.6,1.3,2.6,3.8,4.4,4.2,4.4,5.3,6.3,7,7.6,8.3,8.9,9,8.5,7.8,7.5,7.6,7.9,8.1,8.1,7.4,5.6,3.6,2.3,1.5,1,0.9,1.1,1.3,1.4,1.1,0.4,0.1,0.1],
    [0.2,0.4,0.8,1.7,2.6,3.1,3.1,3.5,4.5,5.3,5.9,6.6,7.5,8.5,8.9,8.3,7.4,6.9,6.8,6.9,6.9,6.7,6,4.4,2.8,1.7,1.2,0.7,0.6,0.9,1.2,1.3,1,0.4,0.1,0],
    [0.1,0.3,0.6,1,1.7,2.2,2.3,2.8,3.7,4.4,4.9,5.6,6.5,7.7,8.4,7.9,6.7,6,5.7,5.6,5.5,5.3,4.6,3.4,2.1,1.4,1,0.7,0.6,0.8,1.1,1.3,1,0.4,0.1,0],
    [0.1,0.3,0.5,1,1.8,2.1,2,2.3,3,3.6,4,4.6,5.4,6.7,7.7,7.2,6,5,4.6,4.5,4.4,4.1,3.5,2.6,1.7,1.1,0.9,0.6,0.4,0.5,0.8,1.2,1,0.4,0.1,0],
    [0,0.2,0.5,1.3,2.1,2.1,1.7,2,2.6,2.8,3.1,3.5,4.5,6,7,6.4,5.1,4.2,3.9,3.8,3.6,3.2,2.8,2.1,1.4,0.9,0.8,0.5,0.3,0.4,0.8,1.1,1,0.4,0.1,0],
    [0,0.1,0.5,1.3,2.1,1.9,1.3,1.4,1.9,2.2,2.3,2.6,3.6,5.2,6.4,5.7,4.3,3.5,3.2,3.2,3,2.7,2.3,1.8,1.2,0.8,0.7,0.4,0.2,0.3,0.7,1.1,1,0.4,0.1,0],
    [0,0.1,0.5,1.3,2,1.6,1,1.2,1.8,2,1.9,2,2.8,4.4,5.5,4.9,3.6,2.8,2.5,2.6,2.5,2.2,1.8,1.4,1,0.8,0.6,0.4,0.1,0.2,0.7,1.1,1,0.4,0.1,0],
    [0,0.1,0.5,1.2,1.8,1.3,0.7,1,1.5,1.6,1.5,1.4,2.1,3.6,4.6,4.1,2.9,2.2,2,2,2,1.7,1.4,1.1,0.8,0.7,0.5,0.3,0.2,0.3,0.7,1.2,1,0.4,0.1,0],
    [0,0.1,0.5,1.2,1.7,1.1,0.4,0.6,1,1.2,1.1,1.1,1.6,2.8,3.6,3.1,2.2,1.6,1.5,1.6,1.6,1.4,1.1,0.9,0.7,0.6,0.3,0.2,0.3,0.7,1.1,1.3,1,0.4,0.1,0],
    [0,0.1,0.5,1.2,1.7,1,0.3,0.3,0.7,0.9,0.9,0.9,1.2,1.8,2.4,2.3,1.7,1.2,1,1.1,1.1,1,0.8,0.8,0.7,0.5,0.3,0.1,0.4,1,1.4,1.3,1,0.4,0.1,0],
    [0,0.1,0.5,1.2,1.6,1,0.2,0.1,0.3,0.5,0.6,0.5,0.6,1,1.5,1.7,1.3,0.8,0.6,0.8,0.9,0.7,0.6,0.6,0.5,0.4,0.2,0.1,0.4,1.1,1.4,1.4,1,0.4,0.1,0],
    [0,0.1,0.4,0.8,1,0.6,0.1,0,0.1,0.3,0.5,0.3,0.2,0.5,0.9,1.2,1,0.7,0.5,0.7,0.8,0.6,0.4,0.4,0.3,0.2,0.2,0.1,0.4,1,1.4,1.3,1,0.4,0.1,0],
    [0,0.1,0.2,0.3,0.2,0.1,0,0,0,0.2,0.3,0.2,0.1,0.3,0.7,0.9,0.8,0.5,0.4,0.7,0.7,0.5,0.3,0.3,0.2,0.2,0.1,0.1,0.3,0.8,1.1,1.1,0.8,0.3,0.1,0],
    [0,0,0.1,0.1,0,0,0,0,0,0,0,0,0.1,0.2,0.5,0.6,0.3,0.2,0.3,0.6,0.6,0.3,0.1,0.1,0.1,0,0,0,0.1,0.2,0.3,0.3,0.2,0.1,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0.1,0.4,0.4,0.2,0.1,0.2,0.5,0.5,0.2,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ];

  // ───────────────────────────── helpers (worklet-safe) ───────────────────────
  function clamp(x, a, b) { 'worklet'; return x < a ? a : x > b ? b : x; }
  function smooth(a, b, x) { 'worklet'; var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function lerpTable(tab, f) {
    'worklet';
    if (f <= tab[0][0]) return tab[0][1];
    for (var i = 1; i < tab.length; i++) {
      if (f <= tab[i][0]) { var a = tab[i - 1], b = tab[i]; return a[1] + (b[1] - a[1]) * (f - a[0]) / (b[0] - a[0]); }
    }
    return tab[tab.length - 1][1];
  }
  // Dave Hoskins hash12 — sine-free so GLSL/SkSL float32 and JS doubles agree to ~1e-5
  function fract(x) { 'worklet'; return x - Math.floor(x); }
  function hash12(x, y) {
    'worklet';
    var a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031);
    var d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
    a += d; b += d; c += d;
    return fract((a + b) * c);
  }
  function cellOnset(i, j) {
    'worklet';
    var x0 = (i + 0.5) * CELL;
    return Math.max(0, 0.17 + 0.48 * (x0 / CARD.w) + 0.2 * (hash12(i, j) - 0.5));
  }

  // ───────────────────────────── frame(t, ev) ─────────────────────────────────
  // ev: { gen, open, close, hover:[t or null ×4], hoverOff:[...], dust, liked }
  function menuState(t, ev) {
    'worklet';
    var s = 0, r = MENU.r0, fill = 0, rim = 0, lift = 0;
    if (ev.open == null || t < ev.open) return { s: 0, r: r, fill: 0, rim: 0, lift: 0 };
    var ta = t - ev.open;
    var endOpen = ev.close != null && ev.close >= ev.open ? Math.min(t, ev.close) - ev.open : ta;
    var so = 1 - Math.exp(-endOpen / 0.088);
    var ro = MENU.r0 + (MENU.r - MENU.r0) * (1 - Math.exp(-endOpen / 0.06));
    var ao = smooth(0, 0.05, endOpen);
    var lo = 1 - Math.exp(-endOpen / 0.08);
    s = so; r = ro; fill = ao; rim = ao; lift = lo;
    if (ev.close != null && ev.close >= ev.open && t >= ev.close) {
      var tc = t - ev.close;
      var k = smooth(0, 0.13, tc);
      s = so * (1 - k);
      r = ro - (ro - 12) * k;
      fill = ao * (1 - smooth(0, 0.06, tc));
      rim = ao * (1 - smooth(0.08, 0.17, tc));
      lift = lo * (1 - smooth(0, 0.22, tc));
    }
    return { s: s, r: r, fill: fill, rim: rim, lift: lift };
  }

  function frame(t, ev) {
    'worklet';
    var g = t - ev.gen;                       // time since generation started
    var f = g * 60;                           // reference-video frame
    var st = {};
    // entrance
    var e = smooth(0, T.enter, g);
    st.cardOpacity = g < 0 ? 0 : e;
    st.cardScale = 0.95 + 0.05 * (1 - Math.pow(1 - clamp(g / T.enter, 0, 1), 3));
    // progress + labels
    var pct = Math.round(lerpTable(PCT, f));
    st.pct = pct;
    st.arc = pct * 3.6;
    var tr = g - T.reveal;                    // time since reveal start
    st.ui = smooth(0, 1, g / 0.22) * (1 - smooth(0, T.uiOut, tr));
    st.labelP = 1 - smooth(126, 136, f);
    st.labelG = smooth(126, 136, f);
    // shimmer: band centre in card units; period 1.5 s; per-label phase measured (dips at f6 / f157)
    var ph = st.labelG > 0.5 ? (g - 157 / 60) / 1.5 : (g - 6 / 60) / 1.5;
    st.shimmer = 100 + (ph - Math.floor(ph)) * 123;   // 100 → 223 (label ink spans 106 … 219)
    // aurora
    st.aurR = lerpTable(AUR_R, f);
    st.aurI = lerpTable(AUR_I, f);
    st.starI = lerpTable(STAR_I, f);
    st.time = g;
    // wobble (36 radial displacements)
    var wob = [];
    var u = (g - WOB_T0) / WOB_DT;
    var i0 = Math.floor(u), fr = u - i0;
    for (var k = 0; k < 36; k++) {
      var a = i0 < 0 || i0 >= WOB.length ? 0 : WOB[i0][k];
      var b = i0 + 1 < 0 || i0 + 1 >= WOB.length ? 0 : WOB[i0 + 1][k];
      wob.push(a + (b - a) * fr);
    }
    st.wob = wob;
    // reveal
    st.reveal = tr;                            // <0: still generating
    // menu + hover lift
    var m = menuState(t, ev);
    st.menu = m;
    st.lift = m.lift;
    var hv = [0, 0, 0, 0];
    for (var h = 0; h < 4; h++) {
      var on = ev.hover && ev.hover[h] != null && t >= ev.hover[h] ? smooth(0, 0.12, t - ev.hover[h]) : 0;
      var off = ev.hoverOff && ev.hoverOff[h] != null && t >= ev.hoverOff[h] ? smooth(0, 0.12, t - ev.hoverOff[h]) : 0;
      hv[h] = Math.max(0, on - off);
    }
    st.hover = hv;
    st.liked = ev.liked ? 1 : 0;
    st.dust = ev.dust == null || t < ev.dust ? -1 : t - ev.dust;
    st.gone = st.dust > T.dustDur;
    return st;
  }

  // progress ring arc as an SVG path (card-local units) — HTML <path d> and Skia Path.MakeFromSVGString
  function arcPath(arc) {
    'worklet';
    var R = RING;
    if (arc <= 0) return '';
    if (arc >= 359.99) return 'M' + R.cx + ' ' + (R.cy - R.r) + ' a' + R.r + ' ' + R.r + ' 0 1 1 0 ' + (2 * R.r) + ' a' + R.r + ' ' + R.r + ' 0 1 1 0 ' + (-2 * R.r);
    var a = arc * Math.PI / 180;
    var ex = R.cx + R.r * Math.sin(a), ey = R.cy - R.r * Math.cos(a);
    return 'M' + R.cx + ' ' + (R.cy - R.r) + ' A' + R.r + ' ' + R.r + ' 0 ' + (arc > 180 ? 1 : 0) + ' 1 ' + ex.toFixed(3) + ' ' + ey.toFixed(3);
  }

  function menuCircles(st) {
    'worklet';
    var out = [];
    for (var i = 0; i < 4; i++) out.push({ x: MENU.x, y: MENU.cy + (i - 1.5) * MENU.gap * st.menu.s, r: st.menu.r });
    return out;
  }

  // ───────────────────────────── dust particles ───────────────────────────────
  var CELLS = (function () {
    var list = [];
    for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
      var x = (i + 0.5) * CELL, y = (j + 0.5) * CELL;
      if (x > CARD.w || y > CARD.h) continue;
      // inside rounded rect?
      var qx = Math.abs(x - CARD.w / 2) - (CARD.w / 2 - CARD.r), qy = Math.abs(y - CARD.h / 2) - (CARD.h / 2 - CARD.r);
      var o = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - CARD.r;
      if (o > 0) continue;
      list.push(i, j);
    }
    return list;
  })();
  var NP = CELLS.length / 2;
  var DUST_SIZE = 2.7;

  // Writes [x, y, size, opacity(=1)] (card-local units) per particle into out (Float32Array NP*4).
  // minSize (units) = one device pixel: alive grains never drop below it (WebGL points can't), dead ones are 0.
  function dust(tau, out, minSize) {
    'worklet';
    var ms = minSize || 0;
    for (var n = 0; n < NP; n++) {
      var i = CELLS[2 * n], j = CELLS[2 * n + 1];
      var x0 = (i + 0.5) * CELL, y0 = (j + 0.5) * CELL;
      var o = cellOnset(i, j);
      var tt = tau - o, k = 4 * n;
      if (tau < 0 || tt < 0) { out[k] = x0; out[k + 1] = y0; out[k + 2] = 0; out[k + 3] = 0; continue; }
      var h2 = hash12(i + 17, j + 31), h3 = hash12(i + 34, j + 62), h4 = hash12(i + 51, j + 93);
      x0 += 1.6 * (h3 - 0.5); y0 += 1.6 * (h2 - 0.5);
      var vy = 18 + 165 * h2 * h2 * h2, vx = 6 + 30 * (h3 - 0.5);
      var life = 0.75 + 0.75 * h4;
      var lt = clamp(tt / life, 0, 1);
      out[k] = x0 + vx * tt + 5 * Math.sin(tt * 2.5 + h4 * 6.2832) * Math.min(tt, 1);
      out[k + 1] = y0 - (vy * tt + 18 * tt * tt);
      // fading = shrinking (coverage ∝ size²): opaque grains keep HTML points and Skia Atlas sprites identical
      var sz = DUST_SIZE * (1 - 0.35 * lt) * Math.pow(1 - lt, 0.65);
      out[k + 2] = lt >= 1 ? 0 : Math.max(sz, ms);
      out[k + 3] = 1;
    }
    return out;
  }

  // ───────────────────────────── shader ───────────────────────────────────────
  // Common body: GLSL ES 1.0 / SkSL subset. Needs PHOTO(q), BLUR(q) (card-local units → rgb).
  var BODY = [
    'const vec2 CARD = vec2(326.0, 427.0);',
    'const float CR = 19.0;',
    'const vec3 CARDC = vec3(0.10980);',
    'float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t*t*(3.0 - 2.0*t); }',
    'float h12(vec2 p){ vec3 p3 = fract(vec3(p.x, p.y, p.x) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
    'float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);',
    '  return mix(mix(h12(i), h12(i+vec2(1.0,0.0)), u.x), mix(h12(i+vec2(0.0,1.0)), h12(i+vec2(1.0,1.0)), u.x), u.y); }',
    'float sdRR(vec2 d, vec2 b, float r){ vec2 q = abs(d) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }',
    'float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0-h); }',
    'float wobAt(float a){ float d = 0.0;',
    '  for (int k = 0; k < 36; k++) { float dk = abs(a - float(k)); dk = min(dk, 36.0 - dk); d += uWob[k] * max(0.0, 1.0 - dk); }',
    '  return d; }',
    'vec3 ramp6(float u, vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5){',
    '  vec3 c = mix(c0, c1, ss(0.6, 0.25, u));',
    '  c = mix(c, c2, ss(0.25, 0.0, u)); c = mix(c, c3, ss(0.0, -0.4, u));',
    '  c = mix(c, c4, ss(-0.4, -0.9, u)); return mix(c, c5, ss(-0.9, -1.6, u)); }',
    'vec3 aurora(vec2 q, out float starOut){',
    '  vec2 v = q - vec2(53.0, 62.0);',
    '  float ang = atan(v.y, v.x);',
    '  float tm = uAur.w;',
    '  float n1 = vnoise(q*0.009 + vec2(0.0, tm*0.25));',
    '  float d = length(v) * (1.0 + 0.10*(n1 - 0.5)) + 4.0*sin(ang*2.3 + tm*0.8);',
    '  float u = (d - uAur.x) / 70.0;',
    '  float n2 = vnoise(q*0.022 + vec2(tm*0.35, -tm*0.5));',
    '  float up = u + 0.28*(n2 - 0.5);',
    '  vec3 cool = ramp6(up, vec3(0.43,0.38,0.57), vec3(0.74,0.65,0.84), vec3(0.62,0.87,0.93), vec3(0.42,0.74,0.77), vec3(0.47,0.58,0.66), vec3(0.22,0.28,0.36));',
    '  vec3 warm = ramp6(up, vec3(0.55,0.36,0.57), vec3(0.83,0.54,0.81), vec3(0.76,0.50,0.66), vec3(0.78,0.55,0.38), vec3(0.51,0.35,0.36), vec3(0.28,0.21,0.23));',
    '  float wk = ss(1.15, 0.35, ang + 0.35*(n1 - 0.5));',
    '  vec3 pal = mix(cool, warm, wk);',
    '  float env = ss(0.85, 0.3, u) * ss(-2.4, -0.9, u);',
    '  float streak = 0.7 + 0.3*n2;',
    '  float amt = clamp(env*streak*uAur.y*0.95, 0.0, 0.92);',
    '  vec3 col = mix(CARDC, pal, amt);',
    // stars: one candidate per 11-unit cell, revealed behind the ripple front
    '  vec2 sc = floor(q / 11.0); float hs = h12(sc + vec2(7.0, 3.0));',
    '  vec2 sp = (sc + vec2(0.2 + 0.6*h12(sc + vec2(1.0, 9.0)), 0.2 + 0.6*h12(sc + vec2(5.0, 2.0)))) * 11.0;',
    '  float sr = 0.35 + 0.5*h12(sc + vec2(3.0, 8.0));',
    '  float sd = length(q - sp);',
    '  float tw = 0.55 + 0.45*sin(tm*5.0 + hs*40.0);',
    '  float behind = ss(uAur.x + 30.0, uAur.x - 10.0, length(q - vec2(53.0, 62.0)));',
    '  starOut = (hs < 0.42 ? 1.0 : 0.0) * (1.0 - ss(sr - 0.5, sr + 0.6, sd)) * tw * behind * uAur.z;',
    '  return col; }',
    'vec4 card(vec2 p){',
    '  vec2 q = p - vec2(PADX, PADT);',
    '  vec2 C = CARD * 0.5; vec2 d = q - C;',
    // wobble: radial warp of the silhouette only
    '  float th = atan(d.x, -d.y); if (th < 0.0) th += 6.28318;',
    '  float disp = wobAt(th / 6.28318 * 36.0);',
    '  float s = abs(sin(th)), c = abs(cos(th));',
    '  float R0 = min(C.x / max(s, 1e-4), C.y / max(c, 1e-4));',
    '  vec2 dw = d * (R0 / (R0 + disp));',
    '  float sdc = sdRR(dw, C, CR);',
    '  float mask = 1.0 - ss(-0.5*uPx, 0.5*uPx, sdc);',
    '  if (mask <= 0.0) return vec4(0.0);',
    '  vec3 col = CARDC;',
    '  float rev = uCard.y;',
    '  if (rev < 1.6 && uAur.y + uAur.z > 0.001) {',
    '    float star; vec3 a = aurora(q, star);',
    '    col = a + vec3(star) * 0.7;',
    '  }',
    '  if (rev >= 0.0) {',
    '    float yn = q.y / CARD.y;',
    '    float front = 0.01 + 1.15 * rev;',
    '    float fo = ss(front, front - 0.24, yn);',
    '    float fade = 1.0 - ss(1.05, 1.5, rev);',
    // swirl displacement that relaxes as the focus front passes
    '    vec2 fl = vec2(vnoise(q*0.007 + vec2(rev*0.5, 1.7)), vnoise(q*0.007 + vec2(4.1, -rev*0.5))) - 0.5;',
    '    vec2 qd = q + fl * 70.0 * (1.0 - fo) * fade;',
    '    vec2 qc = clamp(q, vec2(0.0), CARD); vec2 qdc = clamp(qd, vec2(0.0), CARD);',
    '    vec3 sharp = PHOTO(qc); vec3 bl = BLUR(qdc);',
    '    vec3 img = mix(mix(bl, bl * vec3(0.92, 0.84, 1.02) + vec3(0.05, 0.03, 0.08), 0.8 * fade), sharp, fo);',
    '    float vis = ss(-0.05, 0.6, rev);',
    // elongated iridescent streaks (remnant of the aurora) in the unfocused part
    '    vec2 o = q - vec2(470.0, 40.0);',
    '    float n = vnoise(vec2(length(o) * 0.026 - rev*1.4, atan(o.y, o.x) * 3.0) + fl * 1.5);',
    '    vec3 haze = mix(vec3(0.74, 0.68, 0.80), vec3(0.58, 0.76, 0.80), vnoise(q*0.008 + vec2(3.0, rev*0.4)));',
    '    float veil = (1.0 - fo) * ss(0.35, 0.9, n) * 0.6 * fade;',
    '    float glow = exp(-((yn - front + 0.06) / 0.13) * ((yn - front + 0.06) / 0.13)) * 0.12 * fade;',
    '    img = mix(img, haze, veil) + haze * glow;',
    '    col = mix(col, img, vis);',
    // glass menu
    '    if (uMenu.z + uMenu.w > 0.001) {',
    '      float sd = 1e5; vec2 cc = vec2(0.0); float bd = 1e5; float hov = 0.0;',
    '      for (int i = 0; i < 4; i++) {',
    '        vec2 ci = vec2(MENUX, MENUY + (float(i) - 1.5) * MENUGAP * uMenu.x);',
    '        float di = length(q - ci) - uMenu.y;',
    '        sd = i == 0 ? di : smin(sd, di, 12.0);',
    '        if (di < bd) { bd = di; cc = ci; hov = i == 0 ? uHover.x : i == 1 ? uHover.y : i == 2 ? uHover.z : uHover.w; }',
    '      }',
    '      float inside = 1.0 - ss(-0.6*uPx, 0.6*uPx, sd);',
    '      vec2 v = q - cc; float rr = clamp(length(v) / uMenu.y, 0.0, 1.0);',
    '      vec2 sp = cc + v * (0.78 + 0.16*rr*rr);',
    '      vec3 g = mix(PHOTO(clamp(sp, vec2(0.0), CARD)), BLUR(clamp(sp, vec2(0.0), CARD)), 0.45);',
    '      g = g * (0.74 - 0.16*hov) + vec3(0.06);',
    '      g += vec3(0.10) * ss(-7.0, 0.0, sd);',
    '      col = mix(col, g, inside * uMenu.z);',
    '      vec2 nrm = v / max(length(v), 1e-3);',
    '      float light = 0.45 + 0.55*abs(dot(nrm, normalize(vec2(-0.6, -0.8))));',
    '      float rim = (1.0 - ss(0.2, 1.5, abs(sd + 1.0))) * light;',
    '      col = mix(col, vec3(1.0, 0.98, 0.93), clamp(rim * 0.95 * uMenu.w, 0.0, 1.0));',
    '    }',
    '  }',
    // dust: cells whose onset has passed leave the card (particles take over)
    '  if (uCard.z >= 0.0) {',
    '    vec2 cell = floor(q / 3.0);',
    '    float on = max(0.0, 0.17 + 0.48 * ((cell.x + 0.5) * 3.0 / 326.0) + 0.2 * (h12(cell) - 0.5));',
    '    if (uCard.z >= on) mask = 0.0;',
    '  }',
    '  float a = mask * uCard.x;',
    '  return vec4(col * a, a); }',
  ].join('\n');

  function defines() {
    return [
      'const float PADX = ' + PAD.x.toFixed(1) + ';',
      'const float PADT = ' + PAD.top.toFixed(1) + ';',
      'const float MENUX = ' + MENU.x.toFixed(1) + ';',
      'const float MENUY = ' + MENU.cy.toFixed(1) + ';',
      'const float MENUGAP = ' + MENU.gap.toFixed(1) + ';',
    ].join('\n');
  }
  var UNIFORMS = 'uniform float uPx;\nuniform vec4 uCard;\nuniform vec4 uAur;\nuniform vec4 uMenu;\nuniform vec4 uHover;\nuniform float uWob[36];\n';

  function shaderSource(kind) {
    if (kind === 'glsl') {
      return 'precision highp float;\nuniform vec2 uRes;\nuniform float uScale;\nuniform sampler2D tPhoto;\nuniform sampler2D tBlur;\n' + UNIFORMS +
        defines() + '\n' +
        'vec3 PHOTO(vec2 q){ return texture2D(tPhoto, q / vec2(326.0, 427.0)).rgb; }\n' +
        'vec3 BLUR(vec2 q){ return texture2D(tBlur, q / vec2(326.0, 427.0)).rgb; }\n' +
        BODY + '\nvoid main(){ vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale; gl_FragColor = card(p); }\n';
    }
    // SkSL: canvas draws in units (Group scale applied outside), images evaluated in their own pixel space
    return 'uniform shader tPhoto;\nuniform shader tBlur;\nuniform vec2 uPhotoK;\nuniform vec2 uBlurK;\n' + UNIFORMS +
      defines() + '\n' +
      'vec3 PHOTO(vec2 q){ return tPhoto.eval(q * uPhotoK).rgb; }\n' +
      'vec3 BLUR(vec2 q){ return tBlur.eval(q * uBlurK).rgb; }\n' +
      BODY + '\nhalf4 main(vec2 p){ return half4(card(p)); }\n';
  }

  // uniform values from a frame state (shared by both ends)
  function uniforms(st, pxPerUnit) {
    'worklet';
    return {
      uPx: 1 / pxPerUnit,
      uCard: [st.gone ? 0 : 1, st.reveal, st.dust, 0],
      uAur: [st.aurR, st.aurI, st.starI, st.time],
      uMenu: [st.menu.s, st.menu.r, st.menu.fill, st.menu.rim],
      uHover: st.hover,
      uWob: st.wob,
    };
  }

  // label shimmer gradient stops (relative to band centre, in units) → [offset, alpha]
  function shimmerStops() {
    'worklet';
    var out = [], b = TEXT.label.band, base = TEXT.label.base;
    for (var k = -2; k <= 2; k += 0.5) out.push([k * b, base + (1 - base) * Math.exp(-k * k / 1.0)]);
    return out;
  }

  // ───────────────────────────── icons (Lucide, ISC; trash filled variant) ────
  var ICONS = {
    heart: { stroke: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'] },
    redo: { stroke: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'] },
    download: { stroke: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'] },
    trash: {
      stroke: ['M3.5 6h17', 'M9 6V4.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4.5V6'],
      fill: ['M5.5 8h13l-1.05 12.2a2 2 0 0 1-2 1.8h-6.9a2 2 0 0 1-2-1.8Z'],
      cut: ['M10 11.5v6', 'M14 11.5v6'],
    },
  };
  var ICON_ORDER = ['heart', 'redo', 'download', 'trash'];

  // ───────────────────────────── controller ───────────────────────────────────
  function demoEvents(t0) {
    var d = T.demo;
    return { gen: t0, open: t0 + d.open, close: t0 + d.close, hover: [null, null, null, t0 + d.hover], hoverOff: [null, null, null, t0 + d.close], dust: t0 + d.dust, liked: false };
  }
  function Controller(now, auto) {
    this.auto = auto !== false;
    this.reset(now);
  }
  Controller.prototype.reset = function (now) {
    this.ev = this.auto ? demoEvents(now) : { gen: now, open: null, close: null, hover: [null, null, null, null], hoverOff: [null, null, null, null], dust: null, liked: false };
  };
  Controller.prototype.ready = function (now) { return now - this.ev.gen > T.reveal + 0.6 && this.ev.dust == null; };
  Controller.prototype.tick = function (now) {
    var ev = this.ev;
    if (this.auto && now - ev.gen > T.demo.loop) this.reset(ev.gen + T.demo.loop);
    else if (!this.auto && ev.dust != null && now - ev.dust > T.dustDur + 0.6) this.reset(now);
    return this.ev;
  };
  Controller.prototype.takeOver = function () {           // first user interaction cancels the scripted demo
    if (!this.auto) return;
    this.auto = false;
    var ev = this.ev;
    var now = ev._now;
    ['open', 'close', 'dust'].forEach(function (k) { if (ev[k] != null && ev[k] > now) ev[k] = null; });
    for (var i = 0; i < 4; i++) { if (ev.hover[i] != null && ev.hover[i] > now) ev.hover[i] = null; if (ev.hoverOff[i] != null && ev.hoverOff[i] > now) ev.hoverOff[i] = null; }
  };
  Controller.prototype.enter = function (now) {
    this.ev._now = now; this.takeOver();
    if (!this.ready(now)) return;
    var ev = this.ev;
    if (ev.open != null && (ev.close == null || ev.close < ev.open)) return;
    ev.open = now; ev.close = null;
  };
  Controller.prototype.leave = function (now) {
    this.ev._now = now; this.takeOver();
    var ev = this.ev;
    if (ev.open != null && (ev.close == null || ev.close < ev.open)) ev.close = now;
    for (var i = 0; i < 4; i++) this.hoverBtn(i, false, now);
  };
  Controller.prototype.hoverBtn = function (i, on, now) {
    var ev = this.ev, isOn = ev.hover[i] != null && (ev.hoverOff[i] == null || ev.hoverOff[i] < ev.hover[i]);
    if (on && !isOn) { ev.hover[i] = now; ev.hoverOff[i] = null; }
    if (!on && isOn) ev.hoverOff[i] = now;
  };
  Controller.prototype.press = function (i, now) {
    this.ev._now = now; this.takeOver();
    var ev = this.ev;
    if (i === 0) { ev.liked = !ev.liked; return 'like'; }
    if (i === 1) { this.reset(now); return 'regenerate'; }
    if (i === 2) return 'download';
    ev.close = now; this.hoverBtn(3, false, now); ev.dust = now + 0.3; return 'delete';
  };
  // hit test in card-local units → button index or -1 (only when menu is out)
  function hitButton(st, x, y) {
    if (st.menu.fill < 0.5) return -1;
    var cs = menuCircles(st);
    for (var i = 0; i < 4; i++) if (Math.hypot(x - cs[i].x, y - cs[i].y) <= cs[i].r) return i;
    return -1;
  }

  return {
    CARD: CARD, PAD: PAD, CANVAS: CANVAS, STAGE: STAGE, RING: RING, TEXT: TEXT, MENU: MENU, T: T,
    CELL: CELL, NX: NX, NY: NY, CELLS: CELLS, NP: NP, DUST_SIZE: DUST_SIZE, ICONS: ICONS, ICON_ORDER: ICON_ORDER,
    frame: frame, menuState: menuState, arcPath: arcPath, menuCircles: menuCircles, dust: dust, cellOnset: cellOnset, hash12: hash12,
    shaderSource: shaderSource, uniforms: uniforms, shimmerStops: shimmerStops,
    demoEvents: demoEvents, Controller: Controller, hitButton: hitButton,
    clamp: clamp, smooth: smooth, lerpTable: lerpTable,
  };
});
