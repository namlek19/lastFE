import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { StudyMode } from '../types/quiz';
import { isLowPowerDevice } from '../utils/perfTier';

export interface SakugaLuminousButterflyProps {
  mode: StudyMode;
}

interface Vec2 {
  x: number;
  y: number;
}

interface ArcSample {
  x: number;
  y: number;
  cumLen: number;
}

interface ArcLengthLut {
  samples: ArcSample[];
  totalLen: number;
}

interface TrailSlot {
  active: boolean;
  birth: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

interface ShatterMiniButterfly {
  id: number;
  tx: number;
  ty: number;
  midX: number;
  midY: number;
  scale: number;
  startRot: number;
  endRot: number;
  duration: number;
  delay: number;
  variant: 0 | 1 | 2;
}

interface ShatterShard {
  id: number;
  tx: number;
  ty: number;
  rot: number;
  scale: number;
  duration: number;
  delay: number;
  color: string;
  strokeColor: string;
  points: string;
}

interface ShatterMote {
  id: number;
  tx: number;
  ty: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
  isStar: boolean;
}

interface ShatterBurst {
  id: number;
  x: number;
  y: number;
  shieldActive: boolean;
  minis: ShatterMiniButterfly[];
  shards: ShatterShard[];
  motes: ShatterMote[];
}

const FIRST_VISIT_MIN_MS = 25000;
const FIRST_VISIT_MAX_MS = 45000;
const COOLDOWN_MIN_MS = 180000;
const COOLDOWN_MAX_MS = 360000;
const TRAIL_POOL_SIZE = 7;

const SHARD_SHAPES = [
  '0,-6 5,2 -2,5',
  '0,-7 4,0 0,7 -4,0',
  '-4,-4 6,-1 1,6',
  '0,-6 6,4 -4,2',
] as const;

const SHARD_PALETTE_LIGHT = [
  { color: '#312E81', strokeColor: '#E0E7FF' },
  { color: '#0284C7', strokeColor: '#E0F2FE' },
  { color: '#6D28D9', strokeColor: '#EDE9FE' },
  { color: '#DB2777', strokeColor: '#FCE7F3' },
] as const;

const SHARD_PALETTE_DARK = [
  { color: '#FFFFFF', strokeColor: '#7C3AED' },
  { color: '#A5F3FC', strokeColor: '#0891B2' },
  { color: '#DDD6FE', strokeColor: '#7C3AED' },
  { color: '#F9A8D4', strokeColor: '#BE185D' },
] as const;

const TRAIL_COLORS_LIGHT = ['#4338CA', '#7C3AED', '#0284C7', '#DB2777'] as const;
const TRAIL_COLORS_DARK = ['#FFFFFF', '#E0F2FE', '#DDD6FE', '#FBCFE8'] as const;

function isDarkModeActive(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

function randBetween(min: number, max: number): number {
  return min + Math.random() * Math.max(0, max - min);
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function getViewportSize(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: 1280, h: 720 };
  return {
    w: Math.round(window.visualViewport?.width ?? window.innerWidth),
    h: Math.round(window.visualViewport?.height ?? window.innerHeight),
  };
}

function getHeaderSafeTop(vw: number, vh: number): number {
  if (typeof document !== 'undefined') {
    const headerRect = document.querySelector('header')?.getBoundingClientRect();
    if (headerRect && headerRect.height > 0) {
      if (headerRect.bottom <= 0) {
        return 20;
      }
      return Math.min(Math.round(headerRect.bottom + 14), Math.round(vh * 0.45));
    }
  }
  return vw >= 768 ? 82 : 178;
}

function catmullRom1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function sampleSpline(points: Vec2[], progress: number): Vec2 {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return points[0];

  const clamped = clamp(progress, 0, 1);
  const scaled = clamped * (n - 1);
  const idx = Math.min(n - 2, Math.floor(scaled));
  const localT = scaled - idx;

  const p0 = points[Math.max(0, idx - 1)];
  const p1 = points[idx];
  const p2 = points[idx + 1];
  const p3 = points[Math.min(n - 1, idx + 2)];

  return {
    x: catmullRom1D(p0.x, p1.x, p2.x, p3.x, localT),
    y: catmullRom1D(p0.y, p1.y, p2.y, p3.y, localT),
  };
}

/**
 * Generates a serene, strictly left->right or right->left sweeping glide path
 * with 3 evenly spaced interior waypoints and flowing vertical undulations.
 */
function buildSmoothFlightPath(): Vec2[] {
  const { w: vw, h: vh } = getViewportSize();
  const minY = getHeaderSafeTop(vw, vh) + 16;
  const maxY = Math.max(minY + 90, Math.round(vh * (vw < 768 ? 0.7 : 0.82)));
  const spanY = maxY - minY;

  const enterFromLeft = Math.random() < 0.5;
  const startX = enterFromLeft ? -40 : vw + 40;
  const endX = enterFromLeft ? vw + 40 : -40;

  // Monotonic interior X fractions guarantee graceful gliding with zero erratic turnbacks
  const baseFractions = [0.25, 0.52, 0.78];
  const interiorXs = baseFractions.map((frac) => {
    const f = frac + randBetween(-0.06, 0.06);
    return Math.round((enterFromLeft ? f : 1 - f) * vw);
  });

  const ys: number[] = [];
  let curY = randBetween(minY + spanY * 0.14, maxY - spanY * 0.14);
  let trend = curY < minY + spanY * 0.5 ? 1 : -1;

  for (let i = 0; i < 5; i++) {
    ys.push(Math.round(clamp(curY, minY, maxY)));
    if (i === 1 && Math.random() < 0.75) {
      trend = -trend;
    } else if (i === 3 && Math.random() < 0.5) {
      trend = -trend;
    }
    curY = clamp(curY + trend * randBetween(spanY * 0.16, spanY * 0.36), minY, maxY);
    if (curY <= minY + 6 || curY >= maxY - 6) {
      trend = -trend;
    }
  }

  return [
    { x: startX, y: ys[0] },
    { x: interiorXs[0], y: ys[1] },
    { x: interiorXs[1], y: ys[2] },
    { x: interiorXs[2], y: ys[3] },
    { x: endX, y: ys[4] },
  ];
}

function buildArcLengthLut(points: Vec2[], steps = 180): ArcLengthLut {
  const samples: ArcSample[] = [];
  let prev = sampleSpline(points, 0);
  let cumLen = 0;
  samples.push({ x: prev.x, y: prev.y, cumLen: 0 });

  for (let i = 1; i <= steps; i++) {
    const pt = sampleSpline(points, i / steps);
    cumLen += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    samples.push({ x: pt.x, y: pt.y, cumLen });
    prev = pt;
  }

  return { samples, totalLen: Math.max(1, cumLen) };
}

function sampleByArcLength(
  lut: ArcLengthLut,
  fraction: number
): { x: number; y: number; tx: number; ty: number } {
  const { samples, totalLen } = lut;
  const n = samples.length;
  const targetDist = clamp(fraction, 0, 1) * totalLen;

  let lo = 0;
  let hi = n - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (samples[mid].cumLen <= targetDist) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  const a = samples[lo];
  const b = samples[lo + 1];
  const segLen = b.cumLen - a.cumLen;
  const localT = segLen > 1e-5 ? (targetDist - a.cumLen) / segLen : 0;

  const x = a.x + (b.x - a.x) * localT;
  const y = a.y + (b.y - a.y) * localT;

  const tPrev = samples[Math.max(0, lo - 2)];
  const tNext = samples[Math.min(n - 1, lo + 3)];
  const dx = tNext.x - tPrev.x;
  const dy = tNext.y - tPrev.y;
  const mag = Math.hypot(dx, dy) || 1;

  return { x, y, tx: dx / mag, ty: dy / mag };
}

function createShatterBurst(id: number, x: number, y: number): ShatterBurst {
  const isDark = isDarkModeActive();
  const shardPalette = isDark ? SHARD_PALETTE_DARK : SHARD_PALETTE_LIGHT;
  const trailPalette = isDark ? TRAIL_COLORS_DARK : TRAIL_COLORS_LIGHT;

  const minis: ShatterMiniButterfly[] = Array.from({ length: 6 }, (_, i) => {
    const angleDeg = i * 60 + randBetween(-18, 18);
    const rad = (angleDeg * Math.PI) / 180;
    const dist = randBetween(68, 165);
    const tx = Math.cos(rad) * dist;
    const ty = Math.sin(rad) * dist - randBetween(12, 38);
    const perpX = -Math.sin(rad) * randBetween(-26, 26);
    const perpY = Math.cos(rad) * randBetween(-18, 18);
    const startRot = angleDeg + 90 + randBetween(-22, 22);
    return {
      id: i,
      tx,
      ty,
      midX: tx * 0.48 + perpX,
      midY: ty * 0.44 + perpY - 10,
      scale: randBetween(0.55, 0.92),
      startRot,
      endRot: startRot + randBetween(-34, 34),
      duration: randBetween(1.15, 1.65),
      delay: randBetween(0, 0.08),
      variant: (i % 3) as 0 | 1 | 2,
    };
  });

  const shards: ShatterShard[] = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2 + randBetween(-0.26, 0.26);
    const dist = randBetween(45, 145);
    const swatch = shardPalette[i % shardPalette.length];
    return {
      id: i,
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist - randBetween(4, 22),
      rot: randBetween(-240, 240),
      scale: randBetween(0.65, 1.2),
      duration: randBetween(0.65, 1.05),
      delay: randBetween(0, 0.06),
      color: swatch.color,
      strokeColor: swatch.strokeColor,
      points: SHARD_SHAPES[i % SHARD_SHAPES.length],
    };
  });

