// Skia layers for Feel Deck: the card art (blurred photo + ASCII type + clear photo) and the sheet photo.
// Expo-compatible: @shopify/react-native-skia ships in Expo Go.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Canvas, Group, Image as SkImage, useImage, Blur, Rect, LinearGradient, vec, Picture, Skia, createPicture, matchFont,
  type SkFont,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { L, ASCII_RAMP, ASCII_CELL, FLICKER_MS, flickerAt, cropPlace, clamp } from './feelCore.js';
import { ASCII_GRIDS } from './asciiGrids.js';

const CI = L.cardIn;
const CW = L.card.w;

let fallbackFont: SkFont | null = null;
function asciiFont(custom?: SkFont | null): SkFont {
  if (custom) return custom;
  if (!fallbackFont) fallbackFont = matchFont({ fontFamily: 'Menlo', fontSize: ASCII_CELL.size, fontWeight: '500' });
  return fallbackFont;
}

// one picture of the whole character field at flicker tick k (same rule as the HTML canvas)
function asciiPicture(key: string, k: number, font: SkFont) {
  const g = (ASCII_GRIDS as any)[key];
  return createPicture((canvas) => {
    const paint = Skia.Paint();
    for (let r = 0; r < g.rows; r++) {
      const y = (r + 0.5) * ASCII_CELL.h;
      const fade = y < 150 ? 1 : clamp(1 - (y - 150) / 70, 0, 1);
      if (fade <= 0) continue;
      for (let c = 0; c < g.cols; c++) {
        const i = r * g.cols + c;
        let lv = parseInt(g.lv[i], 16);
        if (!lv) continue;
        lv = clamp(lv + flickerAt(k, i), 1, 10);
        paint.setColor(Skia.Color('#' + g.col.substr(i * 6, 6)));
        paint.setAlphaf(Math.min(1, 0.42 + 0.06 * lv) * fade);
        const ch = ASCII_RAMP[lv];
        const w = font.getTextWidth(ch);
        // HTML draws with textBaseline 'middle' → baseline ≈ y + 0.35 em
        canvas.drawText(ch, (c + 0.5) * ASCII_CELL.w - w / 2, y + ASCII_CELL.size * 0.35, paint, font);
      }
    }
  });
}

export function CardArt(props: {
  source: number; imgKey: string; crop: number[]; clear: SharedValue<number> | number; live: boolean; frozen?: boolean; font?: SkFont | null;
}) {
  const { source, imgKey, crop, clear, live, frozen, font } = props;
  const img = useImage(source);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!live || frozen) return;
    const id = setInterval(() => setTick(Math.floor(Date.now() / FLICKER_MS)), FLICKER_MS);
    return () => clearInterval(id);
  }, [live, frozen]);
  const f = asciiFont(font);
  const pic = useMemo(() => asciiPicture(imgKey, tick, f), [imgKey, tick, f]);
  const cp = cropPlace(crop, CW);
  const H = CI.imgH;
  return (
    <Canvas style={{ position: 'absolute', left: 0, top: 0, width: CW, height: H }} pointerEvents="none">
      {/* blurred photo, faded out toward the text */}
      <Group layer>
        <Group transform={[{ translateX: CW / 2 }, { translateY: H * 0.3 }, { scale: 1.08 }, { translateX: -CW / 2 }, { translateY: -H * 0.3 }]}>
          {img && <SkImage image={img} x={cp.x} y={cp.y} width={cp.size} height={cp.size} fit="fill"><Blur blur={13} mode="clamp" /></SkImage>}
        </Group>
        <Rect x={0} y={0} width={CW} height={H} blendMode="dstIn">
          <LinearGradient start={vec(0, CI.fadeA + 20)} end={vec(0, CI.fadeB + 20)} colors={['#000000', '#00000000']} />
        </Rect>
      </Group>
      <Picture picture={pic} />
      {/* clear photo (shown while the sheet is open and right after it is thrown away) */}
      <Group layer opacity={clear as any}>
        {img && <SkImage image={img} x={cp.x} y={cp.y} width={cp.size} height={cp.size} fit="fill" />}
        <Rect x={0} y={0} width={CW} height={H} blendMode="dstIn">
          <LinearGradient start={vec(0, CI.fadeA + 40)} end={vec(0, CI.fadeB + 30)} colors={['#000000', '#00000000']} />
        </Rect>
      </Group>
    </Canvas>
  );
}

export function SheetPhoto({ source }: { source: number }) {
  const P = L.sheet.photo;
  const img = useImage(source);
  return (
    <Canvas style={{ position: 'absolute', left: P.x, top: P.y - L.sheet.top, width: P.w, height: P.h }} pointerEvents="none">
      <Group layer clip={Skia.RRectXY(Skia.XYWHRect(0, 0, P.w, P.h), P.r, P.r)}>
        {img && <SkImage image={img} x={0} y={0} width={P.w} height={P.h} fit="cover" />}
        <Rect x={0} y={0} width={P.w} height={P.h} blendMode="dstIn">
          <LinearGradient start={vec(0, P.h * 0.55)} end={vec(0, P.h * 0.9)} colors={['#000000', '#00000000']} />
        </Rect>
      </Group>
    </Canvas>
  );
}
