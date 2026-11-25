// Feel Deck — React Native (Expo) port of 06_motion_feel_deck.html.
// Deps (all in Expo Go): react-native-reanimated, react-native-gesture-handler, @shopify/react-native-skia,
// expo-linear-gradient, react-native-svg. Fonts: @expo-google-fonts/lexend + @expo-google-fonts/geist-mono (load them in the app).
// Wrap the app in <GestureHandlerRootView>. Status bar + home indicator are system UI and are not drawn here.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useDerivedValue, withSpring, withTiming, withDelay, Easing, runOnJS, type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import type { SkFont } from '@shopify/react-native-skia';
import {
  SCREEN, C, L, CARDS, DAYS, STAT_LABELS, fmtStats, applyDecision, ICON, WAVE, WAVE_PLAYED,
  SPR, T, BEZ, DRAG, SHEET_DRAG, clamp, lerp, sheetDragDerived, flyDuration, flyPos, heroRect, springCfg,
  frozenInit, DEFAULT_V,
} from './src/feelCore.js';
import { CardArt, SheetPhoto } from './src/FeelArt';

export type FeelFonts = { light: string; regular: string; medium: string; mono: string; monoLight: string };
const DEFAULT_FONTS: FeelFonts = {
  light: 'Lexend_300Light', regular: 'Lexend_400Regular', medium: 'Lexend_500Medium',
  mono: 'GeistMono_400Regular', monoLight: 'GeistMono_300Light',
};
const DEFAULT_IMAGES: Record<string, number> = {
  peaches: require('./assets/img/peaches.jpg'),
  lanterns: require('./assets/img/lanterns.jpg'),
  mimosa: require('./assets/img/mimosa.jpg'),
  sailboat: require('./assets/img/sailboat.jpg'),
};

export type FeelDeckProps = {
  /** false = the "Without" build: no follow, no springs, instant swaps */
  feel?: boolean;
  fonts?: Partial<FeelFonts>;
  images?: Partial<Record<'peaches' | 'lanterns' | 'mimosa' | 'sailboat', number>>;
  asciiFont?: SkFont | null;
  /** fit the 393×852 design to this width (defaults to the window width) */
  width?: number;
  /** parity / screenshots: 'deck' | 'drag:<dx>' | 'toast' | 'sheet' | 'sheetdrag:<dy>' | 'days' | 'detail' | 'hero:<p>' */
  frozen?: string;
};

const ease = (b: number[]) => Easing.bezier(b[0], b[1], b[2], b[3]);
const EASE = { fade: ease(BEZ.fade), sheet: ease(BEZ.sheet), lin: Easing.linear };
const mod = (a: number, n: number) => ((a % n) + n) % n;
const CI = L.cardIn, CW = L.card.w, CH = L.card.h, TB = L.tabbar, DL = L.days, DD = L.detail, SH = L.sheet;
const LH_NUM = 36;

