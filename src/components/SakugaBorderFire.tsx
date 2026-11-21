import React, { memo, useEffect, useRef } from 'react';
import { isLowPowerDevice } from '../utils/perfTier';

export interface SakugaBorderFireProps {
  /** Mastery/completion percentage (0..100). Mounts and animates only at >= 50%. */
  percent: number;
  /** Border radius of the host card in px (matches rounded-xl=12, rounded-2xl=16). */
  radius?: number;
  /** Compact sizing for narrow sidebar chapter cards. */
  compact?: boolean;
  /** Ultra-compact flame outline for inline CTA buttons. */
  mini?: boolean;
}

interface PerimeterPoint {
  px: number;
  py: number;
  nx: number;
  ny: number;
  u: number;
  dispX: number;
  dispY: number;
  curlX: number;
  curlY: number;
  u4: number;
  u7: number;
  u11: number;
  u19: number;
  u9: number;
}

interface RawPerimeterSample {
  px: number;
  py: number;
  nx: number;
  ny: number;
  buoyWeight: number;
  curlWeight: number;
}

interface Point2D {
  x: number;
  y: number;
}

interface BurstShard {
  u: number;
  speed: number;
  size: number;
  color: string;
  isStar: boolean;
  jitter: number;
}

interface FireLayerSpec {
  heightScale: number;
  phaseOffset: number;
  fillStyle: string;
}

interface FireClient {
  host: Element;
  isIntersecting: boolean;
  hasSize: boolean;
  isVisible: boolean;
  lastDraw: number;
  draw: (now: number, visibleCount: number, isDark: boolean) => void;
  hasBurst: () => boolean;
}

type PathTarget = Pick<
  CanvasRenderingContext2D,
  'moveTo' | 'lineTo' | 'arcTo' | 'closePath'
>;

const BURST_DURATION_MS = 850;
const TAU = Math.PI * 2;
const STAR_STEP = Math.PI / 4;

const NORMAL_LAYERS: readonly FireLayerSpec[] = [
  { heightScale: 1.12, phaseOffset: 0, fillStyle: 'rgba(234, 88, 12, 0.36)' },
  { heightScale: 0.9, phaseOffset: 0.42, fillStyle: '#F97316' },
  { heightScale: 0.61, phaseOffset: -0.55, fillStyle: '#FACC15' },
  { heightScale: 0.35, phaseOffset: 0.9, fillStyle: '#FEF9C3' },
];

const MINI_LAYERS: readonly FireLayerSpec[] = [
  { heightScale: 1.1, phaseOffset: 0, fillStyle: 'rgba(234, 88, 12, 0.42)' },
  { heightScale: 0.85, phaseOffset: 0.42, fillStyle: '#F97316' },
  { heightScale: 0.5, phaseOffset: -0.55, fillStyle: '#FEF08A' },
];

const MAX_VIOLET_LAYERS_LIGHT: readonly FireLayerSpec[] = [
  { heightScale: 1.12, phaseOffset: 0, fillStyle: 'rgba(124, 58, 237, 0.30)' },
  { heightScale: 0.9, phaseOffset: 0.42, fillStyle: '#5B21B6' },
  { heightScale: 0.62, phaseOffset: -0.55, fillStyle: '#7C3AED' },
  { heightScale: 0.34, phaseOffset: 0.9, fillStyle: '#C4B5FD' },
];

const MAX_VIOLET_LAYERS_DARK: readonly FireLayerSpec[] = [
  { heightScale: 1.12, phaseOffset: 0, fillStyle: 'rgba(139, 92, 246, 0.38)' },
  { heightScale: 0.9, phaseOffset: 0.42, fillStyle: '#7C3AED' },
  { heightScale: 0.62, phaseOffset: -0.55, fillStyle: '#C084FC' },
  { heightScale: 0.34, phaseOffset: 0.9, fillStyle: '#F5F3FF' },
];

const MAX_MINI_VIOLET_LAYERS_LIGHT: readonly FireLayerSpec[] = [
  { heightScale: 1.1, phaseOffset: 0, fillStyle: 'rgba(124, 58, 237, 0.36)' },
  { heightScale: 0.85, phaseOffset: 0.42, fillStyle: '#5B21B6' },
  { heightScale: 0.5, phaseOffset: -0.55, fillStyle: '#A78BFA' },
];

const MAX_MINI_VIOLET_LAYERS_DARK: readonly FireLayerSpec[] = [
  { heightScale: 1.1, phaseOffset: 0, fillStyle: 'rgba(139, 92, 246, 0.44)' },
  { heightScale: 0.85, phaseOffset: 0.42, fillStyle: '#7C3AED' },
  { heightScale: 0.5, phaseOffset: -0.55, fillStyle: '#DDD6FE' },
];

