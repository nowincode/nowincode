// Lody 对话列表 · 吸顶分组标题 + 顶部渐进模糊（React Native / Expo）
// 依赖（均为 Expo SDK 自带，无需额外原生编译）：expo-blur、expo-linear-gradient、@react-native-masked-view/masked-view、react-native-svg
// 布局、数据、吸顶状态、模糊曲线、原片滚动时间线全部来自 ./src/lodyCore.js（与 HTML 预览共用）。
//
// 用法：
//   <LodyStickyBlurList />                 // 可交互：原生滚动（惯性 / 橡皮筋），吸顶与模糊由 scrollY 原生驱动
//   <LodyStickyBlurList autoPlay />        // 按原片滚动表自动复演（10.77s 循环）
//   <LodyStickyBlurList t={4.6} />         // 定格在原片时间轴 t 秒（对拍用）
//   <LodyStickyBlurList scroll={500} />    // 定格在滚动量 500pt
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Core = require('./src/lodyCore.js');
const { L, C, LAYOUT: LAY } = Core;
const F = L.font;
const AVATAR = require('./assets/avatar.png');
const JELLY = require('./assets/jellyfish.png');
const LODY_SQ = require('./assets/lody_sq.png');

// HTML 的 backdrop-filter: blur(σ) ↔ expo-blur intensity 的经验换算（σ 9px ≈ 28），需真机复核
export const BLUR_INTENSITY = Math.round(Core.BLUR.sigma * 3.1);
// 白色泛白层强度系数：BlurView 的 light 材质自带一层提亮，真机上若偏白，把它调低
export const FADE_K = 1;

type Props = { t?: number; scroll?: number; autoPlay?: boolean; statusBar?: boolean; style?: any };

function Icon({ name, size, color, sw, cx, cy }: { name: string; size: number; color: string; sw: number; cx: number; cy: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', left: cx - size / 2, top: cy - size / 2 }}>
      {Core.ICONS[name].map((d: any[], i: number) => d[0] === 'c'
        ? <Circle key={i} cx={d[1]} cy={d[2]} r={d[3]} fill="none" stroke={color} strokeWidth={sw} />
        : <Path key={i} d={d[1]} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />)}
    </Svg>
  );
}

function RepoIcon({ x, y, d }: { x: number; y: number; d: number }) {
  return (
    <Svg width={d * 1.2} height={d * 1.2} viewBox="0 0 33.6 33.6" style={{ position: 'absolute', left: x, top: y }}>
      <Circle cx={14} cy={14} r={14} fill="#6F6F6F" />
      <Path d="M13 13V3.6A10.4 10.4 0 0 0 3.6 13Z" fill="#CFE6EA" />
      <Path d="M13 3h2v23h-2z" fill="#fff" />
      <Path d="M3 13h11v2H3z" fill="#fff" />
      <Circle cx={19.4} cy={9.4} r={2.3} fill="#6F6F6F" stroke="#fff" strokeWidth={1.6} />
      <Rect x={15.4} y={16.4} width={14} height={8.6} rx={4.3} transform="rotate(40 22.4 20.7)" fill="#fff" stroke="#6F6F6F" strokeWidth={1.7} />
    </Svg>
  );
}

// 中西文交界补 1/8em：把交界前一个字单独成段并加 letterSpacing（iOS 的字距加在字形之后）
function Runs({ str, size }: { str: string; size: number }) {
  const runs = Core.textRuns(str) as { s: string; k: string; gap: boolean }[];
  const out: any[] = [];
  runs.forEach((r, i) => {
    const next = runs[i + 1];
    if (next && next.gap) {
      const chars = Array.from(r.s); const last = chars.pop() as string;
      if (chars.length) out.push(chars.join(''));
      out.push(<Text key={i} style={{ letterSpacing: size / 8 }}>{last}</Text>);
    } else out.push(r.s);
  });
  return <>{out}</>;
}

const textBox = (f: any, yc: number) => ({ top: yc - f.lh / 2 + f.dy, height: f.lh });
const textStyle = (f: any, color: string, weight?: any) => ({ fontSize: f.size, lineHeight: f.lh, color, fontWeight: weight || '400' });

