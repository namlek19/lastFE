import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { StudyMode } from '../types/quiz';

export interface SakugaOrigamiPetalsProps {
  mode: StudyMode;
}

type PetalVariant = 0 | 1 | 2;

interface PetalSpec {
  id: number;
  variant: PetalVariant;
  startX: number;
  startY: number;
  endY: number;
  driftX: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  rotXSpeed: number;
  rotYSpeed: number;
  rotZSpeed: number;
  startRotZ: number;
  scale: number;
  delayMs: number;
  durationMs: number;
}

interface PetalShowerState {
  id: number;
  petals: PetalSpec[];
  headerSafeTop: number;
  maxEndMs: number;
}

// Strictly rarer than SakugaLuminousButterfly (25–45s first visit, 3–6 min cooldown)
const FIRST_VISIT_MIN_MS = 75000;
const FIRST_VISIT_MAX_MS = 120000;
const COOLDOWN_MIN_MS = 420000;
const COOLDOWN_MAX_MS = 660000;

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
        return 18;
      }
      return Math.min(Math.round(headerRect.bottom + 12), Math.round(vh * 0.45));
    }
  }
  return vw >= 768 ? 80 : 176;
}

function buildPetalShower(showerId: number): PetalShowerState {
  const { w: vw, h: vh } = getViewportSize();
  const isMobile = vw < 768;
  const count = isMobile ? 10 : 14;
  const windDir = Math.random() < 0.5 ? 1 : -1;
  const headerSafeTop = getHeaderSafeTop(vw, vh);

  const petals: PetalSpec[] = [];
  let maxEndMs = 0;

  for (let i = 0; i < count; i++) {
    const stepFrac = (i + randBetween(0.15, 0.85)) / count;
    // Slight wind-upwind horizontal bias so petals sweep cleanly across screen
    const biasOffset = windDir > 0 ? -vw * 0.08 : vw * 0.08;
    const startX = clamp(
      Math.round(stepFrac * vw + biasOffset + randBetween(-40, 40)),
      12,
      Math.max(24, vw - 12)
    );
    const delayMs = Math.round((i / Math.max(1, count - 1)) * 3100 + randBetween(0, 500));
    const durationMs = Math.round(randBetween(5800, 8600));
    maxEndMs = Math.max(maxEndMs, delayMs + durationMs);

    petals.push({
      id: i,
      variant: (i % 3) as PetalVariant,
      startX,
      startY: -28,
      endY: vh + 36,
      driftX: windDir * (isMobile ? randBetween(35, 85) : randBetween(55, 145)),
      swayAmp: isMobile ? randBetween(12, 26) : randBetween(16, 42),
      swayFreq: randBetween(0.9, 1.7),
      phase: randBetween(0, Math.PI * 2),
      rotXSpeed: randBetween(1.4, 2.8) * (Math.random() < 0.5 ? 1 : -1),
      rotYSpeed: randBetween(35, 85) * (Math.random() < 0.5 ? 1 : -1),
      rotZSpeed: randBetween(18, 48) * windDir,
      startRotZ: randBetween(-35, 35),
      scale: randBetween(0.72, 1.15),
      delayMs,
      durationMs,
    });
  }

  return { id: showerId, petals, headerSafeTop, maxEndMs };
}

const PETAL_VARIANT_CLASSES: Record<PetalVariant, { left: string; right: string }> = {
  0: {
    left: 'fill-[#BE185D] dark:fill-[#FFFFFF]',
    right: 'fill-[#F43F5E] dark:fill-[#F9A8D4]',
  },
  1: {
    left: 'fill-[#9D174D] dark:fill-[#FCE7F3]',
    right: 'fill-[#DB2777] dark:fill-[#F472B6]',
  },
  2: {
    left: 'fill-[#E11D48] dark:fill-[#FFFFFF]',
    right: 'fill-[#F472B6] dark:fill-[#DDD6FE]',
  },
};

/**
 * Faceted geometric origami cherry blossom petal (100% Zero-Gradient).
 * Light Mode uses rich berry-rose tones for crisp contrast on Warm Parchment;
 * Dark Mode uses luminous pearl-white, sakura-pink & lilac facets.
 */
