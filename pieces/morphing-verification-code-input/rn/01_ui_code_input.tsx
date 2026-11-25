// CodeInput — "Enter code" pill that morphs into a 6-digit field, then Verifying -> error / Verified.
// React Native (Expo) port of 01_ui_code_input.html. All timing / layout comes from
// shared/code_input_core.js (same file the HTML preview runs); this file only maps the frame to views.
//
// Deps (all in Expo Go): react-native-svg, expo-blur.
// RN has no CSS filter: text blur = sharp Text + transparent ghost Text with textShadowRadius;
// ring / cell blur = same-colour layer shadow; whole-layer blur = BlurView overlay inside the clip.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { BlurView } from 'expo-blur';

const CI = require('./shared/code_input_core.js');
const L = CI.L, C = CI.C;

type Ev = { t: number; type: string; d?: string; ok?: boolean };

export type CodeInputProps = {
  /** Return true when the code is correct. Defaults to "always correct". */
  onVerify?: (code: string) => boolean | Promise<boolean>;
  onVerified?: (code: string) => void;
  /** Minimum time the Verifying state stays up (ms). Source: 1200. */
  minVerifyMs?: number;
  /** Return to the Enter-code pill this long after Verified (ms); null = stay. */
  autoResetMs?: number | null;
  /** Loop the source video's scripted timeline instead of taking input. */
  demo?: boolean;
  /** Freeze at a timeline time (ms) — used for parity checks. */
  frozenT?: number;
  /** Uniform scale of the whole control (1 = design size, 247pt wide when open). */
  scale?: number;
};

// ---------- blur emulation ----------
function FocusText({ children, style, blur, opacity, color }: { children: React.ReactNode; style: any; blur: number; opacity: number; color: string }) {
  const m = blur < 0.05 ? 0 : Math.min(1, blur / 4);
  return (
    <>
      <Text style={[style, { color, opacity: opacity * (1 - m) }]}>{children}</Text>
      {m > 0 ? (
        <Text style={[style, { position: 'absolute', color: 'transparent', opacity: opacity * m, textShadowColor: color, textShadowRadius: blur * 1.4, textShadowOffset: { width: 0, height: 0 } }]}>{children}</Text>
      ) : null}
    </>
  );
}
const halo = (color: string, blur: number) =>
  blur < 0.05 ? null : { shadowColor: color, shadowOpacity: Math.min(1, blur / 3), shadowRadius: blur, shadowOffset: { width: 0, height: 0 } };

