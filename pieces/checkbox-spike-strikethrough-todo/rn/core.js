// 04_motion_todo_check_strike — 共享 core（HTML 预览与 RN 组件共同消费）
// 单位：pt（源片 1080px 宽 ≙ 433pt，S = 2.494 px/pt；卡片 360×292pt）
// 时间：秒。所有动态值都由纯函数 rowVisual(state, now) 给出。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TodoCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var S = 2.494; // 源片 px / pt

  // ---------- 布局（全部由 full0.png 实测换算） ----------
  var L = {
    cardW: 360, cardH: 292, cardR: 22,
    padX: 17.2,
    titleX: 17.2, titleBaseline: 30.1, titleSize: 15.5,
    plusCx: 332.8, plusCy: 24.9, btnD: 20,
    rowY0: 73.8, rowPitch: 47.3,
    boxCx: 25.7, boxSize: 18, boxStroke: 2.1, boxR: 7.4,
    textX: 46.1, textSize: 15, textBaselineOff: 5.25,
    sepX0: 46.1, sepX1: 342.3,
    strikeW: 1.8, strikePad: 1.6, strikePadR: 3.0,
    pillH: 20, pillPadL: 6.8, pillPadR: 5.2, pillIcon: 7.6, pillGap: 5.0, pillSize: 11.2,
    pillRight: 342.3, pillRightWithFlag: 313.5,
    emojiSize: 16.5, emojiGap: 3.6,
  };
  L.rowY = function (i) { return L.rowY0 + L.rowPitch * i; };

  var ITEMS = [
    { title: 'Go for a run', emoji: true, flag: 'orange' },
    { title: 'Book a dentist appointment' },
    { title: 'Call mom', pill: { label: 'Today', tone: 'blue' } },
    { title: 'Buy groceries' },
    { title: 'Renew passport', pill: { label: 'Tomorrow', tone: 'neutral' }, flag: 'red' },
  ];
  // 删除线全长兜底表（pt，源片实测 strike 像素长度 / S）；运行时优先用实测文字宽度 + strikePad + strikePadR
  var STRIKE_LEN = [105.0, 190.5, 66.2, 95.4, 111.5];

  // ---------- 颜色 ----------
  var C = {
    blue: [0, 145, 255],
    ringRest: [200, 230, 240, 0.31],
    ringMid: [70, 122, 168, 0.9],
    title: [238, 246, 251],
    text: [233, 242, 246],
    textDoneA: 0.42,
    sep: [255, 255, 255, 0.065],
    btnBg: [255, 255, 255, 0.075],
    plus: [232, 242, 245],
    checkWhite: [255, 255, 255],
    checkGray: [150, 168, 178],
    flag: { orange: { bg: [255, 159, 10, 0.12], fg: [255, 168, 20] }, red: { bg: [255, 59, 48, 0.17], fg: [255, 72, 64] } },
    flagDone: { bg: [255, 255, 255, 0.02], fg: [200, 215, 230, 0.26] },
    pill: {
      blue: { bg: [0, 145, 255, 0.13], fg: [58, 160, 255, 1] },
      neutral: { bg: [255, 250, 240, 0.05], fg: [255, 246, 236, 0.62] },
    },
    pillDone: { bg: [255, 255, 255, 0.012], fg: [205, 222, 236, 0.24] },
    card: [3, 9, 11, 0.8],
  };

  // ---------- 数学 ----------
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(t, t0, t1) { return clamp((t - t0) / (t1 - t0), 0, 1); }
  function sine(p) { return -(Math.cos(Math.PI * p) - 1) / 2; }
  function outSine(p) { return Math.sin((p * Math.PI) / 2); }
  function outCubic(p) { return 1 - Math.pow(1 - p, 3); }
  function bez(x1, y1, x2, y2) {
    // 标准三次贝塞尔参数式，x(tt) 二分求 tt
    function B(a, b, tt) { var u = 1 - tt; return 3 * u * u * tt * a + 3 * u * tt * tt * b + tt * tt * tt; }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var lo = 0, hi = 1, mid = 0.5;
      for (var i = 0; i < 24; i++) { mid = (lo + hi) / 2; if (B(x1, x2, mid) < x) lo = mid; else hi = mid; }
      return B(y1, y2, mid);
    };
  }
  var ease = bez(0.25, 0.1, 0.25, 1);
  function mixC(a, b, t) {
    var aa = a[3] == null ? 1 : a[3], ba = b[3] == null ? 1 : b[3];
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(aa, ba, t)];
  }
  function rgba(c, mul) {
    var a = (c[3] == null ? 1 : c[3]) * (mul == null ? 1 : mul);
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (Math.round(a * 1000) / 1000) + ')';
  }

  // ---------- 勾选 / 取消时间线（秒，相对点击时刻；源片 60fps 逐帧实测） ----------
  var T = {
    // 勾选
    scaleUp: [0.0, 0.14], scalePeak: 1.3, scaleDown: [0.165, 0.305],
    nubGrow: [0.0, 0.09], nubLen: 6.6, nubRetract: [0.14, 0.19], nubTipMax: 17.6,
    fill: [0.005, 0.225],
    checkDraw: [0.062, 0.148], checkPow: 2.5,
    strikeStart: 0.14, strikeDur: 0.165, strikeLag: 1.6, strikeLagSettle: [0.15, 0.25],
    textFade: [0.01, 0.43],
    // 取消
    uStrike: 0.17, uFill: [0.02, 0.14], uCheckGray: [0.03, 0.15], uCheckOut: [0.12, 0.27], uText: [0.0, 0.42],
  };

  // state: { checked: bool, at: 秒(切换时刻) }；now: 秒
  function rowVisual(state, now) {
    var e = now - (state.at == null ? -1e9 : state.at);
    var v = {
      scale: 1, nub: 0, fill: 0, ring: C.ringRest, check: 0, checkColor: C.checkWhite, checkOpacity: 0,
      strikeA: 0, strikeB: 0, strikeLag: 0, done: 0,
    };
    if (state.checked) {
      var up = sine(seg(e, T.scaleUp[0], T.scaleUp[1]));
      var down = sine(seg(e, T.scaleDown[0], T.scaleDown[1]));
      v.scale = 1 + (T.scalePeak - 1) * (up - down);
      var grow = sine(seg(e, T.nubGrow[0], T.nubGrow[1]));
      var retract = sine(seg(e, T.nubRetract[0], T.nubRetract[1]));
      v.nub = T.nubLen * grow * (1 - retract);
      v.fill = sine(seg(e, T.fill[0], T.fill[1]));
      v.ring = v.fill < 0.5 ? mixC(C.ringRest, C.ringMid, v.fill * 2) : mixC(C.ringMid, C.blue, (v.fill - 0.5) * 2);
      v.check = Math.pow(seg(e, T.checkDraw[0], T.checkDraw[1]), T.checkPow);
      v.checkOpacity = e >= T.checkDraw[0] ? 1 : 0;
      v.strikeB = outSine(seg(e, T.strikeStart, T.strikeStart + T.strikeDur));
      v.strikeLag = T.strikeLag * (1 - sine(seg(e, T.strikeLagSettle[0], T.strikeLagSettle[1])));
      v.done = ease(seg(e, T.textFade[0], T.textFade[1]));
    } else if (e < 1.0) {
      // 取消勾选：删除线从右往左线性收回，填充褪去，对勾变灰后淡出
      v.strikeB = 1 - sine(seg(e, 0, T.uStrike));
      v.fill = 1 - sine(seg(e, T.uFill[0], T.uFill[1]));
      v.ring = mixC(C.ringRest, C.blue, v.fill);
      v.check = 1;
      v.checkColor = mixC(C.checkWhite, C.checkGray, sine(seg(e, T.uCheckGray[0], T.uCheckGray[1])));
      v.checkOpacity = 1 - sine(seg(e, T.uCheckOut[0], T.uCheckOut[1]));
      v.done = 1 - ease(seg(e, T.uText[0], T.uText[1]));
      if (v.strikeB <= 0 && v.checkOpacity <= 0) v.checkOpacity = 0;
    }
    return v;
  }

  // ---------- 演示时间线（源片 1× 段：每 0.6s 勾一项；源片 2.4–7.3s 的运镜变速不复刻） ----------
  var DEMO = { period: 6.6, checkAt: [0.5, 1.1, 1.7, 2.3, 2.9], uncheckAt0: 4.935, uncheckStep: 0.05 };
  function demoState(i, t) {
    var tt = ((t % DEMO.period) + DEMO.period) % DEMO.period;
    var on = DEMO.checkAt[i], off = DEMO.uncheckAt0 + DEMO.uncheckStep * i;
    if (tt >= off) return { checked: false, at: off };
    if (tt >= on) return { checked: true, at: on };
    return { checked: false, at: off - DEMO.period }; // 上一轮的取消（跨循环连续）
  }
  function demoTime(t) { return ((t % DEMO.period) + DEMO.period) % DEMO.period; }

  // ---------- 几何：复选框 + 尖角（局部坐标，原点 = 复选框中心，描边中心线） ----------
  // 复选框外形 = 超椭圆（n=SQ_N，近似 iOS squircle）+ 右侧尖角凸起，极坐标采样成折线；
  // 尖角是 (1−|θ|/w)² 的凹侧尖峰，和源片里"对话气泡尖"一致，且与框体是同一条轮廓（描边连续）
  var SQ_N = 3.1, NUB_W = 0.62, BOX_PTS = 120;
  function boxPath(scale, nub) {
    var a = (L.boxSize / 2 - L.boxStroke / 2) * scale;
    var lenMax = Math.max(0, T.nubTipMax - a);
    var len = Math.min(nub, lenMax);
    var d = '';
    for (var k = 0; k < BOX_PTS; k++) {
      var th = (k / BOX_PTS) * Math.PI * 2 - Math.PI;
      var c = Math.abs(Math.cos(th)), sn = Math.abs(Math.sin(th));
      var r = a / Math.pow(Math.pow(c, SQ_N) + Math.pow(sn, SQ_N), 1 / SQ_N);
      if (len > 0) { var u = 1 - Math.abs(th) / NUB_W; if (u > 0) r += len * u * u; }
      var x = Math.round(r * Math.cos(th) * 1000) / 1000, y = Math.round(r * Math.sin(th) * 1000) / 1000;
      d += (k ? 'L' : 'M') + x + ',' + y;
    }
    return d + 'Z';
  }

  var CHECK_PTS = [[-2.8, 0.8], [-1.15, 2.45], [3.35, -2.25]];
  var CHECK_W = 1.85;
  function checkPath(progress, scale) {
    var s = scale || 1;
    var P = CHECK_PTS.map(function (q) { return [q[0] * s, q[1] * s]; });
    var l1 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]);
    var l2 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]);
    var d = progress * (l1 + l2);
    function f(n) { return Math.round(n * 1000) / 1000; }
    var out = 'M' + f(P[0][0]) + ',' + f(P[0][1]);
    if (d <= l1) {
      var a = d / l1;
      return out + ' L' + f(lerp(P[0][0], P[1][0], a) + 0.001) + ',' + f(lerp(P[0][1], P[1][1], a));
    }
    var c = (d - l1) / l2;
    return out + ' L' + f(P[1][0]) + ',' + f(P[1][1]) + ' L' + f(lerp(P[1][0], P[2][0], c)) + ',' + f(lerp(P[1][1], P[2][1], c));
  }

  // 删除线：返回卡片坐标 [x0, x1]（null = 不画）
  function strikeSpan(v, fullLen) {
    var x0 = L.textX - L.strikePad - v.strikeLag;
    var len = (fullLen + v.strikeLag) * v.strikeB;
    if (len < 0.2) return null;
    return [x0, x0 + len];
  }

  // 整行派生颜色（文字 / 旗帜 / 胶囊 / 表情去色）
  function rowColors(item, v) {
    var out = { text: rgba(C.text, lerp(1, C.textDoneA, v.done)), emojiColor: 1 - v.done, emojiGray: v.done * 0.42 };
    if (item.flag) {
      var fl = C.flag[item.flag];
      out.flagBg = rgba(mixC(fl.bg, C.flagDone.bg, v.done));
      out.flagFg = rgba(mixC(fl.fg, C.flagDone.fg, v.done));
    }
    if (item.pill) {
      var pl = C.pill[item.pill.tone];
      out.pillBg = rgba(mixC(pl.bg, C.pillDone.bg, v.done));
      out.pillFg = rgba(mixC(pl.fg, C.pillDone.fg, v.done));
    }
    return out;
  }

  // 帧快照：给 HTML / RN 与对拍共用
  function frame(rowsState, now, strikeLens, items) {
    return (items || ITEMS).map(function (item, i) {
      var v = rowVisual(rowsState[i], now);
      var full = (strikeLens && strikeLens[i]) || STRIKE_LEN[i] || 100;
      return {
        i: i, cy: L.rowY(i), v: v,
        box: boxPath(v.scale, v.nub),
        fill: rgba(C.blue, v.fill),
        ring: rgba(v.ring),
        check: v.checkOpacity > 0 ? checkPath(v.check, 1 + (v.scale - 1) * 0.35) : null,
        checkColor: rgba(v.checkColor, v.checkOpacity),
        strike: strikeSpan(v, full),
        colors: rowColors(item, v),
      };
    });
  }
  function demoFrame(t, strikeLens) {
    var tt = demoTime(t);
    return frame(ITEMS.map(function (_, i) { return demoState(i, tt); }), tt, strikeLens);
  }

  // ---------- 图标路径（pt，局部坐标） ----------
  var ICON = {
    // 旗帜 6.8×8：旗杆 + 带下摆波纹的旗面
    flag: 'M0.5,0.9 C0.5,0.45 0.85,0.25 1.4,0.25 L6.1,0.45 C6.55,0.47 6.85,0.75 6.85,1.2 L6.85,5.3 C6.85,5.75 6.55,6 6.1,5.95 C5.1,5.9 4.7,6.3 3.7,6.3 C2.7,6.3 2.2,5.75 1.35,5.8 L1.35,7.75 C1.35,8.05 1.15,8.2 0.92,8.2 C0.7,8.2 0.5,8.05 0.5,7.75 Z',
    // 日历 7.6×8：外框 + 表头线 + 两个挂环
    calRect: { x: 0.45, y: 1.15, w: 6.7, h: 6.55, r: 1.7 },
    calHeaderY: 3.35, calTicks: [2.35, 5.25], calTickY: [0.25, 1.9], calStroke: 0.95,
    plusArm: 3.0, plusStroke: 1.15,
  };

  // ---------- 壁纸显示列表（433×520 视框，源片构图；纯程序化渐变） ----------
  var WALL_W = 433, WALL_H = 520;
  var HORIZON = { y0: 386, y1: 337 }; // 左端 / 右端地平线 y
  // 渐变全部用 userSpaceOnUse（tf = gradientTransform），形状可以向四周无限延伸，任意视口比例都能铺满
  var EXT = 1500;
  function wallpaper() {
    var ang = (Math.atan2(HORIZON.y1 - HORIZON.y0, WALL_W) * 180) / Math.PI;
    var dy = HORIZON.y0 - 4;
    function sy(cx, cy, k) { return 'translate(' + cx + ' ' + cy + ') scale(1 ' + k + ') translate(' + -cx + ' ' + -cy + ')'; }
    var defs = [
      { id: 'sky', type: 'linear', x1: 0, y1: 0, x2: 108, y2: 520, stops: [[0, '#22505d'], [0.45, '#275a67'], [0.75, '#2f6b78'], [1, '#3a7d8a']] },
      { id: 'skyDark', type: 'radial', cx: 411, cy: 26, r: 390, tf: sy(411, 26, 1.2), stops: [[0, '#173744', 0.85], [0.55, '#1b3f4c', 0.5], [1, '#1b3f4c', 0]] },
      { id: 'haze', type: 'radial', cx: -30, cy: 372, r: 190, tf: sy(-30, 372, 230 / 190), stops: [[0, '#c3dadb', 0.95], [0.45, '#8db8be', 0.55], [1, '#6aa0aa', 0]] },
      { id: 'dune', type: 'linear', x1: 0, y1: dy, x2: 0, y2: dy + 260, stops: [[0, '#e8954d', 0], [0.03, '#e99348', 1], [0.16, '#e58a3c', 1], [0.42, '#e6852f', 1], [0.62, '#ea8b38', 1], [0.78, '#e9832e', 1], [1, '#e47826', 1]] },
      { id: 'duneRed', type: 'radial', cx: 470, cy: 540, r: 260, tf: sy(470, 540, 120 / 260), stops: [[0, '#dc6418', 0.55], [1, '#dc6418', 0]] },
      { id: 'horizonGlow', type: 'radial', cx: 30, cy: HORIZON.y0 + 3, r: 170, tf: 'rotate(' + ang + ' 30 ' + (HORIZON.y0 + 3) + ') ' + sy(30, HORIZON.y0 + 3, 0.07), stops: [[0, '#f6b47a', 0.6], [0.6, '#f3a868', 0.3], [1, '#f3a868', 0]] },
      { id: 'ridge', type: 'linear', x1: 0, y1: 440, x2: 0, y2: 474, stops: [[0, '#f2a258', 0], [0.5, '#f2a258', 0.32], [1, '#f2a258', 0]] },
    ];
    var big = { x: -EXT, y: -EXT, w: 2 * EXT, h: 2 * EXT };
    var shapes = [
      { type: 'rect', x: big.x, y: big.y, w: big.w, h: big.h, fill: 'sky' },
      { type: 'rect', x: big.x, y: big.y, w: big.w, h: big.h, fill: 'skyDark' },
      { type: 'rect', x: big.x, y: big.y, w: big.w, h: big.h, fill: 'haze' },
      // 沙丘主体：沿地平线倾斜、向左右下无限延伸，顶边 3% 软化
      { type: 'rect', x: -EXT, y: dy, w: 2 * EXT, h: EXT, fill: 'dune', rotate: [ang, 0, HORIZON.y0] },
      { type: 'rect', x: big.x, y: big.y, w: big.w, h: big.h, fill: 'duneRed' },
      { type: 'rect', x: big.x, y: big.y, w: big.w, h: big.h, fill: 'horizonGlow' },
      { type: 'rect', x: -EXT, y: 440, w: 2 * EXT, h: 34, fill: 'ridge', rotate: [-2.5, 0, 455] },
    ];
    var step = 91.4 / S; // 网格 36.65pt，原点对齐源片左上角
    var n = Math.ceil(EXT / step), grid = [];
    for (var k = -n; k <= n; k++) {
      grid.push({ x1: k * step, y1: -EXT, x2: k * step, y2: EXT });
      grid.push({ x1: -EXT, y1: k * step, x2: EXT, y2: k * step });
    }
    return { w: WALL_W, h: WALL_H, defs: defs, shapes: shapes, grid: grid, gridColor: "rgba(255,255,255,0.045)", gridWidth: 0.45 };
  }
  // 舞台：433×520 源片构图居中；缩放取"铺满"但保证卡片完整、桌面上限 1.6
  function stageZoom(vw, vh) { return Math.min(Math.max(vw / WALL_W, vh / WALL_H), vw / 400, vh / 330, 1.6); }
  // 视口在舞台坐标下的可见矩形 → 壁纸 viewBox（壁纸铺满整个视口）
  function wallViewBox(vw, vh, zoom) {
    var w = vw / zoom, h = vh / zoom;
    return [WALL_W / 2 - w / 2, WALL_H / 2 - h / 2, w, h];
  }
  // 卡片在壁纸中的位置（居中，源片 x 91 / y 284 px）
  var CARD_IN_WALL = { x: 91 / S, y: 284 / S };

  return {
    S: S, L: L, C: C, T: T, ITEMS: ITEMS, STRIKE_LEN: STRIKE_LEN, DEMO: DEMO, ICON: ICON,
    CHECK_W: CHECK_W, CARD_IN_WALL: CARD_IN_WALL,
    clamp: clamp, lerp: lerp, seg: seg, rgba: rgba, mixC: mixC,
    rowVisual: rowVisual, demoState: demoState, demoTime: demoTime, boxPath: boxPath, checkPath: checkPath,
    strikeSpan: strikeSpan, rowColors: rowColors, frame: frame, demoFrame: demoFrame, wallpaper: wallpaper,
    stageZoom: stageZoom, wallViewBox: wallViewBox,
  };
});
