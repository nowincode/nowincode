// Task interaction (to-do list completion) — shared timeline core for HTML preview and RN.
// All values in pt / ms, measured from the 60fps source (see ANALYSIS.md).
(function (root) {
  'use strict';

  var W = 393, H = 852;

  var LAYOUT = {
    W: W, H: H,
    statusY: 33,
    title: { x: 16, baseline: 98, size: 24 },
    week: { cx0: 28, dx: 56.2, letterY: 130, ringY: 155, dateY: 183, letterSize: 11.5, dateSize: 11.5,
      pill: { w: 26, h: 18, r: 9 }, disk: 12, arcR: 9.1, arcW: 3.8 },
    plan: { x: 20, baseline: 238.5, size: 20 },
    add: { x: 318, y: 218, w: 56, h: 26, size: 15 },
    card: { x: 7.6, w: 378, h: 70.4, top0: 259.6, pitch: 78.5, r: 22 },
    tile: { inset: 8, size: 54.6, r: 16 },
    text: { x: 81.4, titleTop: 21.5, titleSize: 15, timeTop: 38, timeSize: 13, clock: 13 },
    check: { cx: 350.5, d: 26, ring: 1.8 },
    tabbar: { x: 19.5, y: 769.5, w: 280.5, h: 62.5, sel: { w: 75, h: 57 }, centers: [60, 127.5, 195, 262.5], iconY: 790, labelY: 815 },
    fab: { cx: 342.5, cy: 800.5, d: 63 }
  };

  var COLORS = {
    screen: '#F7F7F7', card: '#FFFFFF', tile: '#F8F8F8', ink: '#000000',
    weekday: '#777777', weekdayFuture: '#CFCFCF', todayPill: '#EBEBEB', todayLetter: '#292929',
    date: '#767676', dateFuture: '#CECECE',
    addBg: '#EBEBEB', addInk: '#6B6B6B',
    time: '#8A8A8A', ring: '#CBCBCB',
    checkTop: '#2BC26B', checkBottom: '#5DD092',
    diskFuture: '#EBEBEB',
    red: { arc: '#F4717A', disk: '#F7E7E8' },
    amber: { arc: '#E3BD5C', disk: '#F7F1E8' },
    green: { arc: '#37C671', disk: '#E2F1EA' },
    tabBg: '#F3F3F3', tabSel: '#E9E9E9', tabInk: '#939393', tabLabel: '#8B8B8B',
    fabTop: '#3A3A3A', fabBottom: '#0E0E0E'
  };

  var TASKS = [
    { id: 'reply', title: 'Reply to client emails', time: '9:00 AM', icon: 'envelope' },
    { id: 'standup', title: 'Daily stand-up', time: '9:15 AM', icon: 'briefcase' },
    { id: 'design', title: 'Design review with PM', time: '10:30 AM', icon: 'stars' },
    { id: 'fix', title: 'Fix onboarding flow', time: '12:00 PM', icon: 'compass' },
    { id: 'sprint', title: 'Sprint planning call', time: '2:00 PM', icon: 'calendar' }
  ];

  // M T W T F S S / 20..26; today = Thursday 23 (index 3); progress for past days is fixed.
  var DAYS = [
    { l: 'M', d: 20, p: 0.07 }, { l: 'T', d: 21, p: 1 }, { l: 'W', d: 22, p: 0.2 },
    { l: 'T', d: 23, today: true }, { l: 'F', d: 24, future: true },
    { l: 'S', d: 25, future: true }, { l: 'S', d: 26, future: true }
  ];
  var TODAY = 3;

  // ---- timing (ms) ----
  var T = {
    fade: 190,            // check fill + content dim, easeInOutQuad (frames 64.5→76)
    doneOpacity: 0.22,    // completed row content opacity (title ink 0 → 198 on white)
    reorder: 337,         // tap → drop start (20.75 / 19.5 frames, mean)
    spring: { w: 16.4, z: 0.75, v0: 12 }, // mover, normalised progress (fit err 0.1%)
    scaleAmp: 0.014, scaleTau: 200,
    shiftDelay: 29,       // first shifting card starts 1.75 frames after drop
    shiftStagger: 33.3,   // +2 frames per card
    shiftDur: 483,        // 29 frames, easeInOutQuad
    ringDelay: 200,       // after drop start (arc1 +15 f, arc2 +5 f; compromise)
    ringDur: 333,
    colorDur: 150
  };

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeInOutQuad(t) { t = clamp01(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function easeOutRing(t) { t = clamp01(t); return 1 - Math.pow(1 - t, 1.5); }
  function spring(tMs) {
    if (tMs <= 0) return 0;
    var s = tMs / 1000, w = T.spring.w, z = T.spring.z, v0 = T.spring.v0;
    var wd = w * Math.sqrt(1 - z * z), B = (v0 - z * w) / wd;
    return 1 + Math.exp(-z * w * s) * (-Math.cos(wd * s) + B * Math.sin(wd * s));
  }
  function bump(tMs) {
    if (tMs <= 0) return 0;
    var u = tMs / T.scaleTau; return u * Math.exp(1 - u);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    var A = hex(a), B = hex(b), o = '#';
    for (var i = 0; i < 3; i++) { var v = Math.round(lerp(A[i], B[i], clamp01(t))); o += (v < 16 ? '0' : '') + v.toString(16); }
    return o.toUpperCase();
  }
  function tone(p) { return p >= 1 ? 'green' : p >= 0.4 ? 'amber' : 'red'; }

  function slotY(i) { return LAYOUT.card.top0 + LAYOUT.card.pitch * i; }

  // Tween helpers: value(t) = from + (to - from) * curve(t - start)
  function tw(from, to, start, kind, dur) { return { from: from, to: to, start: start, kind: kind, dur: dur || 0 }; }
  function twVal(a, t) {
    if (!a) return 0;
    var k = t - a.start, e;
    if (a.kind === 'spring') e = spring(k);
    else if (a.kind === 'ring') e = easeOutRing(k / a.dur);
    else e = easeInOutQuad(k / a.dur);
    if (k <= 0) e = 0;
    return lerp(a.from, a.to, e);
  }

  // Replays tap events [{t, id}] up to time t → deterministic frame. Pure: no hidden state.
  function frame(events, t) {
    var n = TASKS.length, i;
    var st = {
      done: [], doneAt: [], order: [], y: [], fade: [], check: [], scaleStart: [], mover: -1, moverAt: -1e9,
      ring: tw(0, 0, -1e9, 'ring', T.ringDur), ringColor: { from: 'red', to: 'red', start: -1e9 }
    };
    for (i = 0; i < n; i++) {
      st.done[i] = false; st.doneAt[i] = 0; st.order[i] = i;
      st.y[i] = tw(slotY(i), slotY(i), -1e9, 'ease', 1);
      st.fade[i] = tw(1, 1, -1e9, 'ease', T.fade);
      st.check[i] = tw(0, 0, -1e9, 'ease', T.fade);
      st.scaleStart[i] = -1e9;
    }
    // Build a queue of taps + their derived reorder moments.
    var q = [];
    (events || []).forEach(function (e, k) { q.push({ t: e.t, type: 'tap', id: e.id, k: k }); });
    q.sort(function (a, b) { return a.t - b.t || a.k - b.k; });
    var pending = [];
    var all = [];
    function process(ev) {
      var c = indexOf(ev.id);
      if (ev.type === 'tap') {
        var nowFade = twVal(st.fade[c], ev.t), nowCheck = twVal(st.check[c], ev.t);
        st.done[c] = !st.done[c];
        st.doneAt[c] = ev.t;
        st.fade[c] = tw(nowFade, st.done[c] ? T.doneOpacity : 1, ev.t, 'ease', T.fade);
        st.check[c] = tw(nowCheck, st.done[c] ? 1 : 0, ev.t, 'ease', T.fade);
        pending.push({ t: ev.t + T.reorder, type: 'reorder', id: ev.id });
      } else {
        var R = ev.t;
        var newOrder = computeOrder(st);
        var moving = [];
        for (var s = 0; s < n; s++) {
          var ci = newOrder[s];
          var cur = yAt(st, ci, R), target = slotY(s);
          if (ci === c) {
            st.y[ci] = tw(cur, target, R, 'spring');
            st.scaleStart[ci] = R; st.mover = ci; st.moverAt = R;
          } else if (Math.abs(cur - target) > 0.01 || Math.abs(st.y[ci].to - target) > 0.01) {
            moving.push({ ci: ci, cur: cur, target: target });
          }
        }
        moving.forEach(function (m, k) {
          st.y[m.ci] = tw(m.cur, m.target, R + T.shiftDelay + T.shiftStagger * k, 'ease', T.shiftDur);
        });
        st.order = newOrder;
        var cnt = st.done.filter(Boolean).length, p = cnt / n;
        var rs = R + T.ringDelay, curP = twVal(st.ring, rs);
        st.ringColor = { from: tone(curP), to: tone(p), start: rs };
        st.ring = tw(curP, p, rs, 'ring', T.ringDur);
      }
    }
    // merge taps and derived reorders in time order (reorders scheduled during processing)
    var qi = 0;
    while (true) {
      pending.sort(function (a, b) { return a.t - b.t; });
      var nextTap = qi < q.length ? q[qi] : null, nextRe = pending.length ? pending[0] : null;
      var ev = null;
      if (nextTap && (!nextRe || nextTap.t <= nextRe.t)) { ev = nextTap; qi++; }
      else if (nextRe) { ev = pending.shift(); }
      if (!ev || ev.t > t) break;
      process(ev); all.push(ev);
    }

    var cards = [];
    for (i = 0; i < n; i++) {
      var sc = 1 + T.scaleAmp * bump(t - st.scaleStart[i]);
      cards.push({
        id: TASKS[i].id, index: i,
        y: yAt(st, i, t), scale: sc,
        content: twVal(st.fade[i], t), check: twVal(st.check[i], t),
        z: i === st.mover && t - st.moverAt < 900 ? 2 : 1,
        done: st.done[i]
      });
    }
    var rp = Math.max(0, twVal(st.ring, t));
    var cp = clamp01((t - st.ringColor.start) / T.colorDur);
    var arc = mix(COLORS[st.ringColor.from].arc, COLORS[st.ringColor.to].arc, cp);
    var dp = clamp01((t - st.ringColor.start) / T.ringDur);
    var disk = mix(COLORS[st.ringColor.from].disk, COLORS[st.ringColor.to].disk, dp);
    return { t: t, cards: cards, today: { p: rp, arc: arc, disk: disk }, doneCount: st.done.filter(Boolean).length };
  }

  function indexOf(id) { for (var i = 0; i < TASKS.length; i++) if (TASKS[i].id === id) return i; return -1; }
  function yAt(st, i, t) { return twVal(st.y[i], t); }
  // Incomplete tasks keep their original order; completed ones follow, oldest completion first.
  function computeOrder(st) {
    var open = [], closed = [];
    for (var i = 0; i < TASKS.length; i++) (st.done[i] ? closed : open).push(i);
    closed.sort(function (a, b) { return st.doneAt[a] - st.doneAt[b]; });
    return open.concat(closed);
  }

  function dayRing(i, todayFrame) {
    var d = DAYS[i];
    if (d.future) return { p: 0, arc: null, disk: COLORS.diskFuture };
    if (d.today) return todayFrame;
    var c = COLORS[tone(d.p)];
    return { p: d.p, arc: c.arc, disk: c.disk };
  }

  // Arc path (clockwise from 12 o'clock) for SVG, centred at (cx, cy).
  function arcPath(cx, cy, r, p) {
    p = Math.min(p, 0.9999);
    var a = p * 2 * Math.PI, x = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
    return 'M ' + cx + ' ' + (cy - r) + ' A ' + r + ' ' + r + ' 0 ' + (p > 0.5 ? 1 : 0) + ' 1 ' + x.toFixed(3) + ' ' + y.toFixed(3);
  }

  // The source clip: tap "Reply" at frame 65, "Daily stand-up" at frame 130 (relative to its first frame).
  var DEMO = { events: [{ t: 708, id: 'reply' }, { t: 1792, id: 'standup' }], length: 3800 };

  var api = {
    LAYOUT: LAYOUT, COLORS: COLORS, TASKS: TASKS, DAYS: DAYS, TODAY: TODAY, T: T, DEMO: DEMO,
    frame: frame, dayRing: dayRing, arcPath: arcPath, slotY: slotY, spring: spring,
    easeInOutQuad: easeInOutQuad, mix: mix, tone: tone
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TaskCore = api;
})(typeof window !== 'undefined' ? window : this);
