// Hold-to-commit buttons — shared core (HTML preview and RN component both consume this file).
// Units = pt. Source: 2000x2000 @60fps, phone screen 1490px wide = 402pt -> 3.706 px/pt.
// frame(events, t) is pure: it folds the event list up to t and returns everything a renderer needs.
// The button surface is one shader (SHADER_SKSL): idle bottom glow + fill light (blurred bar, curved front)
// mapped through a fitted colour ramp, screen-blended. Fits live in measure/*.py.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HoldCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // ---------- layout (measured) ----------
  const L = {
    SCREEN_W: 402, SCREEN_H: 874,
    W: 337, H: 48, GAP: 18.6,        // 1248x178px pills, tops 247px apart
    GROUP_DY: 13,                    // group centre sits 13pt below screen centre
    PRESS_S: 0.95,                   // 1186/1248 wide, 168/178 tall while held
    FONT: 17, TRACK: -0.4, WEIGHT: '500',
    CHECK_W: 15, CHECK_GAP: 8, CHECK_STROKE: 1.8,
    CHECK_PATH: 'M1.4 8.2 L5.6 12.8 L13.6 1.8', // 15x15 box
  };

  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const rgb = (a) => a.map((v) => v / 255);

  // ---------- colours (fitted, see measure/) ----------
  // idle glow = base + lobeA*g(cxa,rxa) + lobeB*g(cxb,rxb); lobes anchored below the bottom edge
  const GLOW_SHAPE = [0.32, 0.70, 0.25, 0.26, 0.85, 1.45]; // cxa, cxb, rxa, rxb (x W), ry, cy (x H)
  // fill ramp stops at I = STOPS, values in screen-inverse space: out = 1-(1-idle)(1-ramp(I))
  const STOPS = [0, 0.2, 0.35, 0.5, 0.62, 0.74, 0.86, 1.0];
  const KINDS = {
    commit: {
      base: hex('#111214'), lobeA: rgb([105, 131, 170]), lobeB: rgb([20, 115, 161]),
      fill: ['#000000', '#000000', '#000000', '#282422', '#4e5963', '#7e98ac', '#b9e2f6', '#f4fdfd'].map(hex),
      done: ['#e2e5e8', '#e2e5e8', '#e2e5e8', '#e2e5e8', '#e2e6e9', '#eef3f6', '#f1f6f7', '#f9fdfd'].map(hex),
      idleText: '#effefe', holdText: '#2a464b', doneText: '#0b0b0c',
      label: 'Hold to Commit', doneLabel: 'Committed',
    },
    delete: {
      base: hex('#140d0f'), lobeA: rgb([174, 24, 71]), lobeB: rgb([168, 4, 29]),
      fill: ['#000000', '#000000', '#000000', '#232527', '#65434b', '#b06976', '#f99aae', '#ffcfe3'].map(hex),
      done: ['#e9dce0', '#e9dce0', '#e9dce0', '#e9dce0', '#eadce1', '#f7e4eb', '#f9ebf0', '#fdf4f7'].map(hex),
      idleText: '#ffffff', holdText: '#5c2c3c', doneText: '#0b0b0c',
      label: 'Hold to Delete', doneLabel: 'Deleted',
    },
  };
  const KEEP_LABEL = 'Keep Holding...';
  // burst palette (commit only): white / light blue / grey
  const BURST_COLS = ['#ffffff', '#ffffff', '#ffffff', '#8ccbf2', '#8ccbf2', '#5aa6d6', '#8d9299'];

  // ---------- timing (measured, ms) ----------
  const T = {
    HOLD: 2000,                 // f80 press -> f200 complete, progress linear
    PRESS_IN: 200, PRESS_OUT: 230,
    TXT_KEEP: 220,              // Hold to X -> Keep Holding... (f81-f94)
    TXT_DONE: 300, TXT_DONE_DELAY: 120, // Keep Holding... -> check + Done (swap midpoint f216, settled f226)
    DONE_FILL: 280, DONE_DELAY: 15, // fill floods to the done ramp (f201-f217)
    DARK_P0: 0.53, DARK_P1: 0.83, // label white -> dark as the light passes under it (f144-f180, ease-out: half way by f150)
    RETRACT_MIN: 260, RETRACT_PER_P: 260, // early release: light drains back (not in source)
    RESET: 450,                 // done -> idle (not in source)
    BLUR: 5,                    // label blur at the swap midpoint (pt)
    SPARK_EVERY: 34, SPARK_LIFE: [450, 900],
    BURST_N: 88, BURST_LIFE: [330, 600],
  };
  // fill shape (fitted): front F=(F0+F1 p)W, blurred bar with sigma=S0+S1 F, curved front, vertical bar
  const FILL = { F0: 0.036, F1: 0.94, LAG: -24, S0: 26, S1: 0.04, INS: -8, SY: 8, A2: 0.9, CURVE: 15, DONE_OVER: 20 };

  // ---------- demo script (source timeline: both pressed at f80, held to completion) ----------
  const DEMO = { PRESS: 1333, RESET: 5000, LOOP: 6400 };
  function demoEvents(t) {
    const n = Math.floor(t / DEMO.LOOP), ev = [];
    for (let k = Math.max(0, n - 1); k <= n; k++) {
      const o = k * DEMO.LOOP;
      for (const id of ['commit', 'delete']) {
        ev.push({ t: o + DEMO.PRESS, type: 'down', id });
        ev.push({ t: o + DEMO.PRESS + T.HOLD + 400, type: 'up', id });
        ev.push({ t: o + DEMO.RESET, type: 'reset', id });
      }
    }
    return ev.sort((a, b) => a.t - b.t);
  }

  // ---------- helpers ----------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const easeInOut = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const mixHex = (a, b, k) => {
    const A = hex(a), B = hex(b);
    return '#' + A.map((v, i) => Math.round(lerp(v, B[i], k) * 255).toString(16).padStart(2, '0')).join('');
  };

  // ---------- per-button state fold ----------
  // phases: idle | holding | releasing | done | resetting
  function fold(events, id, t) {
    let s = { phase: 'idle', t0: 0, pr: 0, tr: 0, tc: 0, ts: 0, tPress: -1e9, tUnpress: -1e9, pressFrom: 0, pressed: false,
      labels: [{ key: 'idle', t: -1e9 }] };
    const pAt = (st, tt) => {
      if (st.phase === 'holding') return clamp((tt - st.t0) / T.HOLD, 0, 1);
      if (st.phase === 'releasing') return st.pr * (1 - easeInOut((tt - st.tr) / (T.RETRACT_MIN + T.RETRACT_PER_P * st.pr)));
      if (st.phase === 'done' || st.phase === 'resetting') return 1;
      return 0;
    };
    const pressAt = (st, tt) => st.pressed ? lerp(st.pressFrom, 1, easeOut((tt - st.tPress) / T.PRESS_IN))
      : lerp(st.pressFrom, 0, easeOut((tt - st.tUnpress) / T.PRESS_OUT));
    const setLabel = (key, tt) => { if (s.labels[s.labels.length - 1].key !== key) s.labels.push({ key, t: tt }); };
    const settle = (tt) => {
      // time-driven transitions up to tt
      if (s.phase === 'holding' && tt >= s.t0 + T.HOLD) {
        s.tc = s.t0 + T.HOLD; s.phase = 'done';
        s.pressFrom = pressAt(s, s.tc); s.pressed = false; s.tUnpress = s.tc;
        setLabel('done', s.tc);
      }
      if (s.phase === 'releasing' && tt >= s.tr + T.RETRACT_MIN + T.RETRACT_PER_P * s.pr) s.phase = 'idle';
      if (s.phase === 'resetting' && tt >= s.ts + T.RESET) s.phase = 'idle';
    };
    for (const e of events) {
      if (e.t > t) break;
      if (e.id !== id) continue;
      settle(e.t);
      if (e.type === 'down' && (s.phase === 'idle' || s.phase === 'releasing')) {
        const p = pAt(s, e.t);
        s.pressFrom = pressAt(s, e.t); s.pressed = true; s.tPress = e.t;
        s.phase = 'holding'; s.t0 = e.t - p * T.HOLD;
        setLabel('keep', e.t);
      } else if (e.type === 'up' && s.phase === 'holding') {
        s.pr = pAt(s, e.t); s.tr = e.t; s.phase = 'releasing';
        s.pressFrom = pressAt(s, e.t); s.pressed = false; s.tUnpress = e.t;
        setLabel('idle', e.t);
      } else if (e.type === 'reset' && s.phase === 'done') {
        s.phase = 'resetting'; s.ts = e.t; setLabel('idle', e.t);
      }
    }
    settle(t);
    s.p = pAt(s, t); s.press = clamp(pressAt(s, t), 0, 1);
    return s;
  }

  // label stack: current label fades/blurs in, previous one out (only the latest swap is shown)
  function labelLayers(s, kind, t) {
    const K = KINDS[kind];
    const text = (key) => key === 'done' ? K.doneLabel : key === 'keep' ? KEEP_LABEL : K.label;
    const n = s.labels.length, cur = s.labels[n - 1], prev = n > 1 ? s.labels[n - 2] : null;
    const dur = cur.key === 'done' ? T.TXT_DONE : T.TXT_KEEP, delay = cur.key === 'done' ? T.TXT_DONE_DELAY : 0;
    const u = clamp((t - cur.t - delay) / dur, 0, 1);
    const out = [];
    const darkK = easeOut((s.p - T.DARK_P0) / (T.DARK_P1 - T.DARK_P0));
    const colorOf = (key) => key === 'done' ? K.doneText : key === 'keep' ? mixHex('#ffffff', K.holdText, darkK)
      : (s.phase === 'releasing' ? mixHex(K.idleText, K.holdText, darkK) : (s.phase === 'resetting' ? mixHex(K.doneText, K.idleText, easeInOut((t - s.ts) / T.RESET)) : K.idleText));
    if (prev && u < 1) {
      const uo = clamp(u / 0.95, 0, 1);
      out.push({ key: prev.key, text: text(prev.key), check: prev.key === 'done', color: colorOf(prev.key), a: 1 - easeInOut(uo), b: T.BLUR * easeOut(uo) });
    }
    const ui = clamp((u - 0.1) / 0.9, 0, 1);
    out.push({ key: cur.key, text: text(cur.key), check: cur.key === 'done', color: colorOf(cur.key), a: prev ? easeOut(ui) : 1, b: prev ? T.BLUR * (1 - easeOut(ui)) : 0 });
    return out;
  }

  // pill perimeter point at param u in [0,1): returns position + outward normal (pill-local, centre origin)
  function perimeter(u, w, h) {
    const r = h / 2, straight = w - h, P = 2 * straight + 2 * Math.PI * r;
    let d = u * P;
    if (d < straight) return { x: -straight / 2 + d, y: -r, nx: 0, ny: -1 };
    d -= straight;
    if (d < Math.PI * r) { const a = -Math.PI / 2 + d / r; return { x: straight / 2 + Math.cos(a) * r, y: Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }; }
    d -= Math.PI * r;
    if (d < straight) return { x: straight / 2 - d, y: r, nx: 0, ny: 1 };
    d -= straight;
    const a = Math.PI / 2 + d / r; return { x: -straight / 2 + Math.cos(a) * r, y: Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
  }

  // ---------- frame ----------
  function buttonFrame(events, kind, t, opt) {
    const s = fold(events, kind, t);
    const celebrate = opt && opt[kind + 'Celebrate'] != null ? opt[kind + 'Celebrate'] : kind === 'commit';
    const scale = lerp(1, L.PRESS_S, s.press);
    let F = (FILL.F0 + FILL.F1 * s.p) * L.W, done = 0, fill = 1;
    if (s.phase === 'idle') fill = 0;
    if (s.phase === 'done' || s.phase === 'resetting') {
      done = easeInOut((t - s.tc - T.DONE_DELAY) / T.DONE_FILL);
      F = lerp(F, L.W + FILL.DONE_OVER, done);
    }
    if (s.phase === 'resetting') fill = 1 - easeInOut((t - s.ts) / T.RESET);

    // sparkles riding the light front (both kinds) — emitted while holding
    const sparks = [];
    if (s.phase === 'holding' || s.phase === 'releasing' || s.phase === 'done') {
      const tEnd = s.phase === 'holding' ? t : s.phase === 'releasing' ? s.tr : s.tc;
      const i0 = Math.max(0, Math.floor((t - T.SPARK_LIFE[1] - s.t0) / T.SPARK_EVERY));
      for (let i = i0; s.t0 + i * T.SPARK_EVERY <= tEnd; i++) {
        const ts = s.t0 + i * T.SPARK_EVERY, seed = i * 7.13 + (kind === 'commit' ? 0 : 91.7);
        const life = lerp(T.SPARK_LIFE[0], T.SPARK_LIFE[1], hash(seed + 1)), age = t - ts;
        if (age < 0 || age > life) continue;
        const u = age / life, pS = clamp((ts - s.t0) / T.HOLD, 0, 1);
        const fx = (FILL.F0 + FILL.F1 * pS) * L.W + FILL.LAG * 0.5;
        const x0 = fx - 10 + 34 * hash(seed + 2), y0 = 4 + 40 * hash(seed + 3);
        const vx = 6 + 22 * hash(seed + 4), vy = -18 + 26 * hash(seed + 5);
        sparks.push({ x: x0 + vx * age / 1000, y: y0 + vy * age / 1000, r: 0.45 + 0.65 * hash(seed + 6), a: (0.35 + 0.55 * hash(seed + 7)) * Math.sin(Math.PI * u) });
      }
    }
    // celebration burst — commit only (destructive actions get no celebration)
    const burst = [];
    if (celebrate && (s.phase === 'done' || s.phase === 'resetting')) {
      const age = t - s.tc;
      if (age >= 0 && age < T.BURST_LIFE[1]) {
        for (let i = 0; i < T.BURST_N; i++) {
          const seed = 500 + i * 3.71, life = lerp(T.BURST_LIFE[0], T.BURST_LIFE[1], hash(seed));
          if (age > life) continue;
          const u = (i + 0.8 * hash(seed + 1)) / T.BURST_N;
          const pt = perimeter(u, L.W * scale, L.H * scale);
          const d = 2.5 + 2.5 * hash(seed + 2) + (8 + 10 * hash(seed + 3)) * (1 - Math.exp(-age / 200));
          const tang = (hash(seed + 4) - 0.5) * 6 * (age / 1000);
          burst.push({ x: L.W / 2 + pt.x + pt.nx * d - pt.ny * tang, y: L.H / 2 + pt.y + pt.ny * d + pt.nx * tang,
            r: 0.7 + 1.3 * Math.pow(hash(seed + 5), 2), a: (1 - smooth(0.45 * life, life, age)) * (0.6 + 0.4 * hash(seed + 6)),
            col: BURST_COLS[Math.floor(hash(seed + 7) * BURST_COLS.length)] });
        }
      }
    }
    return { kind, phase: s.phase, p: s.p, scale, F, fill, done, labels: labelLayers(s, kind, t), sparks, burst, completedAt: s.phase === 'done' ? s.tc : null };
  }

  function layout() {
    const cy = L.SCREEN_H / 2 + L.GROUP_DY, x = (L.SCREEN_W - L.W) / 2;
    return { commit: { x, y: cy - L.GAP / 2 - L.H }, delete: { x, y: cy + L.GAP / 2 } };
  }

  function frame(events, t, opt) {
    return { t, commit: buttonFrame(events, 'commit', t, opt), delete: buttonFrame(events, 'delete', t, opt), layout: layout() };
  }

  // ---------- shader ----------
  // Written once in SkSL style; GLSL gets a #define prelude. Coordinates: fragCoord in px, /uPx -> pt, y down.
  const SHADER_BODY = `
uniform float2 uSize;
uniform float uPx;
uniform float uF;
uniform float uFill;
uniform float uDone;
uniform float3 uBase;
uniform float3 uLobeA;
uniform float3 uLobeB;
uniform float3 uRamp[16];

float phi(float z) { return 1.0 / (1.0 + exp(-1.702 * z)); }
float3 ramp(float I, float3 r0, float3 r1, float3 r2, float3 r3, float3 r4, float3 r5, float3 r6, float3 r7) {
  if (I < 0.2) return mix(r0, r1, I / 0.2);
  if (I < 0.35) return mix(r1, r2, (I - 0.2) / 0.15);
  if (I < 0.5) return mix(r2, r3, (I - 0.35) / 0.15);
  if (I < 0.62) return mix(r3, r4, (I - 0.5) / 0.12);
  if (I < 0.74) return mix(r4, r5, (I - 0.62) / 0.12);
  if (I < 0.86) return mix(r5, r6, (I - 0.74) / 0.12);
  return mix(r6, r7, clamp((I - 0.86) / 0.14, 0.0, 1.0));
}
float4 shade(float2 fc) {
  float2 p = fc / uPx;
  float W = uSize.x, H = uSize.y, r = H * 0.5;
  float qx = max(abs(p.x - W * 0.5) - (W * 0.5 - r), 0.0);
  float sd = length(float2(qx, p.y - r)) - r;
  float cov = clamp(0.5 - sd * uPx, 0.0, 1.0);
  if (cov <= 0.0) return float4(0.0);
  // idle bottom glow
  // (no pow() on signed bases: undefined in GLSL / SkSL, NaN on Skia + Metal)
  float ax = (p.x - ${GLOW_SHAPE[0]} * W) / (${GLOW_SHAPE[2]} * W), bx = (p.x - ${GLOW_SHAPE[1]} * W) / (${GLOW_SHAPE[3]} * W);
  float gy = (p.y - ${GLOW_SHAPE[5]} * H) / (${GLOW_SHAPE[4]} * H);
  float ga = exp(-ax * ax - gy * gy);
  float gb = exp(-bx * bx - gy * gy);
  float3 idle = clamp(uBase + uLobeA * ga + uLobeB * gb, 0.0, 1.0);
  // fill light: blurred bar [INS, E(y)] x [INS, H-INS], curved front
  float sg = ${FILL.S0.toFixed(1)} + ${FILL.S1} * uF;
  float v = clamp(abs(p.y - r) / r, 0.0, 1.0);
  float E = uF - (${FILL.LAG.toFixed(1)}) - ${FILL.CURVE.toFixed(1)} * (1.0 - sqrt(1.0 - v * v));
  float hx = phi((p.x - (${FILL.INS.toFixed(1)})) / sg) - phi((p.x - E) / sg);
  float hy = phi((p.y - (${FILL.INS.toFixed(1)})) / ${FILL.SY.toFixed(1)}) - phi((p.y - (H - (${FILL.INS.toFixed(1)}))) / ${FILL.SY.toFixed(1)});
  float A = mix(1.0 - (1.0 - ${FILL.A2}) * clamp((uF - 150.0) / (W - 150.0), 0.0, 1.0), 1.0, uDone);
  float I = clamp(A * hx * hy, 0.0, 1.0);
  float3 rf = ramp(I, uRamp[0], uRamp[1], uRamp[2], uRamp[3], uRamp[4], uRamp[5], uRamp[6], uRamp[7]);
  float3 rd = ramp(I, uRamp[8], uRamp[9], uRamp[10], uRamp[11], uRamp[12], uRamp[13], uRamp[14], uRamp[15]);
  float3 lit = mix(rf, rd, uDone) * uFill;
  float3 col = 1.0 - (1.0 - idle) * (1.0 - lit);
  // 1pt rim: light on dark, faintly dark on light
  float rim = clamp(1.0 - abs(sd + 0.55) / 0.6, 0.0, 1.0);
  float lum = dot(col, float3(0.299, 0.587, 0.114));
  col = clamp(col + rim * (0.12 * (1.0 - lum) + 0.45 * (idle - uBase) * (1.0 - lum) - 0.07 * lum), 0.0, 1.0);
  return float4(col * cov, cov);
}
`;
  const SHADER_SKSL = SHADER_BODY + `
half4 main(float2 fragCoord) { return half4(shade(fragCoord)); }
`;
  const SHADER_GLSL = `precision highp float;
#define float2 vec2
#define float3 vec3
#define float4 vec4
uniform float uResY;
` + SHADER_BODY + `
void main() { gl_FragColor = shade(vec2(gl_FragCoord.x, uResY - gl_FragCoord.y)); }
`;

  // uniforms in declaration order (Skia flattens in this order)
  function uniforms(bf, px) {
    const K = KINDS[bf.kind];
    return { uSize: [L.W, L.H], uPx: px, uF: bf.F, uFill: bf.fill, uDone: bf.done, uBase: K.base, uLobeA: K.lobeA, uLobeB: K.lobeB,
      uRamp: [...K.fill, ...K.done] };
  }

  return { L, T, KINDS, FILL, STOPS, DEMO, KEEP_LABEL, demoEvents, frame, buttonFrame, layout, uniforms, SHADER_SKSL, SHADER_GLSL, perimeter };
});
