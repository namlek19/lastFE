import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { StudyMode } from '../types/quiz';

export interface SakugaLuminousButterflyProps {
  mode: StudyMode;
}

interface Vec2 {
  x: number;
  y: number;
}

interface TrailSpark {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  dx: number;
  dy: number;
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
  minis: ShatterMiniButterfly[];
  shards: ShatterShard[];
  motes: ShatterMote[];
}

const FIRST_VISIT_MIN_MS = 45000;
const FIRST_VISIT_MAX_MS = 90000;
const COOLDOWN_MIN_MS = 180000;
const COOLDOWN_MAX_MS = 360000;

const SHARD_SHAPES = [
  '0,-6 5,2 -2,5',
  '0,-7 4,0 0,7 -4,0',
  '-4,-4 6,-1 1,6',
  '0,-6 6,4 -4,2',
] as const;

const SHARD_PALETTE = [
  { color: '#FFFFFF', strokeColor: '#0891B2' },
  { color: '#67E8F9', strokeColor: '#0E7490' },
  { color: '#C4B5FD', strokeColor: '#7C3AED' },
  { color: '#F472B6', strokeColor: '#BE185D' },
] as const;

const TRAIL_COLORS = ['#FFFFFF', '#A5F3FC', '#E9D5FF', '#FBCFE8'] as const;

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

function buildWanderingPath(): Vec2[] {
  const { w: vw, h: vh } = getViewportSize();
  const minY = getHeaderSafeTop(vw, vh) + 12;
  const maxY = Math.max(minY + 90, Math.round(vh * (vw < 768 ? 0.72 : 0.84)));

  const enterFromLeft = Math.random() < 0.5;
  const exitRight = enterFromLeft ? Math.random() < 0.8 : Math.random() < 0.2;

  const startX = enterFromLeft ? -56 : vw + 56;
  const endX = exitRight ? vw + 56 : -56;
  const interiorCount = Math.floor(randBetween(4, 6)); // 4 or 5 interior points -> 6 or 7 total

  const points: Vec2[] = [
    { x: startX, y: Math.round(randBetween(minY, maxY)) },
  ];

  const minSafeX = vw < 768 ? 28 : 56;
  const maxSafeX = Math.max(minSafeX + 40, vw - minSafeX);

  for (let i = 0; i < interiorCount; i++) {
    const t = (i + 1) / (interiorCount + 1);
    const baseSpanX = enterFromLeft
      ? minSafeX + t * (maxSafeX - minSafeX)
      : maxSafeX - t * (maxSafeX - minSafeX);
    // Add wandering backtrack/swoop variation
    const jitterX = randBetween(-vw * 0.22, vw * 0.22);
    const x = Math.round(clamp(baseSpanX + jitterX, minSafeX, maxSafeX));
    const y = Math.round(randBetween(minY, maxY));
    points.push({ x, y });
  }

  points.push({ x: endX, y: Math.round(randBetween(minY, maxY)) });
  return points;
}

function createShatterBurst(id: number, x: number, y: number): ShatterBurst {
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
    const swatch = SHARD_PALETTE[i % SHARD_PALETTE.length];
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
      size: randBetween(3, 6.5),
      duration: randBetween(0.75, 1.35),
      delay: randBetween(0, 0.1),
      color: TRAIL_COLORS[i % TRAIL_COLORS.length],
      isStar: i % 3 === 0,
    };
  });

  return { id, x, y, minis, shards, motes };
}

/**
 * Luminous geometric crystal/origami butterfly matching faceted folded wings
 * with flat facet colors (100% Zero-Gradient) and layered CSS drop-shadow glow.
 */