  const motes: ShatterMote[] = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + randBetween(-0.3, 0.3);
    const dist = randBetween(25, 120);
    return {
      id: i,
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist - randBetween(6, 26),
      size: randBetween(3, 6),
      duration: randBetween(0.75, 1.35),
      delay: randBetween(0, 0.1),
      color: trailPalette[i % trailPalette.length],
      isStar: i % 3 === 0,
    };
  });

  return { id, x, y, shieldActive: true, minis, shards, motes };
}

interface OrigamiButterflySvgProps {
  leftWingRef: React.RefObject<HTMLDivElement>;
  rightWingRef: React.RefObject<HTMLDivElement>;
  coreGlowRef: React.RefObject<HTMLSpanElement>;
}

/**
 * Luminous origami swallowtail butterfly (38x36px) with high-contrast dark jewel facets
 * in Light Mode and radiant prism white/violet/cyan facets in Dark Mode (100% Zero-Gradient).
 */
const OrigamiButterflySvg: React.FC<OrigamiButterflySvgProps> = memo(
  ({ leftWingRef, rightWingRef, coreGlowRef }) => {
    const wingGlowClass = 'h-full w-full overflow-visible';

    return (
      <div className="relative flex h-[36px] w-[38px] scale-90 items-center justify-center md:scale-100">
        {/* Pinpoint luminous core aura using cheap box-shadow (zero filter blur pass) */}
        <span
          ref={coreGlowRef}
          aria-hidden="true"
          className="pointer-events-none absolute h-[14px] w-[14px] rounded-full bg-[#6366F1]/45 shadow-[0_0_14px_4px_rgba(124,58,237,0.38)] dark:bg-[#E0F2FE]/80 dark:shadow-[0_0_16px_5px_rgba(103,232,249,0.55)]"
        />

        {/* Left 3D origami wing layer */}
        <div
          ref={leftWingRef}
          style={{ transformOrigin: '50% 47%' }}
          className="pointer-events-none absolute inset-0 will-change-transform"
        >
          <svg viewBox="0 0 36 34" aria-hidden="true" className={wingGlowClass}>
            <polygon
              points="18,14 1.5,5 12,18"
              className="fill-[#312E81] stroke-[#E0E7FF]/55 dark:fill-[#FFFFFF] dark:[stroke:none]"
              strokeWidth="0.45"
              strokeLinejoin="round"
            />
            <polygon
              points="18,14 12,18 17.4,19"
              className="fill-[#4F46E5] stroke-[#E0E7FF]/55 dark:fill-[#DDD6FE] dark:[stroke:none]"
              strokeWidth="0.45"
              strokeLinejoin="round"
            />
            <polygon
              points="17.6,18 8.5,20 12.2,31.5"
              className="fill-[#1E1B4B] stroke-[#E0E7FF]/55 dark:fill-[#F5F3FF] dark:[stroke:none]"
              strokeWidth="0.45"
              strokeLinejoin="round"
            />
            <polygon
              points="17.6,18 12.2,31.5 16.2,24.5"
              className="fill-[#DB2777] stroke-[#E0E7FF]/55 dark:fill-[#F472B6] dark:[stroke:none]"
              strokeWidth="0.45"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Right 3D origami wing layer */}
        <div
          ref={rightWingRef}
          style={{ transformOrigin: '50% 47%' }}
          className="pointer-events-none absolute inset-0 will-change-transform"
        >
          <svg viewBox="0 0 36 34" aria-hidden="true" className={wingGlowClass}>
            <polygon
              points="18,14 34.5,5 24,18"
              className="fill-[#3730A3] stroke-[#E0E7FF]/55 dark:fill-[#FFFFFF] dark:[stroke:none]"
              strokeWidth="0.45"
              strokeLinejoin="round"
            />
            <polygon
              points="18,14 24,18 18.6,19"
              className="fill-[#6D28D9] stroke-[#E0E7FF]/55 dark:fill-[#E0E7FF] dark:[stroke:none]"
              strokeWidth="0.45"
              strokeLinejoin="round"
            />
            <polygon
              points="18.4,18 27.5,20 23.8,31.5"
              className="fill-[#1E1B4B] stroke-[#E0E7FF]/55 dark:fill-[#FFFFFF] dark:[stroke:none]"
              strokeWidth="0.45"
              strokeLinejoin="round"
            />
            <polygon
              points="18.4,18 23.8,31.5 19.8,24.5"
              className="fill-[#0284C7] stroke-[#E0E7FF]/55 dark:fill-[#C4B5FD] dark:[stroke:none]"
              strokeWidth="0.45"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Pinpoint origami spine */}
        <svg
          viewBox="0 0 36 34"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          <polygon
            points="18,11.5 18.8,17 18,22 17.2,17"
            className="fill-[#0F172A] stroke-[#E0E7FF]/55 dark:fill-[#FFFFFF] dark:[stroke:none]"
            strokeWidth="0.4"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }
);

