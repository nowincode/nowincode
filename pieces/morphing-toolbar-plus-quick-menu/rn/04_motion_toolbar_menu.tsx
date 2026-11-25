/**
 * ToolbarMenu — liquid tab bar + "+" button that morphs into a 3×2 quick-create menu.
 * Expo-compatible: depends only on @shopify/react-native-skia (bundled with Expo Go).
 *
 * Drawing, timelines and hit-testing live in 04_motion_toolbar_menu_core.js (shared with the
 * CanvasKit HTML preview); this file is a thin Skia adapter + touch/clock plumbing.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, View, ViewStyle, GestureResponderEvent } from 'react-native';
import {
  Canvas, Picture, Skia, SkCanvas, SkPicture, SkImage, SkPath, SkRuntimeEffect,
  PaintStyle, StrokeCap, StrokeJoin, ClipOp, BlendMode, TileMode, FilterMode, MipmapMode, BlurStyle, TextAlign,
} from '@shopify/react-native-skia';
import Core from './04_motion_toolbar_menu_core';

type RGBA = number[];

function makeRNAdapter() {
  const paths: Record<string, SkPath> = {};
  const effects: Record<string, SkRuntimeEffect> = {};
  const paras: Record<string, any> = {};
  const col = (c: RGBA) => Float32Array.of(c[0], c[1], c[2], c[3] ?? 1);
  const paint = () => { const p = Skia.Paint(); p.setAntiAlias(true); return p; };
  return {
    Stroke: PaintStyle.Stroke, CapRound: StrokeCap.Round, JoinRound: StrokeJoin.Round,
    ClipIntersect: ClipOp.Intersect, BlendPlus: BlendMode.Plus,
    paint,
    imagePaint: paint,
    color: col,
    rect: (x: number, y: number, w: number, h: number) => Skia.XYWHRect(x, y, w, h),
    rrect: (x: number, y: number, w: number, h: number, r: number) => Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r),
    linear: (x0: number, y0: number, x1: number, y1: number, cols: RGBA[], pos: number[]) =>
      Skia.Shader.MakeLinearGradient(Skia.Point(x0, y0), Skia.Point(x1, y1), cols.map(col), pos, TileMode.Clamp),
    radial: (cx: number, cy: number, r: number, cols: RGBA[], pos: number[]) =>
      Skia.Shader.MakeRadialGradient(Skia.Point(cx, cy), r, cols.map(col), pos, TileMode.Clamp),
    blur: (s: number) => Skia.ImageFilter.MakeBlur(s, s, TileMode.Decal, null),
    blurBoost: (s: number, g: number[]) => Skia.ImageFilter.MakeColorFilter(
      Skia.ColorFilter.MakeMatrix([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, g[0], g[1]]),
      Skia.ImageFilter.MakeBlur(s, s, TileMode.Decal, null)),
    maskBlur: (s: number) => Skia.MaskFilter.MakeBlur(BlurStyle.Normal, s, true),
    path: (d: string) => paths[d] || (paths[d] = Skia.Path.MakeFromSVGString(d)!),
    bounds: (p: SkPath) => { const b = p.getBounds(); return [b.x, b.y, b.x + b.width, b.y + b.height]; },
    effect: (name: string, src: string) => effects[name] || (effects[name] = Skia.RuntimeEffect.Make(src)!),
    effectShader: (eff: SkRuntimeEffect, u: number[], children: any[]) => eff.makeShaderWithChildren(u, children),
    imageShader: (img: SkImage, a: number, tx: number, ty: number) => {
      const m = Skia.Matrix(); m.translate(tx, ty); m.scale(a, a);
      return img.makeShaderOptions(TileMode.Decal, TileMode.Decal, FilterMode.Linear, MipmapMode.None, m);
    },
    surface: (w: number, h: number) => {
      const s = Skia.Surface.Make(w, h)!;
      return { canvas: s.getCanvas(), snap: () => s.makeImageSnapshot() };
    },
    // system font (SF Pro on iOS) via Skia's paragraph API
    label: (c: SkCanvas, text: string, cx: number, base: number, size: number, weight: number, color: RGBA) => {
      const key = text + '|' + size + '|' + weight;
      let p = paras[key];
      if (!p) {
        const b = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Center });
        b.pushStyle({ color: col(color), fontSize: size, fontStyle: { weight } as any });
        b.addText(text);
        p = paras[key] = b.build();
        p.layout(200);
      }
      const asc = typeof p.getAlphabeticBaseline === 'function' ? p.getAlphabeticBaseline() : 0.952 * size;
      p.paint(c, cx - 100, base - asc);
    },
    endFrame: () => {},
  };
}

export type ToolbarMenuProps = {
  /** Rendered width in pt; the design width is 360 (height scales with it, 360:200). */
  width?: number;
  initialTab?: number;
  onTabChange?: (index: number) => void;
  onSelect?: (item: string) => void;
  onOpenChange?: (open: boolean) => void;
  /** Loop the interaction sequence from the reference video. */
  demo?: boolean;
  /** Render one instant of the demo sequence (ms); used by tests and screenshots. */
  frozenT?: number;
  /** Paint the reference stage background behind the component. */
  showStage?: boolean;
  style?: ViewStyle;
};