function Icon({ d, size, color, fill, sw = 1.8, style }: { d: string; size: number; color: string; fill?: boolean; sw?: number; style?: any }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path d={d} fill={fill ? color : 'none'} stroke={fill ? 'none' : color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
// text whose line box is centred on cy (HTML centerY)
const ty = (cy: number, lh: number) => ({ position: 'absolute' as const, top: cy - lh / 2, height: lh, lineHeight: lh });

const APress = Animated.createAnimatedComponent(Pressable);
function Press({ style, to = T.pressScale, feel, onPress, children, testID, disabled }: {
  style: ViewStyle | ViewStyle[]; to?: number; feel: boolean; onPress?: () => void; children?: React.ReactNode; testID?: string; disabled?: boolean;
}) {
  const s = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const cfg = springCfg(SPR.press);
  return (
    <APress testID={testID} disabled={disabled} style={[style as any, st]} onPress={onPress}
      onPressIn={() => { if (feel) s.value = withSpring(to, cfg); }}
      onPressOut={() => { if (feel) s.value = withSpring(1, cfg); }}>
      {children}
    </APress>
  );
}

// ---------- stats with per-digit roll ----------
function StatNumber({ i, cur, prev, roll, dir, fonts }: { i: number; cur: string; prev: string; roll: SharedValue<number>; dir: number; fonts: FeelFonts }) {
  const n = Math.max(cur.length, prev.length);
  const a = prev.padStart(n, ' '), b = cur.padStart(n, ' ');
  const cw = L.stats.numSize * 0.6, x0 = 60 - (n * cw) / 2;
  return (
    <View testID={`stat${i}`} style={{ position: 'absolute', left: L.stats.xs[i] - 60, width: 120, top: L.stats.numY - LH_NUM / 2, height: LH_NUM, overflow: 'hidden' }}>
      {Array.from({ length: n }, (_, j) => <Digit key={j} x={x0 + j * cw} w={cw} ch={b[j]} old={a[j] !== b[j] ? a[j] : null} roll={roll} dir={dir} fonts={fonts} />)}
    </View>
  );
}
function Digit({ x, w, ch, old, roll, dir, fonts }: { x: number; w: number; ch: string; old: string | null; roll: SharedValue<number>; dir: number; fonts: FeelFonts }) {
  const sNew = useAnimatedStyle(() => ({ transform: [{ translateY: old === null ? 0 : dir * (1 - roll.value) * LH_NUM }] }));
  const sOld = useAnimatedStyle(() => ({ opacity: old === null || Math.abs(1 - roll.value) < 1e-3 ? 0 : 1, transform: [{ translateY: (dir * (1 - roll.value) - dir) * LH_NUM }] }));
  const st = { position: 'absolute' as const, left: x, width: w, top: 0, height: LH_NUM, lineHeight: LH_NUM, textAlign: 'center' as const, fontFamily: fonts.monoLight, fontSize: L.stats.numSize, color: C.num };
  return (
    <>
      <Animated.Text style={[st, sNew]}>{ch.trim()}</Animated.Text>
      {old !== null && <Animated.Text style={[st, sOld]}>{old.trim()}</Animated.Text>}
    </>
  );
}

// ---------- one card in the deck (depth is derived on the UI thread from v.top) ----------
type Vals = Record<string, SharedValue<number>>;
function CardView({ idx, v, feel, fonts, images, asciiFont, frozen, topJS, onEye, onX, onC }: {
  idx: number; v: Vals; feel: boolean; fonts: FeelFonts; images: Record<string, number>; asciiFont?: SkFont | null; frozen?: boolean; topJS: number;
  onEye: () => void; onX: () => void; onC: () => void;
}) {
  const c = CARDS[mod(idx, CARDS.length)];
  const root = useAnimatedStyle(() => {
    const d = idx - v.top.value, p = v.promo.value;
    let tx = 0, tyv = 0, s = 1, rot = 0, op = 1;
    if (d === 0) {
      tx = v.dx.value; rot = v.rot.value; tyv = v.dy.value; op = v.topA.value;
      if (v.flying.value > 0) { tx = flyPos(v.flyX0.value, v.flyDist.value, v.flyV0.value, v.fly.value * v.flyDur.value, v.flyDur.value); rot = tx * DRAG.rotPerPt; }
    } else if (d === 1) { s = lerp(L.stack[1].s, 1, p); tyv = lerp(L.stack[1].ty, 0, p); }
    else if (d === 2) { s = lerp(L.stack[2].s, L.stack[1].s, p); tyv = lerp(L.stack[2].ty, L.stack[1].ty, p); }
    else if (d === 3) { s = lerp(0.73, L.stack[2].s, p); tyv = lerp(100, L.stack[2].ty, p); op = p; }
    else { op = 0; }
    return { opacity: op, zIndex: 10 - d, transform: [{ translateX: tx }, { translateY: tyv }, { rotate: `${rot}deg` }, { scale: s }] };
  });
  const dimmer = useAnimatedStyle(() => {
    const d = idx - v.top.value, p = v.promo.value;
    const a = d === 0 ? 0 : d === 1 ? lerp(1, 0.45, p) * (1 - v.lift.value) : 1;
    const col = d >= 3 || (d === 2 && p <= 0.5) ? C.stack2 : C.stack1;
    return { opacity: a, backgroundColor: col };
  });
  const textBox = useAnimatedStyle(() => ({ opacity: idx - v.top.value === 0 ? v.cardText.value : 1 }));
  const clear = useDerivedClear(v, idx);
  const depthJS = idx - topJS;
  const tone = [[0, c.tone[0][1]], ...c.tone] as [number, string][];
  return (
    <Animated.View testID={`card${depthJS}`} pointerEvents={depthJS === 0 ? 'box-none' : 'none'}
      style={[{ position: 'absolute', left: L.card.x, top: L.card.y, width: CW, height: CH, borderRadius: L.card.r, overflow: 'hidden' }, root]}>
      <LinearGradient style={StyleSheet.absoluteFill} colors={tone.map((t) => t[1]) as any} locations={tone.map((t) => t[0]) as any} />
      <CardArt source={images[c.img]} imgKey={c.img} crop={c.crop} clear={clear} live={depthJS <= 1 && depthJS >= 0} frozen={frozen} font={asciiFont} />
      <View style={[styles.chip, { left: CI.chip.x, top: CI.chip.y, height: CI.chip.h, paddingHorizontal: CI.chip.padX }]}>
        <Text style={{ fontFamily: fonts.regular, fontSize: CI.chip.size, color: '#f4f4f4', lineHeight: CI.chip.h }}>{c.tag}</Text>
      </View>
      <Press testID="eye" feel={feel} onPress={onEye} disabled={depthJS !== 0}
        style={[styles.glass, { left: CI.eye.cx - CI.eye.d / 2, top: CI.eye.cy - CI.eye.d / 2, width: CI.eye.d, height: CI.eye.d, borderRadius: CI.eye.d / 2 }]}>
        <Icon d={ICON.eye} size={17} color="#eef3f7" sw={1.9} style={{ position: 'absolute', left: 8, top: 8 }} />
      </Press>
      <Animated.View testID={`cardText${depthJS}`} style={[StyleSheet.absoluteFill, textBox]} pointerEvents="none">
        {[c.date + ':', ...c.lines].map((s: string, i: number) => (
          <Text key={i} style={[ty(CI.head.firstY + i * CI.head.lh, CI.head.lh), { left: CI.head.x, fontFamily: fonts.medium, fontSize: CI.head.size, color: '#fff' }]}>{s}</Text>
        ))}
        <View style={{ position: 'absolute', left: CI.quote.barX, top: CI.quote.y, width: 1.5, height: CI.quote.h, backgroundColor: 'rgba(255,255,255,0.32)', borderRadius: 1 }} />
        {c.quote.map((s: string, i: number) => (
          <Text key={i} style={[ty(CI.quote.firstY + i * CI.quote.lh, CI.quote.lh), { left: CI.quote.x, fontFamily: fonts.light, fontSize: CI.quote.size, color: 'rgba(255,255,255,0.8)' }]}>{s}</Text>
        ))}
      </Animated.View>
      {CI.btns.xs.map(([x, w]: number[], i: number) => (
        <Press key={i} testID={['bx', 'bw', 'bc'][i]} feel={feel} disabled={depthJS !== 0} onPress={i === 0 ? onX : i === 2 ? onC : undefined}
          style={{ position: 'absolute', left: x, top: CI.btns.y, width: w, height: CI.btns.h, borderRadius: CI.btns.h / 2, backgroundColor: C.btn }}>
          <Icon d={[ICON.x, ICON.wave, ICON.check][i]} size={23} color="#fff" sw={2} style={{ position: 'absolute', left: w / 2 - 11.5, top: 16.5 }} />
        </Press>
      ))}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, dimmer]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: L.card.r, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' }]} />
    </Animated.View>
  );
}
// the clear-photo opacity only applies to the top card
function useDerivedClear(v: Vals, idx: number) {
  return useDerivedValue(() => (idx - v.top.value === 0 ? v.clear.value : 0));
}

// ======================================================================================
export default function FeelDeck(props: FeelDeckProps) {
  const feel = props.feel !== false;
  const fonts: FeelFonts = { ...DEFAULT_FONTS, ...(props.fonts || {}) };
  const images = { ...DEFAULT_IMAGES, ...(props.images || {}) } as Record<string, number>;
  const win = useWindowDimensions();
  const scale = (props.width ?? win.width) / SCREEN.w;
  const init = useMemo(() => frozenInit(props.frozen || 'deck'), [props.frozen]);

  // ---- React state (structure) ----
  const [top, setTop] = useState(init.s.top);
  const [tab, setTab] = useState<'deck' | 'days'>(init.s.tab as any);
  const [day, setDay] = useState(init.s.day);
  const [heroIdx, setHeroIdx] = useState(init.s.heroIdx);
  const [sheetOpen, setSheetOpen] = useState(init.s.sheet);
  const [stats, setStats] = useState(init.s.stats);
  const [prevStats, setPrevStats] = useState(init.s.prevStats);
  const [dirs, setDirs] = useState([1, 1, 1]);
  const [toastText, setToastText] = useState({ keep: true, label: 'Nov 14' });
  const hist = useRef<any[]>(init.s.hist.slice());
  const busy = useRef(false);
  const timers = useRef<any[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // ---- shared values (one per HTML V key) ----
  const mk = (k: string, x: number) => useSharedValue(x); // eslint-disable-line react-hooks/rules-of-hooks
  const v: Vals = {} as any;
  for (const k of Object.keys(DEFAULT_V)) v[k] = mk(k, (init.v as any)[k]);
  v.top = mk('top', init.s.top);
  v.heroIdx = mk('heroIdx', Math.max(0, init.s.heroIdx));
  for (const k of ['fly', 'flying', 'flyX0', 'flyDist', 'flyV0', 'sheetFlyT', 'sheetFlying', 'sfY0', 'sfDist', 'sfV0']) v[k] = mk(k, 0);
  v.flyDur = mk('flyDur', 1); v.sfDur = mk('sfDur', 1);

  // ---- animation helpers (Without = instant) ----
  const setV = (k: string, x: number) => { v[k].value = x; };
  const sp = useCallback((k: string, to: number, cfg: { w: number; z: number }, v0 = 0, done?: () => void) => {
    if (!feel) { v[k].value = to; done && done(); return; }
    v[k].value = withSpring(to, { ...springCfg(cfg), velocity: v0 }, (fin) => { if (fin && done) runOnJS(done)(); });
  }, [feel]); // eslint-disable-line react-hooks/exhaustive-deps
  const tw = useCallback((k: string, to: number, dur: number, e = EASE.fade, delay = 0, done?: () => void) => {
    if (!feel) { v[k].value = to; done && done(); return; }
    const a = withTiming(to, { duration: dur * 1000, easing: e }, (fin) => { if (fin && done) runOnJS(done)(); });
    v[k].value = delay > 0 ? withDelay(delay * 1000, a) : a;
  }, [feel]); // eslint-disable-line react-hooks/exhaustive-deps
  const after = (sec: number, fn: () => void) => { if (!feel) { fn(); return; } timers.current.push(setTimeout(fn, sec * 1000)); };

  // ---- actions (same sequencing as the HTML) ----
  const rollTo = (from: typeof stats, to: typeof stats) => {
    const a = fmtStats(from), b = fmtStats(to);
    setDirs([0, 1, 2].map((i) => (+b[i] >= +a[i] ? 1 : -1)));
    [0, 1, 2].forEach((i) => { if (a[i] !== b[i]) { v['roll' + i].value = 0; sp('roll' + i, 1, SPR.digit); } });
    setPrevStats(from); setStats(to);
  };
  const statsRef = useRef(stats); statsRef.current = stats;
  const topRef = useRef(top); topRef.current = top;

  const decide = (keep: boolean, vx: number) => {
    if (busy.current) return; busy.current = true;
    const before = { ...statsRef.current }, t0 = topRef.current, dir = keep ? 1 : -1;
    const x0 = v.dx.value, dist = dir * DRAG.flyX - x0;
    const v0 = vx || (feel ? dir * 900 : 0);
    const dur = flyDuration(dist, v0);
    const shift = () => {
      hist.current.push({ top: t0, before, keep });
      v.top.value = t0 + 1; v.flying.value = 0; v.promo.value = 0; v.lift.value = 0; v.dx.value = 0; v.rot.value = 0; v.dy.value = 0;
      setTop(t0 + 1); busy.current = false;
    };
    let pending = 2; const both = () => { if (--pending === 0) shift(); };
    v.flyX0.value = x0; v.flyDist.value = dist; v.flyV0.value = v0; v.flyDur.value = dur; v.flying.value = 1;
    v.fly.value = 0; tw('fly', 1, dur, EASE.lin, 0, both);
    tw('lift', 1, T.liftDur);
    sp('promo', 1, SPR.follow, 0, both);
    after(T.digitDelay, () => rollTo(statsRef.current, applyDecision(statsRef.current, keep)));
    const c = CARDS[mod(t0, CARDS.length)];
    after(T.toastDelay, () => { setToastText({ keep, label: c.toast }); sp('toast', 1, SPR.toast); });
  };
  const undo = () => {
    const h = hist.current.pop(); if (!h) return; if (busy.current) { hist.current.push(h); return; }
    busy.current = true; const dir = h.keep ? 1 : -1;
    v.top.value = h.top; setTop(h.top);
    v.dx.value = dir * 440; v.rot.value = dir * 16; v.promo.value = 1; v.lift.value = 0;
    sp('dx', 0, SPR.back); sp('rot', 0, SPR.back);
    sp('promo', 0, SPR.back, 0, () => { busy.current = false; });
    rollTo(statsRef.current, h.before);
    tw('toast', 0, 0.1);
  };
  const openSheet = () => {
    if (sheetOpen) return; setSheetOpen(true);
    tw('clear', 1, T.imgSwap); tw('cardText', 0, T.cardTextFade);
    v.sheetS.value = 1; v.sheetFlying.value = 0;
    tw('sheetY', 0, T.sheetOpen, EASE.sheet); tw('dim', 1, T.sheetDim);
  };
  const closeSheet = (vy: number) => {
    setSheetOpen(false);
    const target = SCREEN.h - SH.top + 10, y0 = v.sheetY.value, dist = target - y0, v0 = vy || 600, dur = flyDuration(dist, v0);
    v.sfY0.value = y0; v.sfDist.value = dist; v.sfV0.value = v0; v.sfDur.value = dur; v.sheetFlying.value = 1;
    v.sheetFlyT.value = 0;
    tw('sheetFlyT', 1, dur, EASE.lin, 0, () => { v.sheetFlying.value = 0; v.sheetY.value = target; v.sheetS.value = 1; });
    tw('dim', 0, 0.25);
    tw('clear', 0, T.asciiBack, EASE.fade, T.asciiBackDelay);
    tw('cardText', 1, 0.2, EASE.fade, T.textBackDelay);
  };
  const closeDetail = (instant: boolean) => {
    if (day < 0) return; setDay(-1);
    if (instant) { ['heroOn', 'heroP', 'detailA', 'heroText'].forEach((k) => setV(k, 0)); setV('listA', 1); setV('statsA', 1); return; }
    tw('heroText', 0, 0.1); tw('detailA', 0, 0.12);
    after(T.backDelay, () => sp('heroP', 0, SPR.heroBack, 0, () => setV('heroOn', 0)));
    tw('listA', 1, 0.2, EASE.fade, T.backDelay); tw('statsA', 1, 0.2, EASE.fade, T.backDelay);
  };
  const goTab = (i: number) => {
    if (i === 2) return;
    const name = i === 0 ? 'days' : 'deck';
    if (day >= 0) closeDetail(true);
    if (tab === name) return;
    setTab(name); sp('pillX', TB.items[i], SPR.pill);
    const [inK, outK] = name === 'days' ? ['daysA', 'deckA'] : ['deckA', 'daysA'];
    tw(inK, 1, T.tabIn, EASE.fade, T.tabInDelay); tw(outK, 0, T.tabOut, EASE.fade, T.tabOutDelay);
  };
  const openDetail = (i: number) => {
    if (day >= 0) return; setDay(i); setHeroIdx(i); v.heroIdx.value = i;
    setV('heroOn', 1); setV('heroP', 0); setV('heroText', 0);
    tw('listA', 0, T.listOut); tw('statsA', 0, T.listOut);
    sp('heroP', 1, SPR.hero);
    tw('heroText', 1, 0.16, EASE.fade, T.detailInDelay);
    tw('detailA', 1, T.detailIn, EASE.fade, T.detailInDelay);
  };

  // ---- gestures ----
  const onCardRelease = (dx: number, vx: number) => {
    if (busy.current) return;
    const commit = feel ? Math.abs(dx) > DRAG.commitDx || (Math.abs(vx) > DRAG.commitV && Math.sign(vx) === Math.sign(dx)) : Math.abs(dx) > 60;
    if (commit) decide(dx > 0, feel ? vx : 0);
    else { sp('dx', 0, SPR.back, vx); sp('dy', 0, SPR.back); sp('rot', 0, SPR.back); sp('promo', 0, SPR.back); }
  };
  const cardPan = Gesture.Pan().enabled(tab === 'deck' && !sheetOpen).activeOffsetX([-8, 8])
    .onUpdate((e) => {
      if (!feel || v.flying.value > 0) return;
      v.dx.value = e.translationX; v.dy.value = e.translationY * 0.15; v.rot.value = e.translationX * DRAG.rotPerPt;
      v.promo.value = clamp(Math.abs(e.translationX) / DRAG.nextRamp, 0, 1);
    })
    .onEnd((e) => { runOnJS(onCardRelease)(e.translationX, e.velocityX); });
  const onSheetRelease = (dy: number, vy: number) => {
    if (dy > SHEET_DRAG.commitDy || vy > SHEET_DRAG.commitV) closeSheet(vy);
    else { sp('sheetY', 0, SPR.sheetBack, vy); sp('sheetS', 1, SPR.sheetBack); sp('dim', 1, SPR.sheetBack); }
  };
  const sheetPan = Gesture.Pan().enabled(sheetOpen).activeOffsetY([-6, 6])
    .onUpdate((e) => {
      if (!feel) return;
      const d = sheetDragDerived(e.translationY);
      v.sheetY.value = d.ty; v.sheetS.value = d.scale; v.dim.value = d.dim;
    })
    .onEnd((e) => { runOnJS(onSheetRelease)(e.translationY, e.velocityY); });

  // ---- animated styles ----
  const aStats = useAnimatedStyle(() => ({ opacity: v.statsA.value }));
  const aDeck = useAnimatedStyle(() => ({ opacity: v.deckA.value }));
  const aDays = useAnimatedStyle(() => ({ opacity: v.daysA.value * v.listA.value }));
  const aHint = useAnimatedStyle(() => ({ opacity: clamp(1 - v.toast.value * 2.2, 0, 1) }));
  const aToast = useAnimatedStyle(() => ({ opacity: clamp(v.toast.value * 1.6, 0, 1), transform: [{ translateY: (1 - v.toast.value) * 46 }] }));
  const aPill = useAnimatedStyle(() => ({ transform: [{ translateX: v.pillX.value - TB.x - 1 - TB.pill.w / 2 }] }));
  const aDim = useAnimatedStyle(() => ({ opacity: v.dim.value * 0.62 }));
  const aStatusDim = useAnimatedStyle(() => ({ opacity: v.dim.value }));
  const aSheet = useAnimatedStyle(() => {
    const y = v.sheetFlying.value > 0 ? flyPos(v.sfY0.value, v.sfDist.value, v.sfV0.value, v.sheetFlyT.value * v.sfDur.value, v.sfDur.value) : v.sheetY.value;
    const k = 1 - v.sheetS.value;
    return {
      transform: [{ translateY: y }, { scale: v.sheetS.value }],
      borderTopLeftRadius: SH.r + k * 200, borderTopRightRadius: SH.r + k * 200, borderBottomLeftRadius: k * 300, borderBottomRightRadius: k * 300,
      opacity: y >= SCREEN.h - SH.top - 1 ? 0 : 1,
    };
  });
  const aHero = useAnimatedStyle(() => {
    const r = heroRect(v.heroIdx.value, v.heroP.value);
    return { left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: r.r, opacity: v.heroOn.value > 0 ? 1 : 0 };
  });
  const aHeroText = useAnimatedStyle(() => ({ opacity: v.heroText.value }));
  const aDetail = useAnimatedStyle(() => ({ opacity: v.detailA.value }));

  const cur = fmtStats(stats), prev = fmtStats(prevStats);
  const sheetCard = CARDS[mod(top, CARDS.length)];
  const d0 = DAYS[Math.max(0, heroIdx)];
  const frozen = !!props.frozen;

  return (
    <View style={{ width: SCREEN.w * scale, height: SCREEN.h * scale, overflow: 'hidden' }}>
      <View testID="screen" style={{ width: SCREEN.w, height: SCREEN.h, backgroundColor: C.bg, transform: [{ scale }], transformOrigin: 'top left' }}>
        {/* stats */}
        <Animated.View testID="stats" pointerEvents="none" style={[styles.abs, { left: 0, top: 0, width: SCREEN.w, height: 170, zIndex: 5 }, aStats]}>
          {[0, 1, 2].map((i) => (
            <React.Fragment key={i}>
              <StatNumber i={i} cur={cur[i]} prev={prev[i]} roll={v['roll' + i]} dir={dirs[i]} fonts={fonts} />
              <Text style={[ty(L.stats.labelY, 16), { left: L.stats.xs[i] - 50, width: 100, textAlign: 'center', fontFamily: fonts.light, fontSize: L.stats.labelSize, color: C.label }]}>{STAT_LABELS[i]}</Text>
            </React.Fragment>
          ))}
        </Animated.View>

        {/* deck */}
        <Animated.View testID="deck" pointerEvents={tab === 'deck' ? 'box-none' : 'none'} style={[styles.abs, styles.full, { zIndex: 4 }, aDeck]}>
          <Animated.View testID="hint" pointerEvents="none" style={[styles.abs, styles.full, aHint]}>
            {['Swipe left to let go, right to keep', 'tap the eye to see the photograph'].map((s, i) => (
              <Text key={i} style={[ty(i ? L.hint.y2 : L.hint.y1, 18), { left: 0, width: SCREEN.w, textAlign: 'center', fontFamily: fonts.light, fontSize: L.hint.size, color: C.hint }]}>{s}</Text>
            ))}
          </Animated.View>
          <GestureDetector gesture={cardPan}>
            <View style={[styles.abs, styles.full]} pointerEvents="box-none">
              {[top - 1, top, top + 1, top + 2, top + 3].map((idx) => (
                <CardView key={idx} idx={idx} v={v} feel={feel} fonts={fonts} images={images} asciiFont={props.asciiFont} frozen={frozen} topJS={top}
                  onEye={openSheet} onX={() => decide(false, 0)} onC={() => decide(true, 0)} />
              ))}
            </View>
          </GestureDetector>
          <Animated.View testID="toast" pointerEvents={hist.current.length ? 'box-none' : 'none'}
            style={[styles.abs, { left: L.toast.x, top: L.toast.y, width: L.toast.w, height: L.toast.h, borderRadius: L.toast.h / 2, backgroundColor: C.toast, borderWidth: 1, borderColor: C.hair, zIndex: 20 }, aToast]}>
            <View style={[styles.abs, { left: L.toast.check.cx - L.toast.x - L.toast.check.d / 2 - 1, top: L.toast.h / 2 - L.toast.check.d / 2 - 1, width: L.toast.check.d, height: L.toast.check.d, borderRadius: L.toast.check.d / 2, backgroundColor: toastText.keep ? C.accent : '#5a5a5a' }]}>
              <Icon d={toastText.keep ? ICON.check : ICON.x} size={15} color={C.accentInk} sw={2.4} style={{ position: 'absolute', left: 6.3, top: 6.3 }} />
            </View>
            <Text style={[styles.abs, { left: L.toast.textX - L.toast.x - 1, top: 0, height: L.toast.h - 2, lineHeight: L.toast.h - 2, fontFamily: fonts.regular, fontSize: L.toast.size, color: '#f0f0f0' }]}>{`${toastText.keep ? 'Kept' : 'Let go'} · ${toastText.label}`}</Text>
            <Press testID="undo" feel={feel} onPress={undo}
              style={{ position: 'absolute', left: L.toast.undo.x - L.toast.x - 1, top: L.toast.undo.y - L.toast.y - 1, width: L.toast.undo.w, height: L.toast.undo.h, borderRadius: L.toast.undo.h / 2, backgroundColor: C.undo }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: L.toast.size, color: C.accent, textAlign: 'center', lineHeight: L.toast.undo.h }}>Undo</Text>
            </Press>
          </Animated.View>
        </Animated.View>

        {/* days list */}
        <Animated.View testID="days" pointerEvents={tab === 'days' && day < 0 ? 'box-none' : 'none'} style={[styles.abs, styles.full, { zIndex: 3 }, aDays]}>
          <Text style={[ty(DL.labelY, 18), { left: DL.labelX, fontFamily: fonts.light, fontSize: 13, color: '#5a5a5a' }]}>This week</Text>
          {DAYS.map((d: any, i: number) => (
            <Press key={d.id} testID={`row${i}`} feel={feel} to={T.rowPressScale} onPress={() => openDetail(i)}
              style={{ position: 'absolute', left: DL.x, top: DL.y + i * DL.pitch, width: DL.w, height: DL.h, borderRadius: DL.r, backgroundColor: C.row }}>
              <View style={{ position: 'absolute', left: DL.thumb.x, top: (DL.h - DL.thumb.s) / 2, width: DL.thumb.s, height: DL.thumb.s, borderRadius: DL.thumb.r, overflow: 'hidden', opacity: heroIdx === i && day >= 0 ? 0 : 1 }}>
                <Image source={images[d.img]} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <LinearGradient style={StyleSheet.absoluteFill} colors={['transparent', d.haze + '66', d.haze + 'c0']} locations={[0.5, 0.74, 1]} />
              </View>
              <Text style={[ty(DL.titleY, 22), { left: DL.titleX, fontFamily: fonts.regular, fontSize: 17, color: C.text }]}>{d.title}</Text>
              <Text style={[ty(DL.subY, 18), { left: DL.titleX, fontFamily: fonts.light, fontSize: 14, color: C.rowSub }]}>{d.sub}</Text>
              <Text style={[ty(DL.numY, 28), { right: DL.numR, fontFamily: fonts.monoLight, fontSize: 22, color: C.rowNum }]}>{d.n}</Text>
            </Press>
          ))}
        </Animated.View>

        {/* detail rows */}
        <Animated.View testID="detail" pointerEvents={day >= 0 ? 'box-none' : 'none'} style={[styles.abs, styles.full, { zIndex: 6 }, aDetail]}>
          {d0.items.map(([lab, tx, ok]: any, j: number) => <DetailRow key={j} j={j} lab={lab} tx={tx} ok={!!ok} v={v} fonts={fonts} feel={feel} />)}
          <Text style={[ty(DD.footY, 18), { left: 0, width: SCREEN.w, textAlign: 'center', fontFamily: fonts.light, fontSize: 13, color: C.foot }]}>{d0.foot}</Text>
        </Animated.View>

        {/* hero (shared element) */}
        <Animated.View testID="hero" pointerEvents={day >= 0 ? 'box-none' : 'none'} style={[styles.abs, { overflow: 'hidden', zIndex: 7 }, aHero]}>
          <Image source={images[d0.img]} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient style={StyleSheet.absoluteFill} colors={['transparent', d0.haze + '66', d0.haze + 'c0']} locations={[0.5, 0.74, 1]} />
          <Animated.View style={[StyleSheet.absoluteFill, aHeroText]} pointerEvents="none">
            <LinearGradient style={StyleSheet.absoluteFill} colors={['transparent', d0.heroTint + 'd0', d0.heroTint]} locations={[0.48, 0.78, 1]} />
          </Animated.View>
          <Animated.View testID="heroUi" style={[styles.abs, { left: 0, top: 0, width: DD.hero.w, height: DD.hero.h }, aHeroText]} pointerEvents="box-none">
            <Press testID="back" feel={feel} onPress={() => closeDetail(false)}
              style={[styles.glass, { left: DD.back.cx - DD.back.d / 2, top: DD.back.cy - DD.back.d / 2, width: DD.back.d, height: DD.back.d, borderRadius: DD.back.d / 2 }]}>
              <Icon d={ICON.chevL} size={16} color="#eef3f7" sw={2} style={{ position: 'absolute', left: 8, top: 8.5 }} />
            </Press>
            <View style={[styles.glass, { left: DD.hero.w - DD.cards.r - DD.cards.w, top: DD.cards.y, width: DD.cards.w, height: DD.cards.h, borderRadius: DD.cards.h / 2 }]}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: '#e8edf2', textAlign: 'center', lineHeight: DD.cards.h }}>{String(d0.items.length).padStart(2, '0')} cards</Text>
            </View>
            <Text style={[ty(DD.kickerY, 18), { left: DD.textX, fontFamily: fonts.regular, fontSize: 13, letterSpacing: 1.3, color: 'rgba(255,255,255,0.82)' }]}>{d0.kicker}</Text>
            {d0.head.map((s: string, j: number) => (
              <Text key={j} style={[ty(DD.titleY[j], 28.4), { left: DD.textX, fontFamily: fonts.medium, fontSize: DD.titleSize, color: '#fff' }]}>{s}</Text>
            ))}
          </Animated.View>
        </Animated.View>

        {/* tab bar + mic */}
        <View testID="tabbar" style={[styles.abs, { left: TB.x, top: TB.y, width: TB.w, height: TB.h, borderRadius: TB.h / 2, backgroundColor: C.tabbar, borderWidth: 1, borderColor: C.hair, zIndex: 20 }]}>
          <Animated.View testID="pill" style={[styles.abs, { left: 0, top: TB.pill.y - TB.y - 1, width: TB.pill.w, height: TB.pill.h, borderRadius: TB.pill.h / 2, overflow: 'hidden', backgroundColor: C.tabActive }, aPill]}>
            <LinearGradient style={StyleSheet.absoluteFill} colors={[C.tabActive, C.tabActive, C.tabActiveGlow]} locations={[0, 0.45, 1]} />
          </Animated.View>
          {['Days', 'Deck', 'You'].map((name, i) => {
            const on = (tab === 'days' ? 0 : 1) === i;
            const d = i === 0 ? (on ? ICON.daysFill : ICON.days) : i === 1 ? (on ? ICON.deckFill : ICON.deck) : ICON.you;
            return (
              <Press key={name} testID={`tab${i}`} feel={feel} onPress={() => goTab(i)} style={{ position: 'absolute', left: TB.items[i] - TB.x - 1 - 36, top: 0, width: 72, height: TB.h - 2 }}>
                <Icon d={d} size={24} color={on ? C.accent : '#ececec'} fill={on && i < 2} sw={1.7} style={{ position: 'absolute', left: 24, top: TB.iconY - TB.y - 1 - 12 }} />
                <Text style={[ty(TB.labelY - TB.y - 1, 14), { left: 0, width: 72, textAlign: 'center', fontFamily: fonts.medium, fontSize: 11, color: on ? C.accent : '#e6e6e6' }]}>{name}</Text>
              </Press>
            );
          })}
        </View>
        <Press testID="mic" feel={feel} style={{ position: 'absolute', left: L.mic.cx - L.mic.d / 2, top: L.mic.cy - L.mic.d / 2, width: L.mic.d, height: L.mic.d, borderRadius: L.mic.d / 2, backgroundColor: C.mic, borderWidth: 1, borderColor: C.hair, zIndex: 20 }}>
          <Icon d={ICON.mic} size={22} color="#f0f0f0" sw={1.9} style={{ position: 'absolute', left: L.mic.d / 2 - 12 - 1, top: L.mic.d / 2 - 12 - 1 }} />
        </Press>

        {/* dim + sheet */}
        <Animated.View testID="dim" pointerEvents="none" style={[styles.abs, styles.full, { backgroundColor: '#000', zIndex: 40 }, aDim]} />
        <Animated.View pointerEvents="none" style={[styles.abs, { left: 0, top: 0, width: SCREEN.w, height: SH.top, backgroundColor: C.statusDim, zIndex: 41 }, aStatusDim]} />
        <GestureDetector gesture={sheetPan}>
          <Animated.View testID="sheet" pointerEvents={sheetOpen ? 'auto' : 'none'}
            style={[styles.abs, { left: 0, top: SH.top, width: SCREEN.w, height: SCREEN.h - SH.top + 60, overflow: 'hidden', zIndex: 50, transformOrigin: 'top' }, aSheet]}>
            <LinearGradient style={StyleSheet.absoluteFill} colors={sheetCard.sheet.map((s: any) => s[1])} locations={sheetCard.sheet.map((s: any) => s[0])} />
            <SheetPhoto source={images[sheetCard.img]} />
            <View style={[styles.abs, { left: 196.5 - SH.grab.w / 2, top: SH.grab.y - SH.top - SH.grab.h / 2, width: SH.grab.w, height: SH.grab.h, borderRadius: 3, backgroundColor: 'rgba(200,214,234,0.62)' }]} />
            <Press testID="close" feel={feel} onPress={() => closeSheet(0)}
              style={{ position: 'absolute', left: SH.close.cx - SH.close.d / 2, top: SH.close.cy - SH.top - SH.close.d / 2, width: SH.close.d, height: SH.close.d, borderRadius: SH.close.d / 2, backgroundColor: 'rgba(12,22,44,0.6)' }}>
              <Icon d={ICON.x} size={14} color="#eef3f7" sw={2.1} style={{ position: 'absolute', left: 9, top: 9 }} />
            </Press>
            <SheetBody c={sheetCard} fonts={fonts} />
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

function DetailRow({ j, lab, tx, ok, v, fonts }: { j: number; lab: string; tx: string; ok: boolean; v: Vals; fonts: FeelFonts; feel: boolean }) {
  const st = useAnimatedStyle(() => {
    const a = clamp(v.detailA.value * 4 - j * 0.5, 0, 1);
    return { opacity: a, transform: [{ translateY: (1 - a) * 8 }] };
  });
  const R = DD.rows;
  return (
    <Animated.View testID={`detrow${j}`} style={[styles.abs, { left: DD.hero.x, top: R.y + j * R.pitch, width: DD.hero.w, height: R.h, borderRadius: R.r, backgroundColor: C.rowDetail }, st]}>
      <Text style={[ty(R.h / 2, 18), { left: R.labelX, fontFamily: fonts.light, fontSize: 13, color: C.rowLabel }]}>{lab}</Text>
      <Text style={[ty(R.h / 2, 20), { left: R.textX, fontFamily: fonts.light, fontSize: 16, color: ok ? '#eeeeee' : '#7a7a7a' }]}>{tx}</Text>
      <View style={[styles.abs, { left: DD.hero.w - R.circR - R.d / 2, top: (R.h - R.d) / 2, width: R.d, height: R.d, borderRadius: R.d / 2, backgroundColor: ok ? '#eca560' : 'transparent', borderWidth: ok ? 0 : 1, borderColor: '#4a4a4a' }]}>
        <Icon d={ok ? ICON.check : ICON.x} size={ok ? 15 : 12} color={ok ? C.accentInk : '#8a8a8a'} sw={ok ? 2.4 : 1.8} style={{ position: 'absolute', left: ok ? 6.3 : 6.8, top: ok ? 6.3 : 6.8 }} />
      </View>
    </Animated.View>
  );
}

function SheetBody({ c, fonts }: { c: any; fonts: FeelFonts }) {
  const A = SH.audio, cy = A.h / 2 - 1, n = WAVE.length, dx = (A.barsX1 - A.barsX0) / (n - 1);
  return (
    <View pointerEvents="box-none" style={[styles.abs, { left: 0, top: -SH.top, width: SCREEN.w, height: SCREEN.h }]}>
      <View style={[styles.abs, { left: SH.x, top: SH.chip.y, height: SH.chip.h, paddingHorizontal: 11, borderRadius: SH.chip.h / 2, backgroundColor: 'rgba(255,255,255,0.14)' }]}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#fff', lineHeight: SH.chip.h }}>{c.tag}</Text>
      </View>
      <Text style={[ty(SH.metaY, 16), { left: SH.metaX, fontFamily: fonts.monoLight, fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }]}>{`${c.date} · ${c.time}`}</Text>
      {c.lines.map((s: string, i: number) => (
        <Text key={i} style={[ty(SH.title.firstY + i * SH.title.lh, SH.title.lh), { left: SH.x, fontFamily: fonts.medium, fontSize: SH.title.size, color: '#fff' }]}>{s}</Text>
      ))}
      <View style={[styles.abs, { left: SH.x, top: SH.quote.y, width: 2, height: SH.quote.h, borderRadius: 1, backgroundColor: C.accent }]} />
      {c.quoteFull.map((s: string, i: number) => (
        <Text key={i} style={[ty(SH.quote.firstY + i * SH.quote.lh, SH.quote.lh), { left: SH.quote.x, fontFamily: fonts.light, fontSize: SH.quote.size, color: 'rgba(255,255,255,0.8)' }]}>{s}</Text>
      ))}
      <View style={[styles.abs, { left: SH.x, top: A.y, width: A.w, height: A.h, borderRadius: A.h / 2, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }]}>
        <View style={[styles.abs, { left: A.play.cx - SH.x - A.play.d / 2 - 1, top: cy - A.play.d / 2, width: A.play.d, height: A.play.d, borderRadius: A.play.d / 2, backgroundColor: '#fcfcfc' }]}>
          <Icon d={ICON.play} size={14} color="#141414" fill style={{ position: 'absolute', left: 11.5, top: 11 }} />
        </View>
        {WAVE.map((h: number, i: number) => (
          <View key={i} style={[styles.abs, { left: A.barsX0 - SH.x - 1 + i * dx - 1, top: cy - h / 2, width: 1.8, height: h, borderRadius: 1, backgroundColor: i < WAVE_PLAYED ? C.accent : 'rgba(255,255,255,0.55)' }]} />
        ))}
        <Text style={[styles.abs, { left: A.timeX - SH.x - 1, top: 0, height: A.h - 2, lineHeight: A.h - 2, fontFamily: fonts.monoLight, fontSize: 13, color: 'rgba(255,255,255,0.62)' }]}>{c.dur}</Text>
      </View>
      <View style={[styles.abs, { left: SH.x, top: SH.tags.y, flexDirection: 'row', gap: SH.tags.gap }]}>
        {c.tags.map((t: string) => (
          <View key={t} style={{ height: SH.tags.h, paddingHorizontal: 10, borderRadius: SH.tags.h / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.light, fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  full: { left: 0, top: 0, width: SCREEN.w, height: SCREEN.h },
  chip: { position: 'absolute', borderRadius: 99, backgroundColor: C.glassDark, justifyContent: 'center' },
  glass: { position: 'absolute', backgroundColor: C.glassDark },
});
