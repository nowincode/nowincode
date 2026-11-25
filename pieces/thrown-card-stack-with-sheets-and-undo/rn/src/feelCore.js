// Feel Deck — shared core for the HTML preview and the RN component.
// All geometry is in iOS points on a 393×852 screen (measured from the 4K source at 1.883 px/pt).
// Pure data + pure functions only: no DOM, no RN imports.

export const SCREEN = { w: 393, h: 852 };

export const C = {
  bg: '#1e1e1e',
  statusDim: '#101010',
  text: '#f2f2f2',
  num: '#ececec',
  label: '#6b6b6b',
  hint: '#4a4a4a',
  accent: '#f2a358',
  accentInk: '#3a2410',
  row: '#313131',
  rowDetail: '#333333',
  rowLabel: '#5c5c5c',
  rowSub: '#6a6a6a',
  rowNum: '#b8b8b8',
  stack1: '#222222',
  stack2: '#171717',
  tabbar: '#2d2e2c',
  tabActive: '#282622',
  tabActiveGlow: '#3a3128',
  mic: '#292929',
  toast: '#262626',
  undo: '#3c3c3d',
  hair: 'rgba(255,255,255,0.07)',
  glassDark: 'rgba(10,16,24,0.55)',
  btn: 'rgba(255,255,255,0.15)',
  foot: '#575757',
  home: '#d0d0d0',
};

export const FONT = {
  sans: 'Lexend',        // WhatFontIs + font-match: Lexend wins on 3 crops (low confidence, small ink)
  mono: 'Geist Mono',    // font-match: Geist Mono 200–300, contour F1 0.999 on "312"
};

// ---------- layout (pt) ----------
export const L = {
  status: { timeX: 47, y: 30 },
  stats: { xs: [88, 196.5, 305], numY: 111.5, numSize: 30.5, labelY: 140.7, labelSize: 12.5 },
  card: { x: 24, y: 190, w: 345, h: 450, r: 32 },
  stack: [ { s: 1, ty: 0 }, { s: 0.91, ty: 33 }, { s: 0.82, ty: 67 } ],
  cardIn: {
    chip: { x: 20, y: 20, h: 33, padX: 14, size: 13.5 },
    eye: { cx: 309.5, cy: 37, d: 33 },
    head: { x: 24, firstY: 191, lh: 28.3, size: 23.5 },
    quote: { barX: 24, y: 308, h: 39, x: 37, lh: 20, size: 14, firstY: 317 },
    btns: { y: 370, h: 56, xs: [[24, 105], [140.6, 64], [216, 106]] },
    imgH: 345, fadeA: 140, fadeB: 260,
  },
  hint: { y1: 694, y2: 713, size: 13 },
  toast: { x: 20, y: 681, w: 353, h: 53.5, check: { cx: 48, d: 27.6 }, textX: 73, size: 16, undo: { x: 291, y: 689, w: 73, h: 37.5 } },
  tabbar: { x: 23, y: 751, w: 255, h: 61.5, items: [67.5, 150, 232.6], iconY: 776.5, labelY: 795.5, pill: { w: 80, h: 50, y: 757 } },
  mic: { cx: 335, cy: 782, d: 62.7 },
  home: { y: 839, w: 140, h: 5 },
  days: { labelX: 31, labelY: 200, x: 25, y: 220, w: 343, h: 75, pitch: 86.6, r: 22,
          thumb: { x: 11, s: 52, r: 14 }, titleX: 78, titleY: 28.5, subY: 50, numR: 20, numY: 38 },
  detail: { hero: { x: 25, y: 65, w: 343, h: 343, r: 30 }, back: { cx: 32, cy: 32, d: 33 },
            cards: { r: 16, y: 16, h: 32, w: 86.5 }, kickerY: 255, titleY: [281, 309.5], titleSize: 24, textX: 22,
            rows: { y: 423, pitch: 58.4, h: 51, r: 18, labelX: 14, textX: 72, circR: 20.5, d: 27.6 }, footY: 678 },
  sheet: { top: 53, r: 24, photo: { x: 14, y: 66, w: 365, h: 300, r: 26 }, grab: { y: 77, w: 37, h: 5 },
           close: { cx: 348, cy: 97, d: 32 }, x: 24.5,
           chip: { y: 449, h: 28 }, metaX: 101, metaY: 463,
           title: { firstY: 506, lh: 29, size: 25 },
           quote: { y: 593, h: 42, x: 38, firstY: 604, lh: 21, size: 15 },
           audio: { y: 654, w: 344, h: 51, play: { cx: 50.5, d: 36 }, barsX0: 80, barsX1: 311, timeX: 322 },
           tags: { y: 721, h: 27, gap: 8.5 } },
};

