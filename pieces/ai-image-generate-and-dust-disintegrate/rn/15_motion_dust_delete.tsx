/**
 * DustDelete — React Native (Expo) port of the "AI image card" flow:
 *   generating (progress ring + shimmer label, iridescent ripple + stars, jelly edge wobble)
 *   → focus-sweep reveal → liquid-glass action menu (♥ ↻ ⤓ 🗑) → dust disintegration on delete.
 *
 * One shared core (src/dustCore.js) drives both this component and the HTML preview:
 *   - frame(t, ev)  closed-form timeline (worklet) → shader uniforms, ring arc, labels, menu, dust τ
 *   - one card shader body compiled as SkSL here and GLSL in the preview
 *   - dust(τ)       closed-form particles → Skia Atlas sprites (1×1 px of the colour table, nearest sampling)
 *
 * Requires: @shopify/react-native-skia, react-native-reanimated (both ship with Expo). No native code of its own.
 *
 * Usage:
 *   <DustDelete />                                   // 300 pt wide, scripted demo loop; first tap takes over
 *   <DustDelete autoPlay={false} onDelete={…} />     // tap card → menu, tap 🗑 → dust, ↻ → generate again
 *   <DustDelete t={7.0} />                           // frozen frame of the demo schedule (tests / parity)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, PixelRatio, View, ViewStyle } from 'react-native';
import {
  Atlas, Canvas, FilterMode, Group, ImageShader, LinearGradient, MipmapMode, Path, Rect, Shader, Skia, Text as SkText,
  rect, useFont, useImage, useRSXformBuffer, vec,
} from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const C = require('./src/dustCore.js');

const CARD_FX = Skia.RuntimeEffect.Make(C.shaderSource('sksl'))!;

// worklet-captured plain data / pure functions
const frameAt = C.frame;
const uniformsOf = C.uniforms;
const dustAt = C.dust;
const arcPathOf = C.arcPath;
const menuCirclesOf = C.menuCircles;
const W: number = C.CARD.w;
const H: number = C.CARD.h;
const PADX: number = C.PAD.x;
const PADT: number = C.PAD.top;
const CW: number = C.CANVAS.w;
const CH: number = C.CANVAS.h;
const NP: number = C.NP;
const CELLS: number[] = C.CELLS;
const RING = C.RING;
const TX = C.TEXT;
const MENU = C.MENU;
const STOPS: number[][] = C.shimmerStops();
const STOP_POS = STOPS.map((_, i) => i / (STOPS.length - 1));
const STOP_COLORS = STOPS.map((s) => `rgba(255,255,255,${s[1].toFixed(4)})`);

const ICON_PATHS = (C.ICON_ORDER as string[]).map((name) => {
  const d = C.ICONS[name];
  const mk = (list?: string[]) => (list || []).map((s) => Skia.Path.MakeFromSVGString(s)!);
  return { name, stroke: mk(d.stroke), fill: mk(d.fill), cut: mk(d.cut) };
});

const EMPTY_DUST = new Float32Array(NP * 4);
const SPRITES = Array.from({ length: NP }, (_, n) => rect(CELLS[2 * n], CELLS[2 * n + 1], 1, 1));

type Props = {
  width?: number;
  t?: number;
  autoPlay?: boolean;
  style?: ViewStyle;
  onDelete?: () => void;
  onRegenerate?: () => void;
  onDownload?: () => void;
  onLike?: (liked: boolean) => void;
};

const copyEv = (ev: any) => ({ ...ev, hover: ev.hover.slice(), hoverOff: ev.hoverOff.slice() });

export default function DustDelete({ width = 300, t, autoPlay = true, style, onDelete, onRegenerate, onDownload, onLike }: Props) {
  const k = width / W;                                      // pt per unit
  const DPR = PixelRatio.get();
  const frozen = t != null;
  const photo = useImage(require('./assets/photo.jpg'));
  const blur = useImage(require('./assets/photo_blur.png'));
  const cells = useImage(require('./assets/photo_cells.png'));
  const fPct = useFont(require('./assets/fonts/Inter-500.ttf'), TX.pct.size);
  const fLab = useFont(require('./assets/fonts/Inter-400.ttf'), TX.label.size);

  // ── clock (UI thread) + event schedule (JS thread controller, mirrored into a shared value)
  const clock = useSharedValue(frozen ? (t as number) : 0);
  const ctl = useRef<any>(null);
  if (!ctl.current) ctl.current = new C.Controller(0, frozen ? true : autoPlay);
  const evSV = useSharedValue(copyEv(frozen ? C.demoEvents(0) : ctl.current.ev));
  const [dusting, setDusting] = useState(frozen ? C.frame(t, C.demoEvents(0)).dust >= 0 : false);

  useFrameCallback((info) => {
    'worklet';
    if (frozen) return;
    clock.value += Math.min(0.1, (info.timeSincePreviousFrame || 16) / 1000);
  }, !frozen);

  useEffect(() => {
    if (frozen) { clock.value = t as number; evSV.value = copyEv(C.demoEvents(0)); return; }
    const id = setInterval(() => {
      const before = ctl.current.ev;
      const ev = ctl.current.tick(clock.value);
      if (ev !== before) evSV.value = copyEv(ev);
      const st = C.frame(clock.value, ev);
      setDusting(st.dust >= 0 && !st.gone);
    }, 120);
    return () => clearInterval(id);
  }, [frozen, t]);

  // ── per-frame state (UI thread)
  const st = useDerivedValue(() => frameAt(clock.value, evSV.value));
  const uniforms = useDerivedValue(() => {
    const s = st.value;
    const u = uniformsOf(s, k * DPR);
    return {
      uPx: u.uPx, uCard: [s.cardOpacity * u.uCard[0], u.uCard[1], u.uCard[2], 0], uAur: u.uAur, uMenu: u.uMenu, uHover: u.uHover, uWob: u.uWob,
      uPhotoK: [photo ? photo.width() / W : 3, photo ? photo.height() / H : 3],
      uBlurK: [blur ? blur.width() / W : 0.5, blur ? blur.height() / H : 0.5],
    };
  });
  const cardTf = useDerivedValue(() => {
    const s = st.value;
    const sc = s.cardScale * (1 + 0.012 * s.lift);
    const cx = PADX + W / 2, cy = PADT + H / 2;
    return [{ translateX: cx }, { translateY: cy - 3.5 * s.lift }, { scale: sc }, { translateX: -cx }, { translateY: -cy }];
  });
  const uiOpacity = useDerivedValue(() => st.value.ui * st.value.cardOpacity);
  const arc = useDerivedValue(() => Skia.Path.MakeFromSVGString(arcPathOf(st.value.arc) || 'M0 0') as any);
  const pctText = useDerivedValue(() => st.value.pct + '%');
  const pctX = useDerivedValue(() => RING.cx - (fPct ? fPct.getTextWidth(st.value.pct + '%') : 0) / 2);
  const labPx = fLab ? W / 2 - fLab.getTextWidth('Processing...') / 2 : 0;
  const labGx = fLab ? W / 2 - fLab.getTextWidth('Generating...') / 2 : 0;
  const labPOp = useDerivedValue(() => st.value.labelP);
  const labGOp = useDerivedValue(() => st.value.labelG);
  const shimA = useDerivedValue(() => vec(st.value.shimmer - 2 * TX.label.band, 0));
  const shimB = useDerivedValue(() => vec(st.value.shimmer + 2 * TX.label.band, 0));
  const iconOp = useDerivedValue(() => st.value.menu.fill * st.value.cardOpacity);
  const iconTf = [0, 1, 2, 3].map((i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => {
      const c = menuCirclesOf(st.value)[i];
      const s = (c.r / MENU.r) * (MENU.icon / 24);
      return [{ translateX: c.x - 12 * s }, { translateY: c.y - 12 * s }, { scale: s }];
    }));
  const heartFill = useDerivedValue(() => st.value.liked);

  // ── dust
  const dustBuf = useDerivedValue(() => {
    const tau = st.value.dust;
    if (tau < 0 || st.value.gone) return EMPTY_DUST;      // no per-frame particle work outside the delete
    return dustAt(tau, new Float32Array(NP * 4), 1 / (k * DPR));
  });
  const transforms = useRSXformBuffer(NP, (val, i) => {
    'worklet';
    const b = dustBuf.value, s = b[4 * i + 2];
    // a zero-scale RSXform makes Skia drop (almost) the whole atlas batch → park hidden grains off-canvas instead
    if (s <= 0) val.set(1, 0, -1e4, -1e4);
    else val.set(s, 0, PADX + b[4 * i] - s / 2, PADT + b[4 * i + 1] - s / 2);
  });

  // ── touch: tap card → menu; tap a button → action; tap outside buttons with menu out → close
  const onTouch = (e: GestureResponderEvent) => {
    if (frozen) return;
    const x = e.nativeEvent.locationX / k, y = e.nativeEvent.locationY / k;
    const now = clock.value, c = ctl.current;
    const s = C.frame(now, c.ev);
    const b = C.hitButton(s, x, y);
    if (b < 0) { if (s.menu.fill > 0.5) c.leave(now); else c.enter(now); }
    else {
      const what = c.press(b, now);
      if (what === 'delete') onDelete?.();
      if (what === 'regenerate') onRegenerate?.();
      if (what === 'download') onDownload?.();
      if (what === 'like') onLike?.(c.ev.liked);
    }
    evSV.value = copyEv(c.ev);
  };

  const sampling = useMemo(() => ({ filter: FilterMode.Nearest, mipmap: MipmapMode.None }), []);
  if (!photo || !blur || !cells || !fPct || !fLab) return <View style={[{ width, height: H * k }, style]} />;

  return (
    <View style={[{ width, height: H * k }, style]} onStartShouldSetResponder={() => !frozen} onResponderRelease={onTouch}>
      <Canvas style={{ position: 'absolute', left: -PADX * k, top: -PADT * k, width: CW * k, height: CH * k }} colorSpace="srgb" pointerEvents="none">
        <Group transform={[{ scale: k }]}>
          <Group transform={cardTf}>
            <Rect x={0} y={0} width={CW} height={CH}>
              <Shader source={CARD_FX} uniforms={uniforms}>
                <ImageShader image={photo} tx="clamp" ty="clamp" />
                <ImageShader image={blur} tx="clamp" ty="clamp" />
              </Shader>
            </Rect>
            <Group transform={[{ translateX: PADX }, { translateY: PADT }]}>
              <Group opacity={uiOpacity}>
                <Path path={Skia.Path.MakeFromSVGString(`M${RING.cx - RING.r} ${RING.cy} a${RING.r} ${RING.r} 0 1 0 ${2 * RING.r} 0 a${RING.r} ${RING.r} 0 1 0 ${-2 * RING.r} 0`)!}
                  style="stroke" strokeWidth={RING.stroke} color={`rgba(255,255,255,${RING.track})`} />
                <Path path={arc} style="stroke" strokeWidth={RING.stroke} strokeCap="round" color="#fff" />
                <SkText x={pctX} y={TX.pct.baseline} text={pctText} font={fPct} color="#fff" />
                <Group opacity={labPOp}>
                  <SkText x={labPx} y={TX.label.baseline} text="Processing..." font={fLab}>
                    <LinearGradient start={shimA} end={shimB} colors={STOP_COLORS} positions={STOP_POS} />
                  </SkText>
                </Group>
                <Group opacity={labGOp}>
                  <SkText x={labGx} y={TX.label.baseline} text="Generating..." font={fLab}>
                    <LinearGradient start={shimA} end={shimB} colors={STOP_COLORS} positions={STOP_POS} />
                  </SkText>
                </Group>
              </Group>
              <Group opacity={iconOp}>
                {ICON_PATHS.map((ic, i) => (
                  <Group key={ic.name} transform={iconTf[i]}>
                    {ic.fill.map((p, j) => <Path key={'f' + j} path={p} color="#fff" />)}
                    {ic.stroke.map((p, j) => (
                      ic.name === 'heart'
                        ? <HeartPath key={'s' + j} path={p} filled={heartFill} />
                        : <Path key={'s' + j} path={p} style="stroke" strokeWidth={MENU.stroke} strokeCap="round" strokeJoin="round" color="#fff" />
                    ))}
                    {ic.cut.map((p, j) => <Path key={'c' + j} path={p} style="stroke" strokeWidth={1.6} strokeCap="round" color="rgba(60,60,60,0.85)" />)}
                  </Group>
                ))}
              </Group>
            </Group>
            {dusting && <Atlas image={cells} sprites={SPRITES} transforms={transforms} sampling={sampling} />}
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}

function HeartPath({ path, filled }: { path: any; filled: { value: number } }) {
  const op = useDerivedValue(() => filled.value);
  return (
    <>
      <Group opacity={op}><Path path={path} color="#fff" /></Group>
      <Path path={path} style="stroke" strokeWidth={MENU.stroke} strokeCap="round" strokeJoin="round" color="#fff" />
    </>
  );
}
