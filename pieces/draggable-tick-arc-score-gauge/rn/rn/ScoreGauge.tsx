/**
 * ScoreGauge — credit-score gauge with a draggable lens (React Native / Expo).
 *
 * A half circle of 51 ticks lit up to the score. Drag round it: one spring carries the drawn value
 * after your finger, the ticks swell around the head (more while held), the knob snaps tick to tick
 * and the pill names the band. Same core as the HTML preview (../src/gaugeCore.js).
 *
 * Deps: react-native-svg (in Expo Go). Fonts: load SCORE_GAUGE_FONTS with expo-font's useFonts.
 *
 *   const [loaded] = useFonts(SCORE_GAUGE_FONTS);
 *   <ScoreGauge score={682} theme="dark" onChange={(s, band) => {}} />
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Core = require('../src/gaugeCore');

export type ScoreGaugeTheme = 'light' | 'dark';
export type ScoreGaugeTone = 'colour' | 'mono';

export interface ScoreGaugeProps {
  /** initial score, 300–850 (the gauge sweeps up to it on mount) */
  score?: number;
  theme?: ScoreGaugeTheme;
  /** lit ticks red→green, or the card's ink */
  tone?: ScoreGaugeTone;
  onChange?: (score: number, band: string) => void;
  /** loop the author's pointer demo (until the user touches the gauge) */
  demo?: boolean;
  /** frozen demo time in seconds — static render used for parity checks / screenshots */
  t?: number;
  style?: StyleProp<ViewStyle>;
}

export const SCORE_GAUGE_FONTS = {
  Inter_400Regular: require('../fonts/Inter_400Regular.ttf'),
  Inter_500Medium: require('../fonts/Inter_500Medium.ttf'),
  PlusJakartaSans_600SemiBold: require('../fonts/PlusJakartaSans_600SemiBold.ttf'),
};

const L = Core.L;
// hhea ascender / descender (em) of the shipped files — RN text boxes are placed by baseline
const ASC = { inter: 1984 / 2048, jakarta: 1.038 };
// Baselines as Chrome lays the source out (it rounds ascent/descent inside a CSS line-height box):
// title 20.0 below the head top, pill text 18.0 below the pill top. CoreText would centre a natural-height
// box at 19.56 / 18.36, so the texts are placed by baseline instead.
const TITLE_BASE = 20;
const PILL_BASE = 18;
const TITLE_TOP = TITLE_BASE - ASC.inter * L.titleSize;
const PILL_TEXT_TOP = PILL_BASE - ASC.inter * L.pillSize;

/** text that "focuses" in: a sharp layer and a shadow-only ghost layer cross-fade by blur (RN has no filter:blur) */
function FocusText({ text, color, blur }: { text: string; color: string; blur: number }) {
  const m = blur < 0.01 ? 0 : Math.min(1, blur / 4);
  return (
    <>
      <Text style={[styles.pillText, { color, opacity: 1 - m }]}>{text}</Text>
      {m > 0 ? (
        <Text
          style={[
            styles.pillText,
            styles.pillGhost,
            { opacity: m, textShadowColor: color, textShadowRadius: blur * 1.4 },
          ]}
        >
          {text}
        </Text>
      ) : null}
    </>
  );
}