// ---------- content ----------
export const CARDS = [
  { id: 'peach', img: 'peaches', crop: [0.04, 0.02, 0.92], tag: 'Market', date: 'NOV 14', time: '18:42', toast: 'Nov 14',
    lines: ['You bought the good', 'peaches and didn’t', 'wait for a reason'],
    quote: ['Told Ines the stall by the fountain is', 'back. She said bring six, and one for…'],
    quoteFull: ['Told Ines the stall by the fountain is back. She', 'said bring six, and one for the walk home.'],
    tags: ['Ines', 'The fountain', 'Peaches'], dur: '0:24',
    tone: [[0.44, '#3a2741'], [0.52, '#472738'], [0.64, '#30283f'], [0.78, '#4c2c3b'], [0.9, '#622e37'], [1, '#6a2e31']],
    sheet: [[0, '#3a1c12'], [0.3, '#a8401a'], [0.4, '#93360f'], [0.48, '#5e2616'], [0.55, '#2e1c26'], [0.62, '#1a2142'], [0.72, '#2e2a4a'], [0.84, '#583241'], [1, '#7c3b34']] },
  { id: 'lantern', img: 'lanterns', crop: [0.22, 0.0, 0.62], tag: 'Dinner', date: 'NOV 12', time: '23:10', toast: 'Nov 12',
    lines: ['You stayed until', 'the lanterns were', 'the only light left'],
    quote: ['Walked back with Tomás after the long', 'table. He asked about Lisbon and I sai…'],
    quoteFull: ['Walked back with Tomás after the long table. He', 'asked about Lisbon and I said I’d think about it.'],
    tags: ['Tomás', 'Lisbon', 'The long table'], dur: '0:41',
    tone: [[0.44, '#2b3236'], [0.52, '#4b3733'], [0.66, '#343238'], [0.85, '#3e2f31'], [1, '#432c2b']],
    sheet: [[0, '#10202a'], [0.3, '#7a3a18'], [0.42, '#4a2c1c'], [0.55, '#1a2630'], [0.7, '#23303a'], [0.85, '#463028'], [1, '#5a3424']] },
  { id: 'mimosa', img: 'mimosa', crop: [0.05, 0.05, 0.8], tag: 'Garden', date: 'NOV 9', time: '08:15', toast: 'Nov 9',
    lines: ['The mimosa by the', 'gate finally opened', 'while you were out'],
    quote: ['Clara sent a photo before work. Said the', 'whole street smells like honey now and…'],
    quoteFull: ['Clara sent a photo before work. Said the whole', 'street smells like honey now and to come by.'],
    tags: ['Clara', 'The gate', 'Mimosa'], dur: '0:18',
    tone: [[0.44, '#2f2a4e'], [0.54, '#3d3a2a'], [0.7, '#2b2e2a'], [0.88, '#383a24'], [1, '#3e3c22']],
    sheet: [[0, '#1c1a3a'], [0.3, '#6a5a1a'], [0.42, '#3e3a1c'], [0.55, '#22263a'], [0.7, '#2a2c3e'], [0.85, '#3e3a26'], [1, '#4e4622']] },
  { id: 'sail', img: 'sailboat', crop: [0.12, 0.12, 0.62], tag: 'Harbour', date: 'NOV 8', time: '17:52', toast: 'Nov 8',
    lines: ['One sail left on', 'the water before', 'the light went'],
    quote: ['Sat on the wall with Jo until the ferry', 'came in. Neither of us said much, which…'],
    quoteFull: ['Sat on the wall with Jo until the ferry came in.', 'Neither of us said much, which was the point.'],
    tags: ['Jo', 'The harbour', 'Ferry'], dur: '0:33',
    tone: [[0.44, '#13203a'], [0.55, '#3a2a26'], [0.7, '#1c2236'], [0.88, '#3c2a26'], [1, '#4a2e22']],
    sheet: [[0, '#0c1424'], [0.3, '#7a3c16'], [0.42, '#3a2418'], [0.55, '#121c34'], [0.7, '#1c2440'], [0.85, '#3c2a2c'], [1, '#5a3222']] },
];