// Reusable per-bucket ember coordinate arrays (0 allocations during frame draws)
const EMBER_BUCKET_COLORS: [string, string, string] = ['', '', ''];
const EMBER_BUCKET_COUNTS = [0, 0, 0];
const MAX_EMBERS = 24;
const EMBER_X = [new Float32Array(MAX_EMBERS), new Float32Array(MAX_EMBERS), new Float32Array(MAX_EMBERS)];
const EMBER_Y = [new Float32Array(MAX_EMBERS), new Float32Array(MAX_EMBERS), new Float32Array(MAX_EMBERS)];
const EMBER_R = [new Float32Array(MAX_EMBERS), new Float32Array(MAX_EMBERS), new Float32Array(MAX_EMBERS)];

// ---- Module-level shared Smart Timer + VSync & IntersectionObserver coordinator ----
const allClients = new Set<FireClient>();
const visibleClients = new Set<FireClient>();
const elementToClient = new WeakMap<Element, FireClient>();

let sharedIo: IntersectionObserver | null = null;
let sharedMotionQuery: MediaQueryList | null = null;
let darkClassObserver: MutationObserver | null = null;
let cachedIsDark = false;
let prefersReducedMotion = false;
let sharedListenersBound = false;
let externallyPaused = false;
let scrollPaused = false;
let scrollResumeTimerId = 0;
let coordinatorTimerId = 0;
let coordinatorRafId = 0;

function readDarkClass(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

function isDarkModeActive(): boolean {
  return darkClassObserver ? cachedIsDark : readDarkClass();
}

function stopCoordinatorLoop(): void {
  if (coordinatorTimerId !== 0) {
    window.clearTimeout(coordinatorTimerId);
    coordinatorTimerId = 0;
  }
  if (coordinatorRafId !== 0) {
    cancelAnimationFrame(coordinatorRafId);
    coordinatorRafId = 0;
  }
}

function syncClientActiveSet(client: FireClient): void {
  const shouldRun = client.isIntersecting && client.hasSize;
  if (shouldRun && !client.isVisible) {
    client.isVisible = true;
    visibleClients.add(client);
    client.lastDraw = 0;
  } else if (!shouldRun && client.isVisible) {
    client.isVisible = false;
    visibleClients.delete(client);
  }
}

export function setBorderFirePaused(paused: boolean): void {
  if (externallyPaused === paused) return;
  externallyPaused = paused;
  if (paused) {
    stopCoordinatorLoop();
  } else if (typeof document !== 'undefined' && !document.hidden) {
    const now = performance.now();
    const count = Math.max(1, visibleClients.size);
    const isDark = isDarkModeActive();
    for (const client of visibleClients) {
      client.lastDraw = now;
      client.draw(now, count, isDark);
    }
    ensureCoordinatorLoop();
  }
}

function getTargetIntervalMs(visibleCount: number, lowPower: boolean, isBursting: boolean): number {
  if (isBursting) return 33;
  if (lowPower) {
    if (visibleCount <= 2) return 56;
    return 80;
  }
  if (visibleCount <= 2) return 42;
  if (visibleCount <= 5) return 56;
  return 72;
}

function scheduleNextCoordinatorStep(waitMs: number): void {
  if (
    externallyPaused ||
    scrollPaused ||
    prefersReducedMotion ||
    typeof document === 'undefined' ||
    document.hidden ||
    visibleClients.size === 0 ||
    coordinatorTimerId !== 0 ||
    coordinatorRafId !== 0
  ) {
    return;
  }

  if (waitMs <= 18) {
    coordinatorRafId = requestAnimationFrame(coordinatorTick);
  } else {
    coordinatorTimerId = window.setTimeout(() => {
      coordinatorTimerId = 0;
      if (
        !externallyPaused &&
        !scrollPaused &&
        !prefersReducedMotion &&
        !document.hidden &&
        visibleClients.size > 0 &&
        coordinatorRafId === 0
      ) {
        coordinatorRafId = requestAnimationFrame(coordinatorTick);
      }
    }, Math.max(8, Math.round(waitMs - 8)));
  }
}

function coordinatorTick(now: number): void {
  coordinatorRafId = 0;
  if (
    externallyPaused ||
    scrollPaused ||
    prefersReducedMotion ||
    document.hidden ||
    visibleClients.size === 0
  ) {
    return;
  }

  const visibleCount = visibleClients.size;
  const lowPower = isLowPowerDevice();
  const isDark = isDarkModeActive();
  const maxNonBurstDraws = visibleCount >= 5 ? Math.max(2, Math.ceil(visibleCount / 3)) : visibleCount;

  let nonBurstDrawn = 0;
  let minNextWait = Infinity;
  const drawnClients: FireClient[] = [];

  for (const client of visibleClients) {
    const bursting = client.hasBurst();
    const interval = getTargetIntervalMs(visibleCount, lowPower, bursting);

    if (!bursting && nonBurstDrawn >= maxNonBurstDraws) {
      minNextWait = Math.min(minNextWait, 16);
      continue;
    }

    const elapsed = client.lastDraw === 0 ? interval : now - client.lastDraw;
    if (elapsed >= interval) {
      client.lastDraw = now;
      client.draw(now, visibleCount, isDark);
      drawnClients.push(client);
      if (!bursting) {
        nonBurstDrawn += 1;
      }
      minNextWait = Math.min(minNextWait, interval);
    } else {
      minNextWait = Math.min(minNextWait, interval - elapsed);
    }
  }

  // Rotate drawn entries to the tail of the Set so next frame services oldest entries first
  for (let i = 0; i < drawnClients.length; i++) {
    const client = drawnClients[i];
    if (visibleClients.has(client)) {
      visibleClients.delete(client);
      visibleClients.add(client);
    }
  }

  scheduleNextCoordinatorStep(Number.isFinite(minNextWait) ? minNextWait : 56);
}

function ensureCoordinatorLoop(): void {
  scheduleNextCoordinatorStep(0);
}

function ensureSharedObservers(): void {
  if (typeof window === 'undefined') return;

  if (!sharedIo && typeof IntersectionObserver !== 'undefined') {
    sharedIo = new IntersectionObserver(
      (entries) => {
        const isDark = isDarkModeActive();
        for (const entry of entries) {
          const client = elementToClient.get(entry.target);
          if (!client) continue;

          client.isIntersecting = entry.isIntersecting;
          const wasVisible = client.isVisible;
          syncClientActiveSet(client);
          if (!wasVisible && client.isVisible) {
            const now = performance.now();
            client.lastDraw = now;
            client.draw(now, visibleClients.size, isDark);
          }
        }

        if (visibleClients.size > 0) {
          ensureCoordinatorLoop();
        } else {
          stopCoordinatorLoop();
        }
      },
      { threshold: 0.01 }
    );
  }

  if (!sharedListenersBound && typeof document !== 'undefined') {
    sharedListenersBound = true;
    cachedIsDark = readDarkClass();

    if (typeof MutationObserver !== 'undefined') {
      darkClassObserver = new MutationObserver(() => {
        cachedIsDark = readDarkClass();
      });
      darkClassObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    sharedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = sharedMotionQuery.matches;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopCoordinatorLoop();
      } else {
        const now = performance.now();
        const count = Math.max(1, visibleClients.size);
        const isDark = isDarkModeActive();
        for (const client of visibleClients) {
          client.lastDraw = now;
          client.draw(now, count, isDark);
        }
        ensureCoordinatorLoop();
      }
    });

    window.addEventListener(
      'scroll',
      () => {
        if (prefersReducedMotion || externallyPaused || visibleClients.size === 0) return;
        let anyBurst = false;
        for (const client of visibleClients) {
          if (client.hasBurst()) {
            anyBurst = true;
            break;
          }
        }
        if (anyBurst) return;

        if (!scrollPaused) {
          scrollPaused = true;
          stopCoordinatorLoop();
        }
        if (scrollResumeTimerId !== 0) {
          window.clearTimeout(scrollResumeTimerId);
        }
        scrollResumeTimerId = window.setTimeout(() => {
          scrollResumeTimerId = 0;
          scrollPaused = false;
          ensureCoordinatorLoop();
        }, 120);
      },
      { passive: true }
    );

    const handleMotionChange = () => {
      prefersReducedMotion = Boolean(sharedMotionQuery?.matches);
      if (prefersReducedMotion) {
        stopCoordinatorLoop();
      }
      const now = performance.now();
      const count = Math.max(1, visibleClients.size);
      const isDark = isDarkModeActive();
      for (const client of allClients) {
        if (client.isVisible) {
          client.lastDraw = now;
          client.draw(now, count, isDark);
        }
      }
      if (!prefersReducedMotion) {
        ensureCoordinatorLoop();
      }
    };

    sharedMotionQuery.addEventListener('change', handleMotionChange);
  }
}

