// 04_motion_todo_check_strike — React Native（Expo）组件
// 依赖：react-native-svg、expo-blur（均为 Expo 自带模块，无需原生编译）
// 时间线、几何、颜色全部来自 ./core.js（与 HTML 预览同源）
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop, SvgXml } from 'react-native-svg';
import { BlurView } from 'expo-blur';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const K = require('./core.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RunnerEmoji: { color: string; gray: string } = require('./assets/runner_emoji.js');

const L = K.L;
const C = K.C;
const ICON = K.ICON;
const SF_ASCENT = 0.952; // SF Pro ascender / em；文字一律按基线放置

export type TodoItem = {
  title: string;
  emoji?: boolean;
  flag?: 'orange' | 'red';
  pill?: { label: string; tone: 'blue' | 'neutral' };
};
type RowState = { checked: boolean; at: number };

const nowSec = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

// ---------- 小图标 ----------
function FlagIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="-10 -10 20 20">
      <Path transform="translate(-3.35,-4.2)" d={ICON.flag} fill={color} />
    </Svg>
  );
}
function CalendarIcon({ color }: { color: string }) {
  const r = ICON.calRect;
  const d =
    `M${r.x},${ICON.calHeaderY}H${r.x + r.w}` +
    ICON.calTicks.map((x: number) => `M${x},${ICON.calTickY[0]}V${ICON.calTickY[1]}`).join('');
  return (
    <Svg width={L.pillIcon} height={8} viewBox="0 0 7.6 8" style={{ marginRight: L.pillGap }}>
      <Rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.r} fill="none" stroke={color} strokeWidth={ICON.calStroke} />
      <Path d={d} stroke={color} strokeWidth={ICON.calStroke} strokeLinecap="round" />
    </Svg>
  );
}
function PlusIcon() {
  const a = ICON.plusArm;
  return (
    <Svg width={20} height={20} viewBox="-10 -10 20 20">
      <Path d={`M-${a},0H${a}M0,-${a}V${a}`} stroke={K.rgba(C.plus)} strokeWidth={ICON.plusStroke} strokeLinecap="round" />
    </Svg>
  );
}

// ---------- 卡片 ----------
export type TodoWeekWidgetProps = {
  title?: string;
  items?: TodoItem[];
  /** 循环播放源片的演示时间线（依次勾选 → 级联取消） */
  autoplay?: boolean;
  /** 定格到演示时间线的某一时刻（秒），用于截图 / 对拍 */
  frozenT?: number;
  onToggle?: (index: number, checked: boolean) => void;
  style?: ViewStyle;
};