function StatusIcon({ kind, cx, cy }: { kind: string; cx: number; cy: number }) {
  if (kind === 'merge') return <Icon name="merge" size={14} color={C.merge} sw={2.5} cx={cx} cy={cy - 1.25} />;
  const x = cx + 1.2, y = cy + 0.25;
  return (
    <>
      <Icon name="pr" size={16.4} color="#8A8A8A" sw={2.2} cx={x} cy={y} />
      {kind === 'prcheck'
        ? <Icon name="check" size={16.4} color={C.green} sw={2.5} cx={x} cy={y} />
        : <View style={{ position: 'absolute', left: x + 3, top: y + 2.8, width: 5.4, height: 5.4, borderRadius: 2.7, backgroundColor: C.brown }} />}
    </>
  );
}

function GridDots({ cx, cy, phase, t, clock }: { cx: number; cy: number; phase: number; t: number | null; clock: Animated.Value }) {
  const N = 12;
  return (
    <>
      {Array.from({ length: 9 }, (_, i) => {
        const base = { position: 'absolute' as const, left: cx - 6.7 + (i % 3) * 4.9, top: cy - 0.9 - 6.7 + Math.floor(i / 3) * 4.9, width: 3.6, height: 3.6, borderRadius: 1.1, backgroundColor: '#8CA6E8' };
        if (t != null) { const a = Core.gridAlpha(t + phase, i); return <View key={i} style={[base, { opacity: a, transform: [{ scale: Core.gridScale(a) }] }]} />; }
        const input = Array.from({ length: N + 1 }, (_, k) => k / N);
        const alphas = input.map((u) => Core.gridAlpha(u / 0.9 + phase, i));
        return <Animated.View key={i} style={[base, { opacity: clock.interpolate({ inputRange: input, outputRange: alphas }), transform: [{ scale: clock.interpolate({ inputRange: input, outputRange: alphas.map(Core.gridScale) }) }] }]} />;
      })}
    </>
  );
}

