import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LASTFE_FACETS,
  LASTFE_PALETTES,
  LASTFE_PERCHED_BUTTERFLY_POLYS,
  LASTFE_PERCHED_BUTTERFLY_TRANSFORM,
  LASTFE_STAR_POINTS,
  LASTFE_VIEWBOX_H,
  LASTFE_VIEWBOX_MIN_Y,
  LASTFE_VIEWBOX_W,
  LastFeOrigamiLogo,
} from './LastFeOrigamiLogo';
import { isLowPowerDevice } from '../utils/perfTier';

export interface SakugaSumieIntroProps {
  targetLogoRef: React.RefObject<HTMLSpanElement>;
  onBeginReveal: () => void;
  onComplete: () => void;
}

type IntroPhase = 'idle' | 'drop' | 'ascend' | 'surge' | 'shatter_converge' | 'glide';

interface WaterBrushStroke {
  baseXFrac: number;
  yNorm: number;
  widthFrac: number;
  maxHalfW: number;
  waveAmp: number;
  driftSpeed: number;
  waveSpeed: number;
  phase: number;
  toneIdx: 0 | 1 | 2;
}

interface FloatingLakePetal {
  baseXFrac: number;
  yNorm: number;
  variant: 0 | 1 | 2;
  scale: number;
  rot: number;
  flowSpeed: number;
  spinRate: number;
  bobPhase: number;
  bobAmp: number;
  driftAmp: number;
  pushedX: number;
  pushedY: number;
  targetPushedX: number;
  targetPushedY: number;
}

interface InkRipple {
  x: number;
  y: number;
  ageMs: number;
  durationMs: number;
  maxRx: number;
  strokeWidth: number;
  rotOffset: number;
}

interface SplashBead {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  durationMs: number;
  size: number;
}

interface WindWisp {
  xFrac: number;
  yFrac: number;
  len: number;
  speed: number;
  alpha: number;
}

interface BurstMiniState {
  dirX: number;
  dirY: number;
  radiusFactor: number;
  scale: number;
  targetXFrac: number;
  targetYFrac: number;
  flapPhase: number;
  variant: 0 | 1 | 2;
  isPerchedHero: boolean;
  flightSpan: number;
  arcSign: 1 | -1;
}

interface FacetBurstState {
  dirX: number;
  dirY: number;
  radiusFactor: number;
  rotStart: number;
  burstScale: number;
  arcSign: 1 | -1;
  arcBulge: number;
  flightSpan: number;
  sparkOnLock: boolean;
}

interface BurstMoteState {
  angle: number;
  radiusFactor: number;
  size: number;
  isStar: boolean;
  colorIdx: number;
}

interface GlideRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const TAU = Math.PI * 2;
const DROP_IMPACT_MS = 260;
const DROP_TOTAL_MS = 540;
const ASCEND_DURATION_MS = 1560;
const SURGE_DURATION_MS = 380;
const SHATTER_CONVERGE_DURATION_MS = 2550;

const LIGHT_MOTE_COLORS = ['#4338CA', '#7C3AED', '#0284C7', '#DB2777'] as const;
const DARK_MOTE_COLORS = ['#FFFFFF', '#E0F2FE', '#DDD6FE', '#F472B6'] as const;

const BUTTERFLY_FACETS = [
  { pts: [[18, 14], [1.5, 5], [12, 18]], light: '#312E81', dark: '#FFFFFF' },
  { pts: [[18, 14], [12, 18], [17.4, 19]], light: '#4F46E5', dark: '#DDD6FE' },
  { pts: [[17.6, 18], [8.5, 20], [12.2, 31.5]], light: '#1E1B4B', dark: '#F5F3FF' },
  { pts: [[17.6, 18], [12.2, 31.5], [16.2, 24.5]], light: '#DB2777', dark: '#F472B6' },
  { pts: [[18, 14], [34.5, 5], [24, 18]], light: '#3730A3', dark: '#FFFFFF' },
  { pts: [[18, 14], [24, 18], [18.6, 19]], light: '#6D28D9', dark: '#E0E7FF' },
  { pts: [[18.4, 18], [27.5, 20], [23.8, 31.5]], light: '#1E1B4B', dark: '#FFFFFF' },
  { pts: [[18.4, 18], [23.8, 31.5], [19.8, 24.5]], light: '#0284C7', dark: '#C4B5FD' },
] as const;

const PETAL_SHAPES: Record<
  0 | 1 | 2,
  readonly { pts: readonly (readonly [number, number])[]; light: string; dark: string }[]
> = {
  0: [
    { pts: [[14, 7.5], [4.5, 2.5], [5.5, 16.5]], light: '#312E81', dark: '#FFFFFF' },
    { pts: [[14, 7.5], [5.5, 16.5], [13.5, 19]], light: '#4F46E5', dark: '#DDD6FE' },
    { pts: [[14, 7.5], [23.5, 3], [22, 15.5]], light: '#7C3AED', dark: '#F5F3FF' },
    { pts: [[14, 7.5], [22, 15.5], [14.5, 19]], light: '#6D28D9', dark: '#C4B5FD' },
    { pts: [[13.5, 19], [5.5, 16.5], [13.5, 30]], light: '#1E1B4B', dark: '#EDE9FE' },
    { pts: [[14.5, 19], [22, 15.5], [13.5, 30]], light: '#DB2777', dark: '#F472B6' },
  ],
  1: [
    { pts: [[15, 4], [6, 7], [7.5, 17]], light: '#4F46E5', dark: '#FFFFFF' },
    { pts: [[15, 4], [23, 6.5], [19.5, 16]], light: '#312E81', dark: '#E0F2FE' },
    { pts: [[15, 4], [7.5, 17], [19.5, 16]], light: '#6D28D9', dark: '#DDD6FE' },
    { pts: [[7.5, 17], [13, 20.5], [12, 29]], light: '#DB2777', dark: '#FBCFE8' },
    { pts: [[19.5, 16], [13, 20.5], [12, 29]], light: '#1E1B4B', dark: '#C4B5FD' },
    { pts: [[15, 9], [13, 20.5], [17, 15]], light: '#0284C7', dark: '#FFFFFF' },
  ],
  2: [
    { pts: [[13, 3], [5, 9], [9.5, 16]], light: '#BE185D', dark: '#FCE7F3' },
    { pts: [[13, 3], [22, 8], [15.5, 17]], light: '#312E81', dark: '#FFFFFF' },
    { pts: [[13, 3], [9.5, 16], [15.5, 17]], light: '#7C3AED', dark: '#DDD6FE' },
    { pts: [[9.5, 16], [15.5, 17], [16.5, 29.5]], light: '#4F46E5', dark: '#F9A8D4' },
    { pts: [[15.5, 17], [21.5, 18], [16.5, 29.5]], light: '#DB2777', dark: '#F472B6' },
  ],
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  const delta = ((b - a + Math.PI * 3) % TAU) - Math.PI;
  return a + delta * clamp(t, 0, 1);
}

function easeOutCubic(t: number): number {
  const k = 1 - clamp(t, 0, 1);
  return 1 - k * k * k;
}

function easeOutQuart(t: number): number {
  const k = 1 - clamp(t, 0, 1);
  const k2 = k * k;
  return 1 - k2 * k2;
}

function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Strictly monotonic C-infinity curve: energetic burst out of center, wide slow-mo outer hang,
 * graceful accelerating swoop inward, and zero-velocity velvet landing at u = 1.
 */
function burstSwoopWarp(t: number): number {
  const x = clamp(t, 0, 1);
  const g = x + 0.1 * Math.sin(TAU * x);
  return Math.sin(g * Math.PI * 0.5);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function cubicBezier(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const mt = 1 - u;
  const mt2 = mt * mt;
  const u2 = u * u;
  return mt2 * mt * p0 + 3 * mt2 * u * p1 + 3 * mt * u2 * p2 + u2 * u * p3;
}

function cubicBezierDeriv(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const mt = 1 - u;
  return 3 * mt * mt * (p1 - p0) + 6 * mt * u * (p2 - p1) + 3 * u * u * (p3 - p2);
}

function getViewportMetrics(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: 1280, h: 720 };
  return {
    w: Math.round(window.visualViewport?.width ?? window.innerWidth),
    h: Math.round(window.visualViewport?.height ?? window.innerHeight),
  };
}

