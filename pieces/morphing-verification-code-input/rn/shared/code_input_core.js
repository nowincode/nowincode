// Code input morph — shared timeline core (HTML preview and RN component both consume this file).
// Units = pt. Source video is a 3x render (1494x1018 @60fps); every constant below is measured px / 3.
// frame(events, t) is pure: it folds the event list up to t and returns everything a renderer needs.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CodeInput = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // ---------- layout (measured) ----------
  const L = {
    H: 47.67, PAD: 4.33, CELL_W: 35.67, CELL_H: 39, GAP: 5, CELL_R: 10, N: 6,
    RING_W: 1.75, CARET_W: 1.33, CARET_H: 15,
    W_ENTER: 132.7, W_VERIFYING: 122.3, W_VERIFIED: 114.3,
    LABEL_SIZE: 13, LABEL_TRACK: -0.2, DIGIT_SIZE: 17,
    // content rows (ink widths from SF Pro Semibold 13pt / -0.2 tracking, matched to source ink)
    LOCK_W: 10.7, LOCK_H: 11.7, ENTER_GAP: 10.3, ENTER_TEXT_W: 64.4,
    ICON_BOX: 11, STATUS_GAP: 9.7, VERIF_ADV: 28.29, VERIFYING_W: 52.64, VERIFIED_W: 45.82,
    CONTENT_DX: 1.2, // source label rows sit 1.2pt right of the pill centre
  };
  L.W_OTP = 2 * L.PAD + L.N * L.CELL_W + (L.N - 1) * L.GAP;
  L.CELL_RD = L.CELL_H / 2;

  const C = {
    bg: '#F5F4F0', shell: '#FDFDFD', cell: '#EBE9E4', ink: '#121211', ring: '#181716',
    pink: '#FAE2E4', red: '#D42E4C', green: '#25BC4D', white: '#FFFFFF',
    spinTrack: '#B4B3AE', spinArc: '#1C1C1A',
  };

  // ---------- timing (measured, ms) ----------
  const T = {
    SQ_OTP: 180, SQ_OTP_MIN: 64,          // OTP -> pill: squeeze 11 frames to 64pt
    SQ_PILL: 58, SQ_PILL_K: 0.6,          // pill -> anything: 3-4 frames to 0.6 x width
    SP_OTP: [12.3, 0.49, 760],            // expand spring to OTP  (omega, zeta, v0 pt/s)
    SP_PILL: [16.1, 0.70, 690],           // expand spring to pill
    SP_VERIFIED: [16, 0.9],               // verifying -> verified width (no squeeze)
    LAYER_IN: 120, LAYER_OUT_PAD: 20, BLUR_MAX: 8, BLUR_IN: 3.5,
    CHAR_STAGGER: 10, CHAR_IN: 160,
    PUSH_GAMMA: [0.5, 0.6], // gamma(r) = a + b r  (r = |final| / lim0)
    OVER_GROW: 0.35, COMP_BLUR: 25, // cell layout under squeeze / overshoot
    RING_SP: [17.5, 0.775], RING_SHAPE: 80, RING_FADE: 60, RING_IN: 180, RING_OPEN_IN: 220,
    CARET_OPEN: 290, CARET_BLINK: 533, // caret blinks on its own clock; typing does not reset it
    DIGIT_DELAY: 40, DIGIT_IN: 140, DIGIT_IN_Y: 2.7, DIGIT_IN_BLUR: 4,
    DIGIT_OUT: 100, DIGIT_OUT_Y: 10, DIGIT_OUT_BLUR: 6,
    AUTO_SUBMIT: 210,
    SHAKE_AT: 25, SHAKE: [23.5, 0.57, 723],
    CLEAR_AT: 375, CLEAR_STAGGER: 47, RED_FADE_AT: 380, RED_FADE: 360,
    RING_BACK_AT: 680, CARET_BACK_AT: 1000,
    VERIFIED_AT: 25, CHECK_IN: 40, VERIFIED_FADE: 220, IED_AT: 50, IED_IN: 150,
    SPIN_DEG_PER_MS: 0.48, SPIN_PHASE: 125, ARC_BASE: 90, ARC_AMP: 18, ARC_PERIOD: 1400,
  };

  // ---------- math ----------
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeInOutSine = (k) => 0.5 - 0.5 * Math.cos(Math.PI * k);
  const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);
  const easeInQuad = (k) => k * k;

  // damped spring toward `to`, analytic. returns [x, v]
  function springAt(s, t) {
    const dt = Math.max(0, (t - s.t0) / 1000), w = s.w, z = s.z, d0 = s.x0 - s.to, v0 = s.v0;
    if (z < 1) {
      const wd = w * Math.sqrt(1 - z * z), A = d0, B = (v0 + z * w * d0) / wd, e = Math.exp(-z * w * dt);
      const c = Math.cos(wd * dt), sn = Math.sin(wd * dt);
      const x = e * (A * c + B * sn);
      const v = e * ((-z * w) * (A * c + B * sn) + (-A * wd * sn + B * wd * c));
      return [s.to + x, v];
    }
    const A = d0, B = v0 + w * d0, e = Math.exp(-w * dt);
    return [s.to + e * (A + B * dt), e * (B - w * (A + B * dt))];
  }

  // a scalar track made of spring / tween segments; later segments supersede earlier ones
  function Track(x) { this.segs = [{ t0: -1e9, kind: 'hold', x }]; }
  Track.prototype.seg = function (t) {
    let s = this.segs[0];
    for (let i = 1; i < this.segs.length; i++) if (this.segs[i].t0 <= t) s = this.segs[i];
    return s;
  };
  Track.prototype.at = function (t) {
    const s = this.seg(t);
    if (s.kind === 'hold') return [s.x, 0];
    if (s.kind === 'spring') return springAt(s, t);
    const k = clamp((t - s.t0) / s.d), e = s.ease || easeInOutSine;
    const x = lerp(s.x0, s.x1, e(k));
    const k2 = clamp((t + 1 - s.t0) / s.d);
    return [x, k >= 1 ? 0 : (lerp(s.x0, s.x1, e(k2)) - x) * 1000];
  };
  Track.prototype.value = function (t) { return this.at(t)[0]; };
  Track.prototype.cut = function (t) { this.segs = this.segs.filter((s) => s.t0 <= t); };
  Track.prototype.set = function (t, x) { this.cut(t); this.segs.push({ t0: t, kind: 'hold', x }); };
  Track.prototype.spring = function (t, to, w, z, v0) {
    const [x, v] = this.at(t); this.cut(t);
    this.segs.push({ t0: t, kind: 'spring', x0: x, v0: v0 === undefined ? v : v0, to, w, z });
  };
  Track.prototype.tween = function (t, to, d, ease) {
    const x = this.value(t); this.cut(t);
    this.segs.push({ t0: t, kind: 'tween', x0: x, x1: to, d, ease });
  };

  // ---------- event reducer ----------
  // external events: {t, type:'open'|'digit'|'back'|'result'|'reset'|'cancel', d?, ok?}
  function build(events, now) {
    const m = {
      mode: 'enter', status: null, W: new Track(L.W_ENTER), shake: new Track(0),
      layers: { enter: { p: new Track(1), tIn: -1e9, tOut: -2e9 }, otp: { p: new Track(0), tIn: -1e9, tOut: -2e9 }, status: { p: new Track(0), tIn: -1e9, tOut: -2e9 } },
      digits: [], n: 0, ring: new Track(0), ringVis: new Track(1), ringRL: new Track(L.CELL_RD), ringRR: new Track(L.CELL_R), caretAt: -1e9, caretOff: false,
      red: new Track(0), g: new Track(0), lockUntil: -1e9, pending: [], submittedAt: null, resultAt: null,
      statusIn: -1e9, code: '',
    };
    const ext = events.slice().sort((a, b) => a.t - b.t);
    let i = 0;
    for (;;) {
      const pe = m.pending.length ? m.pending.reduce((a, b) => (b.t < a.t ? b : a)) : null;
      const ee = i < ext.length ? ext[i] : null;
      let e = null;
      if (pe && (!ee || pe.t <= ee.t)) e = pe; else e = ee;
      if (!e || e.t > now) break;
      if (e === pe) m.pending.splice(m.pending.indexOf(pe), 1); else i++;
      apply(m, e);
    }
    return m;
  }

  function layerSwap(m, t, from, to, tIn) {
    const lf = m.layers[from], lt = m.layers[to];
    lf.p.tween(t, 0, tIn - t + T.LAYER_OUT_PAD, (k) => k); lf.tOut = t;
    lt.p.set(tIn - 0.001, 0); lt.p.tween(tIn, 1, T.LAYER_IN, (k) => k); lt.tIn = tIn;
  }

  // squeeze-then-expand width morph; returns the time the incoming content starts
  function morph(m, t, fromOtp, toW, sp) {
    const W0 = m.W.value(t);
    const d = fromOtp ? T.SQ_OTP : T.SQ_PILL, wmin = fromOtp ? T.SQ_OTP_MIN : W0 * T.SQ_PILL_K;
    m.W.tween(t, wmin, d);
    m.W.segs.push({ t0: t + d, kind: 'spring', x0: wmin, v0: sp[2], to: toW, w: sp[0], z: sp[1] });
    return t + d;
  }

  // ring corner radii morph toward the target slot's shape (D-shaped at the two ends)
  function ringTo(m, t, idx, jump) {
    const rl = idx === 0 ? L.CELL_RD : L.CELL_R, rr = idx === L.N - 1 ? L.CELL_RD : L.CELL_R;
    if (jump) { m.ring.set(t, idx); m.ringRL.set(t, rl); m.ringRR.set(t, rr); return; }
    m.ring.spring(t, idx, T.RING_SP[0], T.RING_SP[1]);
    m.ringRL.tween(t, rl, T.RING_SHAPE, easeOutCubic); m.ringRR.tween(t, rr, T.RING_SHAPE, easeOutCubic);
  }

  function apply(m, e) {
    const t = e.t;
    switch (e.type) {
      case 'open': {
        if (m.mode !== 'enter') return;
        const tIn = morph(m, t, false, L.W_OTP, T.SP_OTP);
        layerSwap(m, t, 'enter', 'otp', tIn);
        m.mode = 'otp'; m.n = 0; m.digits = []; m.code = '';
        ringTo(m, t, 0, true); m.ringVis.set(t, 0); m.ringVis.tween(tIn, 1, T.RING_OPEN_IN, (k) => k); m.caretAt = t + T.CARET_OPEN; m.caretOff = false;
        m.red.set(t, 0); m.lockUntil = tIn;
        return;
      }
      case 'digit': {
        if (m.mode !== 'otp' || t < m.lockUntil || m.n >= L.N || !/^[0-9]$/.test(String(e.d))) return;
        m.digits.push({ cell: m.n, d: String(e.d), tIn: t + T.DIGIT_DELAY, tOut: null });
        m.n++; m.code += String(e.d);
        if (m.n < L.N) ringTo(m, t, m.n);
        else {
          m.ringVis.tween(t, 0, T.RING_FADE, (k) => k); m.caretOff = true;
          m.pending.push({ t: t + T.AUTO_SUBMIT, type: '_submit' });
        }
        return;
      }
      case 'back': {
        if (m.mode !== 'otp' || t < m.lockUntil || m.n === 0) return;
        m.pending = m.pending.filter((p) => p.type !== '_submit');
        const live = m.digits.filter((g) => g.tOut === null);
        live[live.length - 1].tOut = t;
        const wasFull = m.n === L.N;
        m.n--; m.code = m.code.slice(0, -1);
        if (wasFull) { ringTo(m, t, m.n, true); m.ringVis.tween(t, 1, T.RING_IN, (k) => k); m.caretOff = false; m.caretAt = t; }
        else ringTo(m, t, m.n);
        return;
      }
      case '_submit': {
        if (m.mode !== 'otp' || m.n < L.N) return;
        const tIn = morph(m, t, true, L.W_VERIFYING, T.SP_PILL);
        layerSwap(m, t, 'otp', 'status', tIn);
        m.mode = 'status'; m.status = 'verifying'; m.g.set(t, 0); m.statusIn = tIn; m.submittedAt = t;
        return;
      }
      case 'result': {
        if (m.mode !== 'status' || m.status !== 'verifying') return;
        m.resultAt = t;
        if (e.ok) {
          m.status = 'verified';
          m.g.set(t + T.VERIFIED_AT, 0); m.g.tween(t + T.VERIFIED_AT, 1, T.VERIFIED_FADE, easeOutCubic);
          m.W.spring(t, L.W_VERIFIED, T.SP_VERIFIED[0], T.SP_VERIFIED[1]);
          return;
        }
        const tIn = morph(m, t, false, L.W_OTP, T.SP_OTP);
        layerSwap(m, t, 'status', 'otp', tIn);
        m.mode = 'otp'; m.status = null; m.submittedAt = null;
        m.digits.forEach((g) => { g.tIn = -1e9; });
        m.red.set(t, 1); m.red.set(t + T.RED_FADE_AT, 1); m.red.tween(t + T.RED_FADE_AT, 0, T.RED_FADE, easeInQuad);
        m.shake.segs.push({ t0: tIn + T.SHAKE_AT, kind: 'spring', x0: 0, v0: T.SHAKE[2], to: 0, w: T.SHAKE[0], z: T.SHAKE[1] });
        const live = m.digits.filter((g) => g.tOut === null);
        live.forEach((g) => { g.tOut = t + T.CLEAR_AT + (L.N - 1 - g.cell) * T.CLEAR_STAGGER; });
        m.n = 0; m.code = '';
        ringTo(m, t, 0, true); m.ringVis.set(t, 0);
        m.ringVis.set(t + T.RING_BACK_AT, 0); m.ringVis.tween(t + T.RING_BACK_AT, 1, T.RING_IN, (k) => k);
        m.caretAt = t + T.CARET_BACK_AT; m.caretOff = false;
        m.lockUntil = t + T.RING_BACK_AT;
        return;
      }
      case 'reset':
      case 'cancel': {
        if (m.mode === 'enter') return;
        const fromOtp = m.mode === 'otp';
        const tIn = morph(m, t, fromOtp, L.W_ENTER, T.SP_PILL);
        layerSwap(m, t, fromOtp ? 'otp' : 'status', 'enter', tIn);
        m.mode = 'enter'; m.status = null; m.submittedAt = null; m.pending = [];
        m.n = 0; m.code = ''; m.lockUntil = tIn;
        return;
      }
    }
  }

  // ---------- frame ----------
  function layerLook(layer, t, otpLayer) {
    // opacity leads, blur trails. in: sharpen over LAYER_IN. out: content first gets pushed (per-cell blur),
    // the whole layer only smears in the second half of the squeeze.
    const p = clamp(layer.p.value(t)), out = t >= layer.tOut && layer.tOut > layer.tIn;
    if (!out) return { op: easeOutCubic(clamp(p * 1.6)), blur: T.BLUR_IN * Math.pow(1 - p, 1.4), p };
    if (otpLayer) return { op: easeOutCubic(clamp(p * 1.6)), blur: T.BLUR_MAX * Math.pow(1 - p, 3), p };
    return { op: Math.pow(p, 0.7), blur: T.BLUR_MAX * (1 - p) * (1 - p), p }; // labels smear + fade
  }
  // cell centre offset from the shell centre at shell width W: outer cells ride the edges, inner cells are
  // pushed softly (|x| = min(final, lim * r^0.85)); at overshoot the whole row spreads uniformly.
  const LIM0 = L.W_OTP / 2 - L.PAD - L.CELL_W / 2;
  function cellLayout(W) {
    const lim = W / 2 - L.PAD - L.CELL_W / 2, out = [];
    for (let i = 0; i < L.N; i++) {
      const f = (i - (L.N - 1) / 2) * (L.CELL_W + L.GAP), af = Math.abs(f), sg = f < 0 ? -1 : 1;
      let x;
      if (lim >= LIM0) x = f * lim / LIM0;
      else { const r = af / LIM0; x = sg * Math.min(af, lim * Math.pow(r, T.PUSH_GAMMA[0] + T.PUSH_GAMMA[1] * r)); }
      const w = L.CELL_W * Math.max(1, 1 + (lim / LIM0 - 1) * T.OVER_GROW);
      // pushed cells smear and thin out, weighted by how far out they sit: the middle pair stays crisp
      const comp = af > 0 ? clamp(1 - Math.abs(x) / af) : 0, r = af / LIM0;
      out.push({ cx: W / 2 + x, w, comp, blur: Math.min(6, comp * comp * r * T.COMP_BLUR), op: clamp(1 - 1.2 * Math.pow(comp, 1.5) * r) });
    }
    return out;
  }
  function hexLerp(a, b, k) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k));
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  }

  function frame(events, t) {
    const m = build(events, t);
    const W = m.W.value(t);
    const inner = W - 2 * L.PAD;
    const lay = cellLayout(W);
    const pitch0 = L.CELL_W + L.GAP;
    const slotX = (r) => W / 2 + (r - (L.N - 1) / 2) * pitch0 - L.CELL_W / 2; // final-layout slot (ring/caret)

    const le = layerLook(m.layers.enter, t), lo = layerLook(m.layers.otp, t, true), ls = layerLook(m.layers.status, t);
    const red = m.red.value(t);

    const cells = [];
    for (let i = 0; i < L.N; i++) {
      const c = lay[i];
      cells.push({ x: c.cx - c.w / 2, w: c.w, blur: c.blur, op: c.op, rl: i === 0 ? L.CELL_RD : L.CELL_R, rr: i === L.N - 1 ? L.CELL_RD : L.CELL_R, bg: hexLerp(C.cell, C.pink, red) });
    }
    const digits = [];
    for (const g of m.digits) {
      let op = 1, y = 0, blur = 0;
      const ki = clamp((t - g.tIn) / T.DIGIT_IN);
      if (ki < 1) { const e = easeOutCubic(ki); y = T.DIGIT_IN_Y * (1 - e); blur = T.DIGIT_IN_BLUR * (1 - e); op = clamp(ki * 2.5); }
      if (g.tOut !== null && t >= g.tOut) {
        const ko = clamp((t - g.tOut) / T.DIGIT_OUT);
        if (ko >= 1) continue;
        y += T.DIGIT_OUT_Y * (1 - Math.pow(1 - ko, 5)); blur = Math.max(blur, T.DIGIT_OUT_BLUR * ko); op *= (1 - ko) * (1 - ko);
      }
      if (t < g.tIn) continue;
      const c = lay[g.cell];
      digits.push({ cell: g.cell, d: g.d, cx: c.cx, y, op: op * c.op, blur: Math.max(blur, c.blur), color: red > 0 ? C.red : C.ink });
    }

    const r = m.ring.value(t), rv = clamp(m.ringVis.value(t));
    const ring = {
      x: slotX(r), rl: m.ringRL.value(t), rr: m.ringRR.value(t),
      op: clamp(rv * 2), blur: (1 - rv) * 4,
    };
    const blinkOn = t >= m.caretAt && Math.floor((t - m.caretAt) / T.CARET_BLINK) % 2 === 0;
    const caret = { op: !m.caretOff && blinkOn && rv > 0.99 && m.mode === 'otp' ? 1 : 0, cx: slotX(r) + L.CELL_W / 2 };

    // status pill (verifying / verified)
    const g = clamp(m.g.value(t));
    const sIn = m.statusIn;
    // word segments (not per-char spans, so kerning survives); stagger index = segment's middle char
    const seg = (mid) => {
      const kk = clamp((t - sIn - mid * T.CHAR_STAGGER) / T.CHAR_IN);
      return { op: easeOutCubic(clamp(kk * 1.6)), blur: 5 * (1 - easeOutCubic(kk)) };
    };
    const verif = seg(3);
    const y0 = seg(7.5);
    const ying = { op: y0.op * (1 - g), blur: Math.max(y0.blur, 6 * g) };
    const kd = m.status === 'verified' ? clamp((t - m.resultAt - T.IED_AT) / T.IED_IN) : 0;
    const ied = { op: easeOutCubic(kd), blur: 6 * (1 - easeOutCubic(kd)) };
    const iconIn = clamp((t - sIn) / T.CHAR_IN);
    const kc = m.status === 'verified' ? clamp((t - m.resultAt) / T.CHECK_IN) : 0;
    const rowW = L.ICON_BOX + L.STATUS_GAP + lerp(L.VERIFYING_W, L.VERIFIED_W, g);
    const arcLen = T.ARC_BASE + T.ARC_AMP * Math.sin((2 * Math.PI * (t - sIn)) / T.ARC_PERIOD);
    const status = {
      bg: hexLerp(C.cell, C.green, g), fg: hexLerp(C.ink, C.white, g),
      rowX: W / 2 - rowW / 2 + L.CONTENT_DX, textX: L.ICON_BOX + L.STATUS_GAP,
      spinner: { op: easeOutCubic(iconIn) * (1 - kc), blur: Math.max(5 * (1 - iconIn), 6 * g), angle: (((T.SPIN_PHASE + (t - sIn) * T.SPIN_DEG_PER_MS - arcLen / 2) % 360) + 360) % 360, arc: T.ARC_BASE + T.ARC_AMP * Math.sin((2 * Math.PI * (t - sIn)) / T.ARC_PERIOD) },
      check: { op: kc, blur: 3 * (1 - kc), scale: lerp(0.8, 1, easeOutCubic(kc)) },
      verif, ying, ied,
    };
    const enterRowW = L.LOCK_W + L.ENTER_GAP + L.ENTER_TEXT_W;
    return {
      t, mode: m.mode, status: m.status, code: m.code, n: m.n, submittedAt: m.submittedAt,
      W, x: m.shake.value(t),
      layers: { enter: Object.assign(le, { scale: lerp(0.9, 1, clamp(m.layers.enter.p.value(t))) }), otp: lo, status: ls },
      enter: { rowX: W / 2 - enterRowW / 2 + L.CONTENT_DX, textX: L.LOCK_W + L.ENTER_GAP },
      cells, digits, ring, caret, statusPill: status,
    };
  }

  // the source video's event script (frame / 60 * 1000)
  const DEMO_PERIOD = 10700;
  function demoEvents() {
    const f = (n) => (n / 60) * 1000;
    const ev = [{ t: f(18.5), type: 'open' }];
    [[65.3, 2], [80, 1], [102, 3], [118, 2], [122.5, 1], [152, 2]].forEach(([n, d]) => ev.push({ t: f(n), type: 'digit', d }));
    ev.push({ t: f(237), type: 'result', ok: false });
    [[313, 1], [325, 2], [341, 3], [356, 4], [373.5, 5], [390.5, 6]].forEach(([n, d]) => ev.push({ t: f(n), type: 'digit', d }));
    ev.push({ t: f(473), type: 'result', ok: true });
    ev.push({ t: 9900, type: 'reset' });
    return ev;
  }

  return { L, C, T, frame, build, demoEvents, DEMO_PERIOD, springAt, Track };
});