const OrigamiButterflySvg: React.FC<{ prefersReducedMotion: boolean }> = ({
  prefersReducedMotion,
}) => (
  <div className="relative flex h-11 w-12 items-center justify-center">
    {/* Layered luminous aura behind wings (flat alpha blur discs, Zero-Gradient) */}
    <motion.span
      aria-hidden="true"
      animate={
        prefersReducedMotion
          ? { opacity: 0.45 }
          : { opacity: [0.32, 0.62, 0.32], scale: [0.92, 1.12, 0.92] }
      }
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      className="pointer-events-none absolute h-10 w-10 rounded-full bg-[#67E8F9]/35 blur-md dark:bg-[#67E8F9]/30"
    />
    <motion.span
      aria-hidden="true"
      animate={
        prefersReducedMotion
          ? { opacity: 0.5 }
          : { opacity: [0.42, 0.78, 0.42], scale: [0.9, 1.08, 0.9] }
      }
      transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
      className="pointer-events-none absolute h-6 w-6 rounded-full bg-[#F5D0FE]/45 blur-[3px] dark:bg-[#E879F9]/35"
    />

    <svg
      viewBox="0 0 48 44"
      aria-hidden="true"
      className="relative h-11 w-12 overflow-visible drop-shadow-[0_0_5px_rgba(14,165,233,0.75)] drop-shadow-[0_0_12px_rgba(139,92,246,0.55)] drop-shadow-[0_0_20px_rgba(244,114,182,0.4)] dark:drop-shadow-[0_0_7px_rgba(103,232,249,0.95)] dark:drop-shadow-[0_0_16px_rgba(167,139,250,0.85)] dark:drop-shadow-[0_0_28px_rgba(244,114,182,0.55)]"
    >
      {/* Left faceted origami wings */}
      <motion.g
        style={{ transformOrigin: '24px 22px' }}
        animate={
          prefersReducedMotion
            ? undefined
            : { scaleX: [1, 0.24, 1], skewY: [0, -7, 0] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 0.36, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        {/* Forewing outer ice-cyan & bright crystal facets */}
        <polygon
          points="24,18 4,6 9,22"
          fill="#E0F2FE"
          className="stroke-[#0891B2]/70 dark:stroke-[#67E8F9]/80"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
        <polygon
          points="24,18 9,22 23,23"
          fill="#FFFFFF"
          className="stroke-[#0891B2]/65 dark:stroke-[#67E8F9]/75"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <polygon
          points="24,18 4,6 15,8"
          fill="#A5F3FC"
          className="stroke-[#0891B2]/65 dark:stroke-[#67E8F9]/75"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <polygon
          points="24,18 15,8 23,23"
          fill="#EDE9FE"
          className="stroke-[#7C3AED]/60 dark:stroke-[#C4B5FD]/75"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        {/* Swept triangular hindwing + signature rose-pink crystal glint */}
        <polygon
          points="23,23 11,24 14,39"
          fill="#F472B6"
          className="stroke-[#BE185D]/65 dark:stroke-[#F9A8D4]/80"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
        <polygon
          points="23,23 14,39 22,32"
          fill="#FBCFE8"
          className="stroke-[#7C3AED]/55 dark:stroke-[#C4B5FD]/70"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
      </motion.g>

      {/* Right faceted origami wings */}
      <motion.g
        style={{ transformOrigin: '24px 22px' }}
        animate={
          prefersReducedMotion
            ? undefined
            : { scaleX: [1, 0.24, 1], skewY: [0, 7, 0] }
        }
        transition={
          prefersReducedMotion
            ? undefined
            : { duration: 0.36, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        <polygon
          points="24,18 44,6 39,22"
          fill="#E0F2FE"
          className="stroke-[#0891B2]/70 dark:stroke-[#67E8F9]/80"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
        <polygon
          points="24,18 39,22 25,23"
          fill="#FFFFFF"
          className="stroke-[#0891B2]/65 dark:stroke-[#67E8F9]/75"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <polygon
          points="24,18 44,6 33,8"
          fill="#A5F3FC"
          className="stroke-[#0891B2]/65 dark:stroke-[#67E8F9]/75"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <polygon
          points="24,18 33,8 25,23"
          fill="#C4B5FD"
          className="stroke-[#7C3AED]/60 dark:stroke-[#C4B5FD]/75"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        {/* Swept triangular hindwing */}
        <polygon
          points="25,23 37,24 34,39"
          fill="#EDE9FE"
          className="stroke-[#7C3AED]/60 dark:stroke-[#C4B5FD]/75"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
        <polygon
          points="25,23 34,39 26,32"
          fill="#FFFFFF"
          className="stroke-[#0891B2]/60 dark:stroke-[#67E8F9]/75"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
      </motion.g>

      {/* Luminous central prism spine & antennae */}
      <polygon
        points="24,11 25.6,22 24,33 22.4,22"
        fill="#FFFFFF"
        className="stroke-[#0891B2]/80 dark:stroke-[#67E8F9]"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path
        d="M23.5 12 L20 6 M24.5 12 L28 6"
        fill="none"
        className="stroke-[#0891B2]/85 dark:stroke-[#FFFFFF]"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <circle cx="20" cy="6" r="1" fill="#A5F3FC" />
      <circle cx="28" cy="6" r="1" fill="#FBCFE8" />
    </svg>
  </div>
);

const MINI_VARIANT_COLORS: Record<0 | 1 | 2, { wing: string; stroke: string }> = {
  0: { wing: '#A5F3FC', stroke: '#0891B2' },
  1: { wing: '#DDD6FE', stroke: '#7C3AED' },
  2: { wing: '#FBCFE8', stroke: '#BE185D' },
};

const MiniOrigamiButterflySvg: React.FC<{ variant: 0 | 1 | 2; flapDuration: number }> = ({
  variant,
  flapDuration,
}) => {
  const palette = MINI_VARIANT_COLORS[variant];

  return (
    <svg
      viewBox="0 0 28 26"
      aria-hidden="true"
      className="h-6 w-6 overflow-visible drop-shadow-[0_0_5px_rgba(103,232,249,0.85)] drop-shadow-[0_0_10px_rgba(167,139,250,0.65)]"
    >
      <motion.g
        style={{ transformOrigin: '14px 13px' }}
        animate={{ scaleX: [1, 0.2, 1] }}
        transition={{ duration: flapDuration, repeat: Infinity, ease: 'easeInOut' }}
      >
        <polygon
          points="14,11 2,4 7,15"
          fill={palette.wing}
          stroke={palette.stroke}
          strokeOpacity="0.65"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <polygon
          points="14,14 7,15 10,23"
          fill="#FFFFFF"
          stroke={palette.stroke}
          strokeOpacity="0.6"
          strokeWidth="0.65"
          strokeLinejoin="round"
        />
      </motion.g>
      <motion.g
        style={{ transformOrigin: '14px 13px' }}
        animate={{ scaleX: [1, 0.2, 1] }}
        transition={{ duration: flapDuration, repeat: Infinity, ease: 'easeInOut' }}
      >
        <polygon
          points="14,11 26,4 21,15"
          fill="#FFFFFF"
          stroke={palette.stroke}
          strokeOpacity="0.65"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <polygon
          points="14,14 21,15 18,23"
          fill={palette.wing}
          stroke={palette.stroke}
          strokeOpacity="0.6"
          strokeWidth="0.65"
          strokeLinejoin="round"
        />
      </motion.g>
      <polygon points="14,7 15,13 14,19 13,13" fill="#FFFFFF" />
    </svg>
  );
};

export const SakugaLuminousButterfly: React.FC<SakugaLuminousButterflyProps> = ({ mode }) => {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const isDisabled = mode === 'exam' || prefersReducedMotion;

  const [isVisible, setIsVisible] = useState(false);
  const [trails, setTrails] = useState<TrailSpark[]>([]);
  const [bursts, setBursts] = useState<ShatterBurst[]>([]);

  const mvX = useMotionValue(-100);
  const mvY = useMotionValue(-100);
  const mvRotate = useMotionValue(0);

  const isVisibleRef = useRef(false);
  isVisibleRef.current = isVisible;

  const spawnTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const trailTimersRef = useRef<number[]>([]);
  const burstTimersRef = useRef<number[]>([]);
  const idCounterRef = useRef(1);
  const startFlightRef = useRef<(() => void) | null>(null);

  const nextId = () => {
    idCounterRef.current += 1;
    return idCounterRef.current;
  };

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

  const clearTransientTimers = useCallback(() => {
    for (const id of trailTimersRef.current) {
      window.clearTimeout(id);
    }
    trailTimersRef.current = [];
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

  const spawnTrailSpark = useCallback((x: number, y: number) => {
    const id = nextId();
    const spark: TrailSpark = {
      id,
      x: x + randBetween(-6, 6),
      y: y + randBetween(-6, 6),
      size: randBetween(2.5, 4.5),
      color: TRAIL_COLORS[id % TRAIL_COLORS.length],
      dx: randBetween(-8, 8),
      dy: randBetween(-12, 4),
    };

    setTrails((prev) => [...prev.slice(-7), spark]);

    const removeTimer = window.setTimeout(() => {
      setTrails((prev) => prev.filter((item) => item.id !== id));
    }, 850);
    trailTimersRef.current.push(removeTimer);
  }, []);

  useEffect(() => {
    if (isDisabled) {
      clearSpawnTimer();
      cancelFlightLoop();
      clearTransientTimers();
      setIsVisible(false);
      setTrails([]);
      setBursts([]);
      return;
    }

    let unmounted = false;

    const startFlight = () => {
      if (unmounted || isDisabled || document.visibilityState === 'hidden') return;
      cancelFlightLoop();

      const path = buildWanderingPath();
      const durationMs = randBetween(11500, 16500);
      const startTime = performance.now();
      let lastTrailTime = startTime;

      const initialPos = sampleSpline(path, 0);
      const lookAhead0 = sampleSpline(path, 0.01);
      const initialAngle =
        Math.atan2(lookAhead0.y - initialPos.y, lookAhead0.x - initialPos.x) * (180 / Math.PI) +
        90;

      let curAngle = initialAngle;
      mvX.set(initialPos.x);
      mvY.set(initialPos.y);
      mvRotate.set(curAngle);
      setIsVisible(true);

      const step = (now: number) => {
        if (unmounted || !isVisibleRef.current) return;

        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);

        const pos = sampleSpline(path, t);
        const bobY = Math.sin(elapsed * 0.0065) * 9;
        const flutterX = Math.cos(elapsed * 0.0048) * 4;
        const liveX = pos.x + flutterX;
        const liveY = pos.y + bobY;

        // Instantaneous tangent with shortest-path angle unwrap to prevent 360° flip seams
        const nextT = Math.min(1, t + 0.014);
        const nextPos = sampleSpline(path, nextT);
        const nextElapsed = nextT * durationMs;
        const nextX = nextPos.x + Math.cos(nextElapsed * 0.0048) * 4;
        const nextY = nextPos.y + Math.sin(nextElapsed * 0.0065) * 9;
        const vx = nextX - liveX;
        const vy = nextY - liveY;

        if (Math.hypot(vx, vy) > 0.08) {
          const targetDeg = Math.atan2(vy, vx) * (180 / Math.PI) + 90;
          const deltaDeg = ((targetDeg - curAngle + 540) % 360) - 180;
          curAngle += deltaDeg * 0.14;
        }

        mvX.set(liveX);
        mvY.set(liveY);
        mvRotate.set(curAngle);

        if (now - lastTrailTime >= 200 && t > 0.04 && t < 0.96) {
          lastTrailTime = now;
          spawnTrailSpark(liveX, liveY);
        }

        if (t >= 1) {
          rafRef.current = null;
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
        if (isVisibleRef.current) {
          setIsVisible(false);
        }
      } else if (!unmounted && !isDisabled) {
        scheduleVisit(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unmounted = true;
      startFlightRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
      clearSpawnTimer();
      cancelFlightLoop();
      clearTransientTimers();
    };
  }, [
    cancelFlightLoop,
    clearSpawnTimer,
    clearTransientTimers,
    isDisabled,
    mvRotate,
    mvX,
    mvY,
    scheduleVisit,
    spawnTrailSpark,
  ]);

  const handleButterflyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isVisibleRef.current) return;

    const cx = mvX.get();
    const cy = mvY.get();

    cancelFlightLoop();
    clearSpawnTimer();
    setIsVisible(false);

    const burstId = nextId();
    const burst = createShatterBurst(burstId, cx, cy);
    setBursts((prev) => [...prev, burst]);

    const cleanupTimer = window.setTimeout(() => {
      setBursts((prev) => prev.filter((item) => item.id !== burstId));
    }, 1850);
    burstTimersRef.current.push(cleanupTimer);

    scheduleVisit(false);
  };

  if (isDisabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      {/* Luminous stardust trail left behind the butterfly */}
      <AnimatePresence>
        {trails.map((spark) => (
          <motion.span
            key={`bf-trail-${spark.id}`}
            initial={{ opacity: 0.9, scale: 1, x: 0, y: 0 }}
            animate={{ opacity: 0, scale: 0.25, x: spark.dx, y: spark.dy }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              left: spark.x,
              top: spark.y,
              width: spark.size,
              height: spark.size,
              backgroundColor: spark.color,
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full drop-shadow-[0_0_5px_rgba(103,232,249,0.9)]"
          />
        ))}
      </AnimatePresence>

      {/* Main wandering luminous origami butterfly */}
      {isVisible && (
        <motion.div
          style={{ left: 0, top: 0, x: mvX, y: mvY, rotate: mvRotate }}
          className="pointer-events-none absolute"
        >
          <button
            type="button"
            tabIndex={-1}
            onClick={handleButterflyClick}
            aria-label="Chạm vào bướm ánh sáng"
            title="Chạm để làm vỡ cánh bướm ánh sáng"
            className="pointer-events-auto flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none"
          >
            <OrigamiButterflySvg prefersReducedMotion={prefersReducedMotion} />
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
          {/* Core prism starburst flash */}
          <motion.svg
            viewBox="0 0 64 64"
            aria-hidden="true"
            initial={{ scale: 0.25, opacity: 1, rotate: -18 }}
            animate={{ scale: 1.55, opacity: 0, rotate: 24 }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
            className="pointer-events-none absolute -left-8 -top-8 h-16 w-16 overflow-visible drop-shadow-[0_0_12px_rgba(103,232,249,0.95)]"
          >
            <polygon
              points="32,4 36,28 60,32 36,36 32,60 28,36 4,32 28,28"
              fill="#FFFFFF"
            />
          </motion.svg>

          {/* Expanding thin luminous shockwave ring */}
          <motion.span
            aria-hidden="true"
            initial={{ scale: 0.3, opacity: 0.9 }}
            animate={{ scale: 2.7, opacity: 0 }}
            transition={{ duration: 0.58, ease: 'easeOut' }}
            className="pointer-events-none absolute -left-6 -top-6 h-12 w-12 rounded-full border-2 border-[#67E8F9] drop-shadow-[0_0_10px_rgba(167,139,250,0.85)]"
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
                flapDuration={0.22 + (mini.id % 3) * 0.04}
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
              className="pointer-events-none absolute h-4 w-4 overflow-visible drop-shadow-[0_0_6px_rgba(103,232,249,0.85)]"
            >
              <polygon
                points={shard.points}
                fill={shard.color}
                stroke={shard.strokeColor}
                strokeOpacity="0.55"
                strokeWidth="0.6"
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
                className="pointer-events-none absolute h-3 w-3 overflow-visible drop-shadow-[0_0_6px_rgba(255,255,255,0.95)]"
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
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full drop-shadow-[0_0_6px_rgba(103,232,249,0.95)]"
              />
            )
          )}
        </div>
      ))}
    </div>
  );
};