export const DAYS = [
  { id: 'sat14', title: 'Sat 14 Nov', sub: '3 kept · 1 let go', n: '04', img: 'peaches', kicker: 'SAT 14 NOV:',
    head: ['Peaches, the fountain,', 'the long way back'], heroTint: '#6a2a2e', haze: '#e0727a',
    items: [['Market', 'You bought the good peaches', 1], ['Call', 'Ines said bring six', 1], ['Walk', 'Home past the fountain', 1], ['Errand', 'Forgot the bread again', 0]],
    foot: 'Handed back at 21:30 · 3 min of voice' },
  { id: 'thu12', title: 'Thu 12 Nov', sub: '5 kept', n: '05', img: 'lanterns', kicker: 'THU 12 NOV:',
    head: ['Lanterns, the long table,', 'Lisbon again'], heroTint: '#3a2a24', haze: '#d07a5a',
    items: [['Dinner', 'You stayed until the end', 1], ['Talk', 'Tomás asked about Lisbon', 1], ['Walk', 'Back along the river', 1], ['Note', 'Book the train', 1]],
    foot: 'Handed back at 23:40 · 5 min of voice' },
  { id: 'mon9', title: 'Mon 9 Nov', sub: '2 kept · 2 let go', n: '04', img: 'mimosa', kicker: 'MON 9 NOV:',
    head: ['Mimosa, the gate,', 'a slow morning'], heroTint: '#3a3a22', haze: '#b8a05a',
    items: [['Garden', 'The mimosa finally opened', 1], ['Text', 'Clara sent a photo', 1], ['Errand', 'Return the library book', 0], ['Call', 'Ring the landlord', 0]],
    foot: 'Handed back at 09:05 · 2 min of voice' },
  { id: 'sun8', title: 'Sun 8 Nov', sub: '6 kept · 1 let go', n: '07', img: 'sailboat', kicker: 'SUN 8 NOV:',
    head: ['The harbour wall,', 'one sail left'], heroTint: '#3a2620', haze: '#c8704a',
    items: [['Harbour', 'One sail left on the water', 1], ['Friend', 'Jo came along', 1], ['Ferry', 'Waited for the last one', 1], ['Errand', 'Forgot the camera', 0]],
    foot: 'Handed back at 19:20 · 4 min of voice' },
  { id: 'fri6', title: 'Fri 6 Nov', sub: '4 kept', n: '04', img: 'lanterns', kicker: 'FRI 6 NOV:',
    head: ['Small lights,', 'an early night'], heroTint: '#3a2a24', haze: '#d07a5a',
    items: [['Dinner', 'Soup at the corner place', 1], ['Walk', 'Under the lanterns', 1], ['Read', 'Two chapters in bed', 1], ['Call', 'Mum, briefly', 1]],
    foot: 'Handed back at 22:10 · 3 min of voice' },
];

