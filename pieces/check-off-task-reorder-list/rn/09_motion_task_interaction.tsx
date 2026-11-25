// Task interaction (to-do list completion) — React Native / Expo component.
// Timeline, layout and colours come from the same core as the HTML preview; icons are the shared SVG markup.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, SvgXml } from 'react-native-svg';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Core = require('./09_motion_task_interaction.core.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Icons = require('./09_motion_task_interaction.icons.js');

const L = Core.LAYOUT;
const K = Core.COLORS;
const BRIEFCASE = require('./assets/briefcase.png');
const STAR = require('./assets/star.png');

type TapEvent = { t: number; id: string };
type CardFrame = { id: string; index: number; y: number; scale: number; content: number; check: number; z: number; done: boolean };
type Frame = { t: number; cards: CardFrame[]; today: { p: number; arc: string; disk: string }; doneCount: number };

export type TaskInteractionProps = {
  /** Play the two completions from the source clip on mount (default true). */
  autoPlayDemo?: boolean;
  /** Freeze at this many ms of the demo timeline (for snapshot / parity tests). */
  frozenT?: number;
  /** Uniform scale of the 393×852 screen. */
  scale?: number;
  onToggle?: (id: string, done: boolean) => void;
};

// With lineHeight = fontSize, SF Pro's baseline sits 0.856em below the line box top (same rule as the HTML preview).
const top = (baseline: number, size: number) => baseline - 0.856 * size;

function Label(p: { text: string; x: number; baseline: number; size: number; weight: '400' | '500' | '600' | '700'; color: string; spacing?: number; width?: number }) {
  const centered = p.width != null;
  return (
    <Text
      numberOfLines={1}
      style={{
        position: 'absolute', left: p.x, top: top(p.baseline, p.size), width: p.width,
        fontSize: p.size, lineHeight: p.size, fontWeight: p.weight, color: p.color,
        letterSpacing: p.spacing ?? 0, textAlign: centered ? 'center' : 'left',
      }}>
      {p.text}
    </Text>
  );
}

function Icon({ name, x, y, color }: { name: string; x: number; y: number; color?: string }) {
  const ic = Icons.ICONS[name];
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: ic.w, height: ic.h }}>
      <SvgXml xml={Icons.xml(name, color)} width={ic.w} height={ic.h} />
    </View>
  );
}

function DayRing({ disk, arc, p }: { disk: string; arc: string | null; p: number }) {
  const W = L.week;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={12} fill={disk} />
      {arc && p > 0.0005 ? <Path d={Core.arcPath(12, 12, W.arcR, p)} fill="none" stroke={arc} strokeWidth={W.arcW} strokeLinecap="butt" /> : null}
    </Svg>
  );
}

function TileIcon({ icon }: { icon: string }) {
  if (icon === 'briefcase') return <Image source={BRIEFCASE} style={{ width: 27, height: 27 }} />;
  if (icon === 'stars') {
    return (
      <View style={{ width: 30, height: 30 }}>
        <Image source={STAR} style={{ position: 'absolute', left: 7.4, top: 0, width: 15.2, height: 15.2 }} />
        <Image source={STAR} style={{ position: 'absolute', left: 0.6, top: 15.6, width: 10.6, height: 10.6 }} />
        <Image source={STAR} style={{ position: 'absolute', left: 18.8, top: 15.6, width: 10.6, height: 10.6 }} />
      </View>
    );
  }
  const ic = Icons.ICONS[icon];
  return <SvgXml xml={Icons.xml(icon)} width={ic.w} height={ic.h} />;
}