function getSpreadRadii(vw: number, vh: number): { spreadX: number; spreadY: number } {
  if (vw < 640) {
    return {
      spreadX: clamp(vw * 0.44, 115, 200),
      spreadY: clamp(vh * 0.28, 130, 235),
    };
  }
  const spreadBase = clamp(Math.min(vw, vh) * 0.38, 125, 310);
  return { spreadX: spreadBase * 1.38, spreadY: spreadBase * 0.92 };
}

function getFacetBurstTarget(
  fb: FacetBurstState,
  cx: number,
  cy: number,
  vw: number,
  vh: number,
  spreadX: number,
  spreadY: number
): { x: number; y: number } {
  return {
    x: clamp(cx + fb.dirX * spreadX * fb.radiusFactor, 36, vw - 36),
    y: clamp(cy + fb.dirY * spreadY * fb.radiusFactor - 12, 44, vh - 44),
  };
}

function getMiniBurstTarget(
  mb: BurstMiniState,
  cx: number,
  cy: number,
  vw: number,
  vh: number,
  spreadX: number,
  spreadY: number
): { x: number; y: number } {
  return {
    x: clamp(cx + mb.dirX * spreadX * mb.radiusFactor, 40, vw - 40),
    y: clamp(cy + mb.dirY * spreadY * mb.radiusFactor - 10, 48, vh - 48),
  };
}

function isDarkModeActive(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

const BRUSH_SEGS = 10;
const BRUSH_TOP_X = new Float32Array(BRUSH_SEGS + 1);
const BRUSH_TOP_Y = new Float32Array(BRUSH_SEGS + 1);
const BRUSH_BOT_X = new Float32Array(BRUSH_SEGS + 1);
const BRUSH_BOT_Y = new Float32Array(BRUSH_SEGS + 1);

/**
 * Draws a tapered, dry-brush sumi-e calligraphy stroke smoothly along an undulating curve.
 * Uses preallocated Float32Array scratch buffers and solid polygon fills (0 allocations/frame).
 */
function drawSumiBrushStroke(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spanW: number,
  maxHalfW: number,
  wavePhase: number,
  color: string,
  waveAmp = maxHalfW * 0.85
): void {
  const halfLen = spanW * 0.5;

  for (let i = 0; i <= BRUSH_SEGS; i++) {
    const u = i / BRUSH_SEGS;
    const x = cx - halfLen + u * spanW;
    const waveY = cy + Math.sin(u * Math.PI * 2 + wavePhase) * waveAmp;
    const taper = Math.sin(u * Math.PI);
    const hw = maxHalfW * (0.14 + 0.86 * taper) * (0.82 + 0.18 * Math.cos(u * 9 + wavePhase));
    BRUSH_TOP_X[i] = x;
    BRUSH_TOP_Y[i] = waveY - hw;
    BRUSH_BOT_X[i] = x;
    BRUSH_BOT_Y[i] = waveY + hw * 0.85;
  }

  ctx.beginPath();
  ctx.moveTo(BRUSH_TOP_X[0], BRUSH_TOP_Y[0]);
  for (let i = 1; i <= BRUSH_SEGS; i++) {
    ctx.lineTo(BRUSH_TOP_X[i], BRUSH_TOP_Y[i]);
  }
  for (let i = BRUSH_SEGS; i >= 0; i--) {
    ctx.lineTo(BRUSH_BOT_X[i], BRUSH_BOT_Y[i]);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawCalligraphyEllipseRipple(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotOffset: number,
  lineWidth: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0.12 + rotOffset, 2.35 + rotOffset);
  ctx.lineWidth = Math.max(0.55, lineWidth);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 2.65 + rotOffset, 4.95 + rotOffset);
  ctx.lineWidth = Math.max(0.55, lineWidth * 0.72);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 5.18 + rotOffset, 6.08 + rotOffset);
  ctx.lineWidth = Math.max(0.55, lineWidth * 0.48);
  ctx.stroke();
}