function registerFireClient(client: FireClient): void {
  ensureSharedObservers();
  allClients.add(client);
  elementToClient.set(client.host, client);
  client.isIntersecting = true;
  syncClientActiveSet(client);
  sharedIo?.observe(client.host);
  if (visibleClients.size > 0) {
    ensureCoordinatorLoop();
  }
}

function unregisterFireClient(client: FireClient): void {
  sharedIo?.unobserve(client.host);
  elementToClient.delete(client.host);
  allClients.delete(client);
  visibleClients.delete(client);
  client.isVisible = false;
  client.isIntersecting = false;
  if (visibleClients.size === 0) {
    stopCoordinatorLoop();
  }
}

// ---- Corner-aware geometry & wave helpers ----
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function pushUniqueRawSample(list: RawPerimeterSample[], next: RawPerimeterSample): void {
  if (list.length > 0) {
    const prev = list[list.length - 1];
    const dx = next.px - prev.px;
    const dy = next.py - prev.py;
    if (dx * dx + dy * dy < 0.0625) return;
  }
  list.push(next);
}

/**
 * Generates clockwise perimeter samples around the card border box with guaranteed
 * dense vertices along each rounded corner arc and proportional segments along straight edges.
 */
function buildRoundedRectSamples(
  x: number,
  y: number,
  w: number,
  h: number,
  rRaw: number,
  compact: boolean,
  mini: boolean
): PerimeterPoint[] {
  if (w <= 0 || h <= 0) return [];

  const lowPower = isLowPowerDevice();
  const r = Math.max(0, Math.min(rRaw, w / 2, h / 2));
  const topLen = Math.max(0, w - 2 * r);
  const sideLen = Math.max(0, h - 2 * r);

  const topSegs =
    topLen > 0.5
      ? Math.max(
          4,
          Math.min(
            mini ? 14 : compact ? 22 : 36,
            Math.round(topLen / (mini ? 14 : lowPower ? 30 : 26))
          )
        )
      : 0;
  const sideSegs =
    sideLen > 0.5
      ? Math.max(
          2,
          Math.min(mini ? 5 : 12, Math.round(sideLen / (mini ? 14 : lowPower ? 24 : 20)))
        )
      : 0;
  const cornerSegs = r > 0.5 ? (mini || compact || lowPower ? 3 : 5) : 0;

  const raw: RawPerimeterSample[] = [];

  const addCorner = (cx: number, cy: number, startAngle: number) => {
    if (cornerSegs > 0) {
      for (let i = 0; i <= cornerSegs; i++) {
        const a = startAngle + (i / cornerSegs) * (Math.PI / 2);
        const nx = Math.cos(a);
        const ny = Math.sin(a);
        const isEndpoint = i === 0 || i === cornerSegs;
        pushUniqueRawSample(raw, {
          px: cx + nx * r,
          py: cy + ny * r,
          nx,
          ny,
          buoyWeight: isEndpoint ? 0.16 : 0.1,
          curlWeight: isEndpoint ? 0.62 : 0.28,
        });
      }
    } else {
      const midA = startAngle + Math.PI / 4;
      pushUniqueRawSample(raw, {
        px: cx,
        py: cy,
        nx: Math.cos(midA),
        ny: Math.sin(midA),
        buoyWeight: 0.12,
        curlWeight: 0.35,
      });
    }
  };

  // 1. Top edge interior (left -> right)
  for (let i = 1; i < topSegs; i++) {
    const t = i / topSegs;
    pushUniqueRawSample(raw, {
      px: x + r + t * topLen,
      py: y,
      nx: 0,
      ny: -1,
      buoyWeight: 0.24,
      curlWeight: 1,
    });
  }

  // 2. Top-right rounded corner
  addCorner(x + w - r, y + r, -Math.PI / 2);

  // 3. Right edge interior (top -> bottom)
  for (let i = 1; i < sideSegs; i++) {
    const t = i / sideSegs;
    pushUniqueRawSample(raw, {
      px: x + w,
      py: y + r + t * sideLen,
      nx: 1,
      ny: 0,
      buoyWeight: 0.24,
      curlWeight: 1,
    });
  }

  // 4. Bottom-right rounded corner
  addCorner(x + w - r, y + h - r, 0);

  // 5. Bottom edge interior (right -> left)
  for (let i = 1; i < topSegs; i++) {
    const t = i / topSegs;
    pushUniqueRawSample(raw, {
      px: x + w - r - t * topLen,
      py: y + h,
      nx: 0,
      ny: 1,
      buoyWeight: 0.24,
      curlWeight: 1,
    });
  }

  // 6. Bottom-left rounded corner
  addCorner(x + r, y + h - r, Math.PI / 2);

  // 7. Left edge interior (bottom -> top)
  for (let i = 1; i < sideSegs; i++) {
    const t = i / sideSegs;
    pushUniqueRawSample(raw, {
      px: x,
      py: y + h - r - t * sideLen,
      nx: -1,
      ny: 0,
      buoyWeight: 0.24,
      curlWeight: 1,
    });
  }

  // 8. Top-left rounded corner
  addCorner(x + r, y + r, Math.PI);

  if (raw.length > 2) {
    const first = raw[0];
    const last = raw[raw.length - 1];
    const dx = first.px - last.px;
    const dy = first.py - last.py;
    if (dx * dx + dy * dy < 0.0625) {
      raw.pop();
    }
  }

  const n = raw.length;
  if (n < 3) return [];

  const segLens = new Array<number>(n);
  let totalLen = 0;
  for (let i = 0; i < n; i++) {
    const cur = raw[i];
    const next = raw[(i + 1) % n];
    const segLen = Math.hypot(next.px - cur.px, next.py - cur.py);
    segLens[i] = segLen;
    totalLen += segLen;
  }

  if (totalLen <= 0) return [];

  const freqMul = Math.max(1, Math.round(totalLen / 950));
  const result: PerimeterPoint[] = new Array(n);
  let cumDist = 0;

  for (let i = 0; i < n; i++) {
    const s = raw[i];
    const u = cumDist / totalLen;
    cumDist += segLens[i];

    const buoyX = s.nx;
    const buoyY = s.ny - s.buoyWeight * (1 - Math.max(0, s.ny) * 0.78);
    const invNorm = 1 / (Math.hypot(buoyX, buoyY) || 1);
    const edgeWeight = 0.62 + 0.38 * (1 - Math.max(0, s.ny));
    const uScaled = u * TAU * freqMul;

    result[i] = {
      px: s.px,
      py: s.py,
      nx: s.nx,
      ny: s.ny,
      u,
      dispX: buoyX * invNorm * edgeWeight,
      dispY: buoyY * invNorm * edgeWeight,
      curlX: -s.ny * s.curlWeight,
      curlY: s.nx * s.curlWeight,
      u4: uScaled * 4,
      u7: uScaled * 7,
      u11: uScaled * 11,
      u19: uScaled * 19,
      u9: uScaled * 9,
    };
  }

  return result;
}