function Rows({ t, clock }: { t: number | null; clock: Animated.Value }) {
  const els: any[] = [];
  LAY.rows.forEach((r: any) => {
    if (r.kind === 'chdr') {
      els.push(<Icon key={'c' + r.id} name="chevron" size={15.2} color={C.chev} sw={2.2} cx={24.8} cy={r.tc + 0.75} />);
      els.push(<Text key={'ct' + r.id} numberOfLines={1} style={[st.abs, { left: 36.3 }, textBox(F.chdr, r.tc), textStyle(F.chdr, C.sub)]}><Runs str={r.text} size={F.chdr.size} /></Text>);
      return;
    }
    const d = r.d, f = r.kind === 'top' ? F.title : F.childTitle, right = d.slot ? L.slotTitleRight : L.timeRight;
    els.push(
      <View key={'l' + r.id} style={[st.line, { left: r.x, width: right - r.x }, textBox(f, r.tc)]}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={[{ flex: 1 }, textStyle(f, C.title, d.bold ? L.boldWeight : '400')]}><Runs str={d.t} size={f.size} /></Text>
        {d.pre ? <View style={{ width: 15, height: 15, marginLeft: 9, marginRight: 4 }}><StatusIcon kind={d.pre} cx={7.5} cy={7.5} /></View> : null}
        {d.time ? <Text style={[{ marginLeft: L.titleGap, top: F.time.dy - f.dy }, textStyle(F.time, C.time)]}><Runs str={d.time} size={F.time.size} /></Text> : null}
      </View>,
    );
    if (d.slot === 'dot') els.push(<View key={'d' + r.id} style={[st.abs, { left: L.slotCx - 4.1, top: r.tc - 4.1, width: 8.2, height: 8.2, borderRadius: 4.1, backgroundColor: C.blue }]} />);
    if (d.slot === 'grid') els.push(<GridDots key={'g' + r.id} cx={L.slotCx} cy={r.tc} phase={r.id * 0.37} t={t} clock={clock} />);
    els.push(<Image key={'a' + r.id} source={AVATAR} style={[st.abs, { left: L.avatarCx - L.avatarD / 2, top: r.tc - L.avatarD / 2, width: L.avatarD, height: L.avatarD, borderRadius: L.avatarD / 2 }]} />);
    if (d.sub) {
      const D = d.sq ? 16.1 : L.subIconD;
      els.push(d.sq
        ? <Image key={'s' + r.id} source={LODY_SQ} style={[st.abs, { left: r.x + 0.2, top: r.sc - D / 2 + 0.25, width: D, height: D, borderRadius: 3.5 }]} />
        : <RepoIcon key={'s' + r.id} x={r.x + 0.2} y={r.sc - D / 2 - 0.3} d={D} />);
      els.push(<Text key={'st' + r.id} numberOfLines={1} style={[st.abs, { left: r.x + L.subTextDX }, textBox(F.sub, r.sc), textStyle(F.sub, C.sub)]}>{d.sub}</Text>);
      if (d.st) els.push(<StatusIcon key={'i' + r.id} kind={d.st} cx={L.statusCx} cy={r.sc} />);
    }
  });
  LAY.trees.forEach((tr: any, ti: number) => {
    const last = tr.elbows[tr.elbows.length - 1];
    els.push(<View key={'tv' + ti} style={[st.abs, { left: tr.x - 0.5, top: tr.y0, width: 0, height: last - L.treeR - tr.y0, borderLeftWidth: 1, borderColor: C.tree }]} />);
    tr.elbows.forEach((e: number, k: number) => els.push(
      <View key={'te' + ti + '_' + k} style={[st.abs, { left: tr.x - 0.5, top: e - L.treeR, width: L.treeEndX - tr.x + 0.5, height: L.treeR + 0.5, borderLeftWidth: 1, borderBottomWidth: 1, borderBottomLeftRadius: L.treeR, borderColor: C.tree }]} />,
    ));
  });
  return <>{els}</>;
}

function Labels({ scrollY, under }: { scrollY: Animated.Value; under: boolean }) {
  const tracks = useMemo(() => Core.labelTracks(), []);
  return (
    <View pointerEvents="none" style={st.lblLayer}>
      {tracks.map((k: any) => (
        <Animated.Text key={k.i} numberOfLines={1}
          style={[st.lbl, textStyle({ size: F.label.size, lh: L.labelH }, C.label), {
            marginTop: F.label.dy,
            opacity: scrollY.interpolate({ inputRange: under ? k.underIn : k.overIn, outputRange: under ? k.underOut : k.overOut, extrapolate: 'clamp' }),
            transform: [{ translateY: scrollY.interpolate({ inputRange: k.topIn, outputRange: k.topOut, extrapolate: 'clamp' }) }],
          }]}>
          {k.text}
        </Animated.Text>
      ))}
    </View>
  );
}

function Glass({ style, children }: { style: any; children?: any }) {
  return (
    <View style={[st.glass, style]}>
      <LinearGradient colors={['#ffffff', '#fbfbfb', '#f9f9f9', '#fdfdfd']} locations={[0, 0.3, 0.55, 1]} style={[StyleSheet.absoluteFill, { borderRadius: style.borderRadius }]} />
      {children}
    </View>
  );
}