export const STATS0 = { kept: 48, threads: 312, today: 7 };
export const STAT_LABELS = ['Kept', 'Threads', 'Today'];
export const fmtStats = (s) => [String(s.kept), String(s.threads), String(s.today).padStart(2, '0')];
// keep: +1 kept, +3 threads, −1 today ; let go: −1 today
export const applyDecision = (s, keep) => keep
  ? { kept: s.kept + 1, threads: s.threads + 3, today: Math.max(0, s.today - 1) }
  : { kept: s.kept, threads: s.threads, today: Math.max(0, s.today - 1) };

// ---------- icons (24-unit viewBox, stroke unless noted) ----------
export const ICON = {
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  wave: 'M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4',
  eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  chevL: 'M15 5l-7 7 7 7',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3',
  days: 'M4.5 7.5a2.5 2.5 0 0 1 2.5-2.5h10a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5zM4.5 10h15M8.5 3v3.5M15.5 3v3.5',
  daysFill: 'M7 5h10a2.5 2.5 0 0 1 2.5 2.5V9h-15V7.5A2.5 2.5 0 0 1 7 5zM4.5 10.5h15v7a2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5z',
  deck: 'M6 11.5a2.5 2.5 0 0 1 2.5-2.5h7a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 17.5zM8 6.5h8M9.5 4h5',
  deckFill: 'M8.5 9h7a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 17.5v-6A2.5 2.5 0 0 1 8.5 9zM7.5 5.6h9v1.8h-9zM9 3.2h6V5H9z',
  you: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5',
  play: 'M9 7.2v9.6l8-4.8z',
};

// waveform bars in the sheet's audio pill (heights in pt), first 9 = played (accent)
export const WAVE = [6, 9, 6, 11, 15, 9, 19, 11, 15, 8, 19, 8, 12, 21, 8, 12, 8, 15, 19, 9, 13, 8, 6, 8, 6, 4];
export const WAVE_PLAYED = 9;

// ---------- motion ----------
// Springs are (ω, ζ): stiffness = ω², damping = 2ζω, mass 1  (RN Reanimated withSpring takes those directly)
export const SPR = {
  follow:  { w: 14, z: 0.85 },  // next card rising into place after a throw (settles ≈0.5 s, 4.10→4.63 s)
  back:    { w: 20, z: 0.8 },   // card returning (undo) / snap-back when not thrown far enough (8.17→8.33 s)
  digit:   { w: 34, z: 0.62 },  // last-digit roll, ≈0.15 s with a small overshoot (4.33→4.47 s)
  toast:   { w: 20, z: 0.74 },  // toast rise (4.50→4.70 s)
  press:   { w: 38, z: 0.9 },   // press-in / release
  pill:    { w: 22, z: 0.82 },  // tab indicator slide
  hero:    { w: 17, z: 0.92 },  // thumbnail → hero (23.75→24.05 s)
  heroBack:{ w: 26, z: 0.95 },  // hero → thumbnail, after text/list fade (27.27→27.45 s)
  sheetBack:{ w: 20, z: 0.86 }, // sheet snapping back after a short pull
};
export function springCfg(c) { 'worklet'; return { stiffness: c.w * c.w, damping: 2 * c.z * c.w, mass: 1 }; }

export const T = {
  digitDelay: 0.15,     // release → digits start rolling (finger lifts 4.33 s, digits 4.48 → 4.60 s)
  toastDelay: 0.18,     // release → toast starts (4.51 s)
  liftDur: 0.2,         // next card brightens from half-dim to live after the commit
  sheetOpen: 0.36,      // sheet rise, easeOutExpo-like (12.42 → 12.72 s, 80 % in the first 0.08 s)
  sheetDim: 0.3,
  imgSwap: 0.1,         // card ASCII → clear photo when the eye is tapped
  cardTextFade: 0.12,
  asciiBack: 0.25,      // clear photo → ASCII after the sheet is thrown away (17.0 → 17.25 s)
  asciiBackDelay: 0.35,  // finger lifts 16.75 s, photo → ASCII 17.10 → 17.30 s
  textBackDelay: 0.22,   // card title/quote fade back in from 16.97 s
  tabInDelay: 0, tabIn: 0.16, tabOutDelay: 0.05, tabOut: 0.25,   // overlapping crossfade: new page in fast, old page lingers (20.15 s: list 60 %, card 70 %)
  listOut: 0.15, detailIn: 0.18, detailInDelay: 0.2, stagger: 0.03, backDelay: 0.14,
  pressScale: 0.94, rowPressScale: 0.97,
};
export const BEZ = { sheet: [0.16, 1, 0.3, 1], fade: [0.25, 0.1, 0.25, 1], out: [0.2, 0.8, 0.2, 1] };