export function TodoWeekWidget({ title = 'This week', items = K.ITEMS, autoplay = false, frozenT, onToggle, style }: TodoWeekWidgetProps) {
  const [now, setNow] = useState<number>(() => (frozenT != null ? frozenT : 0));
  const clock0 = useRef<number>(nowSec());
  const [auto, setAuto] = useState<boolean>(autoplay);
  const [rows, setRows] = useState<RowState[]>(() => items.map(() => ({ checked: false, at: -10 })));
  const [lens, setLens] = useState<(number | undefined)[]>(() => items.map(() => undefined));
  const liveUntil = useRef<number>(0);

  // rAF 驱动：自动演示时常驻，手动模式只在动画窗口内跑
  useEffect(() => {
    if (frozenT != null) return;
    let raf = 0;
    const tick = () => {
      const t = nowSec() - clock0.current;
      setNow(t);
      if (auto || t < liveUntil.current) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto, frozenT, rows]);

  const view = useMemo(() => {
    if (frozenT != null || auto) {
      const tt = K.demoTime(frozenT != null ? frozenT : now);
      return { rs: items.map((_, i) => K.demoState(i % 5, tt)) as RowState[], t: tt };
    }
    return { rs: rows, t: now };
  }, [frozenT, auto, now, rows, items]);

  const F = useMemo(
    () => K.frame(view.rs, view.t, lens.map((w) => (w == null ? undefined : w + L.strikePad + L.strikePadR)), items),
    [view, lens, items]
  );

  const toggle = useCallback(
    (i: number) => {
      if (frozenT != null) return;
      const t = nowSec() - clock0.current;
      let base = rows;
      if (auto) {
        // 从当前演示状态接管为手动
        base = view.rs.map((r) => ({ checked: r.checked, at: r.at - view.t + t }));
        setAuto(false);
      }
      const next = base.map((r, k) => (k === i ? { checked: !r.checked, at: t } : r));
      liveUntil.current = t + 1.2;
      setRows(next);
      onToggle?.(i, next[i].checked);
    },
    [rows, auto, view, frozenT, onToggle]
  );

  const onTitleLayout = (i: number) => (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setLens((prev) => (prev[i] != null && Math.abs((prev[i] as number) - w) < 0.25 ? prev : prev.map((v, k) => (k === i ? w : v))));
  };

  return (
    <View style={[styles.shadow, style]}>
      <View style={styles.card}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: K.rgba(C.card) }]} />

        <Text style={[styles.title, { top: L.titleBaseline - SF_ASCENT * L.titleSize, color: K.rgba(C.title) }]}>{title}</Text>
        <View style={[styles.btn, { left: L.plusCx - 10, top: L.plusCy - 10, backgroundColor: K.rgba(C.btnBg) }]}>
          <PlusIcon />
        </View>

        {items.map((item, i) => {
          const y = L.rowY(i);
          const f = F[i];
          const right = item.flag ? L.pillRightWithFlag : L.pillRight;
          const baseline = y + L.textBaselineOff;
          return (
            <React.Fragment key={i}>
              {i > 0 && <View style={[styles.sep, { top: y - L.rowPitch / 2 - 0.22, backgroundColor: K.rgba(C.sep) }]} />}
              <View style={[styles.itemRow, { top: baseline - SF_ASCENT * L.textSize }]} onLayout={onTitleLayout(i)}>
                <Text style={[styles.item, { color: f.colors.text }]}>{item.title}</Text>
                {item.emoji && (
                  <View style={styles.emoji}>
                    <View style={[StyleSheet.absoluteFill, { opacity: f.colors.emojiColor }]}>
                      <SvgXml xml={RunnerEmoji.color} width={L.emojiSize} height={L.emojiSize} />
                    </View>
                    <View style={[StyleSheet.absoluteFill, { opacity: f.colors.emojiGray }]}>
                      <SvgXml xml={RunnerEmoji.gray} width={L.emojiSize} height={L.emojiSize} />
                    </View>
                  </View>
                )}
              </View>
              {item.flag && (
                <View style={[styles.btn, { left: L.plusCx - 10, top: y - 10, backgroundColor: f.colors.flagBg }]}>
                  <FlagIcon color={f.colors.flagFg} />
                </View>
              )}
              {item.pill && (
                <View style={[styles.pill, { right: L.cardW - right, top: y - L.pillH / 2, backgroundColor: f.colors.pillBg }]}>
                  <CalendarIcon color={f.colors.pillFg} />
                  <Text style={[styles.pillText, { color: f.colors.pillFg }]}>{item.pill.label}</Text>
                </View>
              )}
            </React.Fragment>
          );
        })}

        {/* 复选框 + 尖角 + 删除线：同一 SVG 层，压在文字之上 */}
        <Svg width={L.cardW} height={L.cardH} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity={0.1} />
              <Stop offset="0.45" stopColor="#ffffff" stopOpacity={0.04} />
              <Stop offset="1" stopColor="#ffd6aa" stopOpacity={0.26} />
            </LinearGradient>
          </Defs>
          {F.map((f: any, i: number) => {
            const y = L.rowY(i);
            return (
              <G key={i}>
                {f.strike && (
                  <Line x1={f.strike[0]} y1={y} x2={f.strike[1]} y2={y} stroke={K.rgba(C.blue)} strokeWidth={L.strikeW} strokeLinecap="round" />
                )}
                <G transform={`translate(${L.boxCx},${y})`}>
                  <Path d={f.box} fill={f.fill} stroke={f.ring} strokeWidth={L.boxStroke} strokeLinejoin="round" />
                  {f.check && (
                    <Path d={f.check} fill="none" stroke={f.checkColor} strokeWidth={K.CHECK_W} strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </G>
              </G>
            );
          })}
          <Rect x={0.3} y={0.3} width={L.cardW - 0.6} height={L.cardH - 0.6} rx={L.cardR - 0.3} fill="none" stroke="url(#rim)" strokeWidth={0.6} />
        </Svg>

        {items.map((_, i) => (
          <Pressable key={i} onPress={() => toggle(i)} style={[styles.hit, { top: L.rowY(i) - 22 }]} />
        ))}
      </View>
    </View>
  );
}