OrigamiButterflySvg.displayName = 'OrigamiButterflySvg';

const MINI_VARIANT_CLASSES: Record<
  0 | 1 | 2,
  { leftTop: string; leftBottom: string; rightTop: string; rightBottom: string }
> = {
  0: {
    leftTop: 'fill-[#312E81] dark:fill-[#FFFFFF]',
    leftBottom: 'fill-[#0284C7] dark:fill-[#E0F2FE]',
    rightTop: 'fill-[#1E1B4B] dark:fill-[#E0F2FE]',
    rightBottom: 'fill-[#4F46E5] dark:fill-[#A5F3FC]',
  },
  1: {
    leftTop: 'fill-[#3730A3] dark:fill-[#FFFFFF]',
    leftBottom: 'fill-[#6D28D9] dark:fill-[#EDE9FE]',
    rightTop: 'fill-[#312E81] dark:fill-[#EDE9FE]',
    rightBottom: 'fill-[#7C3AED] dark:fill-[#DDD6FE]',
  },
  2: {
    leftTop: 'fill-[#4C1D95] dark:fill-[#FFFFFF]',
    leftBottom: 'fill-[#DB2777] dark:fill-[#FCE7F3]',
    rightTop: 'fill-[#312E81] dark:fill-[#FCE7F3]',
    rightBottom: 'fill-[#BE185D] dark:fill-[#FBCFE8]',
  },
};