// throw / drag rules
export const DRAG = {
  rotPerPt: 1 / 24,            // degrees per pt (template fit −6°, eyeballed ≈8° at 173 pt; CW when dragged right)
  commitDx: 110, commitV: 650, // pt, pt/s
  flyEndV: 5000, flyX: 560,   // fly-off = constant acceleration from release speed to 5000 pt/s (4.33 → 4.50 s from rest)
  nextRamp: 150,               // |dx| at which the next card is fully promoted
};
export const SHEET_DRAG = { commitDy: 120, commitV: 600, scalePerPt: 0.00015, maxShrink: 0.06, dimRange: 220 };  // 16.70 s: dy 137 → width 98 %, deck clearly visible

// ---------- pure derived values (shared, used by the parity test) ----------
export function clamp(v, a, b) { 'worklet'; return Math.min(b, Math.max(a, v)); }
export function lerp(a, b, t) { 'worklet'; return a + (b - a) * t; }

// top card + the one behind it while dragging by dx
export function dragDerived(dx) {
  'worklet';
  const p = clamp(Math.abs(dx) / DRAG.nextRamp, 0, 1);
  return {
    rot: dx * DRAG.rotPerPt,
    nextScale: lerp(L.stack[1].s, 1, p),
    nextTy: lerp(L.stack[1].ty, 0, p),
    nextDim: lerp(1, 0.45, p),       // 1 = slab, 0.45 = half-lit while the finger still holds (4.07–4.32 s)
    thirdScale: lerp(L.stack[2].s, L.stack[1].s, p),
    thirdTy: lerp(L.stack[2].ty, L.stack[1].ty, p),
  };
}

export function sheetDragDerived(dy) {
  'worklet';
  const d = Math.max(0, dy);
  const shrink = Math.min(SHEET_DRAG.maxShrink, d * SHEET_DRAG.scalePerPt);
  return { ty: dy < 0 ? dy * 0.25 : dy, scale: 1 - shrink, dim: clamp(1 - d / SHEET_DRAG.dimRange, 0, 1) };
}

// fly-off duration so that an easeOutQuad starts at the release speed
// fly-off: constant acceleration from release speed v0 (along the throw) to flyEndV → duration and position at time t
export function flyDuration(dist, v0) { 'worklet'; return clamp((2 * Math.abs(dist)) / (Math.max(0, v0 * Math.sign(dist)) + 5000), 0.08, 0.4); }
export function flyPos(x0, dist, v0, t, T) {
  'worklet';
  const u = Math.max(0, v0 * Math.sign(dist)); const a = (2 * (Math.abs(dist) - u * T)) / (T * T); const tt = Math.min(t, T);
  return x0 + Math.sign(dist) * (u * tt + 0.5 * a * tt * tt);
}

// rects for the shared-element transition (p: 0 = row thumbnail, 1 = hero)
export function rowThumbRect(i) {
  'worklet';
  const D = L.days;
  return { x: D.x + D.thumb.x, y: D.y + i * D.pitch + (D.h - D.thumb.s) / 2, w: D.thumb.s, h: D.thumb.s, r: D.thumb.r };
}
export function heroRect(i, p) {
  'worklet';
  const a = rowThumbRect(i), b = L.detail.hero;
  return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p), r: lerp(a.r, b.r, p) };
}

