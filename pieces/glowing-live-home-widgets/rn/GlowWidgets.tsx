// Glow widgets — React Native (Expo) components.
// 几何、时间线与配色全部来自 ./core.js（与 HTML 预览同源）：core.widget(kind, t) 返回卡内坐标（设计单位 u）的显示列表，
// 本文件只负责把它画成 react-native-svg（Path + 线性/径向渐变 + ClipPath，无滤镜、无 Mask）与 RN Text。
// 依赖：react-native-svg（Expo 自带，无需额外原生编译）。文字用 iOS 系统字体（SF Pro）。
//   <EnergyWidget width={343} />        Energy now：曲线左移、圆点读数、Live 呼吸
//   <ThermostatWidget width={164} />    Living room：19° ⇄ 24° 弹簧切换，刻度 / 光晕 / 药丸随温度插色
//   <MusicWidget width={164} />         Midnight Drive：20 根波形条 + 底鼓脉冲、锥形渐变封面旋转
//   <GlowWidgets width={360} />         三张组合（原片版式 720×450u）
//   通用 props：frozenT={秒} 定格（对拍 / 截图）；paused 暂停；float 打开原片的卡片漂浮（展示层，默认关）；
//   displayTracking={false} 关闭小字字距补偿（若 App 自带 SF Pro Display 并通过 fontFamily 指定，可关掉）。
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, G as SvgG, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const G = require('./core.js');

type Kind = 'energy' | 'thermo' | 'music';
type Stops = [number, string, number][];
type Def = { id: string; kind: 'linear' | 'radial'; units: 'user' | 'obb'; x1?: number; y1?: number; x2?: number; y2?: number; cx?: number; cy?: number; r?: number; stops: Stops };
type Shape = {
  d?: string; fill?: string; stroke?: string; w?: number; op?: number; cap?: 'round' | 'butt'; join?: 'round'; dash?: number[];
  clip?: boolean; clipArt?: boolean; group?: string; rot?: number; cx?: number; cy?: number; shapes?: Shape[];
};
type TextItem = { key: string; text: string; x: number; y: number; size: number; weight: string; color: string; op: number; ls: number; lsText: number; align: 'left' | 'center'; w: number; tab: boolean };
type DisplayList = { kind: Kind; w: number; h: number; bleed: number; clip: string; artClip?: string; defs: Def[]; shapes: Shape[]; texts: TextItem[] };
type ClockProps = { frozenT?: number; paused?: boolean };
type WidgetProps = ClockProps & { width?: number; float?: boolean; displayTracking?: boolean; fontFamily?: string };