const MiniOrigamiButterflySvg: React.FC<{ variant: 0 | 1 | 2; flapDuration: number }> = memo(
  ({ variant, flapDuration }) => {
    const palette = MINI_VARIANT_CLASSES[variant];
    const animStyle = { animationDuration: `${flapDuration}s` };

    return (
      <div className="relative h-6 w-6">
        <svg
          viewBox="0 0 28 26"
          aria-hidden="true"
          style={animStyle}
          className="bf-mini-wing-l pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          <polygon
            points="14,11 1.5,4 9.5,14.5"
            className={`${palette.leftTop} stroke-[#E0E7FF]/45 dark:[stroke:none]`}
            strokeWidth="0.4"
            strokeLinejoin="round"
          />
          <polygon
            points="13.7,14 6.5,15.5 9.5,24.5"
            className={`${palette.leftBottom} stroke-[#E0E7FF]/45 dark:[stroke:none]`}
            strokeWidth="0.4"
            strokeLinejoin="round"
          />
        </svg>
        <svg
          viewBox="0 0 28 26"
          aria-hidden="true"
          style={animStyle}
          className="bf-mini-wing-r pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          <polygon
            points="14,11 26.5,4 18.5,14.5"
            className={`${palette.rightTop} stroke-[#E0E7FF]/45 dark:[stroke:none]`}
            strokeWidth="0.4"
            strokeLinejoin="round"
          />
          <polygon
            points="14.3,14 21.5,15.5 18.5,24.5"
            className={`${palette.rightBottom} stroke-[#E0E7FF]/45 dark:[stroke:none]`}
            strokeWidth="0.4"
            strokeLinejoin="round"
          />
        </svg>
        <svg
          viewBox="0 0 28 26"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          <polygon
            points="14,9 14.7,13.5 14,18 13.3,13.5"
            className="fill-[#0F172A] dark:fill-[#FFFFFF]"
          />
        </svg>
      </div>
    );
  }
);

MiniOrigamiButterflySvg.displayName = 'MiniOrigamiButterflySvg';