function lookupPerimeterByU(samples: readonly PerimeterPoint[], uRaw: number): PerimeterPoint {
  const n = samples.length;
  if (n === 0) {
    return {
      px: 0,
      py: 0,
      nx: 0,
      ny: -1,
      u: 0,
      dispX: 0,
      dispY: -1,
      curlX: 1,
      curlY: 0,
      u4: 0,
      u7: 0,
      u11: 0,
      u19: 0,
      u9: 0,
    };
  }
  const u = ((uRaw % 1) + 1) % 1;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (samples[mid].u <= u) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return samples[lo];
}

function appendRoundedRectSubPath(
  target: PathTarget,
  x: number,
  y: number,
  w: number,
  h: number,
  rRaw: number
): void {
  const r = Math.max(0, Math.min(rRaw, w / 2, h / 2));
  target.moveTo(x + r, y);
  target.lineTo(x + w - r, y);
  target.arcTo(x + w, y, x + w, y + r, r);
  target.lineTo(x + w, y + h - r);
  target.arcTo(x + w, y + h, x + w - r, y + h, r);
  target.lineTo(x + r, y + h);
  target.arcTo(x, y + h, x, y + h - r, r);
  target.lineTo(x, y + r);
  target.arcTo(x, y, x + r, y, r);
  target.closePath();
}

function drawRoundedRectStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rRaw: number
): void {
  ctx.beginPath();
  appendRoundedRectSubPath(ctx, x, y, w, h, rRaw);
}

function drawStarSpark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  fill: string,
  strokeColor: string,
  rotation: number
): void {
  const innerR = outerR * 0.34;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = rotation + i * STAR_STEP;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 0.75;
  ctx.stroke();
}

/**
 * Multi-octave periodic wave height in [0.18, 1.0] using arc-length-cached coordinates
 * and algebraic crest shaping (zero Math.pow per point per frame).
 */
function computeWaveHeightCached(
  pt: PerimeterPoint,
  t21: number,
  t15: number,
  t34: number,
  t56: number,
  phaseOffset: number
): number {
  const billow = 0.5 + 0.5 * Math.sin(pt.u4 - t21 + phaseOffset);
  const swell = 0.5 + 0.5 * Math.sin(pt.u7 + t15 - phaseOffset * 0.7);
  const cRaw = 1 - Math.abs(Math.sin(pt.u11 + t34 + phaseOffset * 1.3));
  const crest = cRaw * (0.35 + 0.65 * cRaw);
  const lRaw = 1 - Math.abs(Math.cos(pt.u19 - t56 + phaseOffset * 0.8));
  const lick = lRaw * lRaw;

  return Math.min(1, 0.18 + 0.24 * billow + 0.2 * swell + 0.24 * crest + 0.14 * lick);
}

function drawSmoothClosedWave(ctx: CanvasRenderingContext2D, points: readonly Point2D[]): void {
  const count = points.length;
  if (count < 3) return;

  const last = points[count - 1];
  const first = points[0];
  ctx.beginPath();
  ctx.moveTo((last.x + first.x) * 0.5, (last.y + first.y) * 0.5);

  for (let i = 0; i < count; i++) {
    const cur = points[i];
    const next = points[(i + 1) % count];
    ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) * 0.5, (cur.y + next.y) * 0.5);
  }

  ctx.closePath();
}

function buildBurstShards(compact: boolean): BurstShard[] {
  const count = compact ? 12 : 18;
  const palette = ['#7C3AED', '#C084FC', '#F5F3FF', '#F472B6'];
  return Array.from({ length: count }, (_, idx) => ({
    u: (idx + 0.35) / count,
    speed: compact ? 8 + (idx % 3) * 2.5 : 10 + (idx % 3) * 3,
    size: compact ? 2.2 + (idx % 2) * 1.1 : 2.8 + (idx % 3) * 1.1,
    color: palette[idx % palette.length],
    isStar: idx % 3 === 0,
    jitter: ((idx * 37) % 10) / 10 - 0.5,
  }));
}