export default function LodyStickyBlurList({ t, scroll, autoPlay, statusBar, style }: Props) {
  const frozenT = t != null ? t : null;
  const S0 = scroll != null ? scroll : frozenT != null ? Core.scrollAt(frozenT) : 0;
  const frozen = t != null || scroll != null;
  const scrollY = useRef(new Animated.Value(S0)).current;
  const clock = useRef(new Animated.Value(0)).current;
  const indOpacity = useRef(new Animated.Value(frozenT != null ? Core.indicatorOpacityAt(frozenT) : scroll ? 1 : 0)).current;
  const ref = useRef<any>(null);
  const hideTimer = useRef<any>(null);

  // 点阵加载动画的循环时钟
  useEffect(() => {
    if (frozen) return;
    const loop = Animated.loop(Animated.timing(clock, { toValue: 1, duration: 1000 / 0.9, easing: Easing.linear, useNativeDriver: true }));
    loop.start(); return () => loop.stop();
  }, [frozen, clock]);

  // 自动复演：逐帧把 ScrollView 拨到原片滚动表的位置（含顶部回弹的负值）
  useEffect(() => {
    if (frozen || !autoPlay) return;
    let raf = 0; const t0 = Date.now();
    const tick = () => {
      const tt = (Date.now() - t0) / 1000;
      ref.current?.scrollTo({ y: Core.scrollAt(tt), animated: false });
      indOpacity.setValue(Core.indicatorOpacityAt(tt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [frozen, autoPlay, indOpacity]);

  const showInd = () => { if (autoPlay) return; clearTimeout(hideTimer.current); indOpacity.setValue(1); };
  const hideInd = () => { if (autoPlay) return; clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => Animated.timing(indOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(), 900); };

  const ind = Core.indicator(0), tk = L.ind.trackBottom - L.ind.trackTop;
  const maskColors = Core.BLUR.mask.map((m: number[]) => `rgba(0,0,0,${m[1]})`), maskLocs = Core.BLUR.mask.map((m: number[]) => m[0] / Core.BLUR.bottom);
  const fadeColors = Core.FADE.map((m: number[]) => `rgba(255,255,255,${m[1] * FADE_K})`), fadeLocs = Core.FADE.map((m: number[]) => m[0] / Core.FADE_BOTTOM);
  const T = L.tab;

  return (
    <View style={[st.screen, style]}>
      {/* 内容层：原生滚动 */}
      <Animated.ScrollView ref={ref} style={StyleSheet.absoluteFill} contentOffset={{ x: 0, y: S0 }} scrollEnabled={!frozen && !autoPlay}
        showsVerticalScrollIndicator={false} scrollEventThrottle={16} contentInsetAdjustmentBehavior="never"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        onScrollBeginDrag={showInd} onMomentumScrollEnd={hideInd} onScrollEndDrag={hideInd}>
        <View style={{ width: L.W, height: LAY.contentH }}><Rows t={frozenT != null ? frozenT : scroll != null ? 0 : null} clock={clock} /></View>
      </Animated.ScrollView>

      {/* 被顶走的旧标题：在模糊层之下 */}
      <Labels scrollY={scrollY} under />

      {/* 顶部渐进模糊：一层模糊 × 遮罩份额 m(y)，再盖白色 alpha(y) */}
      <MaskedView pointerEvents="none" style={[st.abs, { left: 0, top: 0, width: L.W, height: Core.BLUR.bottom }]}
        maskElement={<LinearGradient colors={maskColors} locations={maskLocs} style={StyleSheet.absoluteFill} />}>
        <BlurView intensity={BLUR_INTENSITY} tint="light" style={StyleSheet.absoluteFill} />
      </MaskedView>
      <LinearGradient pointerEvents="none" colors={fadeColors} locations={fadeLocs} style={[st.abs, { left: 0, top: 0, width: L.W, height: Core.FADE_BOTTOM }]} />

      {/* 吸顶标题：在模糊层之上 */}
      <Labels scrollY={scrollY} under={false} />

      {/* 顶栏胶囊 */}
      <Glass style={{ left: L.pillL.x, top: L.pillTop, width: L.pillL.w, height: L.pillH, borderRadius: L.pillH / 2 }}>
        <Image source={JELLY} style={[st.abs, { left: 5.9, top: 5.6, width: 32, height: 32, borderRadius: 16, backgroundColor: '#000' }]} />
        <Text style={[st.abs, { left: 49.6, top: 11, height: 22, fontSize: 17, lineHeight: 22, fontWeight: '600', color: '#111' }]}>Lody</Text>
        <Icon name="chevron" size={16.6} color="#555" sw={1.9} cx={98.5} cy={22.6} />
      </Glass>
      <Glass style={{ left: L.pillR.x, top: L.pillTop, width: L.pillR.w, height: L.pillH, borderRadius: L.pillH / 2 }}>
        <Icon name="search" size={24.6} color="#111" sw={2.25} cx={23.8} cy={22.4} />
        <Icon name="filter" size={24} color="#111" sw={2.2} cx={81.05} cy={21.95} />
      </Glass>

      {/* 可选：仿状态栏（真机上由系统绘制，默认不画） */}
      {statusBar ? (
        <View pointerEvents="none" style={[st.abs, { left: 0, top: 0, width: L.W, height: 56 }]}>
          <Text style={[st.abs, { left: 34, top: 21.1, width: 60, textAlign: 'center', fontSize: 17, lineHeight: 22, fontWeight: '600', color: '#000' }]}>09:41</Text>
          <View style={[st.abs, { left: 138.3, top: 13.7, width: 124.7, height: 35.9, borderRadius: 18, backgroundColor: '#000' }]} />
        </View>
      ) : null}

      {/* 滚动条 */}
      <Animated.View pointerEvents="none" style={[st.abs, {
        left: ind.x, top: 0, width: ind.w, height: ind.h, borderRadius: 1.5, backgroundColor: 'rgba(0,0,0,0.33)', opacity: indOpacity,
        transform: [{ translateY: scrollY.interpolate({ inputRange: [0, LAY.maxScroll], outputRange: [L.ind.trackTop, L.ind.trackTop + tk - ind.h], extrapolate: 'clamp' }) }],
      }]} />

      {/* 底部渐隐 + 玻璃 Tab 栏 */}
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.42)', 'rgba(255,255,255,0.6)']} locations={[0, 0.6, 1]} style={[st.abs, { left: 0, top: 800, width: L.W, height: 74 }]} />
      <View style={[st.glass, { left: T.x, top: T.y, width: T.w, height: T.h, borderRadius: T.h / 2, backgroundColor: 'transparent' }]}>
        <BlurView intensity={56} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: T.h / 2, overflow: 'hidden' }]} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: T.h / 2, backgroundColor: 'rgba(252,252,252,0.90)' }]} />
        <View style={[st.abs, { left: T.centers[0] - T.selW / 2 - T.x, top: (T.h - T.selH) / 2, width: T.selW, height: T.selH, borderRadius: T.selH / 2, backgroundColor: '#E9E9EA' }]} />
        {[['messages', '对话'], ['clock', '定时任务'], ['settings', '设置']].map((it, i) => (
          <React.Fragment key={i}>
            <Icon name={it[0]} size={23} color={i === 0 ? C.tabSel : '#111'} sw={1.9} cx={T.centers[i] - T.x} cy={T.iconCy - T.y} />
            <Text style={[st.abs, { left: T.centers[i] - T.x - 40, top: T.textCy - 6 - T.y, width: 80, textAlign: 'center', fontSize: 10, lineHeight: 12, fontWeight: '600', color: i === 0 ? C.tabSel : '#111' }]}>{it[1]}</Text>
          </React.Fragment>
        ))}
      </View>
      <View style={[st.glass, { left: T.composeCx - T.composeD / 2, top: T.y, width: T.composeD, height: T.composeD, borderRadius: T.composeD / 2, backgroundColor: 'transparent' }]}>
        <BlurView intensity={56} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: T.composeD / 2, overflow: 'hidden' }]} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: T.composeD / 2, backgroundColor: 'rgba(252,252,252,0.90)' }]} />
        <Icon name="compose" size={23} color="#111" sw={2} cx={T.composeD / 2} cy={T.h / 2} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { width: L.W, height: L.H, backgroundColor: '#fff', overflow: 'hidden' },
  abs: { position: 'absolute' },
  line: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  lblLayer: { position: 'absolute', left: 0, top: 0, width: L.W, height: 0 },
  lbl: { position: 'absolute', left: 19, top: 0, height: L.labelH },
  glass: { position: 'absolute', backgroundColor: '#fbfbfb', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.11)',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
});