function TaskCard({ task, f, onPress }: { task: any; f: CardFrame; onPress: () => void }) {
  const C = L.card;
  return (
    <View style={[styles.card, { zIndex: f.z, transform: [{ translateY: f.y }, { scale: f.scale }] }]}>
      <View style={[StyleSheet.absoluteFill, { opacity: f.content }]}>
        <View style={styles.tile}><TileIcon icon={task.icon} /></View>
        <Label text={task.title} x={L.text.x - C.x} baseline={30.6} size={15.5} weight="600" color={K.ink} spacing={-0.15} />
        <Icon name="clock" x={84 - C.x} y={40.2} />
        <Label text={task.time} x={101.3 - C.x} baseline={51.2} size={12.5} weight="500" color={K.time} />
      </View>
      <Pressable onPress={onPress} hitSlop={6} style={styles.checkHit}>
        <View style={[styles.checkRing, { opacity: 1 - f.check }]} />
        <View style={[styles.checkFill, { opacity: f.check }]}>
          <Svg width={26} height={26} viewBox="0 0 26 26">
            <Defs>
              <LinearGradient id="ck" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={K.checkTop} />
                <Stop offset="0.55" stopColor="#3FC87C" />
                <Stop offset="1" stopColor={K.checkBottom} />
              </LinearGradient>
            </Defs>
            <Circle cx={13} cy={13} r={13} fill="url(#ck)" />
          </Svg>
          <View style={StyleSheet.absoluteFill}><SvgXml xml={Icons.xml('tick')} width={26} height={26} /></View>
        </View>
      </Pressable>
    </View>
  );
}