export const SakugaLuminousButterfly: React.FC<SakugaLuminousButterflyProps> = memo(({mode}) => {
  const prefersReducedMotion = Boolean(useReducedMotion());
            const isDisabled = mode === 'exam' || prefersReducedMotion;

            const [isVisible, setIsVisible] = useState(false);
            const [bursts, setBursts] = useState<ShatterBurst[]>([]);

            const mvX = useMotionValue(-100);
            const mvY = useMotionValue(-100);
            const mvRotate = useMotionValue(0);
            const mvOpacity = useMotionValue(0);

            const leftWingRef = useRef<HTMLDivElement>(null);
              const rightWingRef = useRef<HTMLDivElement>(null);
                const coreGlowRef = useRef<HTMLSpanElement>(null);

                  const isVisibleRef = useRef(false);
                  const hasVisitedOnceRef = useRef(false);

                  const spawnTimerRef = useRef<number | null>(null);
                  const rafRef = useRef<number | null>(null);
                  const burstTimersRef = useRef<number[]>([]);
                  const idCounterRef = useRef(1);
                  const startFlightRef = useRef<(() => void) | null>(null);

                  const trailElRefs = useRef<Array<HTMLSpanElement | null>>([]);
                    const trailSlotsRef = useRef<TrailSlot[]>(
                    Array.from({length: TRAIL_POOL_SIZE }, () => ({
                      active: false,
                    birth: 0,
                    x: 0,
                    y: 0,
                    vx: 0,
                    vy: 0,
                    size: 3,
                    color: '#FFFFFF',
    }))
                    );
                    const trailCursorRef = useRef(0);

  const nextId = () => {
                      idCounterRef.current += 1;
                    return idCounterRef.current;
  };

  const resetTrailPool = useCallback(() => {
    for (let i = 0; i < TRAIL_POOL_SIZE; i++) {
                      trailSlotsRef.current[i].active = false;
                    const el = trailElRefs.current[i];
                    if (el) {
                      el.style.opacity = '0';
      }
    }
  }, []);

  const cancelFlightLoop = useCallback(() => {
    if (rafRef.current !== null) {
                      window.cancelAnimationFrame(rafRef.current);
                    rafRef.current = null;
    }
  }, []);

  const clearSpawnTimer = useCallback(() => {
    if (spawnTimerRef.current !== null) {
                      window.clearTimeout(spawnTimerRef.current);
                    spawnTimerRef.current = null;
    }
  }, []);

  const clearBurstTimers = useCallback(() => {
    for (const id of burstTimersRef.current) {
                      window.clearTimeout(id);
    }
                    burstTimersRef.current = [];
  }, []);

                    const scheduleVisit = useCallback(
    (isInitial: boolean) => {
                      clearSpawnTimer();
                    if (isDisabled || document.visibilityState === 'hidden' || isVisibleRef.current) return;
                    const delay = isInitial
                    ? Math.round(randBetween(FIRST_VISIT_MIN_MS, FIRST_VISIT_MAX_MS))
                    : Math.round(randBetween(COOLDOWN_MIN_MS, COOLDOWN_MAX_MS));

      spawnTimerRef.current = window.setTimeout(() => {
                      spawnTimerRef.current = null;
                    startFlightRef.current?.();
      }, delay);
    },
                    [clearSpawnTimer, isDisabled]
                    );

  useEffect(() => {
    if (isDisabled) {
                      clearSpawnTimer();
                    cancelFlightLoop();
                    clearBurstTimers();
                    resetTrailPool();
                    isVisibleRef.current = false;
                    setIsVisible(false);
                    setBursts([]);
                    return;
    }

                    let unmounted = false;

    const startFlight = () => {
      if (unmounted || isDisabled || document.visibilityState === 'hidden') return;
                    cancelFlightLoop();
                    resetTrailPool();

                    const path = buildSmoothFlightPath();
                    const lut = buildArcLengthLut(path, 180);
                    const speedPxPerSec = randBetween(92, 118);
                    const durationMs = clamp((lut.totalLen / speedPxPerSec) * 1000, 7500, 18000);

      const startTime = performance.now();
      let prevNow = startTime;
      let lastDrawNow = 0;
      let lastTrailSpawn = startTime;
      const minStepMs = isLowPowerDevice() ? 32 : 18;

      const initSample = sampleByArcLength(lut, 0);
      let curAngle = Math.atan2(initSample.ty, initSample.tx) * (180 / Math.PI) + 90;

      mvX.set(initSample.x);
      mvY.set(initSample.y);
      mvRotate.set(curAngle);
      mvOpacity.set(0);

      isVisibleRef.current = true;
      hasVisitedOnceRef.current = true;
      setIsVisible(true);

      const step = (now: number) => {
        if (unmounted || !isVisibleRef.current) return;

        if (minStepMs > 0 && lastDrawNow !== 0 && now - lastDrawNow < minStepMs) {
          rafRef.current = window.requestAnimationFrame(step);
          return;
        }
        lastDrawNow = now;

        const elapsed = now - startTime;
        const dt = Math.min(0.05, Math.max(0.001, (now - prevNow) / 1000));
        prevNow = now;

                    const s = Math.min(1, elapsed / durationMs);
                    const sample = sampleByArcLength(lut, s);

                    // Drive true 3D perspective wing-flapping & occasional open-wing glide at 60fps
                    const beatSec = elapsed * 0.001;
                    const glideMix = clamp((Math.sin(beatSec * 1.15) - 0.72) / 0.28, 0, 1);
                    const rawWave = 0.5 - 0.5 * Math.cos(beatSec * Math.PI * 6.2);
                    const flapCurve = rawWave * (0.86 + 0.14 * rawWave); // 0 = wide open, 1 = folded up
                    const activeFlapDeg = -14 + flapCurve * 88; // -14deg .. +74deg
                    const glideDeg = 10 + Math.sin(beatSec * 4.5) * 8;
                    const wingDeg = activeFlapDeg * (1 - glideMix) + glideDeg * glideMix;

                    if (leftWingRef.current) {
                      leftWingRef.current.style.transform = `perspective(95px) rotateY(${wingDeg.toFixed(1)}deg)`;
        }
                    if (rightWingRef.current) {
                      rightWingRef.current.style.transform = `perspective(95px) rotateY(${(-wingDeg).toFixed(1)}deg)`;
        }
                    if (coreGlowRef.current) {
          const openAmt = 1 - clamp((wingDeg + 14) / 88, 0, 1);
                    coreGlowRef.current.style.transform = `scale(${(0.88 + openAmt * 0.34).toFixed(2)})`;
                    coreGlowRef.current.style.opacity = (0.42 + openAmt * 0.42).toFixed(2);
        }

                    // Gentle perpendicular air-current drift + aerodynamic lift from wing downstroke
                    const sway = Math.sin(elapsed * 0.0034) * 9;
                    const wingLift = (1 - flapCurve) * (1 - glideMix) * 3.2;
                    const liveX = sample.x + -sample.ty * sway;
                    const liveY = sample.y + sample.tx * sway - wingLift;

                    const targetDeg =
                    Math.atan2(sample.ty, sample.tx) * (180 / Math.PI) +
                    90 +
                    Math.cos(elapsed * 0.0034) * 5;
                    const deltaDeg = ((targetDeg - curAngle + 540) % 360) - 180;
                    const alpha = 1 - Math.exp(-dt * 6);
                    curAngle += deltaDeg * alpha;

                    const fadeIn = Math.min(1, elapsed / 600);
                    const fadeOut = Math.min(1, Math.max(0, (durationMs - elapsed) / 600));
                    mvOpacity.set(Math.min(fadeIn, fadeOut));
                    mvX.set(liveX);
                    mvY.set(liveY);
                    mvRotate.set(curAngle);

        // Spawn trail mote directly into pooled DOM slots (0 React re-renders!)
        if (now - lastTrailSpawn >= 170 && elapsed > 450 && durationMs - elapsed > 820) {
                      lastTrailSpawn = now;
                    const idx = trailCursorRef.current % TRAIL_POOL_SIZE;
                    trailCursorRef.current += 1;
                    const slot = trailSlotsRef.current[idx];
                    const trailPalette = isDarkModeActive() ? TRAIL_COLORS_DARK : TRAIL_COLORS_LIGHT;
                    const color = trailPalette[trailCursorRef.current % trailPalette.length];

                    slot.active = true;
                    slot.birth = now;
                    slot.x = liveX - sample.tx * 10 + randBetween(-3, 3);
                    slot.y = liveY - sample.ty * 10 + randBetween(-3, 3);
                    slot.vx = -sample.tx * 14 + randBetween(-5, 5);
                    slot.vy = -sample.ty * 14 - randBetween(3, 8);
                    slot.size = randBetween(3, 4.8);
                    slot.color = color;

                    const el = trailElRefs.current[idx];
                    if (el) {
                      el.style.width = `${slot.size}px`;
                    el.style.height = `${slot.size}px`;
                    el.style.backgroundColor = slot.color;
          }
        }

                    // Update pooled GPU trail motes inline
                    for (let i = 0; i < TRAIL_POOL_SIZE; i++) {
          const slot = trailSlotsRef.current[i];
                    if (!slot.active) continue;

                    const age = now - slot.birth;
                    const el = trailElRefs.current[i];
          if (age >= 750) {
                      slot.active = false;
                    if (el) el.style.opacity = '0';
          } else if (el) {
            const p = age / 750;
                    const px = slot.x + slot.vx * p;
                    const py = slot.y + slot.vy * p;
                    const scale = 1 - p * 0.72;
                    const opacity = (1 - p) * 0.85;
                    el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%) scale(${scale})`;
                    el.style.opacity = opacity.toFixed(3);
          }
        }

        if (s >= 1) {
                      rafRef.current = null;
                    resetTrailPool();
                    isVisibleRef.current = false;
                    setIsVisible(false);
                    scheduleVisit(false);
                    return;
        }

                    rafRef.current = window.requestAnimationFrame(step);
      };

                    rafRef.current = window.requestAnimationFrame(step);
    };

                    startFlightRef.current = startFlight;
                    scheduleVisit(true);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
                      clearSpawnTimer();
                    cancelFlightLoop();
                    resetTrailPool();
                    if (isVisibleRef.current) {
                      isVisibleRef.current = false;
                    setIsVisible(false);
        }
      } else if (!unmounted && !isDisabled) {
                      scheduleVisit(!hasVisitedOnceRef.current);
      }
    };

                    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
                      unmounted = true;
                    isVisibleRef.current = false;
                    startFlightRef.current = null;
                    document.removeEventListener('visibilitychange', handleVisibility);
                    clearSpawnTimer();
                    cancelFlightLoop();
                    clearBurstTimers();
                    resetTrailPool();
    };
  }, [
                    cancelFlightLoop,
                    clearBurstTimers,
                    clearSpawnTimer,
                    isDisabled,
                    mvOpacity,
                    mvRotate,
                    mvX,
                    mvY,
                    resetTrailPool,
                    scheduleVisit,
                    ]);

  const handleButterflyClick = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (!isVisibleRef.current) return;

    const cx = mvX.get();
    const cy = mvY.get();

    cancelFlightLoop();
    clearSpawnTimer();
    resetTrailPool();
    isVisibleRef.current = false;
    setIsVisible(false);

    const burstId = nextId();
    const burst = createShatterBurst(burstId, cx, cy);
    setBursts((prev) => [...prev, burst]);

    // Keep an invisible ghost-click shield at (cx, cy) briefly so mobile touchend->click
    // never falls through to quiz answers underneath right after butterfly unmounts
    const shieldTimer = window.setTimeout(() => {
      setBursts((prev) =>
        prev.map((item) => (item.id === burstId ? { ...item, shieldActive: false } : item))
      );
    }, 480);

    const cleanupTimer = window.setTimeout(() => {
      setBursts((prev) => prev.filter((item) => item.id !== burstId));
    }, 1850);
    burstTimersRef.current.push(shieldTimer, cleanupTimer);

    scheduleVisit(false);
  };

  if (isDisabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      {/* Pooled zero-re-render stardust trail specks */}
      {Array.from({ length: TRAIL_POOL_SIZE }, (_, i) => (
        <span
          key={`bf-pool-${i}`}
          ref={(el) => {
            trailElRefs.current[i] = el;
          }}
          style={{ opacity: 0, width: 3, height: 3, backgroundColor: '#FFFFFF' }}
          className="pointer-events-none fixed left-0 top-0 rounded-full shadow-[0_0_5px_1px_rgba(79,70,229,0.65)] dark:shadow-[0_0_6px_1px_rgba(196,181,253,0.9)]"
        />
      ))}

      {/* Main wandering luminous origami butterfly */}
      {isVisible && (
        <motion.div
          style={{
            left: -28,
            top: -28,
            x: mvX,
            y: mvY,
            rotate: mvRotate,
            opacity: mvOpacity,
          }}
          className="pointer-events-none absolute h-14 w-14 will-change-transform"
        >
          <button
            type="button"
            tabIndex={-1}
            onPointerDown={handleButterflyClick}
            onClick={handleButterflyClick}
            aria-label="Chạm vào bướm ánh sáng"
            title="Chạm để làm vỡ cánh bướm ánh sáng"
            className="pointer-events-auto flex h-full w-full touch-manipulation cursor-pointer items-center justify-center rounded-full focus-visible:outline-none"
          >
                            <OrigamiButterflySvg
                              leftWingRef={leftWingRef}
                              rightWingRef={rightWingRef}
                              coreGlowRef={coreGlowRef}
                            />
                          </button>
                        </motion.div>
                      )}

                      {/* Luminous shatter burst of mini origami butterflies, prism shards & stardust */}
                      {bursts.map((burst) => (
                        <div
                          key={`bf-burst-${burst.id}`}
                          style={{ left: burst.x, top: burst.y }}
                          className="pointer-events-none absolute"
                        >
                          {burst.shieldActive && (
                            <div
                              onPointerDown={(e) => {
                                e.stopPropagation();
                              }}
                              onPointerUp={(e) => {
                                e.stopPropagation();
                              }}
                              onMouseUp={(e) => {
                                e.stopPropagation();
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              className="pointer-events-auto absolute -left-9 -top-9 z-10 h-18 w-18 touch-manipulation rounded-full"
                            />
                          )}
                          {/* Core prism starburst flash */}
                          <motion.svg
                            viewBox="0 0 64 64"
                            aria-hidden="true"
                            initial={{ scale: 0.25, opacity: 1, rotate: -18 }}
                            animate={{ scale: 1.55, opacity: 0, rotate: 24 }}
                            transition={{ duration: 0.38, ease: 'easeOut' }}
                            className="pointer-events-none absolute -left-8 -top-8 h-16 w-16 overflow-visible"
                          >
                            <polygon
                              points="32,4 36,28 60,32 36,36 32,60 28,36 4,32 28,28"
                              className="fill-[#4338CA] dark:fill-[#FFFFFF]"
                            />
                          </motion.svg>

                          {/* Expanding thin luminous shockwave ring */}
                          <motion.span
                            aria-hidden="true"
                            initial={{ scale: 0.3, opacity: 0.9 }}
                            animate={{ scale: 2.7, opacity: 0 }}
                            transition={{ duration: 0.58, ease: 'easeOut' }}
                            className="pointer-events-none absolute -left-6 -top-6 h-12 w-12 rounded-full border-2 border-[#4F46E5] shadow-[0_0_10px_rgba(124,58,237,0.65)] dark:border-[#67E8F9] dark:shadow-[0_0_12px_rgba(167,139,250,0.85)]"
                          />

                          {/* Scattered flock of 6 glowing mini origami butterflies */}
                          {burst.minis.map((mini) => (
                            <motion.div
                              key={`bf-mini-${burst.id}-${mini.id}`}
                              initial={{
                                x: -12,
                                y: -12,
                                scale: mini.scale * 0.65,
                                rotate: mini.startRot,
                                opacity: 1,
                              }}
                              animate={{
                                x: [-12, mini.midX - 12, mini.tx - 12],
                                y: [-12, mini.midY - 12, mini.ty - 12],
                                scale: [mini.scale * 0.7, mini.scale, mini.scale * 0.45],
                                rotate: [mini.startRot, (mini.startRot + mini.endRot) / 2, mini.endRot],
                                opacity: [1, 1, 0],
                              }}
                              transition={{
                                duration: mini.duration,
                                delay: mini.delay,
                                times: [0, 0.48, 1],
                                ease: 'easeOut',
                              }}
                              className="pointer-events-none absolute"
                            >
                              <MiniOrigamiButterflySvg
                                variant={mini.variant}
                                flapDuration={0.26 + (mini.id % 3) * 0.04}
                              />
                            </motion.div>
                          ))}

                          {/* Sharp angular crystal wing shards */}
                          {burst.shards.map((shard) => (
                            <motion.svg
                              key={`bf-shard-${burst.id}-${shard.id}`}
                              viewBox="-10 -10 20 20"
                              aria-hidden="true"
                              initial={{ x: -8, y: -8, scale: shard.scale * 0.85, rotate: 0, opacity: 1 }}
                              animate={{
                                x: shard.tx - 8,
                                y: shard.ty - 8,
                                scale: [shard.scale, shard.scale * 0.85, 0.2],
                                rotate: shard.rot,
                                opacity: [1, 0.9, 0],
                              }}
                              transition={{
                                duration: shard.duration,
                                delay: shard.delay,
                                ease: 'easeOut',
                              }}
                              className="pointer-events-none absolute h-4 w-4 overflow-visible"
                            >
                              <polygon
                                points={shard.points}
                                fill={shard.color}
                                stroke={shard.strokeColor}
                                strokeOpacity="0.45"
                                strokeWidth="0.55"
                                strokeLinejoin="round"
                              />
                            </motion.svg>
                          ))}

                          {/* Sparkling stardust specks & 4-point glints */}
                          {burst.motes.map((mote) =>
                            mote.isStar ? (
                              <motion.svg
                                key={`bf-mote-${burst.id}-${mote.id}`}
                                viewBox="0 0 16 16"
                                aria-hidden="true"
                                initial={{ x: -6, y: -6, scale: 0.4, opacity: 1, rotate: 0 }}
                                animate={{
                                  x: mote.tx - 6,
                                  y: mote.ty - 6,
                                  scale: [0.6, 1.25, 0],
                                  opacity: [1, 0.95, 0],
                                  rotate: 65,
                                }}
                                transition={{
                                  duration: mote.duration,
                                  delay: mote.delay,
                                  ease: 'easeOut',
                                }}
                                className="pointer-events-none absolute h-3 w-3 overflow-visible"
                              >
                                <polygon points="8,1 9.5,6.5 15,8 9.5,9.5 8,15 6.5,9.5 1,8 6.5,6.5" fill={mote.color} />
                              </motion.svg>
                            ) : (
                              <motion.span
                                key={`bf-mote-${burst.id}-${mote.id}`}
                                initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                                animate={{
                                  x: mote.tx,
                                  y: mote.ty,
                                  scale: [1, 1.2, 0.1],
                                  opacity: [1, 0.9, 0],
                                }}
                                transition={{
                                  duration: mote.duration,
                                  delay: mote.delay,
                                  ease: 'easeOut',
                                }}
                                style={{
                                  width: mote.size,
                                  height: mote.size,
                                  backgroundColor: mote.color,
                                }}
                                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_5px_1px_rgba(79,70,229,0.7)] dark:shadow-[0_0_6px_1px_rgba(103,232,249,0.9)]"
                              />
                            )
                          )}
                        </div>
                      ))}
                    </div>
                    );
});

SakugaLuminousButterfly.displayName = 'SakugaLuminousButterfly';
export default SakugaLuminousButterfly;