const IDLE_AFTER = 1200; // ms after the last input before the frame loop sleeps

export default function ToolbarMenu({
  width = Core.LW, initialTab = 0, onTabChange, onSelect, onOpenChange, demo = false, frozenT, showStage = false, style,
}: ToolbarMenuProps) {
  const k = width / Core.LW;
  const height = Core.LH * k;
  const A = useMemo(makeRNAdapter, []);
  const assets = useMemo(() => {
    const scale = PixelRatio.get() * k * 1.1;
    const a: any = Core.bake(A, scale);
    a.tiles = Core.bakeTiles(A, scale);
    return a;
  }, [A, k]);
  const S = useRef<any>(null);
  if (!S.current) { S.current = Core.makeState(); S.current.tab = initialTab; }
  const t0 = useRef(Date.now());
  const lastInput = useRef(-1e9);
  const now = () => Date.now() - t0.current;

  const record = (t: number): SkPicture => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    c.scale(k, k);
    if (showStage) Core.drawBackground(c, A, Core.STAGE, Core.STAGE, Core.STAGE_OY);
    const st = frozenT != null || demo ? Core.demoState(t % Core.DEMO_LEN) : S.current;
    Core.draw(c, A, Core.frame(st, t % (demo || frozenT != null ? Core.DEMO_LEN : Infinity)), assets);
    return rec.finishRecordingAsPicture();
  };
  const [picture, setPicture] = useState<SkPicture>(() => record(frozenT ?? 0));

  // frame loop: always on in demo mode, otherwise only while something is animating
  const raf = useRef<number | null>(null);
  const loop = () => {
    const t = now();
    setPicture(record(t));
    if (demo || t - lastInput.current < IDLE_AFTER) raf.current = requestAnimationFrame(loop);
    else raf.current = null;
  };
  const wake = () => { if (raf.current == null && frozenT == null) raf.current = requestAnimationFrame(loop); };
  useEffect(() => {
    if (frozenT != null) { setPicture(record(frozenT)); return; }
    if (demo) wake();
    return () => { if (raf.current != null) cancelAnimationFrame(raf.current); raf.current = null; };
  }, [demo, frozenT, width, assets]);

  const onDown = (e: GestureResponderEvent) => {
    if (demo || frozenT != null) return;
    const t = now();
    Core.down(S.current, e.nativeEvent.locationX / k, e.nativeEvent.locationY / k, t);
    lastInput.current = t; wake();
  };
  const onUp = () => {
    if (demo || frozenT != null) return;
    const st = S.current, t = now();
    const wasOpen = st.open, tab = st.tab, tile = st.tile && st.tile.up == null ? st.tile.i : -1;
    Core.up(st, t);
    lastInput.current = t; wake();
    if (st.open !== wasOpen) onOpenChange?.(st.open);
    if (st.tab !== tab) onTabChange?.(st.tab);
    if (tile >= 0) onSelect?.(Core.ITEMS[tile]);
  };

  return (
    <View
      style={[{ width, height }, style]}
      accessibilityRole="toolbar"
      onStartShouldSetResponder={() => true}
      onResponderGrant={onDown}
      onResponderRelease={onUp}
      onResponderTerminate={onUp}
    >
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}