// ---------- icons (same geometry as the HTML inline SVGs) ----------
const Lock = () => (
  <Svg width={L.LOCK_W} height={L.LOCK_H} viewBox="0 0 10.7 11.7" fill="none">
    <Path d="M2.85 5.05V3.35a2.5 2.5 0 0 1 5 0V5.05" stroke={C.ink} strokeWidth={1.45} strokeLinecap="round" />
    <Rect x={0.73} y={5.05} width={9.24} height={5.92} rx={1.9} stroke={C.ink} strokeWidth={1.45} />
  </Svg>
);
const ARC_C = 2 * Math.PI * 4.75;
const Spinner = ({ angle, arc }: { angle: number; arc: number }) => (
  <Svg width={L.ICON_BOX} height={L.ICON_BOX} viewBox="0 0 11 11" fill="none">
    <Circle cx={5.5} cy={5.5} r={4.75} stroke={C.spinTrack} strokeWidth={1.5} />
    <Circle cx={5.5} cy={5.5} r={4.75} stroke={C.spinArc} strokeWidth={1.5} strokeLinecap="round"
      strokeDasharray={`${(arc / 360) * ARC_C} ${ARC_C}`} transform={`rotate(${angle - 90} 5.5 5.5)`} />
  </Svg>
);
const Check = ({ color }: { color: string }) => (
  <Svg width={L.ICON_BOX} height={L.ICON_BOX} viewBox="0 0 11 11" fill="none">
    <Path d="M1.6 5.9 4.25 8.4 9.4 2.7" stroke={color} strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ---------- frame -> views ----------
export function CodeInputView({ f }: { f: any }) {
  const le = f.layers.enter, lo = f.layers.otp, ls = f.layers.status, s = f.statusPill;
  const layerBlur = Math.max(le.op > 0.003 ? le.blur : 0, lo.op > 0.003 ? lo.blur : 0, ls.op > 0.003 ? ls.blur : 0);
  const label = styles.label;
  return (
    <View testID="root" style={{ width: f.W, height: L.H, transform: [{ translateX: f.x }] }}>
      {/* outline ring + soft drop shadow (CSS: 0 0 0 1px .072, 0 1px 2px .05, 0 5px 13px .065) */}
      <View style={[styles.shadowSoft, { left: 0, top: 0, width: f.W, height: L.H, borderRadius: L.H / 2 }]} />
      <View style={[styles.outline, { left: -1, top: -1, width: f.W + 2, height: L.H + 2, borderRadius: L.H / 2 + 1 }]} />
      <View style={[styles.shell, { width: f.W, height: L.H, borderRadius: L.H / 2 }]}>
        {/* enter */}
        {le.op > 0.003 ? (
          <View testID="L-enter" style={[StyleSheet.absoluteFill, { opacity: le.op, transform: [{ scale: le.scale }] }]}>
            <View style={[styles.pill, { width: f.W - 2 * L.PAD, backgroundColor: C.cell }]} />
            <View style={[styles.row, { left: f.enter.rowX }]}>
              <View style={{ position: 'absolute', left: 0, top: (L.H - L.LOCK_H) / 2 }}><Lock /></View>
              <View style={[styles.textBox, { left: f.enter.textX }]}>
                <FocusText style={label} blur={le.blur} opacity={1} color={C.ink}>Enter code</FocusText>
              </View>
            </View>
          </View>
        ) : null}
        {/* status: verifying / verified */}
        {ls.op > 0.003 ? (
          <View testID="L-status" style={[StyleSheet.absoluteFill, { opacity: ls.op }]}>
            <View testID="statusPill" style={[styles.pill, { width: f.W - 2 * L.PAD, backgroundColor: s.bg }]} />
            <View style={[styles.row, { left: s.rowX }]}>
              <View style={{ position: 'absolute', left: 0, top: (L.H - L.ICON_BOX) / 2, opacity: s.spinner.op }}>
                <Spinner angle={s.spinner.angle} arc={s.spinner.arc} />
              </View>
              {s.check.op > 0.003 ? (
                <View style={{ position: 'absolute', left: 0, top: (L.H - L.ICON_BOX) / 2, opacity: s.check.op, transform: [{ scale: s.check.scale }] }}>
                  <Check color={s.fg} />
                </View>
              ) : null}
              <View style={[styles.textBox, { left: s.textX }]}>
                <FocusText style={label} blur={s.verif.blur} opacity={s.verif.op} color={s.fg}>Verif</FocusText>
              </View>
              <View style={[styles.textBox, { left: s.textX + L.VERIF_ADV }]}>
                <FocusText style={label} blur={s.ying.blur} opacity={s.ying.op} color={s.fg}>ying</FocusText>
              </View>
              <View style={[styles.textBox, { left: s.textX + L.VERIF_ADV }]}>
                <FocusText style={label} blur={s.ied.blur} opacity={s.ied.op} color={s.fg}>ied</FocusText>
              </View>
            </View>
          </View>
        ) : null}
        {/* otp */}
        {lo.op > 0.003 ? (
          <View testID="L-otp" style={[StyleSheet.absoluteFill, { opacity: lo.op }]}>
            {f.cells.map((c: any, i: number) => (
              <View key={'c' + i} testID="cell" style={[{ position: 'absolute', left: c.x, top: L.PAD, width: c.w, height: L.CELL_H, backgroundColor: c.bg, opacity: c.op,
                borderTopLeftRadius: c.rl, borderBottomLeftRadius: c.rl, borderTopRightRadius: c.rr, borderBottomRightRadius: c.rr }, halo(c.bg, c.blur)]} />
            ))}
            {f.digits.map((d: any, i: number) => (
              <View key={'d' + d.cell + '_' + i} testID="digit" style={[styles.digitBox, { left: d.cx - 15, transform: [{ translateY: d.y }] }]}>
                <FocusText style={styles.digit} blur={d.blur} opacity={d.op} color={d.color}>{d.d}</FocusText>
              </View>
            ))}
            <View testID="ring" style={[{ position: 'absolute', left: f.ring.x, top: L.PAD, width: L.CELL_W, height: L.CELL_H, borderWidth: L.RING_W, borderColor: C.ring,
              opacity: f.ring.op * (f.ring.blur > 0.05 ? 1 - Math.min(0.6, f.ring.blur / 6) : 1),
              borderTopLeftRadius: f.ring.rl, borderBottomLeftRadius: f.ring.rl, borderTopRightRadius: f.ring.rr, borderBottomRightRadius: f.ring.rr }, halo(C.ring, f.ring.blur)]} />
            <View testID="caret" style={{ position: 'absolute', left: f.caret.cx - L.CARET_W / 2, top: (L.H - L.CARET_H) / 2, width: L.CARET_W, height: L.CARET_H, borderRadius: 1, backgroundColor: C.ring, opacity: f.caret.op }} />
          </View>
        ) : null}
        {layerBlur > 0.3 ? <BlurView tint="light" intensity={Math.min(60, layerBlur * 9)} style={StyleSheet.absoluteFill} /> : null}
      </View>
    </View>
  );
}

// ---------- stateful control ----------
export default function CodeInput({ onVerify, onVerified, minVerifyMs = 1200, autoResetMs = 2400, demo = false, frozenT, scale = 1 }: CodeInputProps) {
  const events = useRef<Ev[]>(demo ? CI.demoEvents() : []);
  const t0 = useRef(Date.now());
  const handled = useRef<{ submit: number | null; verified: number | null }>({ submit: null, verified: null });
  const input = useRef<TextInput>(null);
  const now = useCallback(() => {
    if (frozenT !== undefined) return frozenT;
    const t = Date.now() - t0.current;
    return demo ? t % CI.DEMO_PERIOD : t;
  }, [demo, frozenT]);
  const [f, setF] = useState(() => CI.frame(events.current, frozenT !== undefined ? frozenT : 0));

  useEffect(() => {
    if (frozenT !== undefined || typeof requestAnimationFrame === 'undefined') return;
    let raf = 0, alive = true;
    const tick = () => {
      if (!alive) return;
      const t = now(), fr = CI.frame(events.current, t);
      if (!demo) {
        // hand the code to the app once per submit; result lands no earlier than minVerifyMs
        if (fr.submittedAt !== null && handled.current.submit !== fr.submittedAt) {
          const at = fr.submittedAt, code = fr.code;
          handled.current.submit = at;
          Promise.resolve(onVerify ? onVerify(code) : true).then((ok) => {
            events.current.push({ t: Math.max(now(), at + minVerifyMs), type: 'result', ok: !!ok });
          });
        }
        if (fr.status === 'verified' && handled.current.verified !== handled.current.submit) {
          handled.current.verified = handled.current.submit;
          onVerified && onVerified(fr.code);
          if (autoResetMs !== null) events.current.push({ t: t + autoResetMs, type: 'reset' });
        }
        const last = events.current.reduce((a, e) => Math.max(a, e.t), -1e9);
        if (fr.mode === 'enter' && events.current.length && t - last > 1500) events.current = events.current.filter((e) => e.t > t);
      }
      setF(fr);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [demo, frozenT, now, onVerify, onVerified, minVerifyMs, autoResetMs]);

  const push = (type: string, extra?: Partial<Ev>) => { events.current.push(Object.assign({ t: now(), type }, extra)); };
  const onPress = () => {
    if (demo || frozenT !== undefined) return;
    const fr = CI.frame(events.current, now());
    if (fr.mode === 'enter') { push('open'); input.current?.focus(); }
    else if (fr.mode === 'otp') input.current?.focus();
    else if (fr.status === 'verified') push('reset');
  };
  // the hidden field mirrors the code so iOS one-time-code autofill / paste work; diffs become events
  const onChangeText = (next: string) => {
    const cur = CI.frame(events.current, now()).code as string;
    const digits = next.replace(/\D/g, '').slice(0, L.N);
    if (digits.length < cur.length) for (let i = cur.length; i > digits.length; i--) push('back');
    else digits.slice(cur.length).split('').forEach((d, i) => events.current.push({ t: now() + i * 45, type: 'digit', d }));
  };

  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ width: f.W * scale, height: L.H * scale, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ transform: [{ scale }] }}>
        <CodeInputView f={f} />
      </View>
      {!demo ? (
        <TextInput ref={input} value={f.code} onChangeText={onChangeText} keyboardType="number-pad" textContentType="oneTimeCode"
          autoComplete="sms-otp" maxLength={L.N} caretHidden style={styles.hidden} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { position: 'absolute', left: 0, top: 0, backgroundColor: C.shell, overflow: 'hidden' },
  outline: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.072)' },
  shadowSoft: { position: 'absolute', backgroundColor: C.shell, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 7, shadowOffset: { width: 0, height: 5 } },
  pill: { position: 'absolute', left: L.PAD, top: L.PAD, height: L.CELL_H, borderRadius: L.CELL_H / 2 },
  row: { position: 'absolute', top: 0, height: L.H },
  textBox: { position: 'absolute', top: 0, height: L.H, justifyContent: 'center' },
  label: { fontSize: L.LABEL_SIZE, fontWeight: '600', letterSpacing: L.LABEL_TRACK },
  digitBox: { position: 'absolute', top: 0, width: 30, height: L.H, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: L.DIGIT_SIZE, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: 0, top: 0 },
});
