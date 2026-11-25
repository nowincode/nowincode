// HoldToCommit — press-and-hold confirm buttons (Opal style): a light floods the pill from the left while held,
// sparkles ride the front, and on completion the pill turns white with a check. Destructive buttons skip the
// celebration burst (deleting / disabling means the user is giving something up).
// React Native (Expo) port of 03_motion_hold_commit.html. All timing / layout / colours / the shader come from
// shared/hold_core.js (same file the HTML preview runs); this file only maps the frame to views.
//
// Deps (all in Expo Go): @shopify/react-native-skia, react-native-svg, expo-haptics.
// RN has no CSS filter: label blur = sharp Text + transparent ghost Text with textShadowRadius.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle, Fill, Group, Shader, Skia } from '@shopify/react-native-skia';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

const HC = require('./shared/hold_core.js');
const L = HC.L;
const EFFECT = Skia.RuntimeEffect.Make(HC.SHADER_SKSL);
const PAD = 40; // particle overlay bleed around the pill (pt)

type Kind = 'commit' | 'delete';
type Ev = { t: number; type: 'down' | 'up' | 'reset'; id: Kind };

export type HoldButtonProps = {
  /** 'commit' = blue, celebrates; 'delete' = red, destructive (no burst). */
  kind?: Kind;
  /** Called once when the hold completes. */
  onComplete?: () => void;
  /** Return to the idle label this long after completing (ms); null = stay done until tapped. */
  autoResetMs?: number | null;
  /** Override the celebration burst (defaults: commit on, delete off). */
  celebrate?: boolean;
  haptics?: boolean;
  /** Freeze at a demo-timeline time (ms) — used for parity checks. */
  frozenT?: number;
  /** Drive the button from the source video's scripted timeline (loops). */
  demo?: boolean;
};

const nowMs = () => (globalThis.performance ? globalThis.performance.now() : Date.now());

function FocusText({ text, color, a, b, testID }: { text: string; color: string; a: number; b: number; testID?: string }) {
  const m = b < 0.01 ? 0 : Math.min(1, b / 4);
  const base = [styles.label, { color }];
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, { opacity: a }]} pointerEvents="none" testID={testID}>
      <View>
        <Text style={[...base, { opacity: 1 - m }]}>{text}</Text>
        {m > 0 ? (
          <Text style={[...base, styles.ghost, { opacity: m, color: 'transparent', textShadowColor: color, textShadowRadius: b * 1.4 }]}>{text}</Text>
        ) : null}
      </View>
    </View>
  );
}