// digit roll: per-position offsets (in line-heights) for a value change at progress p (spring output, may overshoot)
export function digitRoll(fromStr, toStr, p, up) {
  const n = Math.max(fromStr.length, toStr.length);
  const a = fromStr.padStart(n, ' '), b = toStr.padStart(n, ' ');
  const out = [];
  for (let i = 0; i < n; i++) {
    if (a[i] === b[i]) out.push({ ch: b[i], old: null, off: 0 });
    else out.push({ ch: b[i], old: a[i], off: (up ? 1 : -1) * (1 - p) }); // new digit offset; old = off − dir
  }
  return out;
}

// sheet / card tone → CSS-like gradient stop list [[offset, color]]
export const toneStops = (card) => card.tone;
// card photo crop window [x0, y0, size] (fractions of the square photo) → css-ish placement inside the 345-pt square
export const cropPlace = (crop, side) => { const k = side / crop[2]; return { size: k, x: -crop[0] * k, y: -crop[1] * k }; };

// ASCII ramp (index 0 = blank). Order measured from the source: sparse on the blue cloth, digits on the bright fruit.
export const ASCII_RAMP = ' .:-/=+*739';
export const ASCII_CELL = { w: 6.76, h: 9, size: 10.2 };

// deterministic flicker: which cells shift a ramp level at tick k (≈1.5 % of cells every 120 ms)
export function flickerAt(k, idx) {
  let h = (idx * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  const u = (h >>> 0) / 4294967296;
  return u < 0.015 ? (u < 0.0075 ? -1 : 1) : 0;
}
export const FLICKER_MS = 120;

// ---------- animated-value defaults + frozen states (HTML ?state=… and RN `frozen` prop share these) ----------
export const DEFAULT_V = {
  dx: 0, dy: 0, rot: 0, promo: 0, lift: 0, topA: 1, clear: 0, cardText: 1, toast: 0,
  sheetY: SCREEN.h - L.sheet.top, sheetS: 1, dim: 0,
  deckA: 1, daysA: 0, statsA: 1, listA: 1, detailA: 0, heroP: 0, heroOn: 0, heroText: 0,
  pillX: L.tabbar.items[1], roll0: 1, roll1: 1, roll2: 1,
};
// name: 'deck' | 'drag:<dx>' | 'toast' | 'sheet' | 'sheetdrag:<dy>' | 'days' | 'detail' | 'hero:<p>'
export function frozenInit(name) {
  const [k, arg] = String(name || 'deck').split(':'); const n = parseFloat(arg ?? '0') || 0;
  const v = { ...DEFAULT_V };
  const s = { top: 0, tab: 'deck', day: -1, heroIdx: -1, sheet: false, stats: { ...STATS0 }, prevStats: { ...STATS0 }, hist: [] };
  if (k === 'drag') { v.dx = n; v.rot = n * DRAG.rotPerPt; v.promo = clamp(Math.abs(n) / DRAG.nextRamp, 0, 1); }
  if (k === 'toast') { s.top = 1; s.stats = applyDecision(STATS0, true); s.hist = [{ top: 0, before: { ...STATS0 }, keep: true }]; v.toast = 1; }
  if (k === 'sheet') { s.sheet = true; v.sheetY = 0; v.dim = 1; v.clear = 1; v.cardText = 0; }
  if (k === 'sheetdrag') { s.sheet = true; const d = sheetDragDerived(n); v.sheetY = d.ty; v.sheetS = d.scale; v.dim = d.dim; v.clear = 1; v.cardText = 0; }
  if (k === 'days' || k === 'detail' || k === 'hero') { s.tab = 'days'; v.pillX = L.tabbar.items[0]; v.deckA = 0; v.daysA = 1; }
  if (k === 'detail') { s.day = 0; s.heroIdx = 0; v.heroOn = 1; v.heroP = 1; v.heroText = 1; v.detailA = 1; v.listA = 0; v.statsA = 0; }
  if (k === 'hero') { s.day = 0; s.heroIdx = 0; v.heroOn = 1; v.heroP = n; v.listA = 1 - n; v.statsA = 1 - n; }
  return { v, s };
}
