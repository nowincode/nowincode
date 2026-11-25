/* 04_motion_toolbar_menu core — shared by the CanvasKit preview, the node parity test and the RN Skia component.
 * Units are pt. Component box is LW×LH; the 360×360 source stage places it at y = STAGE_OY.
 * All timings were measured frame by frame on the 60 fps source (see analysis.md). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ToolbarMenuCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var F = 1000 / 60; // one source frame in ms
  var LW = 360, LH = 200, STAGE = 360, STAGE_OY = 65;

  var BAR = { x: 21.5, y: 140, w: 254, h: 49 };
  BAR.cx = BAR.x + BAR.w / 2; BAR.cy = BAR.y + BAR.h / 2; BAR.bot = BAR.y + BAR.h;
  var MENU = { w: 254, h: 148.5 };
  MENU.top = BAR.bot - MENU.h; MENU.cy = MENU.top + MENU.h / 2;
  var RADIUS = 24.5;
  var PLUS = { cx: 313.25, cy: BAR.cy, d: 49 };
  var PILL = { w: 59, h: 37 }, LENS = { w: 72, h: 54 };
  var SLOT_W = (BAR.w - 12) / 4;
  var TILE = { inset: 9, gap: 6, r: 19.5 };
  TILE.w = (MENU.w - 2 * TILE.inset - 2 * TILE.gap) / 3;
  TILE.h = (MENU.h - 2 * TILE.inset - TILE.gap) / 2;
  var TAB_ICON_DX = [-1, 1, 2.75, 1.5];
  var ITEMS = ['Note', 'Checklist', 'Photo', 'Scan', 'Voice', 'Sketch'];
  var LABEL = { size: 10.4, weight: 600, baseline: 49.25, iconY: 22.5 }; // ink width fit vs source: Note 46 / Checklist 92 px

  function slotX(i) { return BAR.x + 6 + SLOT_W * (i + 0.5); }
  function tileRect(i) {
    var c = i % 3, r = (i / 3) | 0;
    return { x: BAR.x + TILE.inset + c * (TILE.w + TILE.gap), y: MENU.top + TILE.inset + r * (TILE.h + TILE.gap), w: TILE.w, h: TILE.h };
  }

  // ---- measured keyframe tables (index = source frame since the last rest frame) ----
  var OPEN = {
    w: [254, 209.5, 173, 153, 143.5, 138.5, 144, 161, 181.5, 202.5, 221.5, 237.5, 248.5, 256, 260.5, 262.5, 262.5, 262.5, 260.5, 259, 257.5, 256.5, 255.5, 254.5, 254],
    top: [140, 137, 134.5, 133, 94.5, 76.5, 65.5, 55.5, 46.5, 40, 35, 31.5, 29.5, 29.5, 29, 31, 32.5, 34.5, 36, 37.5, 38.5, 38.5, 40, 40.5, 40.5],
    bot: [189, 189.5, 189, 189, 192.5, 195.5, 195.5, 194.5, 193, 191, 189, 187.5, 185.5, 184.5, 184, 185, 185, 186, 186.5, 187, 187.5, 188, 188.5, 189, 189],
    barA: [[0, 1], [1, 0.45], [2, 0.15], [3, 0.04], [4, 0]],
    barBlur: [[0, 0], [1, 1.5], [2, 3], [3, 4], [4, 5]],
    menuA: [[5, 0], [6, 0.12], [7, 0.3], [8, 0.52], [9, 0.68], [10, 0.35], [11, 0.8], [12, 1]],
    menuBlur: [[6, 10], [9, 9], [10, 1.6], [11, 0.4], [12, 0]]
  };
  var CLOSE = {
    w: [254, 237.5, 212.5, 190, 172, 158, 157.5, 167.5, 184, 202, 219, 233.5, 245, 253, 257.5, 260, 260.5, 260.5, 259.5, 258.5, 257.5, 256, 255, 254.5, 254],
    top: [40.5, 51.5, 68, 83, 94.5, 103.5, 115, 125, 132, 136, 138, 139, 139.5, 140, 141, 141.5, 141.5, 141.5, 141.5, 141, 140.5, 140.5, 140.5, 140, 140],
    bot: [189, 189.5, 191, 192.5, 193.5, 194.5, 193.5, 192, 190.5, 190, 189.5, 189.5, 189.5, 189, 189, 189, 189, 189, 189, 189, 189, 189, 189, 189, 189],
    menuA: [[0, 1], [1, 0.45], [2, 0.25], [4, 0.12], [6, 0]],
    menuBlur: [[0, 0], [1, 1], [2, 6], [6, 9]],
    barA: [[7.5, 0], [8.5, 0.4], [9.5, 0.8], [10.5, 0.75], [11.5, 0.95], [12.5, 1]],
    barBlur: [[7.5, 5], [9.5, 4.5], [10.5, 1.2], [11.5, 0.3], [12.5, 0]]
  };
  var MORPH_FRAMES = 24, MORPH_LOCK = 18;
  // plus button: press-in scale per frame, white highlight decay after release
  var PRESS = [[0, 1], [1, 1.031], [2, 1.092], [3, 1.143], [4, 1.173], [5, 1.204], [6, 1.235], [7, 1.245]];
  var PRESS_MAX = 0.245;
  var WHITE_DECAY = [[0, 1], [6, 1], [7, 0.93], [8, 0.85], [9, 0.72], [11, 0.61], [13, 0.52], [14, 0.48], [15, 0.35], [17, 0.24], [19, 0.13], [22, 0]];
  var PLUS_SPRING = { w: 18.6, z: 0.385 };       // rad/s, damping ratio (fit of the release overshoot)
  var LENS_GROW = [[0, 0], [1, 0.3], [2, 0.6], [3, 0.75], [4, 0.85], [5, 0.92], [6, 0.97], [7, 1]];
  var LENS_W = 25;                               // critically damped travel, rad/s
  var LENS_MIN_LIFT = 4, LENS_SETTLE_AT = 10;    // frames

  // ---- math ----
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function table(arr, k) {
    if (k <= 0) return arr[0];
    var n = arr.length - 1; if (k >= n) return arr[n];
    var i = Math.floor(k); return lerp(arr[i], arr[i + 1], k - i);
  }
  function keys(kv, k) {
    if (k <= kv[0][0]) return kv[0][1];
    for (var i = 1; i < kv.length; i++) if (k <= kv[i][0]) {
      var a = kv[i - 1], b = kv[i]; return lerp(a[1], b[1], (k - a[0]) / (b[0] - a[0]));
    }
    return kv[kv.length - 1][1];
  }
  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function springFromRest(t, w, z) { // x(0)=1, x'(0)=0 → 0
    if (t <= 0) return 1;
    var a = z * w, wd = w * Math.sqrt(1 - z * z);
    return Math.exp(-a * t) * (Math.cos(wd * t) + (a / wd) * Math.sin(wd * t));
  }
  function critical(t, w) { return t <= 0 ? 0 : 1 - (1 + w * t) * Math.exp(-w * t); }

  // ---- state & events (times in ms) ----
  function makeState() {
    return { tab: 0, open: false, morph: null, plus: null, lens: null, tile: null };
  }
  function morphK(S, now) { return S.morph ? (now - S.morph.t0) / F : 1e9; }
  function busy(S, now) {
    if (morphK(S, now) < MORPH_LOCK) return true;  // the source re-presses during the last few settle frames
    if (S.plus && S.plus.up == null) return true;
    if (S.tile && S.tile.up == null) return true;
    return false;
  }
  function lensDone(S, now) {
    var L = S.lens; return !L || (L.tr != null && now > L.tr + (LENS_SETTLE_AT + 8) * F);
  }
  function hit(S, x, y) {
    var dx = x - PLUS.cx, dy = y - PLUS.cy;
    if (dx * dx + dy * dy <= 27 * 27) return { kind: 'plus' };
    if (!S.open) {
      if (x >= BAR.x && x <= BAR.x + BAR.w && y >= BAR.y - 4 && y <= BAR.bot + 4)
        return { kind: 'tab', i: clamp(Math.floor((x - BAR.x - 6) / SLOT_W), 0, 3) };
    } else {
      for (var i = 0; i < 6; i++) {
        var r = tileRect(i);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { kind: 'tile', i: i };
      }
    }
    return null;
  }
  function toggle(S, k0) {
    S.open = !S.open;
    S.morph = { t0: k0, dir: S.open ? 'open' : 'close' };
  }
  function down(S, x, y, now) {
    var h = hit(S, x, y);
    if (!h || busy(S, now)) return null;
    if (h.kind === 'plus') S.plus = { down: now, up: null, rel: null };
    else if (h.kind === 'tab') {
      if (!lensDone(S, now)) return null;
      var from = S.lens ? S.lens.to : S.tab;
      S.lens = { from: from, to: h.i, tq: now, tr: null };
    } else if (h.kind === 'tile') S.tile = { i: h.i, down: now, up: null };
    return h;
  }
  function up(S, now) {
    if (S.plus && S.plus.up == null) {
      S.plus.up = now;
      var t1 = Math.max(now, S.plus.down + 7 * F);  // first visibly changed frame
      S.plus.rel = t1 - F;
      toggle(S, t1 - F);
    }
    if (S.lens && S.lens.tr == null) {
      S.lens.tr = Math.max(now, S.lens.tq + LENS_MIN_LIFT * F);
      S.tab = S.lens.to;
    }
    if (S.tile && S.tile.up == null) {
      S.tile.up = now;
      toggle(S, Math.max(now, S.tile.down + 2 * F));
    }
  }

  // ---- frame: display parameters for one instant ----
  function frame(S, now) {
    var D = {};
    var k = morphK(S, now), dir = S.morph ? S.morph.dir : null;
    var T = dir === 'open' ? OPEN : CLOSE;
    var top, bot, w;
    if (dir && k < MORPH_FRAMES + 1) {
      w = table(T.w, k); top = table(T.top, k); bot = table(T.bot, k);
      D.barA = keys(T.barA, k); D.barBlur = keys(T.barBlur, k);
      D.menuA = keys(T.menuA, k); D.menuBlur = keys(T.menuBlur, k);
    } else {
      w = BAR.w; bot = BAR.bot; top = S.open ? MENU.top : BAR.y;
      D.barA = S.open ? 0 : 1; D.menuA = S.open ? 1 : 0; D.barBlur = 0; D.menuBlur = 0;
    }
    var h = bot - top;
    D.shape = { x: BAR.cx - w / 2, y: top, w: w, h: h, r: Math.min(RADIUS, w / 2, h / 2) };
    D.morph = clamp((h - BAR.h) / (MENU.h - BAR.h), 0, 1);
    var cy = (top + bot) / 2;
    D.barT = { cx: BAR.cx, cy: cy, sx: w / BAR.w, sy: h / BAR.h };
    D.menuT = { cx: BAR.cx, cy: cy, sx: w / MENU.w, sy: h / MENU.h };

    // plus button
    var s = 1, white = 0, P = S.plus;
    if (P) {
      var kp = (now - P.down) / F;
      if (P.rel == null || now < P.rel) { s = keys(PRESS, kp); white = (s - 1) / PRESS_MAX; }
      else {
        var sr = keys(PRESS, (P.rel - P.down) / F), wr = (sr - 1) / PRESS_MAX;
        s = 1 + (sr - 1) * springFromRest((now - P.rel) / 1000, PLUS_SPRING.w, PLUS_SPRING.z);
        white = wr * keys(WHITE_DECAY, (now - P.rel) / F);
      }
    }
    var rot = S.open ? 45 : 0;
    if (dir && k < 20) {
      rot = dir === 'open' ? 45 * easeOutQuad(clamp((k - 1) / 13, 0, 1)) : 45 * (1 - easeOutQuad(clamp((k - 1) / 10, 0, 1)));
    }
    D.plus = { s: s, white: white, rot: rot };

    // tiles pressed state
    D.tileA = [1, 1, 1, 1, 1, 1];
    if (S.tile && S.open) D.tileA[S.tile.i] = lerp(1, 0.4, clamp((now - S.tile.down) / (2 * F), 0, 1));
    if (S.tile && !S.open) D.tileA[S.tile.i] = 0.4;

    // selection pill / liquid lens
    var L = S.lens;
    var pill = { x: slotX(S.tab), w: PILL.w, h: PILL.h, white: 1 }, breathe = 0;
    if (L && !lensDone(S, now)) {
      var kq = (now - L.tq) / F, g = keys(LENS_GROW, kq);
      var p = L.tr != null ? critical((now - L.tr) / 1000, LENS_W) : 0;
      var ts = L.tr != null ? L.tr + LENS_SETTLE_AT * F : Infinity;
      var u = easeInOut(clamp((now - ts) / (5 * F), 0, 1));
      var f = g * (1 - u), dirx = Math.sign(L.to - L.from);
      var x0 = slotX(L.from), x1 = slotX(L.to);
      pill.x = lerp(x0, x1, p) - dirx * 2 * g * (1 - p);
      pill.w = lerp(PILL.w, LENS.w, f); pill.h = lerp(PILL.h, LENS.h, f);
      pill.white = Math.max(keys([[0, 1], [1, 0.8], [2, 0.3], [3, 0]], kq), clamp((now - ts - 2.5 * F) / (2.5 * F), 0, 1));
      breathe = Math.min(easeInOut(clamp(kq / 12, 0, 1)), 1 - easeInOut(clamp((now - ts - F) / (8 * F), 0, 1)));
    }
    pill.y = BAR.cy - pill.h / 2;
    D.pill = pill;
    D.breathe = { sx: 1 + 0.02 * breathe, sy: 1 + 0.05 * breathe };
    return D;
  }

  // ---- demo: the source video's interaction script (ms) ----
  var DEMO_LEN = 15733;
  var DEMO = [
    ['plus', 1183, 1284], ['tile', 3150, 3233, 2],
    ['tab', 5084, 5200, 1], ['tab', 5884, 5967, 2], ['tab', 6600, 6683, 3], ['tab', 7884, 7950, 0],
    ['plus', 10100, 10150], ['plus', 10517, 10567], ['plus', 10950, 10984], ['plus', 11367, 11400],
    ['plus', 11783, 11817], ['plus', 12200, 12234]
  ];
  function evPoint(e) {
    if (e[0] === 'plus') return [PLUS.cx, PLUS.cy];
    if (e[0] === 'tab') return [slotX(e[3]), BAR.cy];
    var r = tileRect(e[3]); return [r.x + r.w / 2, r.y + r.h / 2];
  }
  function demoState(t) {
    var S = makeState();
    for (var i = 0; i < DEMO.length; i++) {
      var e = DEMO[i], pt = evPoint(e);
      if (t >= e[1]) down(S, pt[0], pt[1], e[1]);
      if (t >= e[2]) up(S, e[2]);
    }
    return S;
  }

  // ---- paint specs ----
  function rgb(c, a) { return [c[0] / 255, c[1] / 255, c[2] / 255, c.length > 3 ? c[3] * (a == null ? 1 : a) : a == null ? 1 : a]; }
  var COL = {
    bgStops: [0, 0.25, 0.5, 0.75, 1],
    bg: [[225.9, 224.2, 233.4], [228.0, 225.9, 235.0], [223.0, 221.5, 231.1], [214.6, 214.8, 223.2], [214.3, 211.5, 223.3]],
    glow: { cx: 95, cy: 45, sigma: 160, amp: [24.4, 26.0, 18.1] },
    barFill: [[247, 246, 251], [241, 240, 245], [236, 235, 240], [234, 233, 238]],
    menuFill: [[250, 249, 253], [247, 246, 251], [240, 239, 244], [235, 234, 239]],
    fillPos: [0, 0.14, 0.5, 1],
    plusFill: [[243, 242, 247], [237, 236, 241], [233, 232, 237]],
    lensFill: [[246, 245, 250], [238, 237, 242], [229, 228, 235], [232, 231, 236]],
    dark: [[78, 77, 82], [36, 35, 40]],
    glassBar: [[238, 238, 241, 0.62], [214, 214, 218, 0.9]],
    glassMenu: [[222, 222, 226], [199, 199, 204]],
    ink: [20, 20, 22]
  };

  // ---- icon geometry (pt, centered) ----
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    return 'M' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w) + ' ' + (y + r) +
      'V' + (y + h - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w - r) + ' ' + (y + h) +
      'H' + (x + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + x + ' ' + (y + h - r) + 'V' + (y + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + 'Z';
  }
  function circ(cx, cy, r) {
    return 'M' + (cx - r) + ' ' + cy + 'A' + r + ' ' + r + ' 0 1 0 ' + (cx + r) + ' ' + cy + 'A' + r + ' ' + r + ' 0 1 0 ' + (cx - r) + ' ' + cy + 'Z';
  }
  function bracket(sx, sy) { // one scan corner, mirrored by sign
    var e = 7.75, a = 3.2, c = 2.6;
    return 'M' + sx * e + ' ' + sy * a + 'L' + sx * e + ' ' + sy * (e - c) + 'Q' + sx * e + ' ' + sy * e + ' ' + sx * (e - c) + ' ' + sy * e + 'L' + sx * a + ' ' + sy * e;
  }
  var ICONS = {
    calendar: [
      { t: 'dark', d: rr(-8.75, -7, 17.5, 8, 3.2) + rr(-5.4, -8.6, 1.7, 3.6, 0.85) + rr(3.4, -8.6, 1.7, 3.6, 0.85) },
      { t: 'glass', d: rr(-8.5, -2.6, 17, 11.1, 3.2) },
      { t: 'stroke', d: 'M-3.6 1.3L-2.2 0.3L-2.2 6.3M0.7 0.5L4.5 0.5L1.9 6.3', w: 1.75 }
    ],
    stack: [
      { t: 'dark', d: rr(-3.6, -8.5, 12.05, 13.8, 3.2) },
      { t: 'glass', d: rr(-8.5, -5, 11.5, 13.4, 2.8) },
      { t: 'stroke', d: 'M-6 0.4L0 0.4M-6 3.7L-2.9 3.7', w: 1.3 }
    ],
    people: [
      { t: 'dark', d: circ(2.5, -5.5, 2.6) + 'M-1.2 7.4L-1.2 5.3A5 5 0 0 1 8.8 5.3L8.8 7.4Z' },
      { t: 'glass', d: circ(-2.9, -4.3, 2.9) + 'M-8.8 8.2L-8.8 7.2A5.625 5.625 0 0 1 2.45 7.2L2.45 8.2Z' }
    ],
    folder: [
      { t: 'dark', d: 'M-8.75 -6.1Q-8.75 -8.1 -6.75 -8.1L-3.2 -8.1Q-2.2 -8.1 -1.6 -7.3L-0.9 -6.4L6.6 -6.4Q8.6 -6.4 8.6 -4.4L8.6 0L-8.75 0Z' },
      { t: 'glass', d: rr(-8.35, -3.5, 17.1, 11.6, 2.6) }
    ],
    Note: [
      { t: 'glass', d: rr(-8.1, -8.1, 12.1, 16.25, 3) },
      { t: 'stroke', d: 'M-6 -2.3L-0.6 -2.3M-6 1.65L-2.4 1.65', w: 1.4 },
      { t: 'stroke', d: 'M1.7 2.6L7.1 -2.8', w: 2.4 },
      { t: 'dark', d: 'M0.1 4.3L0.75 1.75L2.55 3.55Z' }
    ],
    Checklist: [
      { t: 'glass', d: rr(-7.3, -8.5, 14.6, 17, 3.2) },
      { t: 'stroke', d: 'M-5.6 -2.3L-2.9 0.2L0.2 -4M2.7 -2.2L6.1 -2.2M2.7 3.9L6.5 3.9', w: 1.6 },
      { t: 'ring', d: circ(-2.7, 4.1, 2.15), w: 1.5 }
    ],
    Photo: [
      { t: 'glass', d: rr(-8.55, -6.8, 17.1, 14.55, 3.5) + rr(-2.35, -8.2, 5, 3.4, 1.5) },
      { t: 'dark', d: circ(-0.25, 1.1, 3.1) + circ(4.75, -1.8, 0.9) }
    ],
    Scan: [
      { t: 'glass', d: rr(-4.55, -6.05, 9.2, 11.7, 2.5) },
      { t: 'stroke', d: bracket(-1, -1) + bracket(1, -1) + bracket(1, 1) + bracket(-1, 1), w: 1.8 }
    ],
    Voice: [
      { t: 'glass', d: rr(-1.85, -8.5, 3.7, 9.55, 1.85) },
      { t: 'stroke', d: 'M-1.05 -5.45L1.05 -5.45M-1.05 -1.9L1.05 -1.9', w: 1.3 },
      { t: 'stroke', d: 'M-6.45 -2.3A6.45 6.45 0 0 0 6.45 -2.3M0 4.15L0 7.7M-2.95 7.7L2.95 7.7', w: 1.6 }
    ],
    Sketch: [
      { t: 'glass', d: rr(-7.95, -6.4, 15.9, 12.9, 3) },
      { t: 'stroke', d: 'M-5.45 3.2C-4.2 -0.5 -2.6 -2.6 -1.6 -2.4C-0.4 -2.2 -1.4 2.4 0.4 2.6C1.8 2.8 3.4 -0.6 5.6 -2.6', w: 1.6 }
    ]
  };
  var TAB_ICONS = ['calendar', 'stack', 'people', 'folder'];

  // ---- drawing (A = platform adapter, c = Skia canvas) ----
  function fillPaint(A, shader, alpha) {
    var p = A.paint(); if (shader) p.setShader(shader); if (alpha != null) p.setAlphaf(alpha); return p;
  }
  function vgrad(A, y0, y1, cols, pos, alpha) {
    return A.linear(0, y0, 0, y1, cols.map(function (c) { return rgb(c, alpha); }), pos);
  }
  function mixCols(a, b, t) { return a.map(function (c, i) { return [lerp(c[0], b[i][0], t), lerp(c[1], b[i][1], t), lerp(c[2], b[i][2], t)]; }); }

  function drawIcon(c, A, name, cx, cy, glassCols, glassA, glassBlur) {
    var parts = ICONS[name];
    c.save(); c.translate(cx, cy);
    for (var i = 0; i < parts.length; i++) {
      var pt = parts[i], path = A.path(pt.d);
      if (pt.t === 'dark') {
        c.drawPath(path, fillPaint(A, vgrad(A, -9, 9, COL.dark, [0, 1])));
      } else if (pt.t === 'stroke' || pt.t === 'ring') {
        var sp = A.paint(); sp.setStyle(A.Stroke); sp.setStrokeWidth(pt.w); sp.setStrokeCap(A.CapRound); sp.setStrokeJoin(A.JoinRound);
        sp.setColor(A.color(rgb(pt.t === 'ring' ? [38, 38, 42] : [42, 42, 46])));
        c.drawPath(path, sp);
      } else {
        // frosted card: blur what is behind it, tint, then a thin top highlight
        var b = A.bounds(path);
        c.save(); c.clipPath(path, A.ClipIntersect, true);
        c.saveLayer(null, A.rect(b[0] - 3, b[1] - 3, b[2] - b[0] + 6, b[3] - b[1] + 6), A.blur(glassBlur)); c.restore();
        c.drawPath(path, fillPaint(A, vgrad(A, b[1], b[3], glassCols, [0, 1], glassA)));
        c.restore();
        var rp = A.paint(); rp.setStyle(A.Stroke); rp.setStrokeWidth(0.6);
        rp.setShader(A.linear(0, b[1], 0, b[3], [rgb([255, 255, 255], 0.85), rgb([255, 255, 255], 0.0), rgb([255, 255, 255], 0.25)], [0, 0.45, 1]));
        c.drawPath(path, rp);
      }
    }
    c.restore();
  }

  // Static layers are baked once into images: bar icons and the whole menu content.
  var BAKE_PAD = 6;
  function bakeBox(kind) {
    return kind === 'bar'
      ? { x: BAR.x - BAKE_PAD, y: BAR.y - BAKE_PAD, w: BAR.w + 2 * BAKE_PAD, h: BAR.h + 2 * BAKE_PAD }
      : { x: BAR.x - BAKE_PAD, y: MENU.top - BAKE_PAD, w: MENU.w + 2 * BAKE_PAD, h: MENU.h + 2 * BAKE_PAD };
  }
  function bake(A, scale) {
    var out = {};
    ['bar', 'menu'].forEach(function (kind) {
      var box = bakeBox(kind);
      var surf = A.surface(Math.ceil(box.w * scale), Math.ceil(box.h * scale));
      var c = surf.canvas;
      c.save(); c.scale(scale, scale); c.translate(-box.x, -box.y);
      if (kind === 'bar') {
        for (var i = 0; i < 4; i++) drawIcon(c, A, TAB_ICONS[i], slotX(i) + TAB_ICON_DX[i], BAR.cy, COL.glassBar, 1, 2.2);
      } else {
        for (var j = 0; j < 6; j++) drawTile(c, A, j, scale);
      }
      c.restore();
      out[kind] = { img: surf.snap(), box: box, scale: scale };
      A.endFrame();
    });
    return out;
  }
  function drawTile(c, A, j, scale) {
    var r = tileRect(j), rrr = A.rrect(r.x, r.y, r.w, r.h, TILE.r);
    var sh = A.paint(); sh.setColor(A.color([0, 0, 0, 0.055])); sh.setMaskFilter(A.maskBlur(0.6));
    c.drawRRect(rrr, sh);
    var hl = A.paint(); hl.setStyle(A.Stroke); hl.setStrokeWidth(0.8);
    hl.setShader(A.linear(0, r.y, 0, r.y + r.h, [rgb([255, 255, 255], 0), rgb([255, 255, 255], 0), rgb([255, 255, 255], 0.35)], [0, 0.6, 1]));
    c.drawRRect(A.rrect(r.x + 0.4, r.y + 0.4, r.w - 0.8, r.h - 0.8, TILE.r - 0.4), hl);
    drawIcon(c, A, ITEMS[j], r.x + r.w / 2, r.y + LABEL.iconY, COL.glassMenu, 0.9, 1.6);
    A.label(c, ITEMS[j], r.x + r.w / 2, r.y + LABEL.baseline, LABEL.size, LABEL.weight, rgb(COL.ink), scale);
  }

  function drawBackground(c, A, w, h, oy) { // the 360×360 source stage (not part of the component)
    c.save(); c.translate(0, -(oy || 0));
    var sc = w / STAGE;
    c.scale(sc, sc);
    c.drawRect(A.rect(0, 0, STAGE, STAGE), fillPaint(A, A.linear(0, 0, 0, STAGE, COL.bg.map(function (v) { return rgb(v); }), COL.bgStops)));
    var G = COL.glow, cols = [], pos = [];
    for (var i = 0; i <= 12; i++) {
      var t = i / 12, g = Math.exp(-Math.pow(3 * t, 2) / 2);
      cols.push([G.amp[0] / 255 * g, G.amp[1] / 255 * g, G.amp[2] / 255 * g, 1]); pos.push(t);
    }
    var gp = fillPaint(A, A.radial(G.cx, G.cy, 3 * G.sigma, cols, pos)); gp.setBlendMode(A.BlendPlus);
    c.drawRect(A.rect(0, 0, STAGE, STAGE), gp);
    c.restore();
  }

  function drawShell(c, A, x, y, w, h, r, fills, pos, white) {
    var rrr = A.rrect(x, y, w, h, r);
    var s1 = A.paint(); s1.setColor(A.color([0, 0, 0, 0.05])); s1.setMaskFilter(A.maskBlur(4));
    c.save(); c.translate(0, 2); c.drawRRect(rrr, s1); c.restore();
    var s2 = A.paint(); s2.setColor(A.color([0, 0, 0, 0.16])); s2.setMaskFilter(A.maskBlur(0.75));
    c.save(); c.translate(0, 0.6); c.drawRRect(rrr, s2); c.restore();
    c.drawRRect(rrr, fillPaint(A, vgrad(A, y, y + h, fills, pos)));
    if (white > 0) { var wp = A.paint(); wp.setColor(A.color([1, 1, 1, white])); c.drawRRect(rrr, wp); }
    // inner rim: a soft 2pt light band all round (stronger on top), plus a crisp 1px highlight
    var band = A.paint(); band.setStyle(A.Stroke); band.setStrokeWidth(2.2); band.setMaskFilter(A.maskBlur(0.8));
    band.setShader(A.linear(0, y, 0, y + h, [rgb([255, 255, 255], 0.7), rgb([255, 255, 255], 0.35), rgb([255, 255, 255], 0.5)], [0, 0.5, 1]));
    c.save(); c.clipRRect(rrr, A.ClipIntersect, true);
    c.drawRRect(A.rrect(x + 1.1, y + 1.1, w - 2.2, h - 2.2, Math.max(0, r - 1.1)), band);
    c.restore();
    var rim = A.paint(); rim.setStyle(A.Stroke); rim.setStrokeWidth(1);
    rim.setShader(A.linear(0, y, 0, y + h, [rgb([255, 255, 255], 0.95), rgb([255, 255, 255], 0.0), rgb([255, 255, 255], 0.0), rgb([255, 255, 255], 0.55)],
      [0, Math.min(0.45, 9 / h), 1 - Math.min(0.3, 6 / h), 1]));
    c.drawRRect(A.rrect(x + 0.5, y + 0.5, w - 1, h - 1, Math.max(0, r - 0.5)), rim);
  }

  // blurred content reads as dark blobs in the source: blur, then gain + threshold on alpha (gooey-like)
  function boostOf(blur) { var b = clamp(blur / 6, 0, 1); return [1 + 1.1 * b, -0.03 * b]; }
  function drawLayerImage(c, A, L, T, restCx, restCy, alpha, blur) {
    if (alpha <= 0.002) return;
    var lp = A.paint(); lp.setAlphaf(alpha);
    if (blur > 0.05) lp.setImageFilter(A.blurBoost(blur, boostOf(blur)));
    c.saveLayer(lp);
    c.save();
    c.translate(T.cx, T.cy); c.scale(T.sx, T.sy); c.translate(-restCx, -restCy);
    var b = L.box;
    c.drawImageRect(L.img, A.rect(0, 0, b.w * L.scale, b.h * L.scale), A.rect(b.x, b.y, b.w, b.h), A.imagePaint());
    c.restore();
    c.restore();
  }

  var LENS_SKSL =
    'uniform shader img;\n' +
    'uniform float2 c; uniform float2 hs; uniform float r; uniform float band; uniform float amt; uniform float mag;\n' +
    'float sd(float2 p){ float2 q = abs(p - c) - (hs - r); return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }\n' +
    'half4 main(float2 p){\n' +
    '  float d = sd(p);\n' +
    '  float2 n = normalize(float2(sd(p + float2(0.5, 0.0)) - sd(p - float2(0.5, 0.0)), sd(p + float2(0.0, 0.5)) - sd(p - float2(0.0, 0.5))) + 1e-5);\n' +
    '  float s = clamp(-d / band, 0.0, 1.0);\n' +
    '  float e = (1.0 - s) * (1.0 - s);\n' +
    '  float2 q = c + (p - c) / mag - n * amt * e;\n' +
    '  return img.eval(q);\n' +
    '}\n';

  function drawPill(c, A, D) {
    var P = D.pill;
    var x = P.x - P.w / 2, y = P.y, rr0 = A.rrect(x, y, P.w, P.h, P.h / 2);
    if (P.white > 0.002) {
      var ps = A.paint(); ps.setColor(A.color([0, 0, 0, 0.1 * P.white])); ps.setMaskFilter(A.maskBlur(1.5));
      c.save(); c.translate(0, 0.75); c.drawRRect(rr0, ps); c.restore();
      var pw = A.paint(); pw.setColor(A.color([1, 1, 1, P.white])); c.drawRRect(rr0, pw);
    }
  }
  function drawLensGlass(c, A, D, assets) {
    var P = D.pill, glass = 1 - P.white;
    if (glass <= 0.002) return;
    var x = P.x - P.w / 2, y = P.y, rr0 = A.rrect(x, y, P.w, P.h, P.h / 2);
    var gp = A.paint(); gp.setAlphaf(glass);
    c.saveLayer(gp);
    var sh = A.paint(); sh.setColor(A.color([0, 0, 0, 0.12])); sh.setMaskFilter(A.maskBlur(2));
    c.drawRRect(rr0, sh);
    c.drawRRect(rr0, fillPaint(A, vgrad(A, y, y + P.h, COL.lensFill, [0, 0.25, 0.62, 1])));
    var L = assets.bar;
    var u = [P.x, P.y + P.h / 2, P.w / 2, P.h / 2, P.h / 2, 7, 3.2, 1.04];
    // baked icon layer as a child shader; its matrix maps image px → local pt
    var imgShader = A.imageShader(L.img, 1 / L.scale, L.box.x, L.box.y);
    var eff = A.effect('lens', LENS_SKSL);
    var lp = A.paint(); lp.setShader(A.effectShader(eff, u, [imgShader]));
    c.drawRRect(rr0, lp);
    var rim = A.paint(); rim.setStyle(A.Stroke); rim.setStrokeWidth(1);
    rim.setShader(A.linear(0, y, 0, y + P.h, [rgb([255, 255, 255], 0.95), rgb([255, 255, 255], 0.25), rgb([255, 255, 255], 0.6)], [0, 0.55, 1]));
    c.drawRRect(A.rrect(x + 0.5, y + 0.5, P.w - 1, P.h - 1, P.h / 2 - 0.5), rim);
    c.restore();
  }

  function draw(c, A, D, assets) {
    var sh = D.shape;
    // container (bar ↔ menu), with the tab-switch "breathe" scale while it is a bar
    c.save();
    c.translate(BAR.cx, BAR.cy); c.scale(D.breathe.sx, D.breathe.sy); c.translate(-BAR.cx, -BAR.cy);
    drawShell(c, A, sh.x, sh.y, sh.w, sh.h, sh.r, mixCols(COL.barFill, COL.menuFill, D.morph), COL.fillPos, 0);
    if (D.barA > 0.002) {
      c.save(); c.clipRRect(A.rrect(sh.x, sh.y, sh.w, sh.h, sh.r), A.ClipIntersect, true);
      var pa = D.barA; // the pill fades with the bar content
      if (pa > 0.002) {
        var lp = A.paint(); lp.setAlphaf(pa); c.saveLayer(lp);
        c.save(); c.translate(D.barT.cx, D.barT.cy); c.scale(D.barT.sx, D.barT.sy); c.translate(-BAR.cx, -BAR.cy);
        drawPill(c, A, D);
        c.restore(); c.restore();
      }
      c.restore();
      drawLayerImage(c, A, assets.bar, D.barT, BAR.cx, BAR.cy, D.barA, D.barBlur);
      if (D.barA > 0.99) drawLensGlass(c, A, D, assets);
    }
    c.restore();
    if (D.menuA > 0.002) {
      if (D.tileA.some(function (a) { return a < 1; }) && assets.tiles) {
        // pressed tile: draw tiles individually so one can dim
        var mp = A.paint(); mp.setAlphaf(D.menuA); if (D.menuBlur > 0.05) mp.setImageFilter(A.blurBoost(D.menuBlur, boostOf(D.menuBlur)));
        c.saveLayer(mp);
        c.save(); c.translate(D.menuT.cx, D.menuT.cy); c.scale(D.menuT.sx, D.menuT.sy); c.translate(-BAR.cx, -MENU.cy);
        for (var j = 0; j < 6; j++) {
          var t = assets.tiles[j], ip = A.imagePaint(); ip.setAlphaf(D.tileA[j]);
          c.drawImageRect(t.img, A.rect(0, 0, t.box.w * t.scale, t.box.h * t.scale), A.rect(t.box.x, t.box.y, t.box.w, t.box.h), ip);
        }
        c.restore(); c.restore();
      } else drawLayerImage(c, A, assets.menu, D.menuT, BAR.cx, MENU.cy, D.menuA, D.menuBlur);
    }
    // plus / close button
    var P = D.plus, d = PLUS.d * P.s;
    drawShell(c, A, PLUS.cx - d / 2, PLUS.cy - d / 2, d, d, d / 2, COL.plusFill, [0, 0.45, 1], P.white);
    c.save(); c.translate(PLUS.cx, PLUS.cy); c.rotate(P.rot, 0, 0); c.scale(P.s, P.s);
    var ip2 = A.paint(); ip2.setStyle(A.Stroke); ip2.setStrokeWidth(2.15); ip2.setStrokeCap(A.CapRound);
    ip2.setColor(A.color([0.004, 0, 0.02, 1]));
    c.drawPath(A.path('M-5.8 0L5.8 0M0 -5.8L0 5.8'), ip2);
    c.restore();
    A.endFrame();
  }

  // per-tile bake (used only while a tile is pressed)
  function bakeTiles(A, scale) {
    var out = [];
    for (var j = 0; j < 6; j++) {
      var r = tileRect(j), box = { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 };
      var surf = A.surface(Math.ceil(box.w * scale), Math.ceil(box.h * scale));
      var c = surf.canvas; c.save(); c.scale(scale, scale); c.translate(-box.x, -box.y);
      drawTile(c, A, j, scale); c.restore();
      out.push({ img: surf.snap(), box: box, scale: scale });
      A.endFrame();
    }
    return out;
  }

  return {
    F: F, LW: LW, LH: LH, STAGE: STAGE, STAGE_OY: STAGE_OY, BAR: BAR, MENU: MENU, PLUS: PLUS, TILE: TILE, ITEMS: ITEMS,
    OPEN: OPEN, CLOSE: CLOSE, LABEL: LABEL, DEMO: DEMO, DEMO_LEN: DEMO_LEN, LENS_SKSL: LENS_SKSL,
    slotX: slotX, tileRect: tileRect, makeState: makeState, down: down, up: up, hit: hit, busy: busy,
    frame: frame, demoState: demoState, bake: bake, bakeTiles: bakeTiles, draw: draw, drawBackground: drawBackground,
    springFromRest: springFromRest, critical: critical
  };
});
