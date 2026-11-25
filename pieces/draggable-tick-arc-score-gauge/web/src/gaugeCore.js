/*
 * Score gauge — shared core (HTML preview + React Native component).
 * UMD: classic <script> exposes window.GaugeCore; Metro / esbuild / node get module.exports.
 *
 * One spring is the score: the pointer sets a target, a spring carries the drawn value to it,
 * and every tick, the knob and the figure are read off that one value.
 * All numbers below were measured from the source recording (see ANALYSIS.md).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GaugeCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------- layout (CSS px / pt)
  var L = {
    cardW: 320, cardH: 238, pad: 16, radius: 20,
    headH: 28, plotTop: 62, plotW: 288, plotH: 160,
    cx: 144, cy: 150,        // arc centre inside the plot
    R: 134,                  // outer end of every tick (line end, round cap adds 1.5)
    n: 51, stepDeg: 3.6,     // 51 ticks, 0..180 deg
    tickW: 3,
    lenOn: 15, lenOff: 10,   // base tick length, lit / unlit
    lensAmp: 13, lensSigma: 2.4,
    knobDist: 143, knobR: 4, knobRHeld: 5.5,
    figY: 120, ofY: 146,     // SVG baselines inside the plot
    figSize: 44, figTrack: -0.02, ofSize: 13,
    titleSize: 16, titleTrack: -0.01,
    pillH: 28, pillPadX: 12, pillSize: 12,
  };
  var MIN = 300, MAX = 850;
  var BANDS = [[800, 'Excellent'], [740, 'Very good'], [670, 'Good'], [580, 'Fair'], [-Infinity, 'Poor']];
  // lit-tick colour: three-stop linear sRGB ramp, fitted to the 48 lit ticks seen (rms 1.5/255)
  var STOPS = [[226, 31, 84], [246, 185, 30], [50, 217, 81]];
  var THEMES = {
    light: { slab: [255, 255, 255], ink: [23, 24, 26] },
    dark: { slab: [14, 15, 17], ink: [255, 255, 255] },
  };
  // dynamics
  var SPRING_SCORE = { k: 90, c: 19 };     // pointer target -> drawn value
  var SPRING_FAST = { k: 900, c: 60 };     // grip (press) and knob following the snapped tick
  var TICK_FADE = 0.16;                     // CSS `transition: stroke 160ms` (ease)
  var PILL_IN = 0.18, PILL_OUT = 0.05, PILL_BLUR = 4;

  // ---------------------------------------------------------------- helpers
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function mixRGB(a, b, p) { return [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p]; }
  function hex(c) {
    var s = '#';
    for (var i = 0; i < 3; i++) { var v = Math.round(clamp(c[i], 0, 255)).toString(16); s += v.length < 2 ? '0' + v : v; }
    return s;
  }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  // standard cubic-bezier easing, x -> y (bisection on the parametric form)
  function bezier(x1, y1, x2, y2) {
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var lo = 0, hi = 1, u = x;
      for (var i = 0; i < 40; i++) {
        u = (lo + hi) / 2;
        var bx = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
        if (bx < x) lo = u; else hi = u;
      }
      return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
    };
  }
  var EASE = bezier(0.25, 0.1, 0.25, 1);      // CSS `ease`
  var EASE_OUT = bezier(0.22, 1, 0.36, 1);    // --gag-out
  function springStep(x, v, target, sp, dt) {
    var n = Math.max(1, Math.ceil(dt * 480)), h = dt / n;
    for (var i = 0; i < n; i++) {
      var a = -sp.k * (x - target) - sp.c * v;
      v += a * h; x += v * h;
    }
    return [x, v];
  }
  function theme(name) {
    var t = THEMES[name] || THEMES.light;
    var mix = function (p) { return mixRGB(t.slab, t.ink, p); }; // color-mix(ink p%, slab)
    return { slab: t.slab, ink: t.ink, w6: mix(0.06), w12: mix(0.12), mute: mix(0.52) };
  }
  function tickColour(i) {
    var t = i / (L.n - 1);
    return t <= 0.5 ? mixRGB(STOPS[0], STOPS[1], t / 0.5) : mixRGB(STOPS[1], STOPS[2], (t - 0.5) / 0.5);
  }
  function colourAt(idx) { // continuous index -> ramp colour (knob)
    return tickColour(clamp(idx, 0, L.n - 1));
  }
  function scoreToS(score) { return clamp((score - MIN) / (MAX - MIN), 0, 1); }
  function sToScore(s) { return Math.round(MIN + (MAX - MIN) * clamp(s, 0, 1)); }
  function bandOf(score) {
    for (var i = 0; i < BANDS.length; i++) if (score >= BANDS[i][0]) return BANDS[i][1];
    return 'Poor';
  }
  // pointer (plot coords) -> target fraction; above the centre line it follows the angle,
  // below it pins to whichever end the pointer is on.
  function pointerToS(x, y) {
    var dx = x - L.cx, dy = y - L.cy;
    if (dy >= 0) return dx < 0 ? 0 : 1;
    return (Math.atan2(dy, dx) + Math.PI) / Math.PI;
  }

  // ---------------------------------------------------------------- state
  function createState(score, opts) {
    var s0 = scoreToS(score == null ? 682 : score);
    var sweep = !(opts && opts.sweep === false); // mount: sweeps up from the bottom of the scale
    var v = sweep ? 0 : s0;
    var st = {
      time: 0,
      target: s0,
      v: v, vv: 0,
      held: false, g: 0, gv: 0,
      k: Math.floor(v * (L.n - 1) + 1e-9), kv: 0,
      ticks: [],
      pills: [],
      shown: null,
    };
    for (var i = 0; i < L.n; i++) {
      var on = i <= v * (L.n - 1) + 1e-9;
      st.ticks.push({ on: on, m: on ? 1 : 0, from: on ? 1 : 0, t0: -1, dur: 0 });
    }
    var sc = sToScore(v);
    st.shown = sc;
    st.pills.push({ key: 1, text: bandOf(sc), t0: -1, out: -1 });
    st.pillKey = 1;
    return st;
  }

  function pointer(st, type, x, y) {
    if (type === 'down') { st.held = true; st.target = pointerToS(x, y); }
    else if (type === 'move') { if (st.held) st.target = pointerToS(x, y); }
    else if (type === 'up' || type === 'cancel') { st.held = false; }
  }
  function setScore(st, score) { st.target = scoreToS(score); }
  function nudge(st, delta) { st.target = scoreToS(sToScore(st.target) + delta); }

  function step(st, dt) {
    if (!(dt > 0)) return st;
    dt = Math.min(dt, 0.1);
    st.time += dt;
    var r = springStep(st.v, st.vv, st.target, SPRING_SCORE, dt); st.v = r[0]; st.vv = r[1];
    r = springStep(st.g, st.gv, st.held ? 1 : 0, SPRING_FAST, dt); st.g = r[0]; st.gv = r[1];
    var head = clamp(st.v, 0, 1) * (L.n - 1);
    var snap = Math.floor(head + 1e-9);
    r = springStep(st.k, st.kv, snap, SPRING_FAST, dt); st.k = r[0]; st.kv = r[1];
    // lit state + 160ms stroke transition per tick
    for (var i = 0; i < L.n; i++) {
      var tk = st.ticks[i], on = i <= head + 1e-9;
      if (on !== tk.on) {
        var cur = tickMix(tk, st.time - dt);
        tk.on = on; tk.from = cur; tk.t0 = st.time - dt;
        tk.dur = TICK_FADE * Math.abs((on ? 1 : 0) - cur); // reversing shortens, as in CSS
      }
      tk.m = tickMix(tk, st.time);
    }
    // band pill
    var sc = sToScore(st.v);
    st.shown = sc;
    var b = bandOf(sc), top = st.pills[st.pills.length - 1];
    if (b !== top.text) {
      for (var j = 0; j < st.pills.length; j++) if (st.pills[j].out < 0) st.pills[j].out = st.time;
      st.pillKey += 1;
      st.pills.push({ key: st.pillKey, text: b, t0: st.time, out: -1 });
    }
    st.pills = st.pills.filter(function (p) { return p.out < 0 || st.time - p.out < PILL_OUT; });
    return st;
  }
  function tickMix(tk, now) {
    var to = tk.on ? 1 : 0;
    if (tk.t0 < 0 || tk.dur <= 0) return to;
    var p = clamp((now - tk.t0) / tk.dur, 0, 1);
    return tk.from + (to - tk.from) * EASE(p);
  }
  function settled(st) {
    if (st.held) return false;
    if (Math.abs(st.v - st.target) > 1e-5 || Math.abs(st.vv) > 1e-5) return false;
    if (Math.abs(st.g) > 1e-4 || Math.abs(st.gv) > 1e-4) return false;
    var snap = Math.floor(clamp(st.v, 0, 1) * (L.n - 1) + 1e-9);
    if (Math.abs(st.k - snap) > 1e-4 || Math.abs(st.kv) > 1e-4) return false;
    for (var i = 0; i < L.n; i++) if (st.ticks[i].m !== (st.ticks[i].on ? 1 : 0)) return false;
    for (var j = 0; j < st.pills.length; j++) {
      var p = st.pills[j];
      if (p.out >= 0 || (p.t0 >= 0 && st.time - p.t0 < PILL_IN)) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- display list
  function frame(st, themeName, tone) {
    var th = theme(themeName);
    var mono = tone === 'mono';
    var head = clamp(st.v, 0, 1) * (L.n - 1);
    var grip = clamp(st.g, 0, 1);
    var ticks = [];
    for (var i = 0; i < L.n; i++) {
      var tk = st.ticks[i];
      var len = (tk.on ? L.lenOn : L.lenOff) +
        Math.exp(-Math.pow((i - head) / L.lensSigma, 2)) * L.lensAmp * (0.45 + 0.55 * grip);
      var a = Math.PI - (i * L.stepDeg * Math.PI) / 180;
      var c = Math.cos(a), s = Math.sin(a);
      var onC = mono ? th.ink : tickColour(i);
      ticks.push({
        i: i,
        x1: r3(L.cx + L.R * c), y1: r3(L.cy - L.R * s),
        x2: r3(L.cx + (L.R - len) * c), y2: r3(L.cy - (L.R - len) * s),
        stroke: hex(mixRGB(th.w12, onC, tk.m)),
      });
    }
    var ka = Math.PI - (st.k * L.stepDeg * Math.PI) / 180;
    var knob = {
      cx: r3(L.cx + L.knobDist * Math.cos(ka)),
      cy: r3(L.cy - L.knobDist * Math.sin(ka)),
      r: r3(L.knobR + (L.knobRHeld - L.knobR) * grip),
      fill: hex(mono ? th.ink : colourAt(st.k)),
    };
    var pills = st.pills.map(function (p) {
      var op = 1, blur = 0;
      if (p.t0 >= 0) {
        var e = EASE_OUT(clamp((st.time - p.t0) / PILL_IN, 0, 1));
        op = e; blur = PILL_BLUR * (1 - e);
      }
      if (p.out >= 0) {
        var q = clamp((st.time - p.out) / PILL_OUT, 0, 1);
        op *= 1 - q; blur = Math.max(blur, PILL_BLUR * q);
      }
      return { key: p.key, text: p.text, opacity: r3(op), blur: r3(blur), bg: hex(th.w6), color: hex(th.ink) };
    });
    return {
      score: st.shown,
      band: st.pills[st.pills.length - 1].text,
      card: { w: L.cardW, h: L.cardH, radius: L.radius, pad: L.pad, bg: hex(th.slab) },
      title: { text: 'Credit score', color: hex(th.ink) },
      pills: pills,
      ticks: ticks,
      knob: knob,
      figure: { text: String(st.shown), x: L.cx, y: L.figY, color: hex(th.ink) },
      of: { text: 'of ' + MAX, x: L.cx, y: L.ofY, color: hex(th.mute) },
    };
  }

  // ---------------------------------------------------------------- scripted demo
  // The pointer path the author's site plays on the block (catalog `demo`), plot-relative fractions.
  var DEMO = [
    { ms: 1200 },
    { to: [0.72, 0.3], ms: 700 },
    { act: 'down', ms: 70 },
    { to: [0.2, 0.6], ms: 1200 },
    { to: [0.9, 0.6], ms: 1500 },
    { to: [0.72, 0.3], ms: 900 },
    { act: 'up', ms: 70 },
    { to: [0.5, 1.6], ms: 600 },
  ];
  var DEMO_REST = 1500;
  var DEMO_START = [0.5, 1.6];
  function easeInOut(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  var DEMO_LEN = DEMO.reduce(function (a, s) { return a + s.ms; }, 0);
  var DEMO_PERIOD = DEMO_LEN + DEMO_REST;
  // pointer state of the demo at time t (seconds, looping) -> {x, y (plot px), down}
  function demoPointer(t) {
    var ms = ((t * 1000) % DEMO_PERIOD + DEMO_PERIOD) % DEMO_PERIOD;
    var pos = DEMO_START.slice(), down = false, acc = 0;
    for (var i = 0; i < DEMO.length; i++) {
      var sg = DEMO[i];
      var p = clamp((ms - acc) / sg.ms, 0, 1);
      if (ms < acc) break;
      if (sg.to) {
        var e = easeInOut(p);
        pos = [pos[0] + (sg.to[0] - pos[0]) * e, pos[1] + (sg.to[1] - pos[1]) * e];
      } else if (sg.act === 'down' && ms >= acc) down = true;
      else if (sg.act === 'up' && ms >= acc + sg.ms) down = false;
      acc += sg.ms;
    }
    return { x: pos[0] * L.plotW, y: pos[1] * L.plotH, down: down };
  }
  // feed the demo pointer into a live state (call once per frame before step)
  function applyDemo(st, prevPtr, ptr) {
    if (ptr.down && !(prevPtr && prevPtr.down)) pointer(st, 'down', ptr.x, ptr.y);
    else if (ptr.down) pointer(st, 'move', ptr.x, ptr.y);
    else if (prevPtr && prevPtr.down) pointer(st, 'up', ptr.x, ptr.y);
  }
  // deterministic replay from mount to time t at 60 fps (frozen frames for parity / thumbnails)
  function simulateDemo(t, score) {
    var st = createState(score);
    var n = Math.round(Math.max(0, t) * 60), prev = null;
    for (var f = 1; f <= n; f++) {
      var ptr = demoPointer(f / 60);
      applyDemo(st, prev, ptr);
      prev = ptr;
      step(st, 1 / 60);
    }
    st.demoPtr = prev || demoPointer(0);
    return st;
  }

  return {
    L: L, MIN: MIN, MAX: MAX, BANDS: BANDS, STOPS: STOPS, THEMES: THEMES,
    SPRING_SCORE: SPRING_SCORE, SPRING_FAST: SPRING_FAST,
    hex: hex, theme: theme, tickColour: tickColour, bandOf: bandOf, pointerToS: pointerToS,
    createState: createState, pointer: pointer, setScore: setScore, nudge: nudge,
    step: step, settled: settled, frame: frame,
    DEMO: DEMO, DEMO_PERIOD: DEMO_PERIOD, demoPointer: demoPointer, applyDemo: applyDemo,
    simulateDemo: simulateDemo,
  };
});