// rAF 时钟：frozenT 给定时直接定格（惰性初值，不依赖 effect）
export function useGlowClock({ frozenT, paused }: ClockProps): number {
  const [t, setT] = useState<number>(() => (frozenT == null ? 0 : frozenT));
  const base = useRef(0);
  useEffect(() => {
    if (frozenT != null) { setT(frozenT); return undefined; }
    if (paused) return undefined;
    let raf = 0;
    const start = Date.now() - base.current * 1000;
    const loop = () => {
      const now = (Date.now() - start) / 1000;
      base.current = now;
      setT(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [frozenT, paused]);
  return t;
}

function stops(s: Stops) {
  return s.map((x, i) => <Stop key={i} offset={x[0]} stopColor={x[1]} stopOpacity={x[2]} />);
}

function renderShape(uid: string, s: Shape, i: number) {
  if (s.group) {
    // 剪裁在外层（不随旋转），旋转在内层
    return (
      <SvgG key={i} clipPath={s.clipArt ? `url(#${uid}-artclip)` : undefined}>
        <SvgG rotation={s.rot} originX={s.cx} originY={s.cy}>
          {(s.shapes || []).map((w, j) => <Path key={j} d={w.d} fill={w.fill} />)}
        </SvgG>
      </SvgG>
    );
  }
  return (
    <Path
      key={i}
      d={s.d}
      fill={s.fill || 'none'}
      stroke={s.stroke}
      strokeWidth={s.stroke ? s.w : undefined}
      strokeLinecap={s.cap}
      strokeLinejoin={s.join}
      strokeDasharray={s.dash}
      opacity={s.op == null ? 1 : s.op}
      clipPath={s.clip ? `url(#${uid}-clip)` : s.clipArt ? `url(#${uid}-artclip)` : undefined}
    />
  );
}

// 单张卡：width = 卡片宽（pt），bleed 区域（外晕）画在卡外，不占布局
export function GlowCard({ kind, t, width, uid, displayTracking = true, fontFamily }: { kind: Kind; t: number; width?: number; uid?: string; displayTracking?: boolean; fontFamily?: string }) {
  const id = uid || kind[0];
  const L: DisplayList = G.widget(kind, t, id);
  const k = (width || L.w) / L.w;
  const B = L.bleed;
  return (
    <View style={{ width: L.w * k, height: L.h * k }}>
      <Svg
        width={(L.w + 2 * B) * k}
        height={(L.h + 2 * B) * k}
        viewBox={`${-B} ${-B} ${L.w + 2 * B} ${L.h + 2 * B}`}
        style={{ position: 'absolute', left: -B * k, top: -B * k }}
      >
        <Defs>
          {L.defs.map((d) =>
            d.kind === 'linear' ? (
              <LinearGradient key={d.id} id={`${id}-${d.id}`} gradientUnits={d.units === 'obb' ? 'objectBoundingBox' : 'userSpaceOnUse'} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}>
                {stops(d.stops)}
              </LinearGradient>
            ) : (
              <RadialGradient key={d.id} id={`${id}-${d.id}`} gradientUnits={d.units === 'obb' ? 'objectBoundingBox' : 'userSpaceOnUse'} cx={d.cx} cy={d.cy} r={d.r}>
                {stops(d.stops)}
              </RadialGradient>
            ),
          )}
          <ClipPath id={`${id}-clip`}>
            <Path d={L.clip} />
          </ClipPath>
          {L.artClip ? (
            <ClipPath id={`${id}-artclip`}>
              <Path d={L.artClip} />
            </ClipPath>
          ) : null}
        </Defs>
        {L.shapes.map((s, i) => renderShape(id, s, i))}
      </Svg>
      {L.texts.map((x) => (
        <Text
          key={x.key}
          numberOfLines={1}
          allowFontScaling={false}
          style={[
            styles.t,
            {
              left: x.x * k,
              top: x.y * k,
              fontSize: x.size * k,
              lineHeight: x.size * k,
              fontWeight: x.weight as any,
              color: x.color,
              opacity: x.op,
              letterSpacing: (x.ls + (displayTracking ? x.lsText : 0)) * k,
            },
            fontFamily ? { fontFamily } : null,
            x.align === 'center' ? { width: x.w * k, textAlign: 'center' } : null,
            x.tab ? { fontVariant: ['tabular-nums'] } : null,
          ]}
        >
          {x.text}
        </Text>
      ))}
    </View>
  );
}

function Single({ kind, width, frozenT, paused, float, displayTracking, fontFamily }: WidgetProps & { kind: Kind }) {
  const t = useGlowClock({ frozenT, paused });
  const c = G.CARDS[kind];
  const k = (width || c.w) / c.w;
  const dy = float ? G.floatOffset(kind, t) * k : 0;
  return (
    <View style={{ transform: [{ translateY: dy }] }}>
      <GlowCard kind={kind} t={t} width={width} displayTracking={displayTracking} fontFamily={fontFamily} />
    </View>
  );
}

export function EnergyWidget(p: WidgetProps) { return <Single kind="energy" {...p} />; }
export function ThermostatWidget(p: WidgetProps) { return <Single kind="thermo" {...p} />; }
export function MusicWidget(p: WidgetProps) { return <Single kind="music" {...p} />; }

// 三张组合：原片版式（720×450u），width = 整体宽（pt），背景 #060508
export function GlowWidgets({ width = 360, frozenT, paused, float, displayTracking, fontFamily, background = true }: WidgetProps & { background?: boolean }) {
  const t = useGlowClock({ frozenT, paused });
  const k = width / G.CANVAS.w;
  return (
    <View style={{ width, height: G.CANVAS.h * k, backgroundColor: background ? G.CANVAS.bg : 'transparent' }}>
      {(['energy', 'thermo', 'music'] as Kind[]).map((kind) => {
        const c = G.CARDS[kind];
        const dy = float ? G.floatOffset(kind, t) : 0;
        return (
          <View key={kind} style={{ position: 'absolute', left: c.x * k, top: (c.y + dy) * k }}>
            <GlowCard kind={kind} t={t} width={c.w * k} displayTracking={displayTracking} fontFamily={fontFamily} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  t: { position: 'absolute', includeFontPadding: false },
});

export default GlowWidgets;