function TabBar() {
  const tb = L.tabbar;
  const tabs: [string, string][] = [['home', 'Home'], ['tasks', 'Tasks'], ['calendarTab', 'Calendar'], ['stats', 'Stats']];
  return (
    <View style={[styles.tabbar, { left: tb.x, top: tb.y, width: tb.w, height: tb.h, borderRadius: tb.h / 2 }]}>
      <Svg width={tb.w} height={tb.h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="tb" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F1F1F1" />
            <Stop offset="1" stopColor="#F5F5F5" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={tb.w} height={tb.h} rx={tb.h / 2} fill="url(#tb)" />
        <Rect x={tb.centers[1] - tb.sel.w / 2 - tb.x} y={(tb.h - tb.sel.h) / 2} width={tb.sel.w} height={tb.sel.h} rx={tb.sel.h / 2} fill={K.tabSel} />
      </Svg>
      {tabs.map(([icon, label], i) => {
        const cx = tb.centers[i] - tb.x;
        const on = i === 1;
        return (
          <React.Fragment key={icon}>
            <Icon name={icon} x={cx - 11} y={tb.iconY - tb.y - 11} color={on ? '#111111' : K.tabInk} />
            <Label text={label} x={cx - 50} width={100} baseline={817.8 - tb.y} size={9.5} weight="500" color={on ? '#000000' : K.tabLabel} />
          </React.Fragment>
        );
      })}
    </View>
  );
}

function Fab() {
  const F = L.fab;
  return (
    <View style={[styles.fab, { left: F.cx - F.d / 2, top: F.cy - F.d / 2, width: F.d, height: F.d, borderRadius: F.d / 2 }]}>
      <Svg width={F.d} height={F.d}>
        <Defs>
          <LinearGradient id="fab" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={K.fabTop} />
            <Stop offset="0.7" stopColor={K.fabBottom} />
          </LinearGradient>
        </Defs>
        <Circle cx={F.d / 2} cy={F.d / 2} r={F.d / 2} fill="url(#fab)" />
        <Rect x={F.d / 2 - 11.2} y={F.d / 2 - 1.25} width={22.4} height={2.5} rx={1.25} fill="#FFFFFF" />
        <Rect x={F.d / 2 - 1.25} y={F.d / 2 - 11.8} width={2.5} height={23.6} rx={1.25} fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

export default function TaskInteraction({ autoPlayDemo = true, frozenT, scale = 1, onToggle }: TaskInteractionProps) {
  const frozen = frozenT != null;
  const events = useRef<TapEvent[]>(frozen || autoPlayDemo ? Core.DEMO.events.map((e: TapEvent) => ({ ...e })) : []);
  const t0 = useRef<number>(Date.now());
  const [f, setF] = useState<Frame>(() => Core.frame(events.current, frozen ? frozenT : 0));

  useEffect(() => {
    if (frozen) return undefined;
    let raf = 0;
    const tick = () => {
      setF(Core.frame(events.current, Date.now() - t0.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frozen]);

  const tap = useCallback((id: string) => {
    if (frozen) return;
    const t = Date.now() - t0.current;
    events.current = [...events.current, { t, id }];
    const card = Core.frame(events.current, t).cards.find((c: CardFrame) => c.id === id);
    onToggle?.(id, !!card?.done);
  }, [frozen, onToggle]);

  const W = L.week;
  return (
    <View style={{ width: L.W * scale, height: L.H * scale }}>
      <View style={[styles.screen, { transform: [{ translateX: (L.W * (scale - 1)) / 2 }, { translateY: (L.H * (scale - 1)) / 2 }, { scale }] }]}>
        {/* status bar */}
        <Label text="9:41" x={55.5} baseline={38.6} size={17} weight="600" color="#000000" spacing={-0.2} />
        <Icon name="signal" x={279} y={27.5} />
        <Icon name="wifi" x={301} y={27.5} />
        <Icon name="battery" x={323} y={27} />

        {/* header + week strip */}
        <Label text="To-do list" x={16} baseline={98} size={23} weight="700" color={K.ink} spacing={0.3} />
        {Core.DAYS.map((d: any, i: number) => {
          const cx = W.cx0 + W.dx * i;
          const ring = Core.dayRing(i, f.today);
          return (
            <React.Fragment key={d.d}>
              {d.today ? <View style={{ position: 'absolute', left: cx - W.pill.w / 2, top: 121, width: W.pill.w, height: W.pill.h, borderRadius: W.pill.r, backgroundColor: K.todayPill }} /> : null}
              <Label text={d.l} x={cx - 50} width={100} baseline={133.2} size={W.letterSize} weight="400" color={d.today ? K.todayLetter : d.future ? K.weekdayFuture : K.weekday} />
              <View style={{ position: 'absolute', left: cx - 12, top: W.ringY - 12 }}><DayRing disk={ring.disk} arc={ring.arc} p={ring.p} /></View>
              <Label text={String(d.d)} x={cx - 50} width={100} baseline={186.3} size={W.dateSize} weight={d.today ? '500' : '400'} color={d.today ? K.ink : d.future ? K.dateFuture : K.date} />
            </React.Fragment>
          );
        })}

        <Label text={'Today’s plan'} x={20} baseline={238.6} size={20} weight="700" color={K.ink} spacing={-0.2} />
        <View style={[styles.add, { left: L.add.x, top: L.add.y, width: L.add.w, height: L.add.h }]}>
          <Label text="Add +" x={L.add.w / 2 - 50} width={100} baseline={18.2} size={15} weight="500" color={K.addInk} />
        </View>

        {/* cards */}
        {Core.TASKS.map((task: any, i: number) => (
          <TaskCard key={task.id} task={task} f={f.cards[i]} onPress={() => tap(task.id)} />
        ))}

        <TabBar />
        <Fab />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', left: 0, top: 0, width: L.W, height: L.H, backgroundColor: K.screen, borderRadius: 56, overflow: 'hidden' },
  card: {
    position: 'absolute', left: L.card.x, top: 0, width: L.card.w, height: L.card.h, borderRadius: L.card.r, backgroundColor: K.card,
    shadowColor: '#000000', shadowOpacity: 0.035, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  tile: {
    position: 'absolute', left: L.tile.inset, top: L.tile.inset, width: L.tile.size, height: L.tile.size, borderRadius: L.tile.r,
    backgroundColor: K.tile, alignItems: 'center', justifyContent: 'center',
  },
  checkHit: { position: 'absolute', left: L.check.cx - L.card.x - 20, top: L.card.h / 2 - 20, width: 40, height: 40 },
  checkRing: { position: 'absolute', left: 7, top: 7, width: 26, height: 26, borderRadius: 13, borderWidth: L.check.ring, borderColor: K.ring },
  checkFill: { position: 'absolute', left: 7, top: 7, width: 26, height: 26 },
  add: { position: 'absolute', borderRadius: 13, backgroundColor: K.addBg },
  tabbar: {
    position: 'absolute', overflow: 'visible', borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF',
    shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 6 },
  },
  fab: { position: 'absolute', shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } },
});