function drawOrigamiPetalCanvas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  variant: 0 | 1 | 2,
  scale: number,
  rotRad: number,
  isDark: boolean,
  creaseColor: string
): void {
  const facets = PETAL_SHAPES[variant];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotRad);
  ctx.scale(scale, scale);

  for (let i = 0; i < facets.length; i++) {
    const f = facets[i];
    ctx.beginPath();
    ctx.moveTo(f.pts[0][0] - 14, f.pts[0][1] - 16);
    for (let j = 1; j < f.pts.length; j++) {
      ctx.lineTo(f.pts[j][0] - 14, f.pts[j][1] - 16);
    }
    ctx.closePath();
    ctx.fillStyle = isDark ? f.dark : f.light;
    ctx.fill();
    if (!isDark) {
      ctx.strokeStyle = creaseColor;
      ctx.lineWidth = 0.45;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  rot = 0
): void {
  const ir = r * 0.28;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(ir, -ir);
  ctx.lineTo(r, 0);
  ctx.lineTo(ir, ir);
  ctx.lineTo(0, r);
  ctx.lineTo(-ir, ir);
  ctx.lineTo(-r, 0);
  ctx.lineTo(-ir, -ir);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function drawOrigamiButterfly3D(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  headingRad: number,
  wingDeg: number,
  isDark: boolean,
  creaseColor: string,
  alpha = 1,
  auraAlpha = 1
): void {
  const wingRad = (wingDeg * Math.PI) / 180;
  const flapScaleX = Math.max(0.18, Math.cos(wingRad));
  const tipLiftY = Math.sin(wingRad) * 0.16;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.rotate(headingRad);
  ctx.scale(scale, scale);

  if (auraAlpha > 0.02) {
    ctx.save();
    ctx.globalAlpha *= auraAlpha;
    ctx.beginPath();
    ctx.moveTo(0, -16 * flapScaleX - 4);
    ctx.lineTo(18 * flapScaleX + 4, 0);
    ctx.lineTo(0, 16 * flapScaleX + 4);
    ctx.lineTo(-18 * flapScaleX - 4, 0);
    ctx.closePath();
    ctx.fillStyle = isDark ? 'rgba(196, 181, 253, 0.22)' : 'rgba(99, 102, 241, 0.16)';
    ctx.fill();
    ctx.restore();
  }

  for (let i = 0; i < BUTTERFLY_FACETS.length; i++) {
    const facet = BUTTERFLY_FACETS[i];
    ctx.beginPath();
    for (let j = 0; j < facet.pts.length; j++) {
      const rx = facet.pts[j][0] - 18;
      const ry = facet.pts[j][1] - 17;
      const sx = rx * flapScaleX;
      const sy = ry - Math.abs(rx) * tipLiftY;
      if (j === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fillStyle = isDark ? facet.dark : facet.light;
    ctx.fill();
    if (!isDark) {
      ctx.strokeStyle = creaseColor;
      ctx.lineWidth = 0.45;
      ctx.stroke();
    }
  }

  // Center spine diamond
  ctx.beginPath();
  ctx.moveTo(0, -5.5);
  ctx.lineTo(0.85, 0);
  ctx.lineTo(0, 5);
  ctx.lineTo(-0.85, 0);
  ctx.closePath();
  ctx.fillStyle = isDark ? '#FFFFFF' : '#0F172A';
  ctx.fill();

  ctx.restore();
}

function buildWaterStrokes(lowPower: boolean): WaterBrushStroke[] {
  const count = lowPower ? 11 : 16;
  return Array.from({ length: count }, (_, i) => {
    const t = i / Math.max(1, count - 1);
    const yNorm = 0.41 + t * 0.55;
    const depth = (yNorm - 0.41) / 0.55;
    return {
      baseXFrac: 0.12 + ((i * 0.29) % 0.76),
      yNorm,
      widthFrac: 0.14 + t * 0.24 + ((i % 3) * 0.04),
      maxHalfW: 0.85 + t * 1.9,
      waveAmp: 2.2 + depth * 3.6,
      driftSpeed: 14 + depth * 42,
      waveSpeed: 1.35 + (i % 5) * 0.28,
      phase: i * 1.47,
      toneIdx: (i % 3) as 0 | 1 | 2,
    };
  });
}

function buildLakePetals(lowPower: boolean): FloatingLakePetal[] {
  const presets: readonly { x: number; y: number; rot: number; scale: number }[] = [
    { x: 0.14, y: 0.53, rot: -0.45, scale: 0.56 },
    { x: 0.84, y: 0.5, rot: 0.52, scale: 0.54 },
    { x: 0.22, y: 0.76, rot: 0.28, scale: 0.68 },
    { x: 0.76, y: 0.79, rot: -0.36, scale: 0.7 },
    { x: 0.1, y: 0.88, rot: 0.82, scale: 0.76 },
    { x: 0.9, y: 0.64, rot: -0.78, scale: 0.62 },
    { x: 0.34, y: 0.59, rot: 0.65, scale: 0.52 },
    { x: 0.66, y: 0.57, rot: -0.58, scale: 0.52 },
    { x: 0.42, y: 0.85, rot: -0.22, scale: 0.74 },
    { x: 0.62, y: 0.89, rot: 0.41, scale: 0.72 },
    { x: 0.28, y: 0.46, rot: 0.18, scale: 0.46 },
    { x: 0.73, y: 0.44, rot: -0.24, scale: 0.46 },
  ];
  const count = lowPower ? 7 : 12;
  return presets.slice(0, count).map((p, i) => {
    const depth = clamp((p.y - 0.41) / 0.55, 0, 1);
    return {
      baseXFrac: p.x,
      yNorm: p.y,
      variant: (i % 3) as 0 | 1 | 2,
      scale: p.scale,
      rot: p.rot,
      flowSpeed: 10 + depth * 22,
      spinRate: (i % 2 === 0 ? 1 : -1) * (0.08 + (i % 3) * 0.04),
      bobPhase: i * 1.31,
      bobAmp: 2.6 + (i % 3) * 1.1,
      driftAmp: 6 + (i % 3) * 3,
      pushedX: 0,
      pushedY: 0,
      targetPushedX: 0,
      targetPushedY: 0,
    };
  });
}

function buildWindWisps(): WindWisp[] {
  return Array.from({ length: 8 }, (_, i) => ({
    xFrac: 0.08 + ((i * 0.137) % 0.84),
    yFrac: (i * 0.17) % 1,
    len: 28 + (i % 4) * 18,
    speed: 0.55 + (i % 3) * 0.2,
    alpha: 0.11 + (i % 3) * 0.05,
  }));
}

function buildBurstMinis(lowPower: boolean): BurstMiniState[] {
  const count = lowPower ? 5 : 7;
  const letterTargets = [
    { x: 0.1, y: 0.48 },
    { x: 0.25, y: 0.56 },
    { x: 0.41, y: 0.58 },
    { x: 0.53, y: 0.46 },
    { x: 0.68, y: 0.46 },
    { x: 0.86, y: 0.52 },
  ];

  const items: BurstMiniState[] = [];
  for (let i = 0; i < count; i++) {
    const isHero = i === count - 1;
    const target = letterTargets[i % letterTargets.length];
    const angle = isHero
      ? -0.45 + (Math.random() - 0.5) * 0.25
      : (i / (count - 1)) * TAU + 0.3 + (Math.random() - 0.5) * 0.35;
    items.push({
      dirX: Math.cos(angle),
      dirY: Math.sin(angle),
      radiusFactor: isHero ? 0.96 : 0.68 + Math.random() * 0.42,
      scale: isHero ? 0.92 : 0.6 + (i % 3) * 0.12,
      targetXFrac: target.x,
      targetYFrac: target.y,
      flapPhase: i * 1.15,
      variant: (i % 3) as 0 | 1 | 2,
      isPerchedHero: isHero,
      flightSpan: isHero ? 0.83 : 0.62 + Math.random() * 0.16,
      arcSign: i % 2 === 0 ? 1 : -1,
    });
  }
  return items;
}

function buildFacetBursts(): FacetBurstState[] {
  return LASTFE_FACETS.map((facet, idx) => {
    const angle = idx * 2.39996 + (facet.letterIdx - 2.5) * 0.2 + (Math.random() - 0.5) * 0.55;
    return {
      dirX: Math.cos(angle),
      dirY: Math.sin(angle),
      radiusFactor: 0.54 + Math.random() * 0.58,
      rotStart: (idx % 2 === 0 ? 1 : -1) * (0.9 + (idx % 5) * 0.48),
      burstScale: 0.62 + (idx % 3) * 0.14,
      arcSign: Math.random() < 0.5 ? 1 : -1,
      arcBulge: 38 + Math.random() * 48,
      flightSpan: 0.58 + Math.random() * 0.24,
      sparkOnLock: (idx % 2 === 0 && Math.random() < 0.75) || Math.random() < 0.35,
    };
  });
}

function buildBurstMotes(lowPower: boolean): BurstMoteState[] {
  const count = lowPower ? 10 : 16;
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * TAU + (Math.random() - 0.5) * 0.28,
    radiusFactor: 0.52 + Math.random() * 0.76,
    size: 2.2 + (i % 3) * 1.1,
    isStar: i % 3 === 0,
    colorIdx: i % 4,
  }));
}

export const SakugaSumieIntro: React.FC<SakugaSumieIntroProps> = ({
  targetLogoRef,
  onBeginReveal,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const finishedRef = useRef(false);
  const phaseRef = useRef<IntroPhase>('idle');
  const startGlideRef = useRef<((rect: GlideRect) => void) | null>(null);

  const onBeginRevealRef = useRef(onBeginReveal);
  onBeginRevealRef.current = onBeginReveal;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [isPromptVisible, setIsPromptVisible] = useState(true);
  const [glideRect, setGlideRect] = useState<GlideRect | null>(null);
  const [flipTransform, setFlipTransform] = useState('translate3d(0px, 0px, 0px) scale(1)');
  const [curtainTransparent, setCurtainTransparent] = useState(false);

  const triggerDropRef = useRef<((clientX?: number, clientY?: number) => void) | null>(null);

  const handleSkip = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onBeginRevealRef.current();
    onCompleteRef.current();
  }, []);

  // Lock page scrolling during Intro & restore cleanly on unmount
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Space / Escape skips cleanly; Enter starts drop when idle
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'Enter' && phaseRef.current === 'idle') {
        e.preventDefault();
        triggerDropRef.current?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleSkip]);

  // Execute seamless FLIP handoff once assembled LastFE DOM logo paints over exact Canvas rect
  useEffect(() => {
    if (!glideRect) return;

    let raf1 = 0;
    let raf2 = 0;
    let doneTimer = 0;

    raf1 = window.requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      const targetRect = targetLogoRef.current?.getBoundingClientRect();
      const hasValidTarget = targetRect && targetRect.width > 12;
      const destLeft = hasValidTarget ? targetRect.left : 54;
      const destTop = hasValidTarget ? targetRect.top : 14;
      const destW = hasValidTarget ? targetRect.width : Math.round(glideRect.width * 0.34);

      const dx = destLeft - glideRect.left;
      const dy = destTop - glideRect.top;
      const scale = destW / glideRect.width;

      raf2 = window.requestAnimationFrame(() => {
        if (finishedRef.current) return;
        setFlipTransform(`translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0px) scale(${scale.toFixed(4)})`);
        setCurtainTransparent(true);
        onBeginRevealRef.current();

        doneTimer = window.setTimeout(() => {
          if (!finishedRef.current) {
            finishedRef.current = true;
            onCompleteRef.current();
          }
        }, 700);
      });
    });

    return () => {
      if (raf1 !== 0) window.cancelAnimationFrame(raf1);
      if (raf2 !== 0) window.cancelAnimationFrame(raf2);
      if (doneTimer !== 0) window.clearTimeout(doneTimer);
    };
  }, [glideRect, targetLogoRef]);

  // Single 2D Canvas animation loop driving Beats 1..5 continuously with zero phase seams
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const lowPower = isLowPowerDevice();
    let { w: vw, h: vh } = getViewportMetrics();
    let dpr = lowPower ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);

    const waterStrokes = buildWaterStrokes(lowPower);
    const lakePetals = buildLakePetals(lowPower);
    const windWisps = buildWindWisps();
    const burstMinis = buildBurstMinis(lowPower);
    const facetBursts = buildFacetBursts();
    const burstMotes = buildBurstMotes(lowPower);

    const ripples: InkRipple[] = [];
    const splashes: SplashBead[] = [];

    let phaseStartMs = performance.now();
    let prevFrameMs = phaseStartMs;
    let lastDrawMs = 0;
    let hiddenAtMs = 0;
    let totalTimeMs = 0;

    let dropX = vw * 0.5;
    let dropY = vh * 0.62;
    let dropImpacted = false;

    let surgeStartX = vw * 0.5;
    let surgeStartY = vh * 0.48;
    let surgeStartHeading = 0;
    let surgeStartWingDeg = 12;
    let shatterCenterY = vh * 0.4;

    let glideTriggered = false;
    let rafId = 0;

    const syncSize = () => {
      const next = getViewportMetrics();
      vw = next.w;
      vh = next.h;
      dpr = lowPower ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.max(1, Math.round(vw * dpr));
      canvas.height = Math.max(1, Math.round(vh * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (phaseRef.current === 'idle') {
        dropX = vw * 0.5;
        dropY = vh * 0.62;
      }
    };

    syncSize();
    window.addEventListener('resize', syncSize, { passive: true });
    window.visualViewport?.addEventListener('resize', syncSize, { passive: true });

    const computeIntroRect = (): GlideRect => {
      const introW = clamp(Math.round(vw * (vw < 640 ? 0.56 : 0.34)), 176, 252);
      const introH = introW * (LASTFE_VIEWBOX_H / LASTFE_VIEWBOX_W);
      return {
        left: (vw - introW) * 0.5,
        top: (vh - introH) * 0.5,
        width: introW,
        height: introH,
      };
    };

    const spawnWaterImpact = (ix: number, iy: number) => {
      ripples.push(
        { x: ix, y: iy, ageMs: 0, durationMs: 1350, maxRx: clamp(vw * 0.24, 95, 195), strokeWidth: 2.3, rotOffset: 0.1 },
        { x: ix, y: iy, ageMs: -75, durationMs: 1450, maxRx: clamp(vw * 0.32, 125, 250), strokeWidth: 1.7, rotOffset: 1.4 },
        { x: ix, y: iy, ageMs: -155, durationMs: 1500, maxRx: clamp(vw * 0.4, 155, 305), strokeWidth: 1.2, rotOffset: 2.7 },
        { x: ix, y: iy, ageMs: -230, durationMs: 1550, maxRx: clamp(vw * 0.46, 175, 345), strokeWidth: 0.85, rotOffset: 4.1 }
      );

      for (let i = 0; i < 7; i++) {
        const spread = ((i - 3) / 3) * (36 + (i % 2) * 18);
        splashes.push({
          x: ix + spread * 0.18,
          y: iy,
          vx: spread,
          vy: -(62 + (i % 3) * 28),
          ageMs: 0,
          durationMs: 420 + (i % 3) * 70,
          size: 1.8 + (i % 2) * 0.9,
        });
      }

      // Smoothly nudge lake petals outward from drop impact
      const wrapW = vw + 72;
      for (let i = 0; i < lakePetals.length; i++) {
        const p = lakePetals[i];
        const tSecNow = totalTimeMs * 0.001;
        const curX = (((p.baseXFrac * vw + tSecNow * p.flowSpeed + 36) % wrapW) + wrapW) % wrapW - 36;
        const py = p.yNorm * vh;
        const dx = curX - ix;
        const dy = py - iy;
        const dist = Math.hypot(dx, dy) || 1;
        const impulse = clamp(1 - dist / (vw * 0.58), 0.16, 1) * 18;
        p.targetPushedX = (dx / dist) * impulse;
        p.targetPushedY = (dy / dist) * impulse * 0.48;
      }
    };

    triggerDropRef.current = (clientX?: number, clientY?: number) => {
      if (phaseRef.current !== 'idle' || finishedRef.current) return;
      const targetX = clientX ?? vw * 0.5;
      const targetY = clientY ?? vh * 0.62;
      dropX = clamp(targetX, vw * 0.3, vw * 0.7);
      dropY = clamp(targetY, vh * 0.5, vh * 0.72);
      dropImpacted = false;
      phaseRef.current = 'drop';
      phaseStartMs = performance.now();
      setIsPromptVisible(false);
    };

    startGlideRef.current = (rect: GlideRect) => {
      if (glideTriggered || finishedRef.current) return;
      glideTriggered = true;
      phaseRef.current = 'glide';
      setGlideRect(rect);
    };

    const drawLakeLayer = (
      nowMs: number,
      dtSec: number,
      tSec: number,
      camY: number,
      waterAlpha: number,
      isDark: boolean,
      creaseColor: string
    ) => {
      if (waterAlpha <= 0.005 || camY > vh * 0.99) return;

      ctx.save();
      ctx.globalAlpha = waterAlpha;
      ctx.translate(0, camY);

      const horizonY = vh * 0.36;
      const horizonSway = Math.sin(tSec * 0.28) * 14;
      const inkColors = isDark
        ? ['rgba(196, 181, 253, 0.18)', 'rgba(148, 163, 184, 0.14)', 'rgba(224, 242, 254, 0.11)']
        : ['rgba(30, 27, 75, 0.15)', 'rgba(67, 56, 202, 0.13)', 'rgba(49, 46, 129, 0.10)'];

      // Distant calligraphy horizon brush wash with gentle current sway
      drawSumiBrushStroke(
        ctx,
        vw * 0.5 + horizonSway * 0.5,
        horizonY,
        vw * 0.88,
        3.2,
        tSec * 0.35,
        isDark ? 'rgba(196, 181, 253, 0.14)' : 'rgba(30, 27, 75, 0.13)',
        2.2
      );
      drawSumiBrushStroke(
        ctx,
        vw * 0.28 + horizonSway,
        horizonY - 5,
        vw * 0.28,
        4.6,
        0.8 + tSec * 0.2,
        isDark ? 'rgba(148, 163, 184, 0.09)' : 'rgba(49, 46, 129, 0.08)',
        1.8
      );
      drawSumiBrushStroke(
        ctx,
        vw * 0.74 + horizonSway * 0.75,
        horizonY - 4,
        vw * 0.24,
        4.1,
        2.1 + tSec * 0.2,
        isDark ? 'rgba(148, 163, 184, 0.09)' : 'rgba(49, 46, 129, 0.08)',
        1.8
      );

      // Coherent left-to-right flowing sumi-e water strokes with depth parallax
      for (let i = 0; i < waterStrokes.length; i++) {
        const s = waterStrokes[i];
        const spanW = s.widthFrac * vw;
        const wrapW = vw + spanW;
        const rawX = ((s.baseXFrac * vw + tSec * s.driftSpeed) % wrapW + wrapW) % wrapW - spanW * 0.5;
        const y = s.yNorm * vh + Math.sin(tSec * 0.9 + s.phase) * 3.0;
        drawSumiBrushStroke(
          ctx,
          rawX,
          y,
          spanW,
          s.maxHalfW,
          tSec * s.waveSpeed + s.phase,
          inkColors[s.toneIdx],
          s.waveAmp
        );
      }

      // Subtle ambient breeze ripples on calm spots so the water surface stays gently alive
      const ambientSpots: readonly [number, number, number][] = [
        [0.26, 0.67, 0],
        [0.74, 0.54, 1900],
      ];
      for (let aIdx = 0; aIdx < ambientSpots.length; aIdx++) {
        const [axFrac, ayFrac, offsetMs] = ambientSpots[aIdx];
        const cycle = ((nowMs + offsetMs) % 3800) / 3800;
        const rx = lerp(8, clamp(vw * 0.08, 28, 56), easeOutCubic(cycle));
        const alpha = (1 - cycle) * (isDark ? 0.15 : 0.12);
        drawCalligraphyEllipseRipple(
          ctx,
          vw * axFrac + Math.sin(tSec * 0.3 + aIdx) * 8,
          vh * ayFrac,
          rx,
          rx * 0.28,
          cycle * 1.1 + aIdx * 2.1,
          1.0,
          isDark ? `rgba(196, 181, 253, ${alpha.toFixed(3)})` : `rgba(49, 46, 129, ${alpha.toFixed(3)})`
        );
      }

      // Idle calm breathing center ink ripple
      if (phaseRef.current === 'idle') {
        const breath = (nowMs % 3200) / 3200;
        const rx = lerp(14, clamp(vw * 0.14, 52, 106), easeOutCubic(breath));
        const a = (1 - breath) * (isDark ? 0.22 : 0.18);
        drawCalligraphyEllipseRipple(
          ctx,
          vw * 0.5,
          vh * 0.63,
          rx,
          rx * 0.28,
          breath * 0.8,
          1.4,
          isDark ? `rgba(196, 181, 253, ${a.toFixed(3)})` : `rgba(49, 46, 129, ${a.toFixed(3)})`
        );
      }

      // Impact calligraphic ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.ageMs += dtSec * 1000;
        if (rp.ageMs < 0) continue;
        if (rp.ageMs >= rp.durationMs) {
          ripples.splice(i, 1);
          continue;
        }
        const p = rp.ageMs / rp.durationMs;
        const rx = 8 + easeOutCubic(p) * rp.maxRx;
        const ry = rx * 0.28;
        const alpha = (1 - p) * (1 - p) * (isDark ? 0.68 : 0.6);
        drawCalligraphyEllipseRipple(
          ctx,
          rp.x,
          rp.y,
          rx,
          ry,
          rp.rotOffset,
          rp.strokeWidth * (1 - p * 0.35),
          isDark
            ? `rgba(224, 231, 255, ${alpha.toFixed(3)})`
            : `rgba(49, 46, 129, ${alpha.toFixed(3)})`
        );
      }

      // Impact splash droplets
      for (let i = splashes.length - 1; i >= 0; i--) {
        const sp = splashes[i];
        sp.ageMs += dtSec * 1000;
        if (sp.ageMs >= sp.durationMs) {
          splashes.splice(i, 1);
          continue;
        }
        const t = sp.ageMs / 1000;
        const p = sp.ageMs / sp.durationMs;
        const sx = sp.x + sp.vx * t;
        const sy = sp.y + sp.vy * t + 190 * t * t;
        ctx.save();
        ctx.globalAlpha = waterAlpha * (1 - p);
        ctx.beginPath();
        ctx.arc(sx, sy, sp.size * (1 - p * 0.4), 0, TAU);
        ctx.fillStyle = isDark ? '#E0E7FF' : '#312E81';
        ctx.fill();
        ctx.restore();
      }

      // Continuously drifting origami petals carried by the water current with gentle wake trails
      const petalWrapW = vw + 72;
      const dampFactor = 1 - Math.exp(-dtSec * 7);
      const wakeColor = isDark ? 'rgba(196, 181, 253, 0.18)' : 'rgba(49, 46, 129, 0.14)';

      for (let i = 0; i < lakePetals.length; i++) {
        const lp = lakePetals[i];
        lp.pushedX = lerp(lp.pushedX, lp.targetPushedX, dampFactor);
        lp.pushedY = lerp(lp.pushedY, lp.targetPushedY, dampFactor);

        const wrappedX =
          (((lp.baseXFrac * vw + tSec * lp.flowSpeed + 36) % petalWrapW) + petalWrapW) % petalWrapW -
          36;
        const px = wrappedX + Math.sin(tSec * 0.8 + lp.bobPhase) * lp.driftAmp + lp.pushedX;
        const py = lp.yNorm * vh + Math.cos(tSec * 1.35 + lp.bobPhase) * lp.bobAmp + lp.pushedY;
        const rot = lp.rot + Math.sin(tSec * 0.65 + lp.bobPhase) * 0.16 + lp.spinRate * tSec;

        // Delicate trailing calligraphic wake streak behind gliding petal
        drawSumiBrushStroke(
          ctx,
          px - 15 * lp.scale,
          py + 7 * lp.scale,
          20 * lp.scale,
          1.05 * lp.scale,
          tSec * 1.8 + lp.bobPhase,
          wakeColor,
          1.4 * lp.scale
        );

        // Breathing water ring under drifting petal
        const ringRx = (13 + Math.sin(tSec * 1.5 + lp.bobPhase) * 2.4) * lp.scale;
        drawCalligraphyEllipseRipple(
          ctx,
          px,
          py + 8 * lp.scale,
          ringRx,
          ringRx * 0.3,
          i + tSec * 0.35,
          0.9,
          isDark ? 'rgba(196, 181, 253, 0.24)' : 'rgba(49, 46, 129, 0.19)'
        );

        drawOrigamiPetalCanvas(ctx, px, py, lp.variant, lp.scale, rot, isDark, creaseColor);
      }

      ctx.restore();
    };

    const drawCameraWindParallax = (ascendP: number, surgeP: number, isDark: boolean) => {
      const progress = ascendP * 0.8 + surgeP * 0.2;
      if (progress <= 0.02) return;
      const windFade = smoothstep(0.05, 0.3, progress) * (1 - smoothstep(0.82, 1, progress));
      if (windFade <= 0.01) return;

      for (let i = 0; i < windWisps.length; i++) {
        const w = windWisps[i];
        const wy = ((w.yFrac + progress * w.speed * 1.45) % 1.2) * vh - 40;
        const wx = w.xFrac * vw;
        ctx.save();
        ctx.strokeStyle = isDark
          ? `rgba(196, 181, 253, ${(w.alpha * windFade).toFixed(3)})`
          : `rgba(49, 46, 129, ${(w.alpha * windFade).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + (i % 2 === 0 ? 5 : -5), wy + w.len * 0.5, wx, wy + w.len);
        ctx.stroke();
        ctx.restore();
      }
    };

    const step = (now: number) => {
      if (finishedRef.current || glideTriggered || document.hidden) {
        rafId = 0;
        return;
      }

      const phase = phaseRef.current;
      const minFrameMs = phase === 'idle' ? 33 : lowPower ? 22 : 0;
      if (minFrameMs > 0 && lastDrawMs !== 0 && now - lastDrawMs < minFrameMs) {
        rafId = window.requestAnimationFrame(step);
        return;
      }
      lastDrawMs = now;

      const dtSec = Math.min(0.05, Math.max(0.001, (now - prevFrameMs) / 1000));
      prevFrameMs = now;
      totalTimeMs += dtSec * 1000;

      const tSec = totalTimeMs * 0.001;
      const isDark = isDarkModeActive();
      const creaseColor = isDark ? 'rgba(76, 29, 149, 0.28)' : 'rgba(224, 231, 255, 0.55)';
      const moteColors = isDark ? DARK_MOTE_COLORS : LIGHT_MOTE_COLORS;

      ctx.clearRect(0, 0, vw, vh);

      const elapsed = Math.max(0, now - phaseStartMs);

      if (phase === 'idle') {
        drawLakeLayer(now, dtSec, tSec, 0, 1, isDark, creaseColor);
      } else if (phase === 'drop') {
        drawLakeLayer(now, dtSec, tSec, 0, 1, isDark, creaseColor);

        if (elapsed < DROP_IMPACT_MS) {
          const p = elapsed / DROP_IMPACT_MS;
          const easeDrop = p * p;
          const startY = Math.max(24, dropY - vh * 0.34);
          const curY = lerp(startY, dropY, easeDrop);
          const tailY = Math.max(startY, curY - (18 + 26 * p));

          ctx.beginPath();
          ctx.moveTo(dropX, tailY);
          ctx.lineTo(dropX - 3.6, curY - 4);
          ctx.arc(dropX, curY - 3, 3.8, Math.PI, 0, true);
          ctx.closePath();
          ctx.fillStyle = isDark ? '#E0E7FF' : '#312E81';
          ctx.fill();
        } else {
          if (!dropImpacted) {
            dropImpacted = true;
            spawnWaterImpact(dropX, dropY);
          }

          const bfP = clamp((elapsed - DROP_IMPACT_MS) / (DROP_TOTAL_MS - DROP_IMPACT_MS), 0, 1);
          const easeBf = easeOutCubic(bfP);
          const wingDeg = lerp(70, 10, easeBf);
          const bfY = dropY - easeBf * 16;
          drawOrigamiButterfly3D(
            ctx,
            dropX,
            bfY,
            lerp(0.45, 1.08, easeBf),
            0,
            wingDeg,
            isDark,
            creaseColor,
            easeBf
          );
        }

        if (elapsed >= DROP_TOTAL_MS) {
          phaseRef.current = 'ascend';
          phaseStartMs = now;
        }
      } else if (phase === 'ascend') {
        const p = clamp(elapsed / ASCEND_DURATION_MS, 0, 1);
        const camP = easeInOutCubic(p);

        const camY = camP * vh * 0.96;
        const waterAlpha = 1 - smoothstep(0.54, 0.96, p);
        drawLakeLayer(now, dtSec, tSec, camY, waterAlpha, isDark, creaseColor);
        drawCameraWindParallax(p, 0, isDark);

        // Gently taper horizontal & vertical sway near end of ascend for a zero-seam handoff into surge
        const swayDecay = 1 - smoothstep(0.65, 1, p);
        const bfX =
          lerp(dropX, vw * 0.5, easeOutCubic(Math.min(1, p * 1.4))) +
          Math.sin(p * Math.PI * 2) * 14 * swayDecay;
        const bfBaseY = lerp(dropY - 16, vh * 0.48, easeInOutCubic(p));
        const flapWave = 0.5 - 0.5 * Math.cos(p * TAU * 4.5);
        const wingDeg = -14 + Math.pow(flapWave, 0.82) * 82;
        const liftBob = (0.5 - flapWave) * 5 * swayDecay;
        const heading = Math.cos(p * Math.PI * 2) * 0.08 * swayDecay;
        const bfY = bfBaseY + liftBob;

        for (let m = 0; m < 6; m++) {
          const ageP = (p * 2.6 + m * 0.17) % 1;
          const mx = bfX - Math.sin(m * 1.9 + p * 6) * (6 + ageP * 14);
          const my = bfY + 12 + ageP * 48;
          ctx.save();
          ctx.globalAlpha = (1 - ageP) * 0.72;
          ctx.beginPath();
          ctx.arc(mx, my, (1 - ageP) * 2.4 + 0.6, 0, TAU);
          ctx.fillStyle = moteColors[m % moteColors.length];
          ctx.fill();
          ctx.restore();
        }

        drawOrigamiButterfly3D(
          ctx,
          bfX,
          bfY,
          lerp(1.08, 1.18, p),
          heading,
          wingDeg,
          isDark,
          creaseColor
        );

        if (elapsed >= ASCEND_DURATION_MS) {
          surgeStartX = bfX;
          surgeStartY = bfY;
          surgeStartHeading = heading;
          surgeStartWingDeg = wingDeg;
          phaseRef.current = 'surge';
          phaseStartMs = now;
        }
      } else if (phase === 'surge') {
        const p = clamp(elapsed / SURGE_DURATION_MS, 0, 1);
        const easeSurge = easeInOutCubic(p);
        drawCameraWindParallax(1, p, isDark);

        const targetSurgeY = vh * 0.4;
        const bfX = lerp(surgeStartX, vw * 0.5, easeSurge);
        const bfY = lerp(surgeStartY, targetSurgeY, easeSurge);
        const heading = lerpAngle(surgeStartHeading, 0, easeSurge);
        const wingDeg = lerp(surgeStartWingDeg, 64, easeSurge);
        shatterCenterY = targetSurgeY;

        // Smoothly fade remaining hover motes downward behind rising butterfly
        const moteFade = 1 - p;
        for (let m = 0; m < 6; m++) {
          const ageP = (1 + p * 0.5 + m * 0.17) % 1;
          const mx = bfX - Math.sin(m * 1.9 + 6 + p * 2) * (6 + ageP * 14);
          const my = bfY + 14 + ageP * 48 + p * 18;
          ctx.save();
          ctx.globalAlpha = (1 - ageP) * 0.72 * moteFade;
          ctx.beginPath();
          ctx.arc(mx, my, (1 - ageP) * 2.4 + 0.6, 0, TAU);
          ctx.fillStyle = moteColors[m % moteColors.length];
          ctx.fill();
          ctx.restore();
        }

        // Luminous upward slipstream streak
        const streakAlpha = Math.sin(p * Math.PI) * 0.45;
        if (streakAlpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = streakAlpha;
          ctx.strokeStyle = isDark ? '#DDD6FE' : '#4F46E5';
          ctx.lineWidth = 2.1;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(surgeStartX, surgeStartY + 6);
          ctx.lineTo(bfX, bfY + 12);
          ctx.stroke();
          ctx.restore();
        }

        drawOrigamiButterfly3D(
          ctx,
          bfX,
          bfY,
          lerp(1.18, 1.3, easeSurge),
          heading,
          wingDeg,
          isDark,
          creaseColor
        );

        if (elapsed >= SURGE_DURATION_MS) {
          phaseRef.current = 'shatter_converge';
          phaseStartMs = now;
        }
      } else if (phase === 'shatter_converge') {
        const p = clamp(elapsed / SHATTER_CONVERGE_DURATION_MS, 0, 1);
        const cx = vw * 0.5;
        const cy = shatterCenterY;
        const rect = computeIntroRect();
        const logoScale = rect.width / LASTFE_VIEWBOX_W;
        const palette = isDark ? LASTFE_PALETTES.dark : LASTFE_PALETTES.light;
        const sheenFill = isDark ? '#FFFFFF' : '#EDE9FE';
        const { spreadX, spreadY } = getSpreadRadii(vw, vh);

        const mapSvgX = (sx: number) => rect.left + sx * logoScale;
        const mapSvgY = (sy: number) => rect.top + (sy - LASTFE_VIEWBOX_MIN_Y) * logoScale;

        // 1. Shatter stardust motes drift wide and fade gently without abrupt disappearances
        if (p < 0.48) {
          const mp = p / 0.48;
          const me = easeOutQuart(mp);
          const mAlpha = 1 - smoothstep(0.22, 0.48, p);
          for (let i = 0; i < burstMotes.length; i++) {
            const m = burstMotes[i];
            const mx = cx + Math.cos(m.angle) * spreadX * m.radiusFactor * me;
            const my = cy + Math.sin(m.angle) * spreadY * m.radiusFactor * me;
            ctx.save();
            ctx.globalAlpha = mAlpha;
            if (m.isStar) {
              drawFourPointStar(ctx, mx, my, m.size * 2.05, moteColors[m.colorIdx], mp * 1.9);
            } else {
              ctx.beginPath();
              ctx.arc(mx, my, m.size, 0, TAU);
              ctx.fillStyle = moteColors[m.colorIdx];
              ctx.fill();
            }
            ctx.restore();
          }
        }

        // Diagonal crystal chime shimmer across assembled LastFE facets
        const chimeActive = p >= 0.78 && p <= 0.95;
        const chimeP = chimeActive ? (p - 0.78) / 0.17 : 0;
        const waveSvgX = lerp(-20, 310, chimeP);
        const chimeEnv = chimeActive ? Math.sin(clamp(chimeP, 0, 1) * Math.PI) * 0.55 : 0;

        // 2. All 31 facets: continuous C-infinity cubic-Bezier shatter-hang-swoop into LastFE
        const lockSparks: Array<{ x: number; y: number; r: number; a: number; color: string }> = [];
        const trailSteps = lowPower ? 1 : 2;

        for (let i = 0; i < LASTFE_FACETS.length; i++) {
          const facet = LASTFE_FACETS[i];
          const fb = facetBursts[i];
          const dest = getFacetBurstTarget(fb, cx, cy, vw, vh, spreadX, spreadY);
          const endX = mapSvgX(facet.cx);
          const endY = mapSvgY(facet.cy);

          const dx = dest.x - cx;
          const dy = dest.y - cy;
          const p1x = cx + dx * 1.28;
          const p1y = cy + dy * 1.28;
          const p2x = dest.x + -fb.dirY * fb.arcSign * fb.arcBulge;
          const p2y = dest.y + fb.dirX * fb.arcSign * fb.arcBulge * 0.85;

          const localP = clamp(p / fb.flightSpan, 0, 1);
          const u = burstSwoopWarp(localP);

          const curX = cubicBezier(cx, p1x, p2x, endX, u);
          const curY = cubicBezier(cy, p1y, p2y, endY, u);

          // Spin gracefully outward on shatter, then unwind back to crisp 0deg at u = 1
          const curRot = fb.rotStart * Math.sin(u * Math.PI) * (1 - u);
          const baseScale = lerp(0.32, fb.burstScale, Math.min(1, u * 3)) * (1 - u) + u;

          // Crystal breadcrumb trail while mid-flight (no save/restore overhead)
          if (u > 0.08 && u < 0.94) {
            const trailFade = (1 - smoothstep(0.75, 0.94, u)) * smoothstep(0.08, 0.2, u);
            const prevAlpha = ctx.globalAlpha;
            for (let ts = 1; ts <= trailSteps; ts++) {
              const tu = clamp(u - ts * 0.045, 0, 1);
              const tx = cubicBezier(cx, p1x, p2x, endX, tu);
              const ty = cubicBezier(cy, p1y, p2y, endY, tu);
              ctx.globalAlpha = trailFade * (ts === 1 ? 0.36 : 0.18);
              ctx.beginPath();
              ctx.arc(tx, ty, ts === 1 ? 2.0 : 1.35, 0, TAU);
              ctx.fillStyle = moteColors[i % moteColors.length];
              ctx.fill();
            }
            ctx.globalAlpha = prevAlpha;
          }

          // Velvet magnetic snap micro-pop & highlight sheen upon locking into LastFE
          const lockWindow = 0.12;
          let lockSheenAlpha = 0;
          let popScale = 1;
          if (p >= fb.flightSpan && p <= fb.flightSpan + lockWindow) {
            const lockP = (p - fb.flightSpan) / lockWindow;
            popScale = 1 + Math.sin(lockP * Math.PI) * 0.09;
            lockSheenAlpha = (1 - lockP) * 0.56;
            if (fb.sparkOnLock) {
              lockSparks.push({
                x: endX,
                y: endY,
                r: 1.8 + Math.sin(lockP * Math.PI) * 6.5,
                a: 1 - lockP,
                color: moteColors[i % moteColors.length],
              });
            }
          }

          let chimeSheen = 0;
          if (chimeActive) {
            const distSvg = Math.abs(facet.cx - waveSvgX);
            if (distSvg < 36) {
              chimeSheen = (1 - distSvg / 36) * chimeEnv;
            }
          }

          const curSc = baseScale * popScale * logoScale;
          const curAlpha = lerp(0.5, 1, smoothstep(0, 0.14, p));

          ctx.save();
          ctx.globalAlpha = curAlpha;
          ctx.translate(curX, curY);
          ctx.rotate(curRot);
          ctx.scale(curSc, curSc);
          ctx.beginPath();
          for (let j = 0; j < facet.points.length; j++) {
            const ox = facet.points[j][0] - facet.cx;
            const oy = facet.points[j][1] - facet.cy;
            if (j === 0) ctx.moveTo(ox, oy);
            else ctx.lineTo(ox, oy);
          }
          ctx.closePath();
          ctx.fillStyle = palette[facet.tone];
          ctx.fill();

          if (!lowPower || u >= 0.72) {
            ctx.strokeStyle = palette.crease;
            ctx.lineWidth = 0.45;
            ctx.lineJoin = 'round';
            ctx.stroke();
          }

          const totalSheen = Math.min(0.75, lockSheenAlpha + chimeSheen);
          if (totalSheen > 0.01) {
            ctx.globalAlpha = totalSheen;
            ctx.fillStyle = sheenFill;
            ctx.fill();
          }
          ctx.restore();
        }

        for (let i = 0; i < lockSparks.length; i++) {
          const spk = lockSparks[i];
          ctx.save();
          ctx.globalAlpha = spk.a;
          drawFourPointStar(ctx, spk.x, spk.y, spk.r, spk.color, 0.25);
          ctx.restore();
        }

        // 3. Mini origami butterflies steer nose-first along smooth Bezier swoops; hero settles onto E
        const bfT = LASTFE_PERCHED_BUTTERFLY_TRANSFORM;
        const heroRad = (bfT.rotDeg * Math.PI) / 180;
        const heroAnchorX = 18;
        const heroAnchorY = 17;
        const heroCos = Math.cos(heroRad);
        const heroSin = Math.sin(heroRad);
        const heroFinalSvgX =
          bfT.tx + (heroAnchorX * heroCos - heroAnchorY * heroSin) * bfT.scale;
        const heroFinalSvgY =
          bfT.ty + (heroAnchorX * heroSin + heroAnchorY * heroCos) * bfT.scale;

        for (let i = 0; i < burstMinis.length; i++) {
          const mb = burstMinis[i];
          const dest = getMiniBurstTarget(mb, cx, cy, vw, vh, spreadX, spreadY);
          const dx = dest.x - cx;
          const dy = dest.y - cy;
          const p1x = cx + dx * 1.25;
          const p1y = cy + dy * 1.25;

          if (mb.isPerchedHero) {
            const endX = mapSvgX(heroFinalSvgX);
            const endY = mapSvgY(heroFinalSvgY);
            const p2x = dest.x + -mb.dirY * mb.arcSign * 56;
            const p2y = dest.y + mb.dirX * mb.arcSign * 42;

            const localP = clamp(p / mb.flightSpan, 0, 1);
            const u = burstSwoopWarp(localP);
            const bx = cubicBezier(cx, p1x, p2x, endX, u);
            const by = cubicBezier(cy, p1y, p2y, endY, u);

            const scaleEnd = logoScale * bfT.scale;
            const curScale = lerp(0.55, mb.scale, Math.min(1, u * 3)) * (1 - u) + scaleEnd * u;

            const vx = cubicBezierDeriv(cx, p1x, p2x, endX, u);
            const vy = cubicBezierDeriv(cy, p1y, p2y, endY, u);
            const initAngle = Math.atan2(mb.dirY, mb.dirX) + Math.PI * 0.5;
            const tangentAngle =
              vx * vx + vy * vy > 0.001 ? Math.atan2(vy, vx) + Math.PI * 0.5 : heroRad;
            const steeredAngle = lerpAngle(initAngle, tangentAngle, smoothstep(0.02, 0.16, u));
            const curHeading = lerpAngle(steeredAngle, heroRad, smoothstep(0.76, 1, u));

            const flapRaw = 0.5 - 0.5 * Math.cos(tSec * 20 + mb.flapPhase);
            const curWingDeg = flapRaw * 68 * (1 - smoothstep(0.68, 0.96, u));
            const auraAlpha = 1 - smoothstep(0.75, 0.98, u);

            if (localP < 1) {
              drawOrigamiButterfly3D(
                ctx,
                bx,
                by,
                curScale,
                curHeading,
                curWingDeg,
                isDark,
                creaseColor,
                1,
                auraAlpha
              );
            } else {
              let heroPop = 1;
              if (p <= mb.flightSpan + 0.12) {
                const hp = (p - mb.flightSpan) / 0.12;
                heroPop = 1 + Math.sin(hp * Math.PI) * 0.1;
              }
              ctx.save();
              ctx.translate(rect.left + bfT.tx * logoScale, mapSvgY(bfT.ty));
              ctx.rotate(heroRad);
              ctx.scale(scaleEnd * heroPop, scaleEnd * heroPop);
              for (let k = 0; k < LASTFE_PERCHED_BUTTERFLY_POLYS.length; k++) {
                const poly = LASTFE_PERCHED_BUTTERFLY_POLYS[k];
                ctx.beginPath();
                ctx.moveTo(poly.points[0][0], poly.points[0][1]);
                for (let j = 1; j < poly.points.length; j++) {
                  ctx.lineTo(poly.points[j][0], poly.points[j][1]);
                }
                ctx.closePath();
                ctx.fillStyle = isDark ? poly.darkFill : poly.lightFill;
                ctx.fill();
                ctx.strokeStyle = palette.crease;
                ctx.lineWidth = 0.45;
                ctx.lineJoin = 'round';
                ctx.stroke();
              }
              ctx.restore();
            }
          } else {
            const endX = rect.left + mb.targetXFrac * rect.width;
            const endY = rect.top + mb.targetYFrac * rect.height;
            const p2x = dest.x + -mb.dirY * mb.arcSign * 48;
            const p2y = dest.y + mb.dirX * mb.arcSign * 38;

            const localP = clamp(p / mb.flightSpan, 0, 1);
            if (localP < 1) {
              const u = burstSwoopWarp(localP);
              const bx = cubicBezier(cx, p1x, p2x, endX, u);
              const by = cubicBezier(cy, p1y, p2y, endY, u);

              const vx = cubicBezierDeriv(cx, p1x, p2x, endX, u);
              const vy = cubicBezierDeriv(cy, p1y, p2y, endY, u);
              const initAngle = Math.atan2(mb.dirY, mb.dirX) + Math.PI * 0.5;
              const curHeading =
                vx * vx + vy * vy > 0.001
                  ? lerpAngle(initAngle, Math.atan2(vy, vx) + Math.PI * 0.5, smoothstep(0.02, 0.16, u))
                  : initAngle;

              const fade = 1 - smoothstep(0.72, 1, localP);
              const flapDeg = -10 + (0.5 - 0.5 * Math.cos(tSec * 20 + mb.flapPhase)) * 75;
              drawOrigamiButterfly3D(
                ctx,
                bx,
                by,
                lerp(0.52, mb.scale, smoothstep(0, 0.18, u)) * (1 - u * 0.34),
                curHeading,
                flapDeg,
                isDark,
                creaseColor,
                fade
              );
            }
          }
        }

        // 4. Clean starlight glint fade-in above 't' matching LastFeOrigamiLogo 1:1
        if (p > 0.8) {
          const sp = clamp((p - 0.8) / 0.14, 0, 1);

          ctx.save();
          ctx.globalAlpha = easeOutCubic(sp);
          ctx.beginPath();
          for (let j = 0; j < LASTFE_STAR_POINTS.length; j++) {
            const sx = mapSvgX(LASTFE_STAR_POINTS[j][0]);
            const sy = mapSvgY(LASTFE_STAR_POINTS[j][1]);
            if (j === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.closePath();
          ctx.fillStyle = palette.starAccent;
          ctx.fill();
          ctx.restore();

          // Delicate micro sparkles flanking assembled logo right before FLIP glide
          const compFade = Math.sin(clamp((p - 0.8) / 0.19, 0, 1) * Math.PI);
          if (compFade > 0.04) {
            const glints: readonly [number, number, number, number][] = [
              [-14, 18, 4.2, 0],
              [192, -6, 3.8, 1],
              [288, 56, 4.0, 2],
            ];
            for (let g = 0; g < glints.length; g++) {
              const [gx, gy, gr, cIdx] = glints[g];
              ctx.save();
              ctx.globalAlpha = compFade * 0.82;
              drawFourPointStar(ctx, mapSvgX(gx), mapSvgY(gy), gr * compFade, moteColors[cIdx], p * 2 + g);
              ctx.restore();
            }
          }
        }

        if (elapsed >= SHATTER_CONVERGE_DURATION_MS) {
          startGlideRef.current?.(rect);
          rafId = 0;
          return;
        }
      }

      rafId = window.requestAnimationFrame(step);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAtMs = performance.now();
        if (rafId !== 0) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
      } else if (!finishedRef.current && !glideTriggered) {
        const now = performance.now();
        if (hiddenAtMs > 0) {
          phaseStartMs += now - hiddenAtMs;
          hiddenAtMs = 0;
        }
        prevFrameMs = now;
        lastDrawMs = 0;
        if (rafId === 0) {
          rafId = window.requestAnimationFrame(step);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    rafId = window.requestAnimationFrame(step);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('resize', syncSize);
      window.visualViewport?.removeEventListener('resize', syncSize);
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'idle') return;
    triggerDropRef.current?.(e.clientX, e.clientY);
  };

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] touch-none overflow-hidden select-none">
      {/* Solid Warm Parchment / Deep Basalt backdrop curtain */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 bg-[#F4F2EC] transition-opacity duration-500 ease-out dark:bg-[#0F100E] ${
          curtainTransparent ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Interactive Sumi-e Water & Origami Butterfly 2D Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        className={`fixed inset-0 z-10 h-full w-full touch-none ${
          isPromptVisible ? 'cursor-pointer' : 'pointer-events-none'
        }`}
      />

      {/* Subtle bottom cue while lake waits for click/tap */}
      {isPromptVisible && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 bottom-[max(2.25rem,calc(env(safe-area-inset-bottom)+1.5rem))] z-20 flex justify-center sm:bottom-12"
        >
          <span className="animate-pulse text-xs font-medium tracking-widest text-[#57534E]/65 dark:text-[#A1A1AA]/65">
            Chạm vào mặt nước
          </span>
        </div>
      )}

      {/* Faint Skip button at top-right (also triggered via Space bar) */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          handleSkip();
        }}
        className="fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-30 inline-flex min-h-[36px] min-w-[60px] cursor-pointer items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium tracking-wide text-[#57534E]/55 transition-colors hover:text-[#18181B]/90 focus-visible:outline-2 focus-visible:outline-[#4338CA] dark:text-[#A1A1AA]/50 dark:hover:text-[#F5F5F4]/90 dark:focus-visible:outline-[#818CF8] sm:right-6 sm:top-5"
      >
        Bỏ qua
      </button>

      {/* Seamless FLIP DOM Logo glided smoothly to top-left Header spot */}
      {glideRect && (
        <div
          aria-hidden="true"
          style={{
            left: glideRect.left,
            top: glideRect.top,
            width: glideRect.width,
            height: glideRect.height,
            transformOrigin: 'top left',
            transform: flipTransform,
            transition: 'transform 680ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          className="pointer-events-none fixed z-20 will-change-transform"
        >
          <LastFeOrigamiLogo className="block h-full w-full" />
        </div>
      )}
    </div>
  );
};

export default SakugaSumieIntro;