const SakugaBorderFireComponent: React.FC<SakugaBorderFireProps> = ({
  percent,
  radius = 16,
  compact = false,
  mini = false,
}) => {
  const clampedPct = clampPercent(percent);
  const active = clampedPct >= 50;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const percentRef = useRef<number>(clampedPct);
  const prevPercentRef = useRef<number>(clampedPct);
  const burstStartRef = useRef<number | null>(null);
  const burstShardsRef = useRef<BurstShard[]>(buildBurstShards(compact));
  const redrawClientRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const prev = prevPercentRef.current;
    if (prev < 100 && clampedPct >= 100) {
      burstStartRef.current = performance.now();
    } else if (clampedPct < 50) {
      burstStartRef.current = null;
    }
    prevPercentRef.current = clampedPct;
    percentRef.current = clampedPct;
    redrawClientRef.current?.();
  }, [clampedPct]);

  useEffect(() => {
    burstShardsRef.current = buildBurstShards(compact);
  }, [compact]);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pad = mini ? 7 : compact ? 12 : 16;

    let width = host.clientWidth;
    let height = host.clientHeight;
    let borderX = Math.max(0, Math.round((host.offsetWidth - width) / 2));
    let borderY = Math.max(0, Math.round((host.offsetHeight - height) / 2));
    let clipPath: Path2D | null = null;

    let perimeterSamples: PerimeterPoint[] = [];
    const layerPoints: Point2D[] = [];

    const rebuildPerimeterCache = () => {
      const boxX = pad - borderX;
      const boxY = pad - borderY;
      const boxW = width + borderX * 2;
      const boxH = height + borderY * 2;
      perimeterSamples = buildRoundedRectSamples(boxX, boxY, boxW, boxH, radius, compact, mini);

      if (layerPoints.length !== perimeterSamples.length) {
        layerPoints.length = 0;
        for (let i = 0; i < perimeterSamples.length; i++) {
          layerPoints.push({ x: 0, y: 0 });
        }
      }
    };

    const syncSize = (): boolean => {
      width = host.clientWidth;
      height = host.clientHeight;
      if (width <= 0 || height <= 0) {
        clipPath = null;
        perimeterSamples = [];
        return false;
      }

      borderX = Math.max(0, Math.round((host.offsetWidth - width) / 2));
      borderY = Math.max(0, Math.round((host.offsetHeight - height) / 2));

      const rawDpr = window.devicePixelRatio || 1;
      const dpr = isLowPowerDevice() || mini || compact ? 1 : Math.min(rawDpr, 1.15);
      const canvasW = width + pad * 2;
      const canvasH = height + pad * 2;
      const cw = Math.max(1, Math.round(canvasW * dpr));
      const ch = Math.max(1, Math.round(canvasH * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const boxX = pad - borderX;
      const boxY = pad - borderY;
      const boxW = width + borderX * 2;
      const boxH = height + borderY * 2;

      if (typeof Path2D !== 'undefined' && boxW > 0 && boxH > 0) {
        const nextClip = new Path2D();
        nextClip.rect(0, 0, canvasW, canvasH);
        appendRoundedRectSubPath(nextClip, boxX, boxY, boxW, boxH, radius);
        clipPath = nextClip;
      } else {
        clipPath = null;
      }

      rebuildPerimeterCache();
      return perimeterSamples.length > 0;
    };

    const drawFrame = (now: number, visibleCount: number, isDark: boolean) => {
      const ptCount = perimeterSamples.length;
      if (width <= 0 || height <= 0 || ptCount === 0) return;

      const curPct = percentRef.current;
      const canvasW = width + pad * 2;
      const canvasH = height + pad * 2;

      if (curPct < 50) {
        ctx.clearRect(0, 0, canvasW, canvasH);
        return;
      }

      const ratio = (curPct - 50) / 50; // 0 at 50%, 1 at 100%
      const isMax = curPct >= 100;
      const t = prefersReducedMotion ? 1.2 : now * 0.001;

      ctx.clearRect(0, 0, canvasW, canvasH);

      // Compute one-shot 100% explosion surge progress if active
      let burstP = -1;
      let surgeBoost = 1;
      if (burstStartRef.current !== null && !prefersReducedMotion) {
        const elapsed = now - burstStartRef.current;
        if (elapsed >= BURST_DURATION_MS) {
          burstStartRef.current = null;
        } else {
          burstP = elapsed / BURST_DURATION_MS;
          surgeBoost = 1 + 0.34 * (1 - burstP);
        }
      }

      const baseMaxH = mini
        ? 2.4 + ratio * 2.0
        : compact
          ? 5.2 + ratio * 4.4
          : 6.4 + ratio * 5.8;
      const edgeHeadroom = Math.max(2, pad - Math.max(borderX, borderY) - (mini ? 0.8 : 1.5));
      const maxWaveH = Math.min(edgeHeadroom / 1.12, baseMaxH * surgeBoost);

      const t21 = t * 2.1;
      const t15 = t * 1.5;
      const t34 = t * 3.4;
      const t56 = t * 5.6;
      const t39 = t * 3.9;
      const curlAmp = (0.45 + ratio * 0.55) * (mini ? 0.55 : 1) * 1.85;

      const boxX = pad - borderX;
      const boxY = pad - borderY;
      const boxW = width + borderX * 2;
      const boxH = height + borderY * 2;

      ctx.save();
      if (clipPath) {
        ctx.clip(clipPath, 'evenodd');
      } else {
        ctx.beginPath();
        ctx.rect(0, 0, canvasW, canvasH);
        appendRoundedRectSubPath(ctx, boxX, boxY, boxW, boxH, radius);
        ctx.clip('evenodd');
      }

      const activeLayers = mini
        ? isMax
          ? isDark
            ? MAX_MINI_VIOLET_LAYERS_DARK
            : MAX_MINI_VIOLET_LAYERS_LIGHT
          : MINI_LAYERS
        : isMax
          ? isDark
            ? MAX_VIOLET_LAYERS_DARK
            : MAX_VIOLET_LAYERS_LIGHT
          : NORMAL_LAYERS;

      const skipOuterHalo = isLowPowerDevice() || (compact && visibleCount >= 3);
      const startLayer = skipOuterHalo && activeLayers.length > 2 ? 1 : 0;

      for (let lIdx = startLayer; lIdx < activeLayers.length; lIdx++) {
        const layer = activeLayers[lIdx];
        const heightScaleMul = maxWaveH * layer.heightScale;

        for (let i = 0; i < ptCount; i++) {
          const pt = perimeterSamples[i];
          const wave = computeWaveHeightCached(pt, t21, t15, t34, t56, layer.phaseOffset);
          const disp = wave * heightScaleMul;
          const curl = Math.sin(pt.u9 - t39 + layer.phaseOffset) * wave * curlAmp;

          layerPoints[i].x = pt.px + pt.dispX * disp + pt.curlX * curl;
          layerPoints[i].y = pt.py + pt.dispY * disp + pt.curlY * curl;
        }

        drawSmoothClosedWave(ctx, layerPoints);
        ctx.fillStyle = layer.fillStyle;
        ctx.fill();
      }

      // Batched floating ember sparks drifting off flame crests (2-3 fill calls total instead of 17)
      if (!prefersReducedMotion && ratio > 0.1) {
        const rawEmbers = mini ? 2 + ratio * 2 : compact ? 4 + ratio * 4 : 6 + ratio * 8;
        const emberScale = visibleCount >= 6 ? 0.65 : 1;
        const emberCount = Math.min(MAX_EMBERS, Math.max(1, Math.round(rawEmbers * emberScale)));

        EMBER_BUCKET_COLORS[0] = isMax ? (isDark ? '#F5F3FF' : '#EDE9FE') : '#FEF08A';
        EMBER_BUCKET_COLORS[1] = isMax ? (isDark ? '#F472B6' : '#DB2777') : '#FB923C';
        EMBER_BUCKET_COLORS[2] = isMax ? (isDark ? '#A855F7' : '#7C3AED') : '#FB923C';
        EMBER_BUCKET_COUNTS[0] = 0;
        EMBER_BUCKET_COUNTS[1] = 0;
        EMBER_BUCKET_COUNTS[2] = 0;

        for (let e = 0; e < emberCount; e++) {
          const cycle = (t * 1.15 + e * 0.27) % 1;
          const u = (e + 0.5) / emberCount + Math.sin(e * 4.1) * 0.02;
          const pt = lookupPerimeterByU(perimeterSamples, u);
          const tEmber = t - cycle * 0.25;
          const crestH =
            computeWaveHeightCached(pt, tEmber * 2.1, tEmber * 1.5, tEmber * 3.4, tEmber * 5.6, 0.42) *
            maxWaveH;
          const dist = crestH * 0.8 + (mini ? 0.8 : 1.2) + cycle * (mini ? 2.5 : compact ? 4 : 5.5);
          const ex = pt.px + pt.nx * dist + Math.sin(cycle * 7 + e * 2.3) * (mini ? 1.1 : 2);
          const ey = pt.py + pt.ny * dist - cycle * (mini ? 2.5 : compact ? 2.8 : 4);
          const maxEr = mini ? 1.05 : isMax ? 1.7 : 1.35;
          const er = Math.max(mini ? 0.5 : 0.65, (1 - cycle) * maxEr);

          const bIdx = cycle < 0.42 ? 0 : isMax && e % 4 === 0 ? 1 : isMax ? 2 : 1;
          const slotIdx = EMBER_BUCKET_COUNTS[bIdx]++;
          EMBER_X[bIdx][slotIdx] = ex;
          EMBER_Y[bIdx][slotIdx] = ey;
          EMBER_R[bIdx][slotIdx] = er;
        }

        const bucketLimit = isMax ? 3 : 2;
        for (let b = 0; b < bucketLimit; b++) {
          const cnt = EMBER_BUCKET_COUNTS[b];
          if (cnt === 0) continue;
          ctx.beginPath();
          const xs = EMBER_X[b];
          const ys = EMBER_Y[b];
          const rs = EMBER_R[b];
          for (let i = 0; i < cnt; i++) {
            const x0 = xs[i];
            const y0 = ys[i];
            const r0 = rs[i];
            ctx.moveTo(x0 + r0, y0);
            ctx.arc(x0, y0, r0, 0, TAU);
          }
          ctx.fillStyle = EMBER_BUCKET_COLORS[b];
          ctx.fill();
        }
      }

      // Crisp 4-point anime star sparkles at >= 80% & 100% (disabled on mini button outlines)
      if (!mini && curPct >= 80) {
        const starCount = isMax ? (compact ? 4 : 7) : compact ? 2 : 4;
        const offset = maxWaveH * 0.82 + (compact ? 2.2 : 3.2);
        for (let s = 0; s < starCount; s++) {
          const u = (s + 0.22) / starCount;
          const pt = lookupPerimeterByU(perimeterSamples, u);
          const pulse = prefersReducedMotion ? 0.85 : 0.55 + 0.45 * Math.sin(t * 4.8 + s * 1.9);
          if (pulse < 0.34) continue;
          const sx = pt.px + pt.nx * offset;
          const sy = pt.py + pt.ny * offset - 1;
          const outerR = (compact ? 2.6 : 3.4) * pulse;
          const fill = isMax
            ? s % 3 === 0
              ? '#FFFFFF'
              : s % 3 === 1
                ? '#DDD6FE'
                : '#F9A8D4'
            : s % 2 === 0
              ? '#FEF08A'
              : '#FDE047';
          const stroke = isMax ? 'rgba(76, 29, 149, 0.85)' : 'rgba(120, 53, 15, 0.7)';
          drawStarSpark(ctx, sx, sy, outerR, fill, stroke, t * 1.6 + s);
        }
      }

      // One-shot 100% Sakuga perimeter explosion burst
      if (burstP >= 0) {
        const invP = 1 - burstP;
        const ease = 1 - invP * invP * invP;
        const alpha = Math.max(0, 1 - burstP * Math.sqrt(burstP));

        ctx.save();
        ctx.globalAlpha = alpha;

        const ringExpand = ease * (compact ? 9 : 12);
        drawRoundedRectStroke(
          ctx,
          boxX - ringExpand,
          boxY - ringExpand,
          boxW + ringExpand * 2,
          boxH + ringExpand * 2,
          radius + ringExpand * 0.65
        );
        ctx.strokeStyle = burstP < 0.45 ? '#DDD6FE' : '#7C3AED';
        ctx.lineWidth = Math.max(0.9, invP * 2.8);
        ctx.stroke();

        const shards = burstShardsRef.current;
        for (let i = 0; i < shards.length; i++) {
          const shard = shards[i];
          const pt = lookupPerimeterByU(perimeterSamples, shard.u);
          const dist = ease * shard.speed;
          const px = pt.px + pt.nx * dist + shard.jitter * 4 * ease;
          const py = pt.py + pt.ny * dist + shard.jitter * 4 * ease;
          const curSize = shard.size * (1 - burstP * 0.45);
          if (shard.isStar) {
            drawStarSpark(ctx, px, py, curSize * 1.45, shard.color, '#18181B', ease * 2.4);
          } else {
            ctx.beginPath();
            ctx.arc(px, py, curSize, 0, TAU);
            ctx.fillStyle = shard.color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(24, 24, 27, 0.55)';
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      ctx.restore();
    };

    const client: FireClient = {
      host,
      isIntersecting: false,
      hasSize: false,
      isVisible: false,
      lastDraw: 0,
      draw: drawFrame,
      hasBurst: () => burstStartRef.current !== null && !prefersReducedMotion,
    };

    redrawClientRef.current = () => {
      if (!client.isVisible) return;
      const now = performance.now();
      client.lastDraw = now;
      drawFrame(now, Math.max(1, visibleClients.size), isDarkModeActive());
      if (client.hasBurst()) {
        ensureCoordinatorLoop();
      }
    };

    const ro = new ResizeObserver(() => {
      const sized = syncSize();
      const wasVisible = client.isVisible;
      client.hasSize = sized;
      syncClientActiveSet(client);
      if (client.isVisible) {
        const now = performance.now();
        client.lastDraw = now;
        drawFrame(now, Math.max(1, visibleClients.size), isDarkModeActive());
        if (!wasVisible) {
          ensureCoordinatorLoop();
        }
      } else if (wasVisible && visibleClients.size === 0) {
        stopCoordinatorLoop();
      }
    });
    ro.observe(host);

    client.hasSize = syncSize();
    registerFireClient(client);
    if (client.isVisible) {
      const now = performance.now();
      client.lastDraw = now;
      drawFrame(now, Math.max(1, visibleClients.size), isDarkModeActive());
    }

    return () => {
      redrawClientRef.current = null;
      unregisterFireClient(client);
      ro.disconnect();
    };
  }, [active, compact, mini, radius]);

  if (!active) return null;

  const pad = mini ? 7 : compact ? 12 : 16;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        top: -pad,
        right: -pad,
        bottom: -pad,
        left: -pad,
        width: `calc(100% + ${pad * 2}px)`,
        height: `calc(100% + ${pad * 2}px)`,
      }}
      className="pointer-events-none absolute z-20"
    />
  );
};

export const SakugaBorderFire = memo(SakugaBorderFireComponent);
SakugaBorderFire.displayName = 'SakugaBorderFire';