function LabelLayer({ l }: { l: any }) {
  if (!l.check) return <FocusText text={l.text} color={l.color} a={l.a} b={l.b} testID={'lab-' + l.key} />;
  // check + label as one row; blur applied to the text, the check fades with it
  const m = l.b < 0.01 ? 0 : Math.min(1, l.b / 4);
  return (
    <View style={[StyleSheet.absoluteFill, styles.center, styles.row, { opacity: l.a }]} pointerEvents="none" testID={'lab-' + l.key}>
      <Svg width={L.CHECK_W} height={L.CHECK_W} viewBox="0 0 15 15" style={{ marginRight: L.CHECK_GAP, opacity: 1 - 0.6 * m }}>
        <Path d={L.CHECK_PATH} fill="none" stroke={l.color} strokeWidth={L.CHECK_STROKE} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View>
        <Text style={[styles.label, { color: l.color, opacity: 1 - m }]}>{l.text}</Text>
        {m > 0 ? (
          <Text style={[styles.label, styles.ghost, { opacity: m, color: 'transparent', textShadowColor: l.color, textShadowRadius: l.b * 1.4 }]}>{l.text}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function HoldButton({ kind = 'commit', onComplete, autoResetMs = 1600, celebrate, haptics = true, frozenT, demo }: HoldButtonProps) {
  const events = useRef<Ev[]>([]);
  const t0 = useRef(nowMs());
  const [t, setT] = useState(() => frozenT ?? 0);
  const raf = useRef<number | null>(null);
  const firedFor = useRef<number | null>(null);
  const opt = celebrate == null ? undefined : { [kind + 'Celebrate']: celebrate };

  const clock = () => nowMs() - t0.current;
  const evs = frozenT != null || demo ? HC.demoEvents(t).filter((e: Ev) => e.id === kind) : events.current;
  const f = HC.buttonFrame(evs, kind, t, opt);

  const loop = useCallback(() => {
    const tt = clock();
    setT(tt);
    const bf = HC.buttonFrame(demo ? HC.demoEvents(tt) : events.current, kind, tt, opt);
    const last = events.current.length ? events.current[events.current.length - 1].t : -1e9;
    if (demo || bf.phase !== 'idle' || tt - last < 1200) raf.current = requestAnimationFrame(loop);
    else raf.current = null;
  }, [demo, kind]);
  const kick = () => { if (raf.current == null && frozenT == null) raf.current = requestAnimationFrame(loop); };
  useEffect(() => { if (demo) kick(); return () => { if (raf.current != null) cancelAnimationFrame(raf.current); }; }, [demo]);

  // completion side effects + auto reset
  useEffect(() => {
    if (f.completedAt == null || firedFor.current === f.completedAt || frozenT != null) return;
    firedFor.current = f.completedAt;
    if (haptics) {
      if (kind === 'commit') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    onComplete && onComplete();
    if (autoResetMs != null && !demo) {
      const at = f.completedAt;
      setTimeout(() => { if (firedFor.current === at) { events.current.push({ t: clock(), type: 'reset', id: kind }); kick(); } }, autoResetMs);
    }
  }, [f.completedAt]);

  const push = (type: Ev['type']) => {
    if (frozenT != null || demo) return;
    events.current.push({ t: clock(), type, id: kind });
    kick();
  };
  const onPressIn = () => {
    if (f.phase === 'done') { firedFor.current = -1; push('reset'); return; }
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    push('down');
  };
  const onPressOut = () => push('up');

  const u = HC.uniforms(f, 1);
  const uniforms = { ...u, uRamp: u.uRamp.flat() };
  const sx = (x: number) => PAD + L.W / 2 + (x - L.W / 2) * f.scale;
  const sy = (y: number) => PAD + L.H / 2 + (y - L.H / 2) * f.scale;
  return (
    <View style={styles.slot} testID={'btn-' + kind}>
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} style={StyleSheet.absoluteFill}>
        <View style={[styles.pill, { transform: [{ scale: f.scale }] }]} testID="pill">
          {EFFECT ? (
            <Canvas style={styles.pill} testID="surface">
              <Fill><Shader source={EFFECT} uniforms={uniforms} /></Fill>
            </Canvas>
          ) : null}
          {f.labels.map((l: any, i: number) => <LabelLayer key={l.key + i} l={l} />)}
        </View>
      </Pressable>
      {f.sparks.length || f.burst.length ? (
        <Canvas style={styles.fx} pointerEvents="none" testID="fx">
          <Group>
            {f.sparks.map((p: any, i: number) => <Circle key={'s' + i} cx={sx(p.x)} cy={sy(p.y)} r={p.r} color="#ffffff" opacity={p.a} />)}
            {f.burst.map((p: any, i: number) => <Circle key={'b' + i} cx={PAD + p.x} cy={PAD + p.y} r={p.r} color={p.col} opacity={p.a} />)}
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}

export type HoldToCommitScreenProps = { demo?: boolean; frozenT?: number; onCommit?: () => void; onDelete?: () => void };

/** The source screen: black, both buttons centred (19pt gap). */
export default function HoldToCommitScreen({ demo, frozenT, onCommit, onDelete }: HoldToCommitScreenProps) {
  return (
    <View style={styles.screen} testID="root">
      <View style={styles.group}>
        <HoldButton kind="commit" demo={demo} frozenT={frozenT} onComplete={onCommit} />
        <View style={{ height: L.GAP }} />
        <HoldButton kind="delete" demo={demo} frozenT={frozenT} onComplete={onDelete} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  group: { transform: [{ translateY: L.GROUP_DY }] },
  slot: { width: L.W, height: L.H },
  pill: { width: L.W, height: L.H },
  fx: { position: 'absolute', left: -PAD, top: -PAD, width: L.W + 2 * PAD, height: L.H + 2 * PAD },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  label: { fontSize: L.FONT, fontWeight: '500', letterSpacing: L.TRACK, includeFontPadding: false },
  ghost: { position: 'absolute', left: 0, top: 0 },
});