const OrigamiPetalSvg: React.FC<{ variant: PetalVariant; sizeClass?: string }> = memo(
  ({ variant, sizeClass = 'h-6 w-5' }) => {
    const colors = PETAL_VARIANT_CLASSES[variant];
    const strokeClass = 'stroke-[#FCE7F3]/55 dark:[stroke:none]';

    return (
      <svg
        viewBox="0 0 24 28"
        aria-hidden="true"
        className={`${sizeClass} overflow-visible drop-shadow-[0_0_4px_rgba(219,39,119,0.45)] drop-shadow-[0_0_9px_rgba(244,63,94,0.28)] dark:drop-shadow-[0_0_4px_rgba(255,255,255,0.9)] dark:drop-shadow-[0_0_11px_rgba(244,114,182,0.75)] dark:drop-shadow-[0_0_18px_rgba(196,181,253,0.45)]`}
      >
        <polygon
          points="12,8 3.5,3.5 2,15"
          className={`${colors.left} ${strokeClass}`}
          strokeWidth="0.45"
          strokeLinejoin="round"
        />
        <polygon
          points="12,8 2,15 12,26"
          className={`${colors.left} ${strokeClass}`}
          strokeWidth="0.45"
          strokeLinejoin="round"
        />
        <polygon
          points="12,8 20.5,3.5 22,15"
          className={`${colors.right} ${strokeClass}`}
          strokeWidth="0.45"
          strokeLinejoin="round"
        />
        <polygon
          points="12,8 22,15 12,26"
          className={`${colors.right} ${strokeClass}`}
          strokeWidth="0.45"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
);

OrigamiPetalSvg.displayName = 'OrigamiPetalSvg';

export const SakugaOrigamiPetals: React.FC<SakugaOrigamiPetalsProps> = ({ mode }) => {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const isDisabled = mode === 'exam' || prefersReducedMotion;

  const [shower, setShower] = useState<PetalShowerState | null>(null);
  const [showBlessing, setShowBlessing] = useState(false);

  const isActiveRef = useRef(false);
  const hasVisitedOnceRef = useRef(false);
  const showerIdRef = useRef(1);

  const spawnTimerRef = useRef<number | null>(null);
  const blessingTimersRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const petalElRefs = useRef<Array<HTMLDivElement | null>>([]);
  const blessingWrapRef = useRef<HTMLDivElement>(null);
  const startShowerRef = useRef<(() => void) | null>(null);

  const clearSpawnTimer = useCallback(() => {
    if (spawnTimerRef.current !== null) {
      window.clearTimeout(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }
  }, []);

  const clearBlessingTimers = useCallback(() => {
    for (const id of blessingTimersRef.current) {
      window.clearTimeout(id);
    }
    blessingTimersRef.current = [];
  }, []);

  const cancelShowerLoop = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const scheduleVisit = useCallback(
    (isInitial: boolean) => {
      clearSpawnTimer();
      if (isDisabled || document.visibilityState === 'hidden' || isActiveRef.current) return;
      const delay = isInitial
        ? Math.round(randBetween(FIRST_VISIT_MIN_MS, FIRST_VISIT_MAX_MS))
        : Math.round(randBetween(COOLDOWN_MIN_MS, COOLDOWN_MAX_MS));

      spawnTimerRef.current = window.setTimeout(() => {
        spawnTimerRef.current = null;
        startShowerRef.current?.();
      }, delay);
    },
    [clearSpawnTimer, isDisabled]
  );

  useEffect(() => {
    if (isDisabled) {
      clearSpawnTimer();
      clearBlessingTimers();
      cancelShowerLoop();
      isActiveRef.current = false;
      setShower(null);
      setShowBlessing(false);
      return;
    }

    let unmounted = false;

    const startShower = () => {
      if (unmounted || isDisabled || document.visibilityState === 'hidden') return;
      cancelShowerLoop();
      clearBlessingTimers();

      showerIdRef.current += 1;
      const nextShower = buildPetalShower(showerIdRef.current);
      petalElRefs.current = new Array(nextShower.petals.length).fill(null);

      isActiveRef.current = true;
      hasVisitedOnceRef.current = true;
      setShower(nextShower);

      const showTimer = window.setTimeout(() => {
        if (!unmounted && isActiveRef.current) {
          setShowBlessing(true);
        }
      }, 250);
      const hideTimer = window.setTimeout(() => {
        if (!unmounted) {
          setShowBlessing(false);
        }
      }, 5850);
      blessingTimersRef.current.push(showTimer, hideTimer);

      const startTime = performance.now();

      const step = (now: number) => {
        if (unmounted || !isActiveRef.current) return;

        const elapsed = now - startTime;

        for (let i = 0; i < nextShower.petals.length; i++) {
          const el = petalElRefs.current[i];
          if (!el) continue;

          const petal = nextShower.petals[i];
          const petalElapsed = elapsed - petal.delayMs;
          if (petalElapsed <= 0 || petalElapsed >= petal.durationMs) {
            el.style.opacity = '0';
            continue;
          }

          const p = petalElapsed / petal.durationMs;
          const y = petal.startY + p * (petal.endY - petal.startY);
          const sway = Math.sin(petalElapsed * 0.001 * petal.swayFreq + petal.phase) * petal.swayAmp;
          const x = petal.startX + p * petal.driftX + sway;

          const fadeIn = Math.min(1, p / 0.1);
          const fadeOut = Math.min(1, (1 - p) / 0.14);
          const opacity = Math.min(fadeIn, fadeOut) * 0.94;

          const tSec = petalElapsed * 0.001;
          const rx = Math.sin(tSec * petal.rotXSpeed + petal.phase) * 48;
          const ry = tSec * petal.rotYSpeed;
          const rz = petal.startRotZ + tSec * petal.rotZSpeed;

          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) perspective(90px) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) rotateZ(${rz.toFixed(1)}deg) scale(${petal.scale.toFixed(2)})`;
          el.style.opacity = opacity.toFixed(3);
        }

        if (elapsed >= nextShower.maxEndMs) {
          rafRef.current = null;
          isActiveRef.current = false;
          setShowBlessing(false);
          setShower(null);
          scheduleVisit(false);
          return;
        }

        rafRef.current = window.requestAnimationFrame(step);
      };

      rafRef.current = window.requestAnimationFrame(step);
    };

    startShowerRef.current = startShower;
    scheduleVisit(true);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearSpawnTimer();
        clearBlessingTimers();
        cancelShowerLoop();
        if (isActiveRef.current) {
          isActiveRef.current = false;
          setShowBlessing(false);
          setShower(null);
        }
      } else if (!unmounted && !isDisabled) {
        scheduleVisit(!hasVisitedOnceRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unmounted = true;
      isActiveRef.current = false;
      startShowerRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
      clearSpawnTimer();
      clearBlessingTimers();
      cancelShowerLoop();
    };
  }, [cancelShowerLoop, clearBlessingTimers, clearSpawnTimer, isDisabled, scheduleVisit]);

  useEffect(() => {
    if (!shower) return;

    const syncBlessingTop = () => {
      const el = blessingWrapRef.current;
      if (!el) return;
      const { w: vw, h: vh } = getViewportSize();
      el.style.top = `${getHeaderSafeTop(vw, vh) + 4}px`;
    };

    window.addEventListener('scroll', syncBlessingTop, { passive: true });
    return () => {
      window.removeEventListener('scroll', syncBlessingTop);
    };
  }, [shower]);

  if (isDisabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      {/* Falling folded origami blossom petals */}
      {shower?.petals.map((petal, idx) => (
        <div
          key={`sakura-petal-${shower.id}-${petal.id}`}
          ref={(el) => {
            petalElRefs.current[idx] = el;
          }}
          style={{ opacity: 0, left: 0, top: 0 }}
          className="pointer-events-none fixed left-0 top-0 will-change-transform"
        >
          <OrigamiPetalSvg variant={petal.variant} />
        </div>
      ))}

      {/* Delicate floating "học tốt nha" blessing pill below Header */}
      <AnimatePresence>
        {showBlessing && shower && (
          <motion.div
            ref={blessingWrapRef}
            key={`sakura-blessing-${shower.id}`}
            style={{ top: shower.headerSafeTop + 4 }}
            initial={{ opacity: 0, y: -8, scale: 0.94 }}
            animate={{ opacity: 1, y: [0, 3, 0], scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{
              opacity: { duration: 0.42, ease: 'easeOut' },
              scale: { duration: 0.42, ease: 'easeOut' },
              y: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="pointer-events-none fixed left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-[#F43F5E]/40 bg-[#FAF9F5]/95 px-4 py-1.5 text-xs font-bold tracking-wide text-[#9F1239] shadow-[3px_3px_0_0_#FECDD3,0_10px_24px_-8px_rgba(190,24,93,0.18)] dark:border-[#F9A8D4]/45 dark:bg-[#1E221F]/92 dark:text-[#FCE7F3] dark:shadow-[0_0_18px_rgba(244,114,182,0.3),3px_3px_0_0_#831843] sm:text-sm"
          >
            <OrigamiPetalSvg variant={0} sizeClass="h-[18px] w-[15px] shrink-0" />
            <span>học tốt nha</span>
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3 shrink-0">
              <polygon
                points="8,1 9.8,6.2 15,8 9.8,9.8 8,15 6.2,9.8 1,8 6.2,6.2"
                className="fill-[#F43F5E] dark:fill-[#F9A8D4]"
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