export default function ScoreGauge({
  score = 682,
  theme = 'light',
  tone = 'colour',
  onChange,
  demo = false,
  t,
  style,
}: ScoreGaugeProps) {
  const frozen = typeof t === 'number';
  const frozenState = useMemo(() => (frozen ? Core.simulateDemo(t, score) : null), [frozen, t, score]);
  const live = useRef<any>(null);
  if (live.current === null) live.current = Core.createState(score);
  const st = frozen ? frozenState : live.current;

  const [, setTick] = useState(0);
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  const demoRef = useRef<{ t: number; prev: any } | null>(demo ? { t: 0, prev: null } : null);
  const shown = useRef<number>(st.shown);
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  const wake = () => {
    if (frozen || raf.current != null) return;
    last.current = 0;
    raf.current = requestAnimationFrame(loop);
  };
  const loop = (now: number) => {
    raf.current = null;
    const s = live.current;
    const dt = last.current ? Math.min((now - last.current) / 1000, 0.05) : 1 / 60;
    last.current = now;
    let busy = false;
    const d = demoRef.current;
    if (d) {
      d.t += dt;
      const ptr = Core.demoPointer(d.t);
      Core.applyDemo(s, d.prev, ptr);
      d.prev = ptr;
      busy = true;
    }
    Core.step(s, dt);
    if (s.shown !== shown.current) {
      shown.current = s.shown;
      cbRef.current?.(s.shown, Core.bandOf(s.shown));
    }
    setTick((n) => (n + 1) % 1e9);
    if (busy || !Core.settled(s)) raf.current = requestAnimationFrame(loop);
    else last.current = 0;
  };

  useEffect(() => {
    if (frozen) return undefined;
    demoRef.current = demo ? { t: 0, prev: null } : null;
    wake();
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen, demo]);

  // plot origin in page coordinates, fixed at touch-down (locationX can switch reference mid-drag)
  const origin = useRef({ x: 0, y: 0 });
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !frozen,
        onMoveShouldSetPanResponder: () => !frozen,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const n = e.nativeEvent;
          origin.current = { x: n.pageX - n.locationX, y: n.pageY - n.locationY };
          demoRef.current = null;
          Core.pointer(live.current, 'down', n.locationX, n.locationY);
          wake();
        },
        onPanResponderMove: (e) => {
          const n = e.nativeEvent;
          Core.pointer(live.current, 'move', n.pageX - origin.current.x, n.pageY - origin.current.y);
          wake();
        },
        onPanResponderRelease: () => {
          Core.pointer(live.current, 'up');
          wake();
        },
        onPanResponderTerminate: () => {
          Core.pointer(live.current, 'cancel');
          wake();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frozen],
  );

  const f = Core.frame(st, theme, tone);

  return (
    <View style={[styles.card, { backgroundColor: f.card.bg }, style]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: f.title.color }]} numberOfLines={1}>
          {f.title.text}
        </Text>
        <View style={styles.pills}>
          {f.pills.map((p: any, i: number) => (
            <View
              key={p.key}
              style={[
                styles.pill,
                i < f.pills.length - 1 && styles.pillLeaving,
                { backgroundColor: p.bg, opacity: p.opacity },
              ]}
            >
              <FocusText text={p.text} color={p.color} blur={p.blur} />
            </View>
          ))}
        </View>
      </View>

      <View
        style={styles.plot}
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Credit score"
        accessibilityValue={{ min: Core.MIN, max: Core.MAX, now: f.score, text: `${f.score}, ${f.band}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (frozen) return;
          demoRef.current = null;
          Core.nudge(live.current, e.nativeEvent.actionName === 'increment' ? 10 : -10);
          wake();
        }}
      >
        <Svg width={L.plotW} height={L.plotH} style={StyleSheet.absoluteFill} pointerEvents="none">
          {f.ticks.map((k: any) => (
            <Line
              key={k.i}
              x1={k.x1}
              y1={k.y1}
              x2={k.x2}
              y2={k.y2}
              stroke={k.stroke}
              strokeWidth={L.tickW}
              strokeLinecap="round"
            />
          ))}
          <Circle cx={f.knob.cx} cy={f.knob.cy} r={f.knob.r} fill={f.knob.fill} />
        </Svg>
        <Text
          pointerEvents="none"
          style={[styles.figure, { top: f.figure.y - ASC.jakarta * L.figSize, color: f.figure.color }]}
        >
          {f.figure.text}
        </Text>
        <Text pointerEvents="none" style={[styles.of, { top: f.of.y - ASC.inter * L.ofSize, color: f.of.color }]}>
          {f.of.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: L.cardW,
    height: L.cardH,
    padding: L.pad,
    borderRadius: L.radius,
  },
  head: {
    height: L.headH,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    paddingTop: TITLE_TOP,
    fontFamily: 'Inter_500Medium',
    fontSize: L.titleSize,
    letterSpacing: L.titleTrack * L.titleSize,
    includeFontPadding: false,
  },
  pills: { height: L.pillH, flexDirection: 'row', justifyContent: 'flex-end' },
  // the current pill sits in flow; a leaving one overlaps it from the same right edge
  pillLeaving: { position: 'absolute', right: 0, top: 0 },
  pill: {
    height: L.pillH,
    paddingHorizontal: L.pillPadX,
    borderRadius: L.pillH / 2,
    paddingTop: PILL_TEXT_TOP,
  },
  pillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: L.pillSize,
    includeFontPadding: false,
  },
  pillGhost: {
    position: 'absolute',
    left: L.pillPadX,
    top: PILL_TEXT_TOP,
    color: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
  },
  plot: {
    width: L.plotW,
    height: L.plotH,
    marginTop: L.plotTop - L.pad - L.headH,
  },
  figure: {
    position: 'absolute',
    left: 0,
    width: L.plotW,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: L.figSize,
    letterSpacing: L.figTrack * L.figSize,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  of: {
    position: 'absolute',
    left: 0,
    width: L.plotW,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: L.ofSize,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
});