// ---------- 壁纸（程序化渐变 + 网格，433×520 视框） ----------
// viewBox：舞台坐标下要显示的矩形（默认源片构图 0 0 433 520）；配合 K.wallViewBox 可铺满任意视口
export function DuneWallpaper({ style, viewBox }: { style?: ViewStyle; viewBox?: number[] }) {
  const W = useMemo(() => K.wallpaper(), []);
  const vb = viewBox || [0, 0, W.w, W.h];
  return (
    <Svg style={style} width="100%" height="100%" viewBox={vb.join(' ')} preserveAspectRatio="none">
      <Defs>
        {W.defs.map((g: any) =>
          g.type === 'linear' ? (
            <LinearGradient key={g.id} id={'w_' + g.id} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
              {g.stops.map((s: any, k: number) => (
                <Stop key={k} offset={String(s[0])} stopColor={s[1]} stopOpacity={s[2] == null ? 1 : s[2]} />
              ))}
            </LinearGradient>
          ) : (
            <RadialGradient key={g.id} id={'w_' + g.id} gradientUnits="userSpaceOnUse" cx={g.cx} cy={g.cy} r={g.r} gradientTransform={g.tf}>
              {g.stops.map((s: any, k: number) => (
                <Stop key={k} offset={String(s[0])} stopColor={s[1]} stopOpacity={s[2] == null ? 1 : s[2]} />
              ))}
            </RadialGradient>
          )
        )}
      </Defs>
      {W.shapes.map((s: any, k: number) => {
        const transform = s.rotate ? `rotate(${s.rotate.join(' ')})` : undefined;
        return s.type === 'rect' ? (
          <Rect key={k} x={s.x} y={s.y} width={s.w} height={s.h} fill={`url(#w_${s.fill})`} transform={transform} />
        ) : (
          <Ellipse key={k} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={`url(#w_${s.fill})`} transform={transform} />
        );
      })}
      <G stroke={W.gridColor} strokeWidth={W.gridWidth}>
        {W.grid.map((l: any, k: number) => (
          <Line key={k} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
        ))}
      </G>
    </Svg>
  );
}

// ---------- 演示屏：壁纸 + 卡片（与 HTML 预览同一舞台缩放规则） ----------
export default function TodoCheckStrikeDemo({ frozenT, autoplay = true }: { frozenT?: number; autoplay?: boolean }) {
  const [size, setSize] = useState({ w: 433, h: 520 });
  const zoom = K.stageZoom(size.w, size.h);
  return (
    <View style={styles.screen} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <DuneWallpaper style={StyleSheet.absoluteFill as ViewStyle} viewBox={K.wallViewBox(size.w, size.h, zoom)} />
      <View
        style={{
          position: 'absolute', width: 433, height: 520,
          left: size.w / 2 - 216.5, top: size.h / 2 - 260,
          transform: [{ scale: zoom }],
        }}
      >
        <TodoWeekWidget autoplay={autoplay} frozenT={frozenT} style={{ position: 'absolute', left: K.CARD_IN_WALL.x, top: K.CARD_IN_WALL.y }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#2a5a66', overflow: 'hidden' },
  shadow: {
    width: L.cardW, height: L.cardH, borderRadius: L.cardR,
    shadowColor: '#190800', shadowOpacity: 0.62, shadowRadius: 19, shadowOffset: { width: 0, height: 20 },
  },
  card: { width: L.cardW, height: L.cardH, borderRadius: L.cardR, overflow: 'hidden' },
  title: { position: 'absolute', left: L.titleX, fontSize: L.titleSize, fontWeight: '500', letterSpacing: -0.1 },
  btn: { position: 'absolute', width: L.btnD, height: L.btnD, borderRadius: L.btnD / 2 },
  sep: { position: 'absolute', left: L.sepX0, width: L.sepX1 - L.sepX0, height: 0.45 },
  itemRow: { position: 'absolute', left: L.textX, flexDirection: 'row', alignItems: 'flex-start' },
  item: { fontSize: L.textSize, fontWeight: '400', letterSpacing: -0.12 },
  emoji: { width: L.emojiSize, height: L.emojiSize, marginLeft: L.emojiGap, marginTop: SF_ASCENT * L.textSize + 3 - L.emojiSize },
  pill: {
    position: 'absolute', height: L.pillH, borderRadius: L.pillH / 2, flexDirection: 'row', alignItems: 'center',
    paddingLeft: L.pillPadL, paddingRight: L.pillPadR,
  },
  pillText: { fontSize: L.pillSize, fontWeight: '500', letterSpacing: -0.05 },
  hit: { position: 'absolute', left: 0, width: 300, height: 44 },
});
