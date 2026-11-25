/* Glow widgets — shared core (HTML preview + React Native).
 * 三张深色小组件：①Energy now 实时折线（曲线匀速左移、圆点固定、读数跟随圆点高度）；②Living room 温控表盘（19°/24° 弹簧切换，
 * 刻度 / 光晕 / 药丸随温度连续插色，标签在弹簧回弹后才切换）；③Midnight Drive 音乐卡（20 根波形条 + 每 0.5s 的底鼓脉冲，背景光晕同拍）。
 * 坐标：设计单位 u = 原片 px / 2（原片 1440×900 = 画布 720×450u）；角度为度，0° 向右、逆时针为正、y 向下。
 * 所有数值测自原片（analysis.md）。widget(kind, t, opts) 是 t 的纯函数，返回卡内坐标的显示列表：
 *   { w, h, bleed, defs:[渐变], shapes:[Path], texts:[文字] }   —— HTML 与 RN 逐项同源。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GlowCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LOOP = 5; // 全片循环周期（秒）
  var CANVAS = { w: 720, h: 450, bg: '#060508' };
  var CARDS = {
    energy: { x: 132, y: 32.1, w: 456, h: 150, r: 40, bleed: 40, bg: '#09100E', phase: 0 },
    thermo: { x: 132, y: 198.4, w: 220, h: 220, r: 52, bleed: 48, bg: '#09090E', phase: 2.2 },
    music: { x: 368, y: 198.4, w: 220, h: 220, r: 52, bleed: 40, bg: '#0B070D', phase: -2.2 },
  };
  // 展示层漂浮（原片每张卡 5s 周期上下 ±2u，相位不同）——不属于 UI，默认关闭
  var FLOAT = { amp: 2, period: 5 };
  var BORDER = { color: '#FFFFFF', op: 0.09, w: 0.5 };
  // 文字基线 → 行盒顶（line-height = 字号）。SF Pro：ascent 0.952 / descent 0.241，半行距居中后基线在 0.855em
  var BASE = 0.855;
  // 原片小字（<20）是 SF Pro Display 的字距；iOS 系统字体在 20pt 以下自动切到 SF Text（更宽），RN 端补偿字距（u/字，Chrome 实测 Display−Text）
  var TRACK = { label: -0.697, unit: -0.594, live: -0.473, room: -0.618, eco: -0.505, heat: -0.511, title: -0.666, artist: -0.571 };

  // ---------------------------------------------------------------- 工具
  function f2(v) { return Math.round(v * 100) / 100; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hex2rgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgb2hex(c) {
    return '#' + c.map(function (v) { var s = Math.round(clamp(v, 0, 255)).toString(16).toUpperCase(); return s.length < 2 ? '0' + s : s; }).join('');
  }
  function mix(a, b, k) { var A = hex2rgb(a), B = hex2rgb(b); return rgb2hex([0, 1, 2].map(function (i) { return A[i] + (B[i] - A[i]) * k; })); }
  function roundRect(x, y, w, h, r) {
    return 'M' + f2(x + r) + ' ' + f2(y) + 'H' + f2(x + w - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + f2(x + w) + ' ' + f2(y + r) +
      'V' + f2(y + h - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + f2(x + w - r) + ' ' + f2(y + h) + 'H' + f2(x + r) +
      'A' + r + ' ' + r + ' 0 0 1 ' + f2(x) + ' ' + f2(y + h - r) + 'V' + f2(y + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + f2(x + r) + ' ' + f2(y) + 'Z';
  }
  function ellipse(cx, cy, rx, ry) {
    return 'M' + f2(cx - rx) + ' ' + f2(cy) + 'A' + f2(rx) + ' ' + f2(ry) + ' 0 1 0 ' + f2(cx + rx) + ' ' + f2(cy) +
      'A' + f2(rx) + ' ' + f2(ry) + ' 0 1 0 ' + f2(cx - rx) + ' ' + f2(cy) + 'Z';
  }
  function circle(cx, cy, r) { return ellipse(cx, cy, r, r); }
  // 多层描边合成指定辉光剖面：T(d) 为距中心线 d 处的目标不透明度；由外向内第 k 层 a_k = 1-(1-T(r_k))/(1-T(r_{k-1}))（不透明度叠乘反解）
  function glowStack(T, reach, inner, n) {
    var out = [], prev = 0;
    for (var k = 0; k < n; k++) {
      var r = reach - (reach - inner) * (k / (n - 1));
      var tr = T(r), a = 1 - (1 - tr) / (1 - prev);
      out.push({ w: f2(2 * r), op: Math.round(clamp(a, 0, 1) * 10000) / 10000 });
      prev = tr;
    }
    return out;
  }
  // 径向 α(r) = a·(1-r)^p 的 6 段渐变
  function powStops(col, a, p) {
    return [0, 0.2, 0.4, 0.6, 0.8, 1].map(function (r) { return [r, col, Math.round(a * Math.pow(1 - r, p) * 10000) / 10000]; });
  }
  // 外晕叠层（小 α 近似相加）：第 j 层外扩 d_j，α_j = T(d_j) - T(d_{j-1})，T(d) = e^{-d/L}
  function haloLayers(L, reach, n) {
    var out = [], prev = 0;
    for (var j = 0; j < n; j++) {
      var d = reach * (1 - j / n), tv = Math.exp(-d / L);
      out.push({ d: f2(d), op: Math.round((tv - prev) * 10000) / 10000 });
      prev = tv;
    }
    return out;
  }
  function linear(id, x1, y1, x2, y2, stops, units) { return { id: id, kind: 'linear', units: units || 'user', x1: x1, y1: y1, x2: x2, y2: y2, stops: stops }; }
  function radial(id, stops) { return { id: id, kind: 'radial', units: 'obb', cx: 0.5, cy: 0.5, r: 0.5, stops: stops }; }
  function url(uid, id) { return 'url(#' + uid + '-' + id + ')'; }
  function text(key, s, x, baseline, size, weight, color, extra) {
    var o = { key: key, text: s, x: f2(x), y: f2(baseline - BASE * size), size: size, weight: weight, color: color, op: 1, ls: 0, lsText: TRACK[key] || 0, align: 'left', w: 0, tab: false };
    for (var k in extra) o[k] = extra[k];
    return o;
  }
  function floatOffset(kind, t) { return FLOAT.amp * Math.sin((2 * Math.PI * t) / FLOAT.period + CARDS[kind].phase); }
  function cardFrame(c, uid, shapes, defs) {
    // 外框描边（1px@2x）
    shapes.push({ d: roundRect(0.25, 0.25, c.w - 0.5, c.h - 0.5, c.r - 0.25), fill: 'none', stroke: BORDER.color, w: BORDER.w, op: BORDER.op });
  }

  // ---------------------------------------------------------------- ① Energy now
  // 曲线（卡内 y，单位 u）：y(x,t) = Y0 + Σ A_n sin(nθ + φ_n)，θ = 2π(x + W·t/5)/W —— 每 5s 恰好左移一个卡宽（无缝循环）
  var ENERGY = {
    Y0: 106.67,
    H: [[1, 16.855, -2.7349], [3, 8.96, -1.4224], [7, 4.43, -0.199]],
    kw0: 4.7691, kwPerU: 0.0147, // 读数 kW = kw0 - kwPerU·y(圆点)
    dotX: 319.8, dotR: 4.4,
    step: 2, // 采样步长
    line: '#34D399', core: '#B4FFE4', coreW: 2.1,
    glow: { peak: 0.5, decay: 5.06, reach: 20, n: 12 },
    edge: 0.125, edgeMin: 0.12, // 两端 12.5% 线性渐隐（到 0.12）
    fillTop: 74, fillStops: [[0, 0.442], [1, 0.229]],
    bell: 0.64, // 填充横向 sin(πx/W)^0.64（10 万像素联合拟合：辉光 + 竖向 + 横向）
    pill: { x: 386, y: 22.5, w: 44, h: 20, bg: '#34D399', bgOp: 0.16, dotX: 395.5, dotR: 2.7, dot: '#34D399', text: '#6EE7B7' },
    halo: { color: '#34D399', op: 0.07 },
  };
  function energyY(x, t) {
    var W = CARDS.energy.w, th = (2 * Math.PI * (x + (W * t) / LOOP)) / W, y = ENERGY.Y0;
    for (var i = 0; i < ENERGY.H.length; i++) { var h = ENERGY.H[i]; y += h[1] * Math.sin(h[0] * th + h[2]); }
    return y;
  }
  function energyValue(t) { return ENERGY.kw0 - ENERGY.kwPerU * energyY(ENERGY.dotX, t); }
  var ENERGY_GLOW = glowStack(function (d) { return ENERGY.glow.peak * Math.exp(-(d - 1) / ENERGY.glow.decay); }, ENERGY.glow.reach, 1.6, ENERGY.glow.n);

  function energy(t, uid) {
    var c = CARDS.energy, W = c.w, H = c.h, E = ENERGY, defs = [], shapes = [], texts = [];
    uid = uid || 'e';
    // 外晕
    defs.push(radial('halo', [[0, E.halo.color, E.halo.op], [1, E.halo.color, 0]]));
    shapes.push({ d: ellipse(W / 2, H * 0.62, W / 2 + 34, H / 2 + 30), fill: url(uid, 'halo') });
    shapes.push({ d: roundRect(0, 0, W, H, c.r), fill: c.bg });
    // 曲线
    var pts = [];
    for (var x = 0; x <= W + 1e-6; x += E.step) pts.push([x, energyY(x, t)]);
    var line = 'M' + pts.map(function (p) { return f2(p[0]) + ' ' + f2(p[1]); }).join('L');
    var area = line + 'L' + W + ' ' + H + 'L0 ' + H + 'Z';
    // 填充：竖向渐变（user 空间）× 横向钟形（用卡底色盖层实现乘法：结果 = bg + (1-o)(fill-bg)）
    defs.push(linear('fillV', 0, E.fillTop, 0, H, E.fillStops.map(function (s) { return [s[0], E.line, s[1]]; })));
    var bell = [];
    for (var i = 0; i <= 10; i++) { var u = i / 10; bell.push([u, c.bg, f2(1 - Math.pow(Math.sin(Math.PI * u), E.bell))]); }
    defs.push(linear('fillH', 0, 0, W, 0, bell));
    var clip = roundRect(0, 0, W, H, c.r);
    shapes.push({ d: area, fill: url(uid, 'fillV'), clip: true });
    shapes.push({ d: area, fill: url(uid, 'fillH'), clip: true });
    // 线：辉光叠层 + 核心线，均用两端渐隐的横向渐变描边
    var edge = function (col) { return [[0, col, E.edgeMin], [E.edge, col, 1], [1 - E.edge, col, 1], [1, col, E.edgeMin]]; };
    defs.push(linear('lineG', 0, 0, W, 0, edge(E.line)));
    defs.push(linear('lineC', 0, 0, W, 0, edge(E.core)));
    ENERGY_GLOW.forEach(function (g) { shapes.push({ d: line, fill: 'none', stroke: url(uid, 'lineG'), w: g.w, op: g.op, cap: 'round', join: 'round', clip: true }); });
    shapes.push({ d: line, fill: 'none', stroke: url(uid, 'lineC'), w: E.coreW, op: 1, cap: 'round', join: 'round', clip: true });
    // 圆点 + 竖虚线
    var dy = energyY(E.dotX, t);
    shapes.push({ d: 'M' + E.dotX + ' ' + f2(dy + E.dotR + 2) + 'V' + H, fill: 'none', stroke: '#A7F3D0', w: 0.8, op: 0.45, dash: [2, 4] });
    defs.push(radial('dotGlow', [[0, '#B4FFE4', 0.6], [0.3, E.line, 0.34], [0.6, E.line, 0.12], [1, E.line, 0]]));
    shapes.push({ d: circle(E.dotX, dy, 17), fill: url(uid, 'dotGlow') });
    shapes.push({ d: circle(E.dotX, dy, E.dotR), fill: '#FFFFFF' });
    // Live 药丸（圆点 1Hz 呼吸）
    var P = E.pill, pulse = 0.775 + 0.225 * Math.cos(2 * Math.PI * t);
    shapes.push({ d: roundRect(P.x, P.y, P.w, P.h, P.h / 2), fill: P.bg, op: P.bgOp });
    shapes.push({ d: circle(P.dotX, P.y + P.h / 2, P.dotR), fill: P.dot, op: f2(pulse * 1000) / 1000 });
    cardFrame(c, uid, shapes, defs);
    // 文字
    texts.push(text('label', 'Energy now', 28.5, 33, 11.8, '400', '#8F9A96'));
    texts.push(text('value', energyValue(t).toFixed(2), 26.2, 69.4, 34, '300', '#FFFFFF', { tab: true }));
    texts.push(text('unit', 'kW', 99.6, 69.6, 14.5, '400', '#87928E', { ls: 0.4 }));
    texts.push(text('live', 'Live', P.dotX + 7.8, P.y + 13.6, 9.5, '600', P.text));
    return { kind: 'energy', w: W, h: H, bleed: c.bleed, clip: clip, defs: defs, shapes: shapes, texts: texts };
  }

  // ---------------------------------------------------------------- ② Thermostat
  // 温度由弹簧驱动（k=80, c=9, m=1；ω=8.95, ζ=0.503），t=0.50s 目标 19→24，t=2.95s 24→19；标签在 +0.575s 才切换
  var THERMO = {
    lo: 19, hi: 24, tUp: 0.5, tDown: 2.95, w0: 8.952, zeta: 0.503,
    labelDelay: 0.575, labelFade: 0.1,
    min: 16, a0: 225, degPer: 22.5, // 角度 = 225 - 22.5·(T - 16)
    cx: 110, cy: 114, rIn: 71, rOut: 79, tickW: 2, ticks: 49, tickStep: 5.625, knobR: 5.4, knobRing: 75,
    // glow：卡内圆形光晕的纯色（stop α 0.5 时与原片拟合），halo 共用；knob：旋钮外圈小光晕
    blue: { tick: '#3B82F6', glow: '#397AEB', pill: '#1C396B', pillText: '#A9C5FA', knob: '#3B82F6' },
    orange: { tick: '#F7843C', glow: '#EB7B30', pill: '#69391C', pillText: '#FFD3B4', knob: '#E27A40' },
    glowC: [110, 125], glowR: 133, glowPow: 1.55, glowA: 0.5,
    halo: { L: 16.5, reach: 46, n: 12, v: [[-48, 0.027], [0, 0.042], [110, 0.092], [220, 0.156], [268, 0.183]] },
    inactive: 0.17, rampLo: 0.42,
  };
  function stepResp(t) {
    if (t <= 0) return 0;
    var w = THERMO.w0, z = THERMO.zeta, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  }
  function smooth(e0, e1, x) { var u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); }
  function thermoState(t) {
    var T = THERMO, tl = ((t % LOOP) + LOOP) % LOOP, temp = T.lo, lab = 0;
    for (var n = -1; n <= 0; n++) {
      temp += (T.hi - T.lo) * (stepResp(tl - T.tUp - n * LOOP) - stepResp(tl - T.tDown - n * LOOP));
    }
    var up = T.tUp + T.labelDelay, dn = T.tDown + T.labelDelay, f = T.labelFade / 2;
    lab = smooth(up - f, up + f, tl) - smooth(dn - f, dn + f, tl);
    return { temp: temp, s: clamp((temp - T.lo) / (T.hi - T.lo), 0, 1), label: lab, angle: T.a0 - T.degPer * (temp - T.min), display: Math.round(temp) };
  }
  function polar(cx, cy, r, a) { var q = (a * Math.PI) / 180; return [cx + r * Math.cos(q), cy - r * Math.sin(q)]; }

  function thermo(t, uid) {
    var c = CARDS.thermo, T = THERMO, W = c.w, H = c.h, defs = [], shapes = [], texts = [];
    uid = uid || 't';
    var st = thermoState(t), s = st.s, col = function (k) { return mix(T.blue[k], T.orange[k], s); };
    // 外晕：距卡边 e^{-d/16.5} 衰减、越往下越强（逐层外扩圆角矩形 + 竖向不透明度渐变）
    var Hl = T.halo, hb = -c.bleed, he = H + c.bleed;
    defs.push(linear('haloV', 0, hb, 0, he, Hl.v.map(function (v) { return [f2((v[0] - hb) / (he - hb)), col('glow'), v[1]]; })));
    haloLayers(Hl.L, Hl.reach, Hl.n).forEach(function (l) { shapes.push({ d: roundRect(-l.d, -l.d, W + 2 * l.d, H + 2 * l.d, c.r + l.d), fill: url(uid, 'haloV'), op: l.op }); });
    shapes.push({ d: roundRect(0, 0, W, H, c.r), fill: c.bg });
    // 卡内光晕：圆形，α = 0.5·(1-r)^1.55
    defs.push(radial('glow', powStops(col('glow'), T.glowA, T.glowPow)));
    shapes.push({ d: circle(T.glowC[0], T.glowC[1], T.glowR), fill: url(uid, 'glow'), clip: true });
    // 刻度
    var iK = (st.temp - T.min) * 4;
    for (var i = 0; i < T.ticks; i++) {
      var a = T.a0 - i * T.tickStep, p0 = polar(T.cx, T.cy, T.rIn, a), p1 = polar(T.cx, T.cy, T.rOut, a);
      var d = 'M' + f2(p0[0]) + ' ' + f2(p0[1]) + 'L' + f2(p1[0]) + ' ' + f2(p1[1]);
      var on = clamp(iK - i + 0.5, 0, 1); // 跨过刻度时 1 个刻度宽度内渐变
      var actOp = T.rampLo + (1 - T.rampLo) * clamp(i / Math.max(iK, 1), 0, 1);
      if (on < 1) shapes.push({ d: d, fill: 'none', stroke: '#FFFFFF', w: T.tickW, op: f2(T.inactive * (1 - on) * 1000) / 1000, cap: 'round' });
      if (on > 0) shapes.push({ d: d, fill: 'none', stroke: col('tick'), w: T.tickW, op: f2(actOp * on * 1000) / 1000, cap: 'round' });
    }
    // 旋钮 + 光晕
    var k = polar(T.cx, T.cy, T.knobRing, st.angle);
    defs.push(radial('knobGlow', [[0, col('knob'), 0.8], [0.35, col('knob'), 0.6], [0.47, col('knob'), 0.42], [0.67, col('knob'), 0.15], [0.85, col('knob'), 0.04], [1, col('knob'), 0]]));
    shapes.push({ d: circle(k[0], k[1], 15), fill: url(uid, 'knobGlow') });
    shapes.push({ d: circle(k[0], k[1], T.knobR), fill: '#FFFFFF' });
    // 药丸：底色 = 主题色与标签色各半
    var pk = (s + st.label) / 2;
    shapes.push({ d: roundRect(73.5, 145.75, 73, 20, 10), fill: mix(T.blue.pill, T.orange.pill, pk) });
    cardFrame(c, uid, shapes, defs);
    texts.push(text('room', 'Living room', 0, 28.65, 10.5, '400', '#9A979E', { align: 'center', x: 0, w: W }));
    texts.push(text('temp', st.display + '°', 0, 127.3, 54, '300', '#FFFFFF', { align: 'center', x: 0.3, w: W, ls: -0.7 }));
    var ptc = mix(T.blue.pillText, T.orange.pillText, pk);
    if (st.label < 1) texts.push(text('eco', 'Eco', 0, 158.6, 9.8, '500', ptc, { ls: -0.3, align: 'center', x: 73.5, w: 73, op: f2((1 - st.label) * 1000) / 1000 }));
    if (st.label > 0) texts.push(text('heat', 'Heating', 0, 158.6, 9.8, '500', ptc, { ls: -0.3, align: 'center', x: 73.5, w: 73, op: f2(st.label * 1000) / 1000 }));
    return { kind: 'thermo', w: W, h: H, bleed: c.bleed, clip: roundRect(0, 0, W, H, c.r), defs: defs, shapes: shapes, texts: texts, state: st };
  }

  // ---------------------------------------------------------------- ③ Music
  // 条高（u）：h_k(t) = D + A1 sin(2πt + 0.7k) + A3 sin(6πt + 1.9k) + K/(1+q·k)·e^{-(t mod 0.5)/τ}（拟合残差 0.29u RMS）
  var MUSIC = {
    D: 33.575, A1: 12.006, A3: 8.218, K: 35.045, q: 0.1448, tau: 0.0725, beat: 0.5,
    bars: 20, x0: 21.75, pitch: 9, bw: 5, cy: 111.75,
    top: '#E86CB4', bottom: '#8C58E8',
    glow: '#A64CC0', glowOp: 0.5, glowKick: 0.5, glowC: [110, 140], glowR: 118.5, glowPow: 1.12,
    play: { cx: 110, cy: 182.5, r: 19 },
  };
  // 封面：三色锥形渐变（粉 85° / 青 205° / 紫 325°，RGB 循环插值），顺时针 72°/s（每 5s 一圈）；RN 无锥形渐变 → 120 个 3° 扇形
  var ART = { x: 22, y: 22.25, s: 36, r: 9, stops: [[85, '#DE4CA2'], [205, '#44B0F5'], [325, '#8C5DF0']], spin: -72, n: 120 };
  function conicColor(a) {
    var S = ART.stops, a2 = ((a - S[0][0]) % 360 + 360) % 360 + S[0][0];
    for (var i = 0; i < S.length; i++) {
      var p = S[i], q = S[(i + 1) % S.length], qa = i + 1 < S.length ? q[0] : q[0] + 360;
      if (a2 >= p[0] && a2 <= qa) return mix(p[1], q[1], (a2 - p[0]) / (qa - p[0]));
    }
    return S[0][1];
  }
  // 扇形颜色固定（t=0 的相位），整组按 rot 旋转：SVG rotate 正值 = 屏幕顺时针，故 rot = -spin·t
  var ART_WEDGES = (function () {
    var cx = ART.x + ART.s / 2, cy = ART.y + ART.s / 2, R = 27, out = [], da = 360 / ART.n;
    for (var i = 0; i < ART.n; i++) {
      var a0 = i * da - 0.6, a1 = (i + 1) * da + 0.6, p0 = polar(cx, cy, R, a0), p1 = polar(cx, cy, R, a1);
      out.push({ d: 'M' + f2(cx) + ' ' + f2(cy) + 'L' + f2(p0[0]) + ' ' + f2(p0[1]) + 'L' + f2(p1[0]) + ' ' + f2(p1[1]) + 'Z', fill: conicColor((i + 0.5) * da) });
    }
    return out;
  })();
  function artGroup(t) {
    var rot = ((-ART.spin * t) % 360 + 360) % 360;
    return { group: 'art', clipArt: true, rot: Math.round(rot * 1000) / 1000, cx: ART.x + ART.s / 2, cy: ART.y + ART.s / 2, shapes: ART_WEDGES };
  }
  function kick(t) { var p = ((t % MUSIC.beat) + MUSIC.beat) % MUSIC.beat; return Math.exp(-p / MUSIC.tau); }
  function barHeights(t) {
    var M = MUSIC, kk = kick(t), out = [];
    for (var k = 0; k < M.bars; k++) {
      out.push(M.D + M.A1 * Math.sin(2 * Math.PI * t + 0.7 * k) + M.A3 * Math.sin(6 * Math.PI * t + 1.9 * k) + (M.K / (1 + M.q * k)) * kk);
    }
    return out;
  }
  function music(t, uid) {
    var c = CARDS.music, M = MUSIC, W = c.w, H = c.h, defs = [], shapes = [], texts = [];
    uid = uid || 'm';
    shapes.push({ d: roundRect(0, 0, W, H, c.r), fill: c.bg });
    var g = clamp(M.glowOp * (1 + M.glowKick * kick(t)), 0, 1);
    defs.push(radial('glow', powStops(M.glow, g, M.glowPow)));
    shapes.push({ d: circle(M.glowC[0], M.glowC[1], M.glowR), fill: url(uid, 'glow'), clip: true });
    // 封面
    shapes.push(artGroup(t));
    // 原片锥形渐变中心是柔化的（无尖锐风车心）：中心叠一层三色均值的径向渐隐
    defs.push(radial('artCore', [[0, '#9772DA', 0.9], [0.45, '#9772DA', 0.4], [1, '#9772DA', 0]]));
    shapes.push({ d: circle(ART.x + ART.s / 2, ART.y + ART.s / 2, 9), fill: url(uid, 'artCore'), clipArt: true });
    // 波形条（每根条自带竖向渐变，objectBoundingBox）
    defs.push(linear('bar', 0, 0, 0, 1, [[0, M.top, 1], [1, M.bottom, 1]], 'obb'));
    barHeights(t).forEach(function (h, k) {
      var x = M.x0 + k * M.pitch;
      shapes.push({ d: roundRect(x, M.cy - h / 2, M.bw, h, M.bw / 2), fill: url(uid, 'bar') });
    });
    // 控制区
    var P = M.play;
    defs.push(radial('playGlow', [[0, '#E9D5FF', 0.35], [0.5, '#C4A0F5', 0.12], [1, '#A777E8', 0]]));
    shapes.push({ d: circle(P.cx, P.cy, P.r + 16), fill: url(uid, 'playGlow') });
    shapes.push({ d: circle(P.cx, P.cy, P.r), fill: '#FFFFFF' });
    shapes.push({ d: roundRect(P.cx - 4.3, P.cy - 4.6, 2.9, 9.2, 0.8) + roundRect(P.cx + 1.4, P.cy - 4.6, 2.9, 9.2, 0.8), fill: '#0B0910' });
    var ic = '#E4CFEA';
    shapes.push({ d: roundRect(57.2, 178.3, 1.7, 8.4, 0.5) + 'M65.2 178.5L59.6 182.5L65.2 186.5Z', fill: ic, join: 'round' });
    shapes.push({ d: roundRect(161.1, 178.3, 1.7, 8.4, 0.5) + 'M154.8 178.5L160.4 182.5L154.8 186.5Z', fill: ic, join: 'round' });
    cardFrame(c, uid, shapes, defs);
    texts.push(text('title', 'Midnight Drive', 67, 38.9, 12.6, '600', '#FFFFFF', { ls: 0.25 }));
    texts.push(text('artist', 'Neon Harbor', 67.2, 51.2, 9.4, '400', '#8E8597'));
    return { kind: 'music', w: W, h: H, bleed: c.bleed, clip: roundRect(0, 0, W, H, c.r), artClip: roundRect(22, 22.25, 36, 36, 9), defs: defs, shapes: shapes, texts: texts };
  }

  function widget(kind, t, uid) {
    return kind === 'energy' ? energy(t, uid) : kind === 'thermo' ? thermo(t, uid) : music(t, uid);
  }

  return {
    LOOP: LOOP, CANVAS: CANVAS, CARDS: CARDS, FLOAT: FLOAT, BASE: BASE, ENERGY: ENERGY, THERMO: THERMO, MUSIC: MUSIC,
    widget: widget, energy: energy, thermo: thermo, music: music,
    energyY: energyY, energyValue: energyValue, thermoState: thermoState, barHeights: barHeights, kick: kick, floatOffset: floatOffset,
    mix: mix, glowStack: glowStack,
  };
});
